'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GameCore } = require('../src/core/game-core')
const { FakePlatform } = require('../src/platform/fake-platform')
const { TestHarness, configHash } = require('../src/debug/test-harness')
const { GAME_CONFIG } = require('../src/config/game-config')

test('100 局无渲染循环不扩张实体池、不残留结果锁', () => {
  const core = new GameCore(new FakePlatform())
  const harness = new TestHarness(core)
  const fixedDt = 1 / GAME_CONFIG.tickRate
  for (let run = 0; run < 100; run += 1) {
    core.startRun(run)
    const killer = harness.spawnFish({ level: 2, x: core.player.x, y: core.player.y, vx: 0 })
    harness.injectCollisionSet([{ type: 'LETHAL', entity: killer }])
    core.update(fixedDt)
    core.onShow()
    assert.equal(core.screenState, 'RESULT')
  }
  core.quitRun()
  core.releaseAllEntities()
  assert.equal(core.fishPool.items.length, GAME_CONFIG.fish.capacity)
  assert.equal(core.grassPool.items.length, GAME_CONFIG.grass.capacity)
  assert.equal(core.fishPool.activeCount(), 0)
  assert.equal(core.grassPool.activeCount(), 0)
  assert.equal(core.eventLog.length <= 2048, true)
})

test('调试接口提供稳定配置哈希、计数与结果锁观测', () => {
  const core = new GameCore(new FakePlatform())
  const harness = new TestHarness(core)
  harness.startRun(1)
  assert.match(configHash(), /^[0-9a-f]{8}$/)
  assert.equal(harness.config().hash, configHash())
  assert.equal(harness.counts().totalReserved, 4)
  assert.deepEqual(harness.resultState(), { locked: false, committed: false, result: null })
  assert.equal(harness.spawnTrace().length, 0)
})
