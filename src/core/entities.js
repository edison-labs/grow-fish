'use strict'

function createFishSlot(poolIndex) {
  return {
    poolIndex,
    inUse: false,
    generation: 0,
    spawnSeq: 0,
    active: false,
    pending: false,
    level: 1,
    visualId: 0,
    side: 'left',
    direction: 1,
    x: 0,
    y: 0,
    baseY: 0,
    vx: 0,
    width: 0,
    height: 0,
    age: 0,
    phase: 0,
    amplitude: 0,
    period: 2,
    warningRemaining: 0,
    equalCooldown: 0,
    dangerSuppressed: false,
    entering: false
  }
}

function resetFish(fish) {
  fish.active = false
  fish.pending = false
  fish.level = 1
  fish.visualId = 0
  fish.side = 'left'
  fish.direction = 1
  fish.x = 0
  fish.y = 0
  fish.baseY = 0
  fish.vx = 0
  fish.width = 0
  fish.height = 0
  fish.age = 0
  fish.phase = 0
  fish.amplitude = 0
  fish.period = 2
  fish.warningRemaining = 0
  fish.equalCooldown = 0
  fish.dangerSuppressed = false
  fish.entering = false
}

function createGrassSlot(poolIndex) {
  return {
    poolIndex,
    inUse: false,
    generation: 0,
    spawnSeq: 0,
    active: false,
    visualId: -1,
    x: 0,
    y: 0,
    width: 24,
    height: 42,
    growRemaining: 0,
    respawnRemaining: 0,
    swayPhase: 0
  }
}

function resetGrass(grass) {
  grass.active = false
  grass.visualId = -1
  grass.x = 0
  grass.y = 0
  grass.width = 24
  grass.height = 42
  grass.growRemaining = 0
  grass.respawnRemaining = 0
  grass.swayPhase = 0
}

function fishBody(fish) {
  return { x: fish.x, y: fish.y, rx: fish.width * 0.35, ry: fish.height * 0.35 }
}

function fishVisualMargins(fish) {
  const facingRight = (fish.direction || 1) >= 0
  return {
    left: fish.width * (facingRight ? 0.65 : 0.42),
    right: fish.width * (facingRight ? 0.42 : 0.65),
    top: fish.height * 0.5,
    bottom: fish.height * 0.5
  }
}

function grassBody(grass) {
  return { x: grass.x, y: grass.y - grass.height * 0.16, rx: grass.width * 0.32, ry: grass.height * 0.25 }
}

module.exports = { createFishSlot, resetFish, createGrassSlot, resetGrass, fishBody, fishVisualMargins, grassBody }
