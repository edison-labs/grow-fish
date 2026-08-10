'use strict'

// Independent QA regressions captured from the R1 candidate. These assertions
// express the product/test-plan expectation and intentionally fail on the
// original R1 bundle until the corresponding defect is fixed.

const test = require('node:test')
const assert = require('node:assert/strict')
const { GameCore } = require('../src/core/game-core')
const { GameApp } = require('../src/app/game-app')
const { FakePlatform } = require('../src/platform/fake-platform')
const { TestHarness } = require('../src/debug/test-harness')
const { GAME_CONFIG, upgradeNeed } = require('../src/config/game-config')
const { computeLayout, uiRects } = require('../src/render/layout')
const { CanvasRenderer } = require('../src/render/canvas-renderer')
const { AudioManager } = require('../src/audio/audio-manager')
const { WechatPlatform } = require('../src/platform/wechat-platform')

const dt = 1 / GAME_CONFIG.tickRate

function makeCanvas() {
  const gradient = { addColorStop() {} }
  const methods = ['arc', 'beginPath', 'bezierCurveTo', 'clearRect', 'closePath', 'ellipse', 'fill', 'fillRect', 'fillText', 'lineTo', 'moveTo', 'quadraticCurveTo', 'restore', 'rotate', 'save', 'scale', 'setTransform', 'stroke', 'translate']
  const context = { createLinearGradient: () => gradient }
  for (const method of methods) context[method] = () => {}
  return { width: 0, height: 0, getContext: () => context }
}

function makeAudioContext() {
  const calls = []
  const oscillator = () => ({
    type: 'sine',
    frequency: { value: 0, setValueAtTime() {} },
    connect() {},
    start() { calls.push('oscillator.start') },
    stop() { calls.push('oscillator.stop') }
  })
  const gain = () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} })
  return {
    calls,
    currentTime: 0,
    destination: {},
    createOscillator: oscillator,
    createGain: gain,
    resume() { calls.push('context.resume') },
    suspend() { calls.push('context.suspend') }
  }
}

function makeRecordingCanvas() {
  const calls = { texts: [], scales: [], arcs: [], ellipses: [], ops: [] }
  const stack = []
  const gradient = { addColorStop() {} }
  const context = {
    font: '10px sans-serif',
    scaleX: 1,
    scaleY: 1,
    createLinearGradient: () => gradient,
    save() { stack.push({ font: this.font, scaleX: this.scaleX, scaleY: this.scaleY }); calls.ops.push(['save']) },
    restore() { Object.assign(this, stack.pop() || { font: this.font, scaleX: 1, scaleY: 1 }); calls.ops.push(['restore']) },
    scale(x, y) { this.scaleX *= x; this.scaleY *= y; calls.scales.push({ x, y }); calls.ops.push(['scale', x, y]) },
    setTransform(a, b, c, d, e, f) { this.scaleX = a; this.scaleY = d; calls.ops.push(['setTransform', a, b, c, d, e, f]) },
    translate(x, y) { calls.ops.push(['translate', x, y]) },
    rotate(angle) { calls.ops.push(['rotate', angle]) },
    arc(x, y, radius, start, end) { calls.arcs.push({ x, y, radius, scaleX: this.scaleX, scaleY: this.scaleY }); calls.ops.push(['arc', x, y, radius, start, end]) },
    ellipse(x, y, rx, ry, rotation, start, end) { calls.ellipses.push({ x, y, rx, ry, effectiveRx: Math.abs(rx * this.scaleX), effectiveRy: Math.abs(ry * this.scaleY) }); calls.ops.push(['ellipse', x, y, rx, ry, rotation, start, end]) },
    fillText(value, x, y) { calls.texts.push({ value: String(value), x, y, font: this.font, scaleX: this.scaleX, scaleY: this.scaleY }); calls.ops.push(['fillText', String(value), x, y, this.font, this.scaleX, this.scaleY]) }
  }
  for (const method of ['beginPath', 'bezierCurveTo', 'clearRect', 'closePath', 'fill', 'fillRect', 'lineTo', 'moveTo', 'quadraticCurveTo', 'stroke']) context[method] = (...args) => { calls.ops.push([method, ...args]) }
  return { width: 0, height: 0, calls, getContext: () => context }
}

function makeCountingAudioContext() {
  const created = []
  return {
    created,
    currentTime: 0,
    destination: {},
    resume() {},
    suspend() {},
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } },
    createOscillator() {
      const oscillator = {
        type: 'sine',
        stopCalls: [],
        frequency: { value: 0, setValueAtTime() {} },
        connect() {},
        start() {},
        stop(when) { this.stopCalls.push(when) }
      }
      created.push(oscillator)
      return oscillator
    }
  }
}

function visualTextSize(call) {
  const match = /([\d.]+)px/.exec(call.font)
  return (match ? Number(match[1]) : 0) * Math.abs(call.scaleX)
}

function makeWorld(seed = 20260731, viewport) {
  const platform = new FakePlatform({ viewport: viewport || { width: 800, height: 450, dpr: 1, safeArea: null, menuButton: null } })
  const core = new GameCore(platform, { seed })
  const harness = new TestHarness(core)
  harness.startRun(seed)
  core.drainEvents()
  return { platform, core, harness }
}

test('QA BUG-R1-001: safety prediction includes the fish vertical drift for the full 0.8 seconds', () => {
  const { core, harness } = makeWorld(41233)
  core.releaseAllEntities()
  core.spawnManager.tryReserve = () => null
  core.player.x = core.layout.playable.left + core.player.width * 0.35
  core.player.y = 225
  core.player.vx = 0
  core.player.vy = 0
  const fish = harness.spawnFish({ level: 2, side: 'left', active: false, pending: true, entering: true, warningRemaining: dt, x: -58.56, y: 251, vx: 109.76, randomize: false })
  Object.assign(fish, { baseY: 251, amplitude: 13.5, phase: -Math.PI / 2, period: 3, age: 0 })
  assert.equal(core.isDangerSpawnSafe(fish, true), false, 'a candidate whose vertical drift reaches the player before 0.8s must be rejected')
})

test('QA BUG-R1-002: one spawner tick performs at most one reservation or activation', () => {
  const { core, harness } = makeWorld(20260731)
  core.releaseAllEntities()
  core.spawnManager.reset()
  core.runClock = 6
  const bounds = core.layout.playable
  const pending = harness.spawnFish({ level: 2, side: 'right', active: false, pending: true, entering: true, warningRemaining: dt, vx: 0 })
  pending.x = bounds.right + pending.width * 0.5 + GAME_CONFIG.fish.offscreenPadding
  pending.y = pending.baseY = bounds.bottom - pending.height
  core.update(dt)
  const transitions = core.events.filter((event) => event.tick === core.tick && ['fish_activated', 'danger_warning'].includes(event.type))
  assert.equal(transitions.length, 1, `expected one lifecycle transition, got ${transitions.map((event) => event.type).join(',')}`)
})

test('QA BUG-R1-003: a stationary player and equal fish both visibly separate after bounce', () => {
  const { core, harness } = makeWorld(314159)
  core.releaseAllEntities()
  core.debug.freezeAI = true
  const startX = core.player.x
  const startY = core.player.y
  harness.spawnFish({ level: 1, x: core.player.x, y: core.player.y, vx: 0, randomize: false })
  core.update(dt)
  core.update(dt)
  assert.equal(Math.hypot(core.player.x - startX, core.player.y - startY) > 0.01, true, 'player bounce impulse was discarded before moving the player')
})

test('QA BUG-R1-004: a background interval is excluded from frame-performance metrics', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 7 })
  app.start()
  app.core.startRun(7)
  app.core.drainEvents()
  app.loop(0)
  app.loop(16.667)
  const before = app.performanceSnapshot()
  platform.emit('hide')
  platform.emit('show')
  app.loop(30016.667)
  const after = app.performanceSnapshot()
  app.stop()
  assert.equal(after.longFrames, before.longFrames)
  assert.equal(after.p95FrameMs < 200, true)
  assert.equal(app.core.debug.droppedTicks, 0)
})

test('QA BUG-R1-004: performance metrics retain a full 60-second 60fps gameplay sample', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 8 })
  app.core.startRun(8)
  app.core.drainEvents()
  for (let frame = 0; frame < 60 * 60; frame += 1) app.recordFrame(dt)
  assert.equal(app.performanceSnapshot().samples >= 60 * 60, true)
})

test('QA BUG-R1-004: p95 frame interval uses the nearest-rank percentile', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 9 })
  app.core.startRun(9)
  app.core.drainEvents()
  app.metrics.frameIntervals = Array.from({ length: 20 }, (_, index) => index + 1)
  assert.equal(app.performanceSnapshot().p95FrameMs, 19)
})

test('QA BUG-R1-004: HOME and PAUSED frames are excluded from gameplay metrics', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 10 })
  app.start()
  app.loop(0)
  app.loop(16.667)
  assert.equal(app.performanceSnapshot().samples, 0)
  app.core.startRun(10)
  app.core.drainEvents()
  app.loop(33.334)
  assert.equal(app.performanceSnapshot().samples, 1)
  app.core.pause('test')
  app.core.drainEvents()
  app.loop(50.001)
  assert.equal(app.performanceSnapshot().samples, 1)
  app.stop()
})

test('QA BUG-R1-004: long-frame count expires with the 60-second sliding window', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 11 })
  app.core.startRun(11)
  app.core.drainEvents()
  app.recordFrame(0.25)
  for (let frame = 0; frame < 60 * 60; frame += 1) app.recordFrame(dt)
  assert.equal(app.performanceSnapshot().longFrames, 0)
})

test('QA BUG-R1-005: resize keeps the full rendered fish silhouette inside the playable area', () => {
  const { core, harness } = makeWorld(31003)
  core.releaseAllEntities()
  const fish = harness.spawnFish({ level: 1, side: 'left', active: true, entering: false, x: core.layout.playable.left, y: core.player.y, vx: 0, randomize: false })
  core.resize({ width: 1200, height: 600, dpr: 1, safeArea: null, menuButton: null })
  assert.equal(fish.x - fish.width * 0.65 >= core.layout.playable.left, true)
})

test('QA BUG-R1-005: an incoming fish remains entering until its complete tail is visible', () => {
  const { core, harness } = makeWorld(31004)
  core.releaseAllEntities()
  const fish = harness.spawnFish({ level: 1, side: 'left', active: true, entering: true, x: core.layout.playable.left + 55, y: core.player.y, vx: 0, randomize: false })
  fish.width = 100
  core.updateFish(dt)
  assert.equal(fish.entering, true)
})

test('QA BUG-R1-005: a departing fish is retained until its complete tail leaves the viewport', () => {
  const { core, harness } = makeWorld(31005)
  core.releaseAllEntities()
  const fish = harness.spawnFish({ level: 1, side: 'left', active: true, entering: false, x: core.layout.playable.right + 55, y: core.player.y, vx: 0, randomize: false })
  fish.width = 100
  fish.direction = 1
  core.updateFish(dt)
  assert.equal(fish.inUse, true)
})

test('QA BUG-R1-006: fastest-win result keeps unrounded milliseconds', () => {
  const { core } = makeWorld(271828)
  core.runClock = 74 / 60
  assert.equal(core.makeResult(true, null).durationMs, core.runClock * 1000)
})

test('QA BUG-R1-007: generated grass respects the 5% short-side edge margin', () => {
  const viewport = { width: 1024, height: 768, dpr: 1, safeArea: null, menuButton: null }
  const { core } = makeWorld(0, viewport)
  core.grassPool.releaseAll((grass) => { grass.active = false; grass.respawnRemaining = 0 })
  core.setSeed(0)
  core.player.x = core.layout.playable.left + core.player.width * 0.35
  core.player.y = (core.layout.playable.top + core.layout.playable.bottom) / 2
  core.player.vx = 0
  core.player.vy = 0
  core.player.facing = -1
  assert.equal(core.placeGrass(core.grassPool.items[0], true), true)
  const grass = core.grassPool.items.find((item) => item.inUse && item.active)
  const minimum = Math.min(core.layout.width, core.layout.height) * 0.05
  assert.equal(grass.x - core.layout.playable.left >= minimum, true)
})

test('QA BUG-R1-008: all six initial grass objects are active on supported 21:9 safe-area layout', () => {
  const viewport = { width: 700, height: 300, dpr: 3, safeArea: { left: 44, top: 16, right: 656, bottom: 300 }, menuButton: { left: 550, top: 8, width: 90, height: 32 } }
  const { core } = makeWorld(951, viewport)
  const active = core.grassPool.items.filter((grass) => grass.inUse && grass.active)
  assert.equal(active.length, GAME_CONFIG.grass.initialCount)
})

test('QA BUG-R1-009: pending test entities are non-active by default', () => {
  const { core, harness } = makeWorld(61001)
  core.releaseAllEntities()
  const fish = harness.spawnFish({ level: 2, pending: true })
  assert.equal(fish.pending, true)
  assert.equal(fish.active, false)
})

test('QA BUG-R1-010: non-finite pointer coordinates cannot poison player state', () => {
  const { core } = makeWorld(51001)
  core.handlePointer('start', { id: 7, x: Number.NaN, y: 200 })
  core.handlePointer('move', { id: 7, x: 400, y: 250 })
  core.update(dt)
  assert.equal([core.player.x, core.player.y, core.player.vx, core.player.vy].every(Number.isFinite), true)
})

test('QA BUG-R1-011: duplicate pointer start cannot leave an orphaned move owner', () => {
  const { core } = makeWorld(51002)
  core.handlePointer('start', { id: 9, x: 200, y: 200 })
  core.handlePointer('move', { id: 9, x: 260, y: 200 })
  core.handlePointer('start', { id: 9, x: 300, y: 220 })
  core.handlePointer('end', { id: 9, x: 300, y: 220 })
  assert.equal(core.input.moveId, null)
  assert.equal(core.input.move.active, false)
})

test('QA BUG-R1-012: returning to PAUSED does not resume the audio context or ambient sound', () => {
  const audioContext = makeAudioContext()
  const platform = new FakePlatform({ canvas: makeCanvas(), audioContext })
  const app = new GameApp(platform, { seed: 77 })
  app.start()
  app.audio.unlock()
  app.core.startRun(77)
  app.processEvents(app.core.drainEvents())
  assert.notEqual(app.audio.ambient, null)
  platform.emit('hide')
  const resumesBeforeShow = audioContext.calls.filter((call) => call === 'context.resume').length
  platform.emit('show')
  const resumesAfterShow = audioContext.calls.filter((call) => call === 'context.resume').length
  app.stop()
  assert.equal(app.core.screenState, 'PAUSED')
  assert.equal(resumesAfterShow, resumesBeforeShow)
})

test('QA BUG-R1-013: malformed safeArea falls back to an ordered in-viewport playable rectangle', () => {
  const layout = computeLayout({ width: 800, height: 450, dpr: 1, safeArea: { left: 900, top: 500, right: -1, bottom: -1 }, menuButton: null })
  assert.equal(layout.playable.left >= 0 && layout.playable.left < layout.playable.right, true)
  assert.equal(layout.playable.right <= layout.width, true)
  assert.equal(layout.playable.top >= 0 && layout.playable.top < layout.playable.bottom, true)
  assert.equal(layout.playable.bottom <= layout.height, true)
})

test('QA BUG-R1-014: HUD controls stay inside the platform top safe inset', () => {
  const viewport = { width: 800, height: 450, dpr: 1, safeArea: { left: 0, top: 16, right: 800, bottom: 450 }, menuButton: null }
  const layout = computeLayout(viewport)
  const home = uiRects(layout, 'HOME')
  const running = uiRects(layout, 'RUNNING')
  assert.equal(home.sound.y >= viewport.safeArea.top, true)
  assert.equal(home.haptic.y >= viewport.safeArea.top, true)
  assert.equal(running.pause.y >= viewport.safeArea.top, true)
})

test('QA BUG-R1-015: eating at exactly three seconds continues the combo', () => {
  const { core, harness } = makeWorld(62001)
  core.releaseAllEntities()
  core.spawnManager.tryReserve = () => null
  core.debug.freezeAI = true
  harness.setPlayer({ level: 2 })
  core.stats.comboCount = 1
  core.stats.comboTimer = GAME_CONFIG.score.comboWindow
  for (let tick = 0; tick < GAME_CONFIG.score.comboWindow * GAME_CONFIG.tickRate - 1; tick += 1) core.update(dt)
  harness.spawnFish({ level: 1, x: core.player.x, y: core.player.y, vx: 0, randomize: false })
  core.update(dt)
  assert.equal(core.stats.comboCount, 2)
})

test('QA BUG-R1-016: the growth HUD displays current XP and required XP numerically', () => {
  const { core } = makeWorld(63001)
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  renderer.drawHud(core.snapshot())
  assert.equal(canvas.calls.texts.some((call) => new RegExp(`${core.player.xp}\\s*/\\s*${upgradeNeed(core.player.level)}`).test(call.value)), true)
})

test('QA BUG-R1-017: a score change visibly enlarges the score readout', () => {
  const { core } = makeWorld(63002)
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  const snapshot = core.snapshot()
  renderer.drawHud(snapshot)
  const baseline = canvas.calls.texts.find((call) => call.value.startsWith('分数 '))
  canvas.calls.texts.length = 0
  canvas.calls.scales.length = 0
  renderer.consumeEvents([{ type: 'fish_eaten', data: { points: 100, x: core.player.x, y: core.player.y } }], snapshot)
  renderer.drawHud(snapshot)
  const animated = canvas.calls.texts.find((call) => call.value.startsWith('分数 '))
  assert.equal(visualTextSize(animated) > visualTextSize(baseline), true)
})

test('QA BUG-R1-018: level-up feedback shows central 升级！Lv.X text for about 0.8 seconds', () => {
  const { core, harness } = makeWorld(63003)
  harness.setPlayer({ level: 2 })
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  const snapshot = core.snapshot()
  renderer.consumeEvents([{ type: 'level_up', data: { previous: 1, level: 2 } }], snapshot)
  renderer.drawEffects(snapshot)
  assert.equal(canvas.calls.texts.some((call) => call.value === '升级！Lv.2'), true)
  canvas.calls.texts.length = 0
  renderer.update(0.79)
  renderer.drawEffects(snapshot)
  assert.equal(canvas.calls.texts.some((call) => call.value === '升级！Lv.2'), true)
})

test('QA BUG-R1-019: eating a fish renders a shrinking suction effect', () => {
  const { core } = makeWorld(63004)
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  const snapshot = core.snapshot()
  renderer.consumeEvents([{ type: 'fish_eaten', data: { points: 100, x: core.player.x + 40, y: core.player.y, width: 50, height: 26, direction: 1, visualId: 2 } }], snapshot)
  renderer.update(0.1)
  renderer.drawEffects(snapshot)
  assert.equal(canvas.calls.scales.some((call) => call.x > 0 && call.x < 1 && call.y > 0 && call.y < 1), true)
})

test('QA BUG-R1-020: level-up feedback includes an expanding circular upgrade ring', () => {
  const { core, harness } = makeWorld(64001)
  harness.setPlayer({ level: 2 })
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  const snapshot = core.snapshot()
  renderer.consumeEvents([{ type: 'level_up', data: { previous: 1, level: 2 } }], snapshot)
  renderer.update(0.2)
  renderer.drawEffects(snapshot)
  assert.equal(canvas.calls.arcs.length + canvas.calls.ellipses.length > 0, true)
})

test('QA BUG-R1-021: winning starts a visible celebration effect', () => {
  const { core } = makeWorld(64002)
  const renderer = new CanvasRenderer(makeRecordingCanvas())
  renderer.consumeEvents([{ type: 'game_win', data: { level: 10 } }], core.snapshot())
  assert.equal(renderer.effects.length > 0, true)
})

test('QA BUG-R1-022: the first 0.4 seconds of death retain reduced scene motion', () => {
  const { core, harness } = makeWorld(64003)
  core.releaseAllEntities()
  const fish = harness.spawnFish({ level: 1, x: core.layout.playable.left + 200, y: core.layout.playable.top + 140, vx: 60, randomize: false })
  const before = fish.x
  harness.setState('DEAD')
  core.cinematicClock = 0
  core.update(dt)
  assert.equal(fish.x > before && fish.x < before + 60 * dt, true)
})

test('QA BUG-R1-023: a high combo adds a particle trail beyond normal eat feedback', () => {
  const { core } = makeWorld(64004)
  const snapshot = core.snapshot()
  const low = new CanvasRenderer(makeRecordingCanvas())
  const high = new CanvasRenderer(makeRecordingCanvas())
  const base = { type: 'fish_eaten', data: { points: 100, x: core.player.x, y: core.player.y } }
  low.consumeEvents([{ ...base, data: { ...base.data, combo: 1 } }], snapshot)
  high.consumeEvents([{ ...base, data: { ...base.data, combo: 4 } }], snapshot)
  assert.equal(high.effects.length > low.effects.length, true)
})

test('QA BUG-R1-024: score floating text lasts about 0.6 seconds', () => {
  const { core } = makeWorld(64005)
  const renderer = new CanvasRenderer(makeRecordingCanvas())
  renderer.consumeEvents([{ type: 'grass_eaten', data: { points: 10, x: core.player.x, y: core.player.y } }], core.snapshot())
  const score = renderer.effects.find((effect) => effect.kind === 'score')
  assert.equal(Math.abs(score.life - 0.6) <= 0.01, true)
})

test('QA BUG-R1-025: the level-up size transition begins at the old visual size', () => {
  const { core, harness } = makeWorld(64006)
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  renderer.drawPlayer(core.snapshot())
  const oldRadius = canvas.calls.ellipses[0].effectiveRx
  canvas.calls.ellipses.length = 0
  harness.setPlayer({ level: 2 })
  core.levelUpRemaining = GAME_CONFIG.timing.levelUpVisual
  const upgraded = core.snapshot()
  renderer.consumeEvents([{ type: 'level_up', data: { previous: 1, level: 2 } }], upgraded)
  renderer.drawPlayer(upgraded)
  const transitionStartRadius = canvas.calls.ellipses[0].effectiveRx
  assert.equal(transitionStartRadius <= oldRadius * 1.01, true)
})

test('QA BUG-R1-026: short audio voices enforce the six-instance concurrency cap', () => {
  const context = makeCountingAudioContext()
  const platform = new FakePlatform({ audioContext: context })
  const audio = new AudioManager(platform, { soundEnabled: true, hapticEnabled: true })
  audio.unlock()
  for (let index = 0; index < 20; index += 1) audio.play('fish_eaten', index + 1)
  assert.equal(context.created.length <= 6, true)
})

test('QA BUG-R1-026: a result voice preempts low-priority audio and voice cleanup remains bounded', () => {
  const context = makeCountingAudioContext()
  const platform = new FakePlatform({ audioContext: context })
  const audio = new AudioManager(platform, { soundEnabled: true, hapticEnabled: true })
  audio.unlock()
  for (let index = 0; index < 6; index += 1) assert.equal(audio.play('fish_eaten', index + 1), true)
  const victim = audio.voices[0]
  assert.equal(audio.play('dead'), true)
  assert.equal(audio.voices.length, 6)
  assert.equal(victim.oscillator.stopCalls.some((when) => when === undefined), true)
  const resultVoice = audio.voices.find((voice) => voice.name === 'dead')
  assert.notEqual(resultVoice, undefined)
  resultVoice.oscillator.onended()
  resultVoice.oscillator.onended()
  assert.equal(audio.voices.length, 5)
  const remaining = audio.voices.slice()
  audio.stopVoices()
  for (const voice of remaining) voice.oscillator.onended?.()
  assert.equal(audio.voices.length, 0)
})

test('QA BUG-R1-027: idle and swimming player states have distinct rendered motion', () => {
  const { core } = makeWorld(64007)
  const canvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(canvas)
  core.player.vx = 0
  core.player.vy = 0
  renderer.drawPlayer(core.snapshot())
  const idle = JSON.stringify(canvas.calls.ops)
  canvas.calls.ops.length = 0
  core.player.vx = 100
  renderer.drawPlayer(core.snapshot())
  const swimming = JSON.stringify(canvas.calls.ops)
  assert.notEqual(swimming, idle)
})

test('QA BUG-R1-027: water grass provides at least two distinct visual forms', () => {
  const { core } = makeWorld(64008)
  const rendererCanvas = makeRecordingCanvas()
  const renderer = new CanvasRenderer(rendererCanvas)
  const traces = []
  for (let visualId = 0; visualId < 3; visualId += 1) {
    rendererCanvas.calls.ops.length = 0
    renderer.drawGrass({ x: 200, y: 250, width: 24, height: 42, growRemaining: 0, swayPhase: 0, visualId, spawnSeq: visualId + 1 })
    traces.push(JSON.stringify(rendererCanvas.calls.ops))
  }
  assert.equal(new Set(traces).size >= 2, true)
})

test('QA BUG-R1-028: pausing freezes active visual-feedback clocks', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 65001 })
  app.start()
  app.core.startRun(65001)
  app.core.drainEvents()
  const snapshot = app.core.snapshot()
  app.renderer.consumeEvents([{ type: 'level_up', data: { previous: 1, level: 2 } }], snapshot)
  app.core.pause('test')
  app.core.drainEvents()
  app.loop(0)
  for (let frame = 1; frame <= 10; frame += 1) app.loop(frame * 100)
  const levelText = app.renderer.effects.find((effect) => effect.kind === 'levelText')
  app.stop()
  assert.notEqual(levelText, undefined)
  assert.equal(levelText.age, 0)
})

test('QA BUG-R1-029: starting a new run clears every visual-feedback state from the previous run', () => {
  const platform = new FakePlatform({ canvas: makeCanvas() })
  const app = new GameApp(platform, { seed: 65002 })
  app.start()
  app.core.startRun(65002)
  let events = app.core.drainEvents()
  app.renderer.consumeEvents(events, app.core.snapshot())
  app.processEvents(events)
  const snapshot = app.core.snapshot()
  app.renderer.consumeEvents([
    { type: 'fish_eaten', data: { points: 100, combo: 4, x: snapshot.player.x, y: snapshot.player.y } },
    { type: 'level_up', data: { previous: 1, level: 2 } }
  ], snapshot)
  assert.equal(app.renderer.effects.length > 0, true)
  app.core.pause('test')
  app.core.quitRun()
  events = app.core.drainEvents()
  app.renderer.consumeEvents(events, app.core.snapshot())
  app.processEvents(events)
  app.core.startRun(65003)
  events = app.core.drainEvents()
  app.renderer.consumeEvents(events, app.core.snapshot())
  app.processEvents(events)
  app.stop()
  assert.equal(app.renderer.effects.length, 0)
  assert.equal(app.renderer.playerPulse, 0)
  assert.equal(app.renderer.scorePulse, 0)
  assert.equal(app.renderer.playerLevelTransition, null)
})

test('QA BUG-R1-030: WeChat viewport lookup falls back when getWindowInfo throws', () => {
  const platform = new WechatPlatform({
    getWindowInfo() { throw new Error('unsupported getWindowInfo') },
    getSystemInfoSync() { return { windowWidth: 800, windowHeight: 450, pixelRatio: 2, safeArea: null } }
  })
  assert.deepEqual(platform.getViewport(), { width: 800, height: 450, dpr: 2, safeArea: null, menuButton: null })
})

test('QA BUG-R1-030: malformed viewport dimensions and DPR fall back to finite positive geometry', () => {
  const layout = computeLayout({ width: Number.NaN, height: Number.NEGATIVE_INFINITY, dpr: -3, safeArea: null, menuButton: { left: Number.NaN } })
  const pause = uiRects(layout, 'RUNNING').pause
  assert.equal([layout.width, layout.height, layout.dpr, layout.playable.left, layout.playable.top, layout.playable.right, layout.playable.bottom, pause.x, pause.y].every(Number.isFinite), true)
  assert.equal(layout.width >= 1 && layout.height >= 1 && layout.dpr > 0, true)
  assert.equal(layout.playable.left < layout.playable.right && layout.playable.top < layout.playable.bottom, true)
})

test('QA BUG-R1-030: malformed getWindowInfo data falls back to valid legacy system info', () => {
  const platform = new WechatPlatform({
    getWindowInfo() { return { windowWidth: Number.NaN, windowHeight: 0, pixelRatio: -2, safeArea: { left: Number.NaN } } },
    getSystemInfoSync() { return { windowWidth: 844, windowHeight: 390, pixelRatio: 3, safeArea: { left: 44, top: 16, right: 810, bottom: 390 } } },
    getMenuButtonBoundingClientRect() { return { left: Number.NaN, top: -10, width: -20, height: Number.POSITIVE_INFINITY } }
  })
  const viewport = platform.getViewport()
  assert.equal(viewport.width, 844)
  assert.equal(viewport.height, 390)
  assert.equal(viewport.dpr, 3)
  const layout = computeLayout(viewport)
  const pause = uiRects(layout, 'RUNNING').pause
  assert.equal([pause.x, pause.y, pause.width, pause.height].every(Number.isFinite), true)
  assert.equal(pause.x >= layout.playable.left && pause.x + pause.width <= layout.playable.right, true)
})

test('QA BUG-R1-031: quitting a run clears every active short-audio voice', () => {
  const context = makeCountingAudioContext()
  const platform = new FakePlatform({ canvas: makeCanvas(), audioContext: context })
  const app = new GameApp(platform, { seed: 65004 })
  app.audio.unlock()
  app.processEvents([{ type: 'fish_eaten', data: { combo: 4 } }, { type: 'level_up', data: { level: 2 } }])
  assert.equal(app.audio.voices.length, 2)
  app.processEvents([{ type: 'game_paused', data: {} }])
  assert.equal(app.audio.voices.length, 2)
  const voices = app.audio.voices.slice()
  app.processEvents([{ type: 'game_quit', data: {} }])
  assert.equal(app.audio.voices.length, 0)
  assert.equal(voices.every((voice) => voice.oscillator.stopCalls.some((when) => when === undefined)), true)
  app.processEvents([{ type: 'fish_eaten', data: { combo: 1 } }])
  assert.equal(app.audio.voices.length, 1)
  app.processEvents([{ type: 'game_start', data: {} }])
  assert.equal(app.audio.voices.length, 0)
})
