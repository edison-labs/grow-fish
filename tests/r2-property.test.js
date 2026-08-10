'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GAME_CONFIG } = require('../src/config/game-config')
const { GameCore } = require('../src/core/game-core')
const { clamp, ellipsesOverlap } = require('../src/core/math')
const { fishVisualMargins } = require('../src/core/entities')
const { FakePlatform } = require('../src/platform/fake-platform')
const { AudioManager } = require('../src/audio/audio-manager')

const dt = 1 / GAME_CONFIG.tickRate
const safetyTicks = Math.ceil(GAME_CONFIG.fish.safeContactTime * GAME_CONFIG.tickRate)

const supportedViewports = [
  { width: 1024, height: 768, dpr: 1, safeArea: null, menuButton: null },
  { width: 800, height: 450, dpr: 2, safeArea: null, menuButton: null },
  { width: 700, height: 300, dpr: 3, safeArea: { left: 44, top: 16, right: 656, bottom: 300 }, menuButton: { left: 550, top: 8, width: 90, height: 32 } },
  { width: 1366, height: 768, dpr: 2, safeArea: { left: 24, top: 20, right: 1342, bottom: 752 }, menuButton: { left: 1190, top: 10, width: 120, height: 36 } }
]

function startWorld(seed, viewport = supportedViewports[seed % supportedViewports.length]) {
  const core = new GameCore(new FakePlatform({ viewport }), { seed })
  core.startRun(seed)
  core.drainEvents()
  return core
}

function independentFishBody(core, fish, elapsed) {
  if (elapsed <= 0) return { x: fish.x, y: fish.y, rx: fish.width * 0.35, ry: fish.height * 0.35 }
  const bounds = core.layout.playable
  const age = fish.age + elapsed
  const visual = fishVisualMargins(fish)
  return {
    x: fish.x + fish.vx * elapsed,
    y: clamp(
      fish.baseY + Math.sin(fish.phase + (age * Math.PI * 2) / fish.period) * fish.amplitude,
      bounds.top + visual.top,
      bounds.bottom - visual.bottom
    ),
    rx: fish.width * 0.35,
    ry: fish.height * 0.35
  }
}

test('R2 regression: safety prediction and real fish motion share outlined vertical limits', () => {
  const core = startWorld(20260816)
  for (const edge of ['top', 'bottom']) {
    core.releaseAllEntities()
    const fish = core.acquireFish(10, 'left', false)
    fish.active = true
    fish.entering = false
    fish.x = (core.layout.playable.left + core.layout.playable.right) / 2
    fish.vx = 0
    fish.age = 0
    fish.period = 2
    fish.amplitude = fish.height * 4
    fish.phase = edge === 'top' ? -Math.PI / 2 : Math.PI / 2
    fish.baseY = edge === 'top' ? core.layout.playable.top : core.layout.playable.bottom
    fish.y = fish.baseY
    const predicted = core.predictedFishBody(fish, dt)
    core.updateFish(dt)
    const visual = fishVisualMargins(fish)
    assert.equal(fish.y, predicted.y, `${edge} predicted y`)
    assert.equal(
      fish.y,
      edge === 'top' ? core.layout.playable.top + visual.top : core.layout.playable.bottom - visual.bottom,
      `${edge} outlined limit`
    )
  }
})

function currentPathCollides(core, fish) {
  const bounds = core.layout.playable
  let x = core.player.x
  let y = core.player.y
  const rx = core.player.width * 0.35
  const ry = core.player.height * 0.35
  if (ellipsesOverlap({ x, y, rx, ry }, independentFishBody(core, fish, 0))) return true
  for (let step = 1; step <= safetyTicks; step += 1) {
    x = clamp(x + core.player.vx * dt, bounds.left + rx, bounds.right - rx)
    y = clamp(y + core.player.vy * dt, bounds.top + ry, bounds.bottom - ry)
    if (ellipsesOverlap({ x, y, rx, ry }, independentFishBody(core, fish, step * dt))) return true
  }
  return false
}

test('R2 property: 128 seeds always start with six legal grass objects and two near-player objects', () => {
  for (let seed = 0; seed < 128; seed += 1) {
    const core = startWorld(seed)
    const grass = core.grassPool.items.filter((item) => item.inUse && item.active)
    assert.equal(grass.length, GAME_CONFIG.grass.initialCount, `seed=${seed} active grass`)
    const near = grass.filter((item) => {
      const ratio = Math.hypot(item.x - core.player.x, item.y - core.player.y) / core.player.width
      return ratio >= 1 - 1e-9 && ratio <= 2.5 + 1e-9
    })
    assert.equal(near.length >= 2, true, `seed=${seed} near grass=${near.length}`)
    for (const item of grass) {
      const legal = core.grassPlacementBounds(item)
      assert.equal(item.x >= legal.xMin - 1e-9 && item.x <= legal.xMax + 1e-9, true, `seed=${seed} grass=${item.spawnSeq} x`)
      assert.equal(item.y >= legal.yMin - 1e-9 && item.y <= legal.yMax + 1e-9, true, `seed=${seed} grass=${item.spawnSeq} y`)
    }
    assert.equal(new Set(grass.map((item) => item.visualId)).size >= 2, true, `seed=${seed} grass visual forms`)
  }
})

test('R2 property: production danger-spawn prediction matches motion and protects the 0.8-second window across 160 seeds', () => {
  let accepted = 0
  let independentlyColliding = 0
  let activatedAndSimulated = 0
  for (let seed = 0; seed < 160; seed += 1) {
    const core = startWorld(seed)
    core.releaseAllEntities()
    core.spawnManager.tryReserve = () => null
    core.player.level = 1 + (seed % 9)
    core.updatePlayerDimensions()
    const side = seed % 2 === 0 ? 'left' : 'right'
    const fish = core.acquireFish(core.player.level + 1, side, true)
    assert.notEqual(fish, null, `seed=${seed} candidate`)
    core.spawnManager.placeCandidate(fish, side)

    const bounds = core.layout.playable
    const playerRx = core.player.width * 0.35
    const playerRy = core.player.height * 0.35
    const scenario = seed % 4
    if (scenario === 0) core.player.x = side === 'left' ? bounds.left + playerRx : bounds.right - playerRx
    else if (scenario === 1) core.player.x = side === 'left' ? bounds.left + playerRx + core.player.width : bounds.right - playerRx - core.player.width
    else if (scenario === 2) core.player.x = bounds.left + (bounds.right - bounds.left) * 0.5
    else core.player.x = side === 'left' ? bounds.right - playerRx : bounds.left + playerRx
    core.player.y = clamp(fish.baseY, bounds.top + playerRy, bounds.bottom - playerRy)

    const maxSpeed = core.layout.width * GAME_CONFIG.player.baseSpeedRatio
    if (scenario === 1) {
      core.player.vx = side === 'left' ? -maxSpeed * 0.35 : maxSpeed * 0.35
      core.player.vy = (seed % 3 - 1) * maxSpeed * 0.08
    } else {
      core.player.vx = 0
      core.player.vy = 0
    }

    for (let step = 0; step <= safetyTicks; step += 1) {
      const elapsed = step * dt
      const predicted = core.predictedFishBody(fish, elapsed)
      const independent = independentFishBody(core, fish, elapsed)
      assert.equal(Math.abs(predicted.x - independent.x) < 1e-8, true, `seed=${seed} step=${step} predicted x`)
      assert.equal(Math.abs(predicted.y - independent.y) < 1e-8, true, `seed=${seed} step=${step} predicted y`)
    }

    const collides = currentPathCollides(core, fish)
    const safe = core.isDangerSpawnSafe(fish, true)
    if (collides) {
      independentlyColliding += 1
      assert.equal(safe, false, `seed=${seed} colliding path must be rejected`)
    }
    if (!safe) continue
    accepted += 1

    if (core.player.vx === 0 && core.player.vy === 0) {
      fish.pending = false
      fish.active = true
      fish.entering = true
      for (let step = 0; step < safetyTicks; step += 1) {
        core.update(dt)
        assert.equal(core.screenState, 'RUNNING', `seed=${seed} unsafe activation at step=${step + 1}`)
      }
      activatedAndSimulated += 1
    }
  }
  assert.equal(accepted >= 40, true, `accepted candidates=${accepted}`)
  assert.equal(independentlyColliding >= 20, true, `independently colliding candidates=${independentlyColliding}`)
  assert.equal(activatedAndSimulated >= 20, true, `activated candidates simulated=${activatedAndSimulated}`)
})

function makePriorityAudioContext() {
  const context = { currentTime: 0, destination: {}, created: [], active: 0 }
  context.resume = () => {}
  context.suspend = () => {}
  context.createGain = () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} })
  context.createOscillator = () => {
    const oscillator = {
      onended: null,
      active: false,
      frequency: { value: 0, setValueAtTime() {} },
      connect() {},
      start() { if (!this.active) { this.active = true; context.active += 1 } },
      stop(when) {
        if (Number.isFinite(when)) { this.stopAt = when; return }
        if (this.active) { this.active = false; context.active -= 1 }
      },
      finish() {
        if (this.active) { this.active = false; context.active -= 1 }
        this.onended?.()
      }
    }
    context.created.push(oscillator)
    return oscillator
  }
  return context
}

test('R2 regression: critical audio preempts a low-priority voice without exceeding six active voices', () => {
  const context = makePriorityAudioContext()
  const audio = new AudioManager(new FakePlatform({ audioContext: context }), { soundEnabled: true, hapticEnabled: true })
  assert.equal(audio.unlock(), true)
  for (let index = 0; index < 6; index += 1) assert.equal(audio.play('fish_eaten', index + 1), true)
  assert.equal(audio.voices.length, 6)
  assert.equal(context.active, 6)
  assert.equal(audio.play('dead'), true)
  assert.equal(audio.voices.length, 6)
  assert.equal(context.active, 6)
  assert.equal(audio.voices.some((voice) => voice.name === 'dead'), true)
  const dead = audio.voices.find((voice) => voice.name === 'dead').oscillator
  dead.finish()
  dead.onended?.()
  assert.equal(audio.voices.length, 5)
  audio.stopVoices()
  for (const oscillator of context.created) oscillator.onended?.()
  assert.equal(audio.voices.length, 0)
  assert.equal(context.active, 0)
})
