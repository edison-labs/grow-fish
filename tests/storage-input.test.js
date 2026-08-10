'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { FakePlatform } = require('../src/platform/fake-platform')
const { SaveManager, normalizeSave } = require('../src/storage/save-manager')
const { computeLayout, uiRects } = require('../src/render/layout')
const { InputController } = require('../src/input/input-controller')

test('坏存档按字段容错并保留合法设置', () => {
  assert.deepEqual(normalizeSave({ highestScore: -3, highestLevel: 99, fastestWinMs: 0, soundEnabled: false, tutorialCompleted: true }), {
    schemaVersion: 1,
    highestScore: 0,
    highestLevel: 1,
    fastestWinMs: null,
    tutorialCompleted: true,
    soundEnabled: false,
    hapticEnabled: true
  })
  const platform = new FakePlatform()
  const saves = new SaveManager(platform)
  platform.failWrites = true
  assert.equal(saves.setSoundEnabled(false), false)
  assert.equal(saves.lastWriteOk, false)
})

test('历史记录未提升时不重复写，相同最快成绩不覆盖', () => {
  const platform = new FakePlatform()
  let writes = 0
  const originalSave = platform.save.bind(platform)
  platform.save = (key, value) => { writes += 1; return originalSave(key, value) }
  const saves = new SaveManager(platform)
  assert.equal(saves.commitResult({ won: true, score: 100, level: 10, durationMs: 60000 }), true)
  assert.equal(writes, 1)
  assert.equal(saves.commitResult({ won: true, score: 100, level: 10, durationMs: 60000 }), true)
  assert.equal(saves.commitResult({ won: false, score: 50, level: 4, durationMs: 1000 }), true)
  assert.equal(writes, 1)
})

test('HUD 图鉴与暂停按钮避开安全区和胶囊且互不重叠，图鉴态只暴露关闭按钮', () => {
  const layout = computeLayout({
    width: 844,
    height: 390,
    dpr: 3,
    safeArea: { left: 44, top: 16, right: 810, bottom: 390 },
    menuButton: { left: 704, top: 10, width: 88, height: 32 }
  })
  const running = uiRects(layout, 'RUNNING')
  assert.deepEqual(Object.keys(running).sort(), ['catalog', 'pause'])
  for (const rect of [running.catalog, running.pause]) {
    assert.equal([rect.x, rect.y, rect.width, rect.height].every(Number.isFinite), true)
    assert.equal(rect.x >= layout.playable.left, true)
    assert.equal(rect.x + rect.width <= 704, true)
    assert.equal(rect.y >= layout.safeTop, true)
  }
  assert.equal(running.catalog.x + running.catalog.width <= running.pause.x, true)
  const catalog = uiRects(layout, 'CATALOG')
  assert.deepEqual(Object.keys(catalog), ['catalogClose'])
  assert.equal(catalog.catalogClose.x >= layout.playable.left, true)
  assert.equal(catalog.catalogClose.x + catalog.catalogClose.width <= 704, true)
  assert.equal(catalog.catalogClose.y >= layout.safeTop, true)
  assert.deepEqual(Object.keys(uiRects(layout, 'PAUSED')).sort(), ['quit', 'resume'])
  assert.deepEqual(Object.keys(uiRects(layout, 'RESULT')).sort(), ['haptic', 'home', 'retry', 'sound'])
})

test('UI 捕获与移动捕获互斥，拖出按钮不会误触', () => {
  const actions = []
  const input = new InputController((action) => actions.push(action))
  const layout = computeLayout({ width: 800, height: 450, dpr: 1 })
  const start = uiRects(layout, 'HOME').start
  input.handle('start', { id: 1, x: start.x + 10, y: start.y + 10 }, layout, 'HOME')
  input.handle('move', { id: 1, x: 0, y: 0 }, layout, 'HOME')
  input.handle('end', { id: 1, x: 0, y: 0 }, layout, 'HOME')
  assert.deepEqual(actions, [])
  input.handle('start', { id: 2, x: 300, y: 250 }, layout, 'RUNNING')
  input.handle('move', { id: 2, x: 390, y: 250 }, layout, 'RUNNING')
  assert.equal(input.move.active, true)
  assert.equal(input.move.directionX > 0, true)
  input.handle('end', { id: 2, x: 390, y: 250 }, layout, 'RUNNING')
  assert.equal(input.move.active, false)
  assert.equal(input.move.released, true)
})

test('图鉴态只允许关闭按钮，场景拖动和原 HUD 按钮都不穿透', () => {
  const actions = []
  const input = new InputController((action) => actions.push(action))
  const layout = computeLayout({ width: 800, height: 450, dpr: 1 })
  const running = uiRects(layout, 'RUNNING')
  const close = uiRects(layout, 'CATALOG').catalogClose

  input.handle('start', { id: 1, x: 300, y: 250 }, layout, 'CATALOG')
  input.handle('move', { id: 1, x: 390, y: 250 }, layout, 'CATALOG')
  input.handle('end', { id: 1, x: 390, y: 250 }, layout, 'CATALOG')
  assert.equal(input.move.active, false)
  assert.equal(input.moveId, null)

  input.handle('start', { id: 2, x: running.pause.x + 10, y: running.pause.y + 10 }, layout, 'CATALOG')
  input.handle('end', { id: 2, x: running.pause.x + 10, y: running.pause.y + 10 }, layout, 'CATALOG')
  assert.deepEqual(actions, [])

  input.handle('start', { id: 3, x: close.x + close.width / 2, y: close.y + close.height / 2 }, layout, 'CATALOG')
  input.handle('end', { id: 3, x: close.x + close.width / 2, y: close.y + close.height / 2 }, layout, 'CATALOG')
  assert.deepEqual(actions, ['catalogClose'])
})
