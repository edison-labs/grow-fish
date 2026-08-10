'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  GAME_CONFIG,
  growthForFish,
  upgradeNeed,
  targetFishCount,
  spawnInterval,
  lethalCap,
  validateConfig
} = require('../src/config/game-config')
const { SeededRng } = require('../src/core/seeded-rng')
const { relationFor, ellipsesOverlap } = require('../src/core/math')

test('策划冻结公式与边界保持一致', () => {
  assert.equal(GAME_CONFIG.tickRate, 60)
  assert.deepEqual(Array.from({ length: 5 }, (_, index) => growthForFish(index + 1)), [1, 2, 4, 7, 11])
  assert.equal(upgradeNeed(1), 3)
  assert.equal(upgradeNeed(2), 2)
  assert.equal(upgradeNeed(9), 58)
  assert.equal(upgradeNeed(10), Infinity)
  assert.equal(targetFishCount(1), 8)
  assert.equal(targetFishCount(10), 14)
  assert.equal(spawnInterval(1), 1)
  assert.equal(spawnInterval(10), 0.64)
  assert.deepEqual([lethalCap(1), lethalCap(3), lethalCap(6), lethalCap(10)], [1, 2, 3, 3])
  assert.deepEqual(validateConfig(), [])
})

test('关系与椭圆碰撞边界明确', () => {
  assert.equal(relationFor(3, 2), 'EDIBLE')
  assert.equal(relationFor(3, 3), 'EQUAL')
  assert.equal(relationFor(3, 4), 'LETHAL')
  assert.equal(ellipsesOverlap({ x: 0, y: 0, rx: 2, ry: 1 }, { x: 4, y: 0, rx: 2, ry: 1 }), true)
  assert.equal(ellipsesOverlap({ x: 0, y: 0, rx: 2, ry: 1 }, { x: 4.01, y: 0, rx: 2, ry: 1 }), false)
})

test('同 seed 随机流可复现且用途流彼此隔离', () => {
  const first = new SeededRng(42)
  const second = new SeededRng(42)
  assert.deepEqual(Array.from({ length: 12 }, () => first.nextUint()), Array.from({ length: 12 }, () => second.nextUint()))
  const master = new SeededRng(42)
  const gameplay = master.derive('gameplay')
  const appearance = master.derive('appearance')
  assert.notEqual(gameplay.nextUint(), appearance.nextUint())
})
