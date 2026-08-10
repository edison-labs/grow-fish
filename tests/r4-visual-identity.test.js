'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GameCore } = require('../src/core/game-core')
const { FakePlatform } = require('../src/platform/fake-platform')
const { fishVisualMargins } = require('../src/core/entities')
const { CanvasRenderer, FISH_LEVEL_VISUALS, fishVisualForLevel } = require('../src/render/canvas-renderer')

function makeRecordingCanvas() {
  const calls = { ops: [], texts: [], saves: 0, restores: 0 }
  const values = Object.create(null)
  let gradientId = 0
  const context = {
    createLinearGradient(...args) {
      const id = gradientId
      gradientId += 1
      calls.ops.push(['createLinearGradient', ...args])
      return {
        __gradientId: id,
        addColorStop(offset, color) { calls.ops.push(['addColorStop', id, offset, color]) }
      }
    },
    save() { calls.saves += 1; calls.ops.push(['save']) },
    restore() { calls.restores += 1; calls.ops.push(['restore']) },
    fillText(value, x, y) {
      const text = String(value)
      calls.texts.push(text)
      calls.ops.push(['fillText', text, x, y])
    }
  }
  for (const method of [
    'arc', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath', 'ellipse', 'fill', 'fillRect',
    'lineTo', 'moveTo', 'quadraticCurveTo', 'rotate', 'scale', 'setTransform', 'stroke', 'translate'
  ]) {
    context[method] = (...args) => calls.ops.push([method, ...args])
  }
  for (const property of [
    'fillStyle', 'font', 'globalAlpha', 'lineCap', 'lineJoin', 'lineWidth', 'strokeStyle', 'textAlign', 'textBaseline'
  ]) {
    Object.defineProperty(context, property, {
      configurable: true,
      get() { return values[property] },
      set(value) {
        values[property] = value
        const recorded = value && typeof value === 'object' && Number.isInteger(value.__gradientId)
          ? `gradient:${value.__gradientId}`
          : value
        calls.ops.push(['set', property, recorded])
      }
    })
  }
  return { width: 0, height: 0, calls, getContext: () => context }
}

function makeWorld(seed = 20260810) {
  const core = new GameCore(new FakePlatform(), { seed })
  core.startRun(seed)
  core.drainEvents()
  return core
}

test('R4 visual identity: all ten levels have a complete and unique visual definition', () => {
  assert.equal(FISH_LEVEL_VISUALS.length, 10)
  for (const key of ['id', 'body', 'tail', 'fin', 'pattern', 'primary', 'secondary']) {
    assert.equal(new Set(FISH_LEVEL_VISUALS.map((visual) => visual[key])).size, 10, `${key} must distinguish every level`)
  }
  for (let level = 1; level <= 10; level += 1) {
    const visual = fishVisualForLevel(level)
    assert.strictEqual(visual, FISH_LEVEL_VISUALS[level - 1], `Lv.${level} lookup`)
    for (const key of ['id', 'body', 'tail', 'fin', 'pattern', 'primary', 'secondary', 'accent']) {
      assert.equal(typeof visual[key], 'string', `Lv.${level} ${key}`)
      assert.notEqual(visual[key].length, 0, `Lv.${level} ${key}`)
    }
  }
})

test('R4 visual identity: wild fish visualId is level minus one and pool reuse cannot leak the old level visual', () => {
  const core = makeWorld(20260811)
  core.releaseAllEntities()
  let reusedSlot = null
  for (let level = 1; level <= 10; level += 1) {
    const fish = core.acquireFish(level, level % 2 ? 'left' : 'right', level % 2 === 0)
    assert.notEqual(fish, null)
    if (reusedSlot) assert.strictEqual(fish, reusedSlot)
    reusedSlot = fish
    assert.equal(fish.level, level)
    assert.equal(fish.visualId, level - 1)
    fish.visualId = 99
    core.releaseFish(fish)
  }
  const finalFish = core.acquireFish(10, 'left', true)
  assert.strictEqual(finalFish, reusedSlot)
  assert.equal(finalFish.level, 10)
  assert.equal(finalFish.visualId, 9)
})

test('R4 visual identity: Lv.1 through Lv.10 sizes strictly increase and Lv.10 is approximately twice Lv.1', () => {
  const core = makeWorld(20260812)
  core.releaseAllEntities()
  const widths = []
  const heights = []
  for (let level = 1; level <= 10; level += 1) {
    const fish = core.acquireFish(level, 'left', false)
    assert.notEqual(fish, null)
    widths.push(fish.width)
    heights.push(fish.height)
    core.releaseFish(fish)
  }
  for (let index = 1; index < widths.length; index += 1) {
    assert.equal(widths[index] > widths[index - 1], true, `Lv.${index + 1} width`)
    assert.equal(heights[index] > heights[index - 1], true, `Lv.${index + 1} height`)
  }
  assert.equal(Math.abs(widths[9] / widths[0] - 2) < 0.01, true)
  assert.equal(Math.abs(heights[9] / heights[0] - 2) < 0.01, true)
})

test('R4 visual identity: lifecycle margins include outline padding in both directions', () => {
  const fish = { width: 100, height: 52, direction: 1 }
  const rightFacing = fishVisualMargins(fish)
  fish.direction = -1
  const leftFacing = fishVisualMargins(fish)
  const strokePadding = Math.max(2.2, fish.height * 0.045) / 2
  assert.equal(rightFacing.left, fish.width * 0.65 + strokePadding)
  assert.equal(rightFacing.right, fish.width * 0.42 + strokePadding)
  assert.equal(leftFacing.left, rightFacing.right)
  assert.equal(leftFacing.right, rightFacing.left)
  assert.equal(rightFacing.top, fish.height * 0.5 + strokePadding)
  assert.equal(rightFacing.bottom, fish.height * 0.5 + strokePadding)
})

test('R4 visual identity: vertical swim motion keeps outlined wild fish inside the playable area', () => {
  const core = makeWorld(20260815)
  core.releaseAllEntities()
  const fish = core.acquireFish(10, 'left', false)
  fish.active = true
  fish.entering = false
  fish.x = core.layout.playable.left + fishVisualMargins(fish).left
  fish.baseY = core.layout.playable.top
  fish.y = fish.baseY
  fish.amplitude = fish.height
  fish.phase = -Math.PI / 2
  core.updateFish(1 / 60)
  const margins = fishVisualMargins(fish)
  assert.equal(fish.y >= core.layout.playable.top + margins.top, true)
  assert.equal(fish.y <= core.layout.playable.bottom - margins.bottom, true)
})

test('R4 visual identity: live fish and tutorial render no edible, equal, or danger badge text', () => {
  const core = makeWorld(20260813)
  core.releaseAllEntities()
  core.player.level = 3
  core.updatePlayerDimensions()
  Object.assign(core.tutorial, { enabled: true, elapsed: 4, ateGrass: true, ateFish: false })
  for (const level of [2, 3, 4]) {
    const fish = core.acquireFish(level, 'left', false)
    fish.active = true
    fish.pending = false
    fish.x = 180 + level * 90
    fish.y = fish.baseY = 180
  }
  const snapshot = core.snapshot()
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  renderer.drawRun(snapshot)
  assert.equal(canvas.calls.texts.includes('吃体型更小的鱼，避开红色闪边的大鱼'), true)
  assert.deepEqual(canvas.calls.texts.filter((text) => /可吃|同级|危险/.test(text)), [])
})

test('R4 visual identity: only lethal live fish receive the two-layer red danger outline', () => {
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  const outlinedLevels = []
  const drawDangerOutline = renderer.drawDangerOutline.bind(renderer)
  renderer.drawDangerOutline = (style, fish, width, height) => {
    outlinedLevels.push(fish.level)
    drawDangerOutline(style, fish, width, height)
  }
  const snapshot = { player: { level: 3 } }
  for (const level of [2, 3, 4]) {
    renderer.drawFishShape({ x: level * 120, y: 180, width: 100, height: 52, direction: 1, level, visualId: level - 1, spawnSeq: level }, snapshot)
  }
  assert.deepEqual(outlinedLevels, [4])
  assert.equal(canvas.calls.ops.filter((op) => op[0] === 'set' && op[1] === 'strokeStyle' && op[2] === '#5b0b20').length, 1)
  assert.equal(canvas.calls.ops.filter((op) => op[0] === 'set' && op[1] === 'strokeStyle' && op[2] === '#ff3b5c').length, 1)
  assert.equal(canvas.calls.saves, canvas.calls.restores)
})

test('R4 visual identity: danger outline alpha changes with phase and disappears after the player reaches the fish level', () => {
  const alphaAt = (elapsed, playerLevel) => {
    const canvas = makeRecordingCanvas()
    const renderer = new CanvasRenderer(canvas)
    renderer.elapsed = elapsed
    renderer.drawFishShape({ x: 240, y: 180, width: 100, height: 52, direction: 1, level: 4, visualId: 3, spawnSeq: 0 }, { player: { level: playerLevel } })
    return canvas.calls.ops
      .filter((op) => op[0] === 'set' && op[1] === 'globalAlpha')
      .map((op) => op[2])
  }
  const start = alphaAt(0, 3)
  const crest = alphaAt(1 / 7.2, 3)
  assert.equal(start.length, 1)
  assert.equal(crest.length, 1)
  assert.notEqual(start[0], crest[0])
  const inPulseRange = (alpha) => alpha >= 0.55 - 1e-9 && alpha <= 0.95 + 1e-9
  assert.equal(inPulseRange(start[0]), true)
  assert.equal(inPulseRange(crest[0]), true)
  assert.deepEqual(alphaAt(0, 4), [])
})

test('R4 visual identity: all ten level drawings have unique procedural signatures and balanced canvas state', () => {
  const signatures = []
  for (let level = 1; level <= 10; level += 1) {
    const canvas = makeRecordingCanvas()
    const renderer = new CanvasRenderer(canvas)
    renderer.drawFishShape({
      x: 0,
      y: 0,
      width: 100,
      height: 52,
      direction: 1,
      level,
      visualId: level - 1,
      player: true
    }, { player: { level } })
    assert.equal(canvas.calls.saves > 0, true, `Lv.${level} saves`)
    assert.equal(canvas.calls.saves, canvas.calls.restores, `Lv.${level} save/restore`)
    assert.equal(canvas.calls.ops.filter(([name]) => name === 'clip').length, 1, `Lv.${level} body clip`)
    assert.equal(canvas.calls.ops.some((op) => op[0] === 'set' && op[1] === 'lineJoin' && op[2] === 'round'), true, `Lv.${level} safe outline join`)
    signatures.push(JSON.stringify(canvas.calls.ops))
  }
  assert.equal(new Set(signatures).size, 10)
})

test('R4 visual identity: catalog is a five-by-two Lv.1-Lv.10 gallery with growing previews and no danger outlines', () => {
  const core = makeWorld(20260816)
  core.player.level = 6
  core.updatePlayerDimensions()
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  const previews = []
  let dangerOutlines = 0
  const drawFishShape = renderer.drawFishShape.bind(renderer)
  renderer.drawFishShape = (fish, snapshot, alreadyTranslated) => {
    previews.push({ level: fish.level, x: fish.x, y: fish.y, width: fish.width, height: fish.height })
    return drawFishShape(fish, snapshot, alreadyTranslated)
  }
  renderer.drawDangerOutline = () => { dangerOutlines += 1 }
  renderer.drawCatalog(core.snapshot())

  assert.deepEqual(previews.map((fish) => fish.level), Array.from({ length: 10 }, (_, index) => index + 1))
  assert.equal(new Set(previews.map((fish) => fish.x)).size, 5)
  assert.equal(new Set(previews.map((fish) => fish.y)).size, 2)
  for (const y of new Set(previews.map((fish) => fish.y))) assert.equal(previews.filter((fish) => fish.y === y).length, 5)
  for (let index = 1; index < previews.length; index += 1) {
    assert.equal(previews[index].width > previews[index - 1].width, true, `Lv.${index + 1} preview width`)
    assert.equal(previews[index].height > previews[index - 1].height, true, `Lv.${index + 1} preview height`)
  }
  for (let index = 0; index < FISH_LEVEL_VISUALS.length; index += 1) {
    assert.equal(canvas.calls.texts.some((text) => text.includes(`Lv.${index + 1}`) && text.includes(FISH_LEVEL_VISUALS[index].name)), true)
  }
  assert.equal(canvas.calls.texts.includes('鱼类图鉴'), true)
  assert.equal(dangerOutlines, 0)
  assert.equal(canvas.calls.ops.some((op) => op[0] === 'set' && op[1] === 'strokeStyle' && ['#5b0b20', '#ff3b5c'].includes(op[2])), false)
  assert.equal(canvas.calls.saves, canvas.calls.restores)
})

test('R4 visual identity: fish suction effects preserve the eaten fish level identity', () => {
  const core = makeWorld(20260814)
  const renderer = new CanvasRenderer(makeRecordingCanvas())
  renderer.consumeEvents([{
    type: 'fish_eaten',
    data: {
      fishLevel: 7,
      visualId: 1,
      points: 100,
      x: core.player.x + 40,
      y: core.player.y,
      width: 80,
      height: 42,
      direction: -1
    }
  }], core.snapshot())
  const suction = renderer.effects.find((effect) => effect.kind === 'suction')
  assert.notEqual(suction, undefined)
  assert.equal(suction.level, 7)
  assert.equal(suction.visualId, 1)
  let drawnLevel = null
  renderer.drawFishShape = (fish) => { drawnLevel = fish.level }
  renderer.drawEffects(core.snapshot())
  assert.equal(drawnLevel, 7)
})
