'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GAME_CONFIG, upgradeNeed } = require('../src/config/game-config')
const { GameCore } = require('../src/core/game-core')
const { FakePlatform } = require('../src/platform/fake-platform')
const { TestHarness } = require('../src/debug/test-harness')

const fixedDt = 1 / GAME_CONFIG.tickRate

function makeWorld(seed = 20260731, options = {}) {
  const platform = new FakePlatform(options)
  const core = new GameCore(platform, { seed })
  const harness = new TestHarness(core)
  harness.startRun(seed)
  core.drainEvents()
  return { platform, core, harness }
}

function compactFish(core) {
  return core.fishPool.items
    .filter((fish) => fish.inUse)
    .map((fish) => ({ level: fish.level, side: fish.side, active: fish.active, pending: fish.pending, x: fish.x, y: fish.y, vx: fish.vx }))
}

test('相同 seed、输入与 tick 数产生同一世界', () => {
  const a = makeWorld(8848)
  const b = makeWorld(8848)
  for (let tick = 0; tick < 240; tick += 1) {
    a.core.update(fixedDt)
    b.core.update(fixedDt)
  }
  assert.equal(a.core.screenState, b.core.screenState)
  assert.deepEqual(a.core.stats, b.core.stats)
  assert.deepEqual(compactFish(a.core), compactFish(b.core))
  assert.deepEqual(a.core.spawnManager.trace, b.core.spawnManager.trace)
})

test('同 tick 致命碰撞优先于吃鱼、吃草和同级弹开', () => {
  const { core, harness } = makeWorld()
  harness.setPlayer({ level: 2, xp: 0 })
  const edible = harness.spawnFish({ level: 1, x: core.player.x, y: core.player.y, vx: 0 })
  const lethal = harness.spawnFish({ level: 3, x: core.player.x, y: core.player.y, vx: 0 })
  const equal = harness.spawnFish({ level: 2, x: core.player.x, y: core.player.y, vx: 0 })
  const grass = harness.spawnGrass({ x: core.player.x, y: core.player.y })
  harness.injectCollisionSet([
    { type: 'EDIBLE', entity: edible },
    { type: 'GRASS', entity: grass },
    { type: 'EQUAL', entity: equal },
    { type: 'LETHAL', entity: lethal }
  ])
  core.update(fixedDt)
  assert.equal(core.screenState, 'DEAD')
  assert.equal(core.stats.score, 0)
  assert.equal(core.stats.fishEaten, 0)
  assert.equal(core.stats.grassEaten, 0)
  assert.equal(edible.inUse, true)
  assert.equal(grass.active, true)
})

test('升级仅触发一级并安全收缩 Lv2 草丛总量至 4', () => {
  const { core } = makeWorld()
  assert.equal(core.grassPool.activeCount(), 6)
  core.player.xp = upgradeNeed(1)
  core.update(fixedDt)
  assert.equal(core.player.level, 2)
  assert.equal(core.player.xp, 0)
  assert.equal(core.grassPool.activeCount(), GAME_CONFIG.grass.maxAfterLevelOne)
  assert.equal(core.invincibleRemaining > 0, true)
  assert.equal(core.pPlus2Protection > 0, true)
  assert.equal(core.eventLog.filter((event) => event.type === 'grass_retired').length, 2)
})

test('溢出成长在升级表现结束后的下一 tick 才继续升级', () => {
  const { core } = makeWorld()
  core.player.xp = 20
  core.update(fixedDt)
  assert.equal(core.player.level, 2)
  const overlayTicks = Math.ceil(GAME_CONFIG.timing.levelUpVisual * GAME_CONFIG.tickRate)
  for (let tick = 0; tick < overlayTicks; tick += 1) core.update(fixedDt)
  assert.equal(core.player.level, 2)
  assert.equal(core.levelUpRemaining, 0)
  core.update(fixedDt)
  assert.equal(core.player.level, 3)
})

test('升级无敌期压制危险，必须分离后才恢复致死', () => {
  const { core, harness } = makeWorld()
  harness.setPlayer({ level: 2 })
  const lethal = harness.spawnFish({ level: 3, x: core.player.x, y: core.player.y, vx: 0 })
  core.invincibleRemaining = 0.5
  core.update(fixedDt)
  assert.equal(core.screenState, 'RUNNING')
  assert.equal(lethal.dangerSuppressed, true)
  core.invincibleRemaining = 0
  core.update(fixedDt)
  assert.equal(core.screenState, 'RUNNING')
  lethal.x = core.layout.playable.right - lethal.width
  lethal.y = lethal.baseY = core.layout.playable.bottom - lethal.height
  core.update(fixedDt)
  assert.equal(lethal.dangerSuppressed, false)
  lethal.x = core.player.x
  lethal.y = lethal.baseY = core.player.y
  core.update(fixedDt)
  assert.equal(core.screenState, 'DEAD')
})

test('死亡演出后只结算一次并进入 RESULT', () => {
  const { core, harness, platform } = makeWorld()
  const killer = harness.spawnFish({ level: 2, x: core.player.x, y: core.player.y, vx: 0 })
  harness.injectCollisionSet([{ type: 'LETHAL', entity: killer }])
  core.update(fixedDt)
  assert.equal(core.screenState, 'DEAD')
  for (let tick = 0; tick < GAME_CONFIG.timing.dead * GAME_CONFIG.tickRate; tick += 1) core.update(fixedDt)
  assert.equal(core.screenState, 'RESULT')
  assert.equal(core.result.killerLevel, 2)
  assert.equal(core.result.saved, true)
  const writes = platform.storage.size
  for (let tick = 0; tick < 120; tick += 1) core.update(fixedDt)
  assert.equal(platform.storage.size, writes)
  assert.equal(core.eventLog.filter((event) => event.type === 'game_result').length, 1)
})

test('Lv9 达标进入胜利并在演出后结算', () => {
  const { core } = makeWorld()
  core.player.level = 9
  core.player.xp = upgradeNeed(9)
  core.updatePlayerDimensions()
  core.update(fixedDt)
  assert.equal(core.player.level, 10)
  assert.equal(core.screenState, 'WIN')
  for (let tick = 0; tick < GAME_CONFIG.timing.win * GAME_CONFIG.tickRate; tick += 1) core.update(fixedDt)
  assert.equal(core.screenState, 'RESULT')
  assert.equal(core.result.won, true)
})

test('开局 5 秒绝对只允许 Lv1/Lv2，并保留可观测生成轨迹', () => {
  const { core } = makeWorld(77)
  core.releaseAllEntities()
  core.runClock = 0
  for (let index = 0; index < 16; index += 1) {
    const decision = core.spawnManager.tryReserve()
    if (decision.level !== undefined) assert.equal([1, 2].includes(decision.level), true)
    core.fishPool.releaseAll((fish) => { fish.active = false; fish.pending = false })
  }
  assert.equal(core.spawnManager.trace.length, 16)
  assert.equal(core.spawnManager.trace.every((decision) => decision.openingProtection), true)
})

test('初始对象满足安全布局，统一刷新器从首 tick 逐条补向目标', () => {
  const { core } = makeWorld(20260731)
  const fish = core.fishPool.items.filter((item) => item.inUse)
  const grass = core.grassPool.items.filter((item) => item.inUse)
  assert.equal(fish.length, 4)
  assert.equal(fish.every((item) => item.level === 1 && item.active && !item.pending), true)
  assert.equal(grass.length, 6)
  const nearGrass = grass.filter((item) => {
    const distanceInWidths = Math.hypot(item.x - core.player.x, item.y - core.player.y) / core.player.width
    return distanceInWidths >= 1 && distanceInWidths <= 2.5
  })
  assert.equal(nearGrass.length >= 2, true)
  assert.equal(fish.every((item) => Math.hypot(item.x - core.player.x, item.y - core.player.y) >= core.player.width * 1.5), true)
  for (let left = 0; left < fish.length; left += 1) {
    for (let right = left + 1; right < fish.length; right += 1) {
      assert.equal(Math.hypot(fish[left].x - fish[right].x, fish[left].y - fish[right].y) > fish[left].width, true)
    }
  }
  core.update(fixedDt)
  assert.equal(core.spawnManager.trace.length, 1)
  assert.equal(core.spawnManager.counts().totalReserved, 5)
})

test('生成失败按 0.2 秒短重试，不叠加正常刷新间隔', () => {
  const { core } = makeWorld(99)
  core.releaseAllEntities()
  const originalAcquire = core.acquireFish.bind(core)
  core.acquireFish = () => null
  const failed = core.spawnManager.tryReserve()
  assert.equal(failed.result, 'pool_exhausted')
  assert.equal(core.spawnManager.retryRemaining, GAME_CONFIG.fish.retryDelay)
  const before = core.spawnManager.trace.length
  core.spawnManager.update(0.19)
  assert.equal(core.spawnManager.trace.length, before)
  core.acquireFish = originalAcquire
  core.spawnManager.update(0.011)
  assert.equal(core.spawnManager.trace.length, before + 1)
  assert.equal(['spawn_reserved', 'warning_reserved'].includes(core.spawnManager.lastDecision.result), true)
})

test('旋转重排不把预警/入场鱼夹进可视区', () => {
  const { core, harness } = makeWorld()
  const pending = harness.spawnFish({ level: 2, side: 'left', active: false, pending: true, entering: true })
  const entering = harness.spawnFish({ level: 1, side: 'right', active: true, entering: true })
  const resident = harness.spawnFish({ level: 1, side: 'left', active: true, entering: false, x: core.layout.playable.left, y: core.layout.playable.top })
  const overlappingDanger = harness.spawnFish({ level: 2, active: true, entering: false, x: core.player.x, y: core.player.y })
  core.resize({ width: 1200, height: 600, dpr: 1, safeArea: null, menuButton: null })
  assert.equal(core.screenState, 'PAUSED')
  assert.equal(pending.x + pending.width * 0.5 < core.layout.playable.left, true)
  assert.equal(entering.x - entering.width * 0.5 > core.layout.playable.right, true)
  assert.equal(resident.x - resident.width * 0.5 >= core.layout.playable.left, true)
  assert.equal(resident.y - resident.height * 0.5 >= core.layout.playable.top, true)
  assert.equal(overlappingDanger.dangerSuppressed, true)
  assert.equal(core.grassPool.items.filter((grass) => grass.inUse).every((grass) => grass.x - grass.width >= core.layout.playable.left && grass.x + grass.width <= core.layout.playable.right), true)
})

test('危险生成安全逃生评估包含上下边界净空', () => {
  const { core } = makeWorld()
  const bounds = core.layout.playable
  core.player.y = bounds.top + core.player.height * 0.35
  const farCandidate = { x: bounds.right + 1000, y: bounds.bottom, vx: 0, width: 10, height: 10 }
  assert.equal(core.simulateSafetyPath(farCandidate, 0, 0, 1, fixedDt, true), false)
})

test('后台切换会暂停，横屏恢复后需显式继续', () => {
  const { core } = makeWorld()
  core.onHide()
  assert.equal(core.screenState, 'PAUSED')
  core.onShow()
  assert.equal(core.screenState, 'PAUSED')
  assert.equal(core.resume(), true)
  assert.equal(core.screenState, 'RUNNING')
})
