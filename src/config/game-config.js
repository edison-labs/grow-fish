'use strict'

const GAME_CONFIG = Object.freeze({
  version: '0.1.0',
  tickRate: 60,
  maxCatchUpTicks: 5,
  maxFrameDelta: 0.1,
  player: Object.freeze({
    baseWidthRatio: 0.08,
    sizePerLevel: 1.08,
    maxWidthRatio: 0.16,
    baseSpeedRatio: 0.36,
    speedPerLevel: 0.96,
    bodyAspect: 0.52,
    collisionRatio: 0.7,
    spawnXRatio: 0.35,
    turnSmoothTime: 0.12,
    releaseTime: 0.2
  }),
  input: Object.freeze({ radiusShortSideRatio: 0.08, deadZoneRatio: 0.15 }),
  fish: Object.freeze({
    baseSpeedRatio: 0.14,
    levelSpeedScale: 0.98,
    minRandomSpeed: 0.85,
    maxRandomSpeed: 1.15,
    warningTime: 0.5,
    offscreenPadding: 24,
    spawnAttempts: 5,
    retryDelay: 0.2,
    safeContactTime: 0.8,
    equalCooldown: 0.5,
    equalBounceSpeedRatio: 0.08,
    capacity: 24
  }),
  grass: Object.freeze({
    initialCount: 6,
    maxAtLevelOne: 8,
    maxAfterLevelOne: 4,
    growTime: 0.4,
    respawnMin: 2,
    respawnMax: 3,
    noVisibleFallbackTime: 4,
    placementAttempts: 8,
    retryDelay: 0.5,
    capacity: 10
  }),
  spawn: Object.freeze({
    minInterval: 0.6,
    baseInterval: 1,
    intervalLevelStep: 0.04,
    lowPopulationRatio: 0.6,
    lowPopulationMultiplier: 0.5,
    edibleMinRatio: 0.5,
    openingProtectionTime: 5,
    levelUpPPlus2Protection: 2
  }),
  score: Object.freeze({ comboWindow: 3, comboStep: 0.1, comboMax: 2 }),
  timing: Object.freeze({ levelUpVisual: 0.3, invincible: 0.8, dead: 0.8, deadSlowMotion: 0.4, win: 1.2, tutorialLead: 3 }),
  layout: Object.freeze({ hudHeightRatio: 0.08, minAspect: 4 / 3, maxAspect: 21 / 9, maxDpr: 2 }),
  pools: Object.freeze({ effects: 128, floatingText: 32, warnings: 4 })
})

function growthForFish(level) {
  return 1 + (level * (level - 1)) / 2
}

function upgradeNeed(level) {
  if (level === 1) return 3
  if (level >= 10) return Infinity
  return 2 * growthForFish(level - 1)
}

function playerSizeScale(level) {
  return Math.min(2, Math.pow(GAME_CONFIG.player.sizePerLevel, level - 1))
}

function playerSpeedScale(level) {
  return Math.pow(GAME_CONFIG.player.speedPerLevel, level - 1)
}

function targetFishCount(level) {
  return Math.min(14, 8 + Math.floor(((level - 1) * 2) / 3))
}

function spawnInterval(level) {
  return Math.max(GAME_CONFIG.spawn.minInterval, GAME_CONFIG.spawn.baseInterval - GAME_CONFIG.spawn.intervalLevelStep * (level - 1))
}

function lethalCap(level) {
  if (level === 1) return 1
  return Math.min(3, 1 + Math.floor(level / 3))
}

function validateConfig(config = GAME_CONFIG) {
  const errors = []
  if (config.tickRate !== 60) errors.push('tickRate must be 60')
  if (config.player.releaseTime <= 0 || config.player.turnSmoothTime <= 0) errors.push('player timing must be positive')
  if (config.fish.capacity < 18) errors.push('fish pool too small')
  for (let level = 1; level <= 9; level += 1) {
    if (!Number.isFinite(upgradeNeed(level)) || upgradeNeed(level) <= 0) errors.push(`invalid upgradeNeed ${level}`)
    if (targetFishCount(level) < 8 || targetFishCount(level) > 14) errors.push(`invalid target ${level}`)
  }
  return errors
}

module.exports = {
  GAME_CONFIG,
  growthForFish,
  upgradeNeed,
  playerSizeScale,
  playerSpeedScale,
  targetFishCount,
  spawnInterval,
  lethalCap,
  validateConfig
}

