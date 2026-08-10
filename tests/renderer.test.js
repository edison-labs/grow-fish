'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { CanvasRenderer } = require('../src/render/canvas-renderer')
const { GameCore } = require('../src/core/game-core')
const { FakePlatform } = require('../src/platform/fake-platform')

function makeMockCanvas() {
  const calls = []
  const gradient = { addColorStop: (...args) => calls.push(['addColorStop', ...args]) }
  const methods = new Set([
    'arc', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath', 'ellipse', 'fill', 'fillRect', 'fillText',
    'lineTo', 'moveTo', 'quadraticCurveTo', 'restore', 'rotate', 'save', 'scale', 'setTransform', 'stroke', 'translate'
  ])
  const target = { createLinearGradient: (...args) => { calls.push(['createLinearGradient', ...args]); return gradient } }
  for (const method of methods) target[method] = (...args) => calls.push([method, ...args])
  const ctx = new Proxy(target, { set(object, property, value) { object[property] = value; return true } })
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, calls }
}

test('渲染器可无异常绘制 HOME、RUNNING 及全部覆盖状态', () => {
  const platform = new FakePlatform()
  const core = new GameCore(platform, { seed: 123 })
  const { canvas, calls } = makeMockCanvas()
  const renderer = new CanvasRenderer(canvas)
  renderer.render(core.snapshot())
  core.startRun(123)
  renderer.render(core.snapshot())
  core.player.level = 2
  core.updatePlayerDimensions()
  renderer.render(core.snapshot())
  core.pause('test')
  renderer.render(core.snapshot())
  core.screenState = 'DEAD'
  renderer.render(core.snapshot())
  core.screenState = 'WIN'
  renderer.render(core.snapshot())
  core.screenState = 'RESULT'
  core.result = { won: true, score: 100, level: 10, fishEaten: 8, grassEaten: 3, highestCombo: 4, durationMs: 61000, saved: true }
  core.debug.enabled = true
  core.debug.showCollision = true
  renderer.render(core.snapshot())
  assert.equal(canvas.width, 800)
  assert.equal(canvas.height, 450)
  assert.equal(calls.some(([name]) => name === 'fillText'), true)
  assert.equal(calls.filter(([name]) => name === 'save').length, calls.filter(([name]) => name === 'restore').length)
})

test('渲染事件特效池有硬上限且生命周期可回收', () => {
  const platform = new FakePlatform()
  const core = new GameCore(platform)
  core.startRun(1)
  const { canvas } = makeMockCanvas()
  const renderer = new CanvasRenderer(canvas)
  for (let index = 0; index < 200; index += 1) {
    renderer.consumeEvents([{ type: 'fish_eaten', data: { x: 10, y: 20, points: 10 } }], core.snapshot())
  }
  assert.equal(renderer.effects.length <= 128, true)
  renderer.update(2)
  assert.equal(renderer.effects.length, 0)
})
