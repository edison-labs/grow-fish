'use strict'

const {
  GAME_CONFIG,
  growthForFish,
  upgradeNeed,
  playerSizeScale,
  playerSpeedScale,
  validateConfig
} = require('../config/game-config')
const { SeededRng } = require('./seeded-rng')
const { ObjectPool } = require('./object-pool')
const { clamp, ellipsesOverlap, relationFor } = require('./math')
const { createFishSlot, resetFish, createGrassSlot, resetGrass, fishBody, fishVisualMargins } = require('./entities')
const { computeLayout } = require('../render/layout')
const { InputController } = require('../input/input-controller')
const { SaveManager } = require('../storage/save-manager')
const { SpawnManager } = require('../spawn/spawn-manager')
const { CollisionSystem } = require('../collision/collision-system')

function decayTimer(value, dt) {
  const next = value - dt
  return next <= 1e-9 ? 0 : next
}

class GameCore {
  constructor(platform, options = {}) {
    const errors = validateConfig()
    if (errors.length) throw new Error(`Invalid game config: ${errors.join(', ')}`)
    this.platform = platform
    this.layout = computeLayout(options.viewport || platform.getViewport())
    this.saveManager = options.saveManager || new SaveManager(platform)
    this.input = new InputController((action) => this.handleAction(action))
    this.fishPool = new ObjectPool('fish', GAME_CONFIG.fish.capacity, createFishSlot)
    this.grassPool = new ObjectPool('grass', GAME_CONFIG.grass.capacity, createGrassSlot)
    this.spawnManager = new SpawnManager(this)
    this.collisionSystem = new CollisionSystem(this)
    this.events = []
    this.eventLog = []
    this.tick = 0
    this.runId = 0
    this.spawnSeq = 0
    this.screenState = 'HOME'
    this.pausedFrom = null
    this.pauseView = null
    this.orientationBlocked = !this.layout.isLandscape
    this.hidden = false
    this.resultLocked = false
    this.resultCommitted = false
    this.result = null
    this.runClock = 0
    this.cinematicClock = 0
    this.levelUpRemaining = 0
    this.invincibleRemaining = 0
    this.pPlus2Protection = 0
    this.noVisibleGrassTime = 0
    this.grassRetryRemaining = 0
    this.comboEligibleThisFrame = false
    this.masterSeed = options.seed === undefined ? 20260731 : options.seed >>> 0
    this.setSeed(this.masterSeed)
    this.player = this.createPlayer()
    this.stats = this.createStats()
    this.tutorial = this.createTutorial()
    this.debug = { enabled: false, freezeAI: false, showCollision: false, droppedTicks: 0 }
  }

  setSeed(seed) {
    this.masterSeed = seed >>> 0
    const master = new SeededRng(this.masterSeed)
    this.gameplayRng = master.derive('gameplay')
    this.appearanceRng = master.derive('appearance')
    this.fxRng = master.derive('fx')
  }

  createPlayer() {
    return { level: 1, xp: 0, x: 0, y: 0, vx: 0, vy: 0, width: 0, height: 0, facing: 1, releaseVx: 0, releaseVy: 0, releaseElapsed: GAME_CONFIG.player.releaseTime }
  }

  createStats() {
    return { score: 0, fishEaten: 0, grassEaten: 0, comboCount: 0, comboTimer: 0, highestCombo: 0 }
  }

  createTutorial() {
    return { enabled: !this.saveManager.data.tutorialCompleted, elapsed: 0, ateGrass: false, ateFish: false }
  }

  startRun(seed) {
    this.releaseAllEntities()
    this.runId += 1
    this.tick = 0
    this.spawnSeq = 0
    this.setSeed(seed === undefined ? ((this.platform.now() >>> 0) ^ Math.imul(this.runId, 2654435761)) >>> 0 : seed)
    this.screenState = 'RUNNING'
    this.pausedFrom = null
    this.pauseView = null
    this.orientationBlocked = !this.layout.isLandscape
    this.resultLocked = false
    this.resultCommitted = false
    this.result = null
    this.runClock = 0
    this.cinematicClock = 0
    this.levelUpRemaining = 0
    this.invincibleRemaining = 0
    this.pPlus2Protection = 0
    this.noVisibleGrassTime = 0
    this.grassRetryRemaining = 0
    this.comboEligibleThisFrame = false
    this.player = this.createPlayer()
    this.stats = this.createStats()
    this.tutorial = this.createTutorial()
    this.spawnManager.reset()
    this.input.clear(true)
    this.updatePlayerDimensions()
    const bounds = this.layout.playable
    this.player.x = bounds.left + (bounds.right - bounds.left) * GAME_CONFIG.player.spawnXRatio
    this.player.y = bounds.top + (bounds.bottom - bounds.top) * 0.5
    this.spawnInitialGrass()
    this.spawnInitialFish()
    this.emit('game_start', { runId: this.runId, seed: this.masterSeed, firstTutorial: this.tutorial.enabled })
    if (this.orientationBlocked) this.pause('orientation')
  }

  update(dt = 1 / GAME_CONFIG.tickRate) {
    if (this.screenState === 'DEAD' || this.screenState === 'WIN') return this.updateCinematic(dt)
    if (this.screenState !== 'RUNNING') return
    const frameSnapshot = { level: this.player.level, invincible: this.invincibleRemaining > 0 }
    const levelUpActiveAtFrameStart = this.levelUpRemaining > 0
    this.comboEligibleThisFrame = this.stats.comboTimer > 0
    this.tick += 1
    this.runClock += dt
    if (this.tutorial.enabled) this.tutorial.elapsed += dt
    if (this.stats.comboTimer > 0) {
      this.stats.comboTimer = decayTimer(this.stats.comboTimer, dt)
    }
    if (this.invincibleRemaining > 0) this.invincibleRemaining = decayTimer(this.invincibleRemaining, dt)
    if (this.pPlus2Protection > 0) this.pPlus2Protection = decayTimer(this.pPlus2Protection, dt)
    if (this.levelUpRemaining > 0) {
      this.levelUpRemaining = decayTimer(this.levelUpRemaining, dt)
      if (this.levelUpRemaining === 0) this.emit('level_up_visual_end', { level: this.player.level })
    }
    this.updatePlayer(dt)
    if (!this.debug.freezeAI) this.updateFish(dt)
    this.updateGrass(dt)
    this.spawnManager.update(dt)
    this.collisionSystem.resolve(frameSnapshot)
    if (this.stats.comboTimer === 0) this.stats.comboCount = 0
    if (this.screenState !== 'RUNNING') return
    if (!levelUpActiveAtFrameStart && this.levelUpRemaining <= 0 && this.player.level < 10 && this.player.xp >= upgradeNeed(this.player.level)) this.applyLevelUp()
  }

  updateCinematic(dt) {
    if (this.screenState === 'DEAD' && this.cinematicClock < GAME_CONFIG.timing.deadSlowMotion && !this.debug.freezeAI) {
      const remaining = GAME_CONFIG.timing.deadSlowMotion - this.cinematicClock
      const motionDt = Math.min(dt, remaining)
      const slowScale = 0.35 * clamp(remaining / GAME_CONFIG.timing.deadSlowMotion, 0, 1)
      this.updateFish(motionDt * slowScale)
    }
    this.cinematicClock += dt
    const duration = this.screenState === 'DEAD' ? GAME_CONFIG.timing.dead : GAME_CONFIG.timing.win
    if (this.cinematicClock + 1e-9 >= duration) this.enterResult()
  }

  updatePlayer(dt) {
    const move = this.input.move
    const maxSpeed = this.layout.width * GAME_CONFIG.player.baseSpeedRatio * playerSpeedScale(this.player.level)
    if (move.active) {
      const targetX = move.directionX * maxSpeed * move.ratio
      const targetY = move.directionY * maxSpeed * move.ratio
      const alpha = 1 - Math.exp(-dt / GAME_CONFIG.player.turnSmoothTime)
      this.player.vx += (targetX - this.player.vx) * alpha
      this.player.vy += (targetY - this.player.vy) * alpha
      this.player.releaseElapsed = 0
    } else if (move.released) {
      if (this.player.releaseElapsed === 0) {
        this.player.releaseVx = this.player.vx
        this.player.releaseVy = this.player.vy
      }
      this.player.releaseElapsed = Math.min(GAME_CONFIG.player.releaseTime, this.player.releaseElapsed + dt)
      const ratio = 1 - this.player.releaseElapsed / GAME_CONFIG.player.releaseTime
      this.player.vx = this.player.releaseVx * Math.max(0, ratio)
      this.player.vy = this.player.releaseVy * Math.max(0, ratio)
      if (this.player.releaseElapsed >= GAME_CONFIG.player.releaseTime) move.released = false
    } else if (!move.active) {
      this.player.vx = 0
      this.player.vy = 0
    }
    this.player.x += this.player.vx * dt
    this.player.y += this.player.vy * dt
    if (Math.abs(this.player.vx) > maxSpeed * 0.04) this.player.facing = this.player.vx < 0 ? -1 : 1
    this.clampPlayerToBounds()
  }

  updateFish(dt) {
    const bounds = this.layout.playable
    for (const fish of this.fishPool.items) {
      if (!fish.inUse || !fish.active) continue
      fish.age += dt
      fish.equalCooldown = decayTimer(fish.equalCooldown, dt)
      fish.x += fish.vx * dt
      const visual = fishVisualMargins(fish)
      fish.y = clamp(fish.baseY + Math.sin(fish.phase + (fish.age * Math.PI * 2) / fish.period) * fish.amplitude, bounds.top + visual.top, bounds.bottom - visual.bottom)
      fish.entering = fish.side === 'left' ? fish.x - visual.left < bounds.left : fish.x + visual.right > bounds.right
      const departed = fish.direction > 0 ? fish.x - visual.left > bounds.right : fish.x + visual.right < bounds.left
      if (departed) this.releaseFish(fish)
    }
  }

  updateGrass(dt) {
    this.enforceGrassPopulationCap()
    let visible = 0
    let active = 0
    for (const grass of this.grassPool.items) {
      if (!grass.inUse) continue
      if (grass.active) {
        active += 1
        grass.growRemaining = decayTimer(grass.growRemaining, dt)
        if (grass.growRemaining <= 0) visible += 1
      } else if (grass.respawnRemaining > 0) grass.respawnRemaining = decayTimer(grass.respawnRemaining, dt)
    }
    const maxGrass = this.player.level === 1 ? GAME_CONFIG.grass.maxAtLevelOne : GAME_CONFIG.grass.maxAfterLevelOne
    for (const grass of this.grassPool.items) {
      if (active >= maxGrass) break
      if (grass.inUse && !grass.active && grass.respawnRemaining <= 0 && this.placeGrass(grass, false)) { active += 1; visible += 0 }
    }
    if (this.player.level === 1 && visible === 0) this.noVisibleGrassTime += dt
    else this.noVisibleGrassTime = 0
    if (this.grassRetryRemaining > 0) this.grassRetryRemaining = decayTimer(this.grassRetryRemaining, dt)
    if (this.player.level === 1 && this.noVisibleGrassTime >= GAME_CONFIG.grass.noVisibleFallbackTime && this.grassRetryRemaining <= 0) {
      const grass = this.grassPool.items.find((item) => !item.inUse || (!item.active && item.respawnRemaining <= 0))
      if (grass && this.placeGrass(grass, true)) this.noVisibleGrassTime = 0
      else this.grassRetryRemaining = GAME_CONFIG.grass.retryDelay
    }
  }

  updatePlayerDimensions() {
    const width = Math.min(this.layout.width * GAME_CONFIG.player.maxWidthRatio, this.layout.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(this.player.level))
    this.player.width = width
    this.player.height = width * GAME_CONFIG.player.bodyAspect
  }

  playerBody(position = this.player) {
    return { x: position.x, y: position.y, rx: this.player.width * 0.35, ry: this.player.height * 0.35 }
  }

  clampPlayerToBounds() {
    const bounds = this.layout.playable
    const rx = this.player.width * 0.35
    const ry = this.player.height * 0.35
    if (this.player.x < bounds.left + rx) { this.player.x = bounds.left + rx; if (this.player.vx < 0) this.player.vx = 0 }
    if (this.player.x > bounds.right - rx) { this.player.x = bounds.right - rx; if (this.player.vx > 0) this.player.vx = 0 }
    if (this.player.y < bounds.top + ry) { this.player.y = bounds.top + ry; if (this.player.vy < 0) this.player.vy = 0 }
    if (this.player.y > bounds.bottom - ry) { this.player.y = bounds.bottom - ry; if (this.player.vy > 0) this.player.vy = 0 }
  }

  acquireFish(level, side, randomize = true) {
    const fish = this.fishPool.acquire(resetFish)
    if (!fish) return null
    fish.spawnSeq = ++this.spawnSeq
    fish.level = clamp(Math.floor(level), 1, 10)
    fish.side = side
    fish.direction = side === 'left' ? 1 : -1
    fish.visualId = fish.level - 1
    const size = Math.min(this.layout.width * GAME_CONFIG.player.maxWidthRatio, this.layout.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(fish.level))
    fish.width = size
    fish.height = size * GAME_CONFIG.player.bodyAspect
    const randomScale = randomize ? this.gameplayRng.range(GAME_CONFIG.fish.minRandomSpeed, GAME_CONFIG.fish.maxRandomSpeed) : 1
    fish.vx = fish.direction * this.layout.width * GAME_CONFIG.fish.baseSpeedRatio * randomScale * Math.pow(GAME_CONFIG.fish.levelSpeedScale, fish.level - 1)
    fish.phase = randomize ? this.gameplayRng.range(0, Math.PI * 2) : fish.spawnSeq
    fish.amplitude = this.layout.height * (randomize ? this.gameplayRng.range(0.01, 0.03) : 0.015)
    fish.period = randomize ? this.gameplayRng.range(1.5, 3) : 2.2
    return fish
  }

  releaseFish(fish) { this.fishPool.release(fish, resetFish) }

  spawnInitialFish() {
    const bounds = this.layout.playable
    const positions = [[0.62, 0.22], [0.8, 0.43], [0.58, 0.72], [0.83, 0.84]]
    positions.forEach(([nx, ny], index) => {
      const side = index % 2 === 0 ? 'left' : 'right'
      const fish = this.acquireFish(1, side, false)
      if (!fish) return
      fish.active = true
      fish.entering = false
      fish.x = bounds.left + (bounds.right - bounds.left) * nx
      fish.y = bounds.top + (bounds.bottom - bounds.top) * ny
      fish.baseY = fish.y
    })
  }

  spawnInitialGrass() {
    const angleSet = [0, Math.PI * 0.72, Math.PI * 1.15, Math.PI * 1.55, Math.PI * 0.3, Math.PI * 1.85]
    for (let index = 0; index < GAME_CONFIG.grass.initialCount; index += 1) {
      const grass = this.grassPool.acquire(resetGrass)
      if (!grass) break
      grass.spawnSeq = ++this.spawnSeq
      const near = index < 2
      const distance = this.player.width * (near ? (index === 0 ? 1.4 : 2.1) : (2.8 + index * 0.3))
      const angle = angleSet[index]
      grass.x = this.player.x + Math.cos(angle) * distance
      grass.y = this.player.y + Math.sin(angle) * distance
      if (this.isGrassPositionLegal(grass, true)) this.activateGrass(grass)
      else if (near && this.placeInitialNearGrass(grass, index)) continue
      else if (!this.placeGrass(grass, false)) this.placeInitialGrassFallback(grass, index)
    }
  }

  placeInitialNearGrass(grass, index) {
    const distances = index === 0 ? [1.4, 1.8, 2.2, 1.1, 2.5] : [2.1, 1.6, 2.4, 1.2, 1.9]
    for (const distanceRatio of distances) {
      for (let angleIndex = 0; angleIndex < 16; angleIndex += 1) {
        const angle = ((angleIndex + index * 5) / 16) * Math.PI * 2
        grass.x = this.player.x + Math.cos(angle) * this.player.width * distanceRatio
        grass.y = this.player.y + Math.sin(angle) * this.player.width * distanceRatio
        if (this.isGrassPositionLegal(grass, true)) { this.activateGrass(grass); return true }
      }
    }
    return false
  }

  placeInitialGrassFallback(grass, index) {
    const legal = this.grassPlacementBounds(grass)
    const columns = 9
    const rows = 5
    for (let offset = 0; offset < columns * rows; offset += 1) {
      const cell = (offset * 17 + index * 11) % (columns * rows)
      const column = cell % columns
      const row = Math.floor(cell / columns)
      grass.x = legal.xMin + ((legal.xMax - legal.xMin) * column) / (columns - 1)
      grass.y = legal.yMin + ((legal.yMax - legal.yMin) * row) / (rows - 1)
      if (this.isGrassPositionLegal(grass, false)) { this.activateGrass(grass); return true }
    }
    return false
  }

  grassPlacementBounds(grass, layout = this.layout) {
    const bounds = layout.playable
    const edgeMargin = Math.min(layout.width, layout.height) * 0.05
    const xPadding = Math.max(grass.width, edgeMargin)
    const topPadding = Math.max(grass.height, edgeMargin)
    const bottomPadding = Math.max(grass.height * 0.4, edgeMargin)
    return {
      xMin: bounds.left + xPadding,
      xMax: bounds.right - xPadding,
      yMin: bounds.top + topPadding,
      yMax: bounds.bottom - bottomPadding
    }
  }

  placeGrass(grass, preferForward) {
    if (!grass.inUse) {
      const acquired = this.grassPool.acquire(resetGrass)
      if (!acquired) return false
      grass = acquired
      grass.spawnSeq = ++this.spawnSeq
    }
    const legal = this.grassPlacementBounds(grass)
    const baseAngle = preferForward ? Math.atan2(this.player.vy || 0, this.player.vx || this.player.facing) : this.gameplayRng.range(0, Math.PI * 2)
    for (let attempt = 0; attempt < GAME_CONFIG.grass.placementAttempts; attempt += 1) {
      const fan = attempt < 5 ? this.gameplayRng.range(-Math.PI / 3, Math.PI / 3) : this.gameplayRng.range(-Math.PI, Math.PI)
      const distance = this.player.width * this.gameplayRng.range(1.5, 3)
      grass.x = clamp(this.player.x + Math.cos(baseAngle + fan) * distance, legal.xMin, legal.xMax)
      grass.y = clamp(this.player.y + Math.sin(baseAngle + fan) * distance, legal.yMin, legal.yMax)
      if (this.isGrassPositionLegal(grass, false)) { this.activateGrass(grass); return true }
    }
    if (grass.inUse && !grass.active) grass.respawnRemaining = GAME_CONFIG.grass.retryDelay
    return false
  }

  activateGrass(grass) {
    if (!Number.isInteger(grass.visualId) || grass.visualId < 0) grass.visualId = grass.spawnSeq % 3
    grass.active = true
    grass.growRemaining = GAME_CONFIG.grass.growTime
    grass.respawnRemaining = 0
    grass.swayPhase = this.fxRng.range(0, Math.PI * 2)
  }

  isGrassPositionLegal(candidate, allowNearPlayer) {
    const legal = this.grassPlacementBounds(candidate)
    if (candidate.x < legal.xMin || candidate.x > legal.xMax || candidate.y < legal.yMin || candidate.y > legal.yMax) return false
    const dx = candidate.x - this.player.x
    const dy = candidate.y - this.player.y
    if (!allowNearPlayer && Math.sqrt(dx * dx + dy * dy) < this.player.width) return false
    for (const grass of this.grassPool.items) {
      if (!grass.inUse || !grass.active || grass === candidate) continue
      const gx = grass.x - candidate.x
      const gy = grass.y - candidate.y
      if (Math.sqrt(gx * gx + gy * gy) < Math.max(grass.width, candidate.width) * 1.5) return false
    }
    return true
  }

  relayoutActiveGrass() {
    const activeGrass = this.grassPool.items
      .filter((grass) => grass.inUse && grass.active)
      .sort((a, b) => a.spawnSeq - b.spawnSeq || a.poolIndex - b.poolIndex)
    const placed = []
    const positionIsLegal = (grass, x, y) => {
      const legal = this.grassPlacementBounds(grass)
      if (x < legal.xMin || x > legal.xMax || y < legal.yMin || y > legal.yMax) return false
      if (Math.hypot(x - this.player.x, y - this.player.y) < this.player.width) return false
      return placed.every((other) => Math.hypot(x - other.x, y - other.y) >= Math.max(grass.width, other.width) * 1.5)
    }

    for (const grass of activeGrass) {
      const mappedX = grass.x
      const mappedY = grass.y
      if (!positionIsLegal(grass, mappedX, mappedY)) {
        const legal = this.grassPlacementBounds(grass)
        const columns = 25
        const rows = 15
        const candidates = []
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const x = legal.xMin + ((legal.xMax - legal.xMin) * column) / (columns - 1)
            const y = legal.yMin + ((legal.yMax - legal.yMin) * row) / (rows - 1)
            candidates.push({ x, y, order: row * columns + column, distance: (x - mappedX) ** 2 + (y - mappedY) ** 2 })
          }
        }
        candidates.sort((a, b) => a.distance - b.distance || a.order - b.order)
        const replacement = candidates.find((candidate) => positionIsLegal(grass, candidate.x, candidate.y))
        if (replacement) {
          grass.x = replacement.x
          grass.y = replacement.y
        }
      }
      placed.push(grass)
    }
  }

  consumeFish(fish) {
    const growth = growthForFish(fish.level)
    this.stats.comboCount = this.stats.comboTimer > 0 || this.comboEligibleThisFrame ? this.stats.comboCount + 1 : 1
    this.stats.comboTimer = GAME_CONFIG.score.comboWindow
    this.stats.highestCombo = Math.max(this.stats.highestCombo, this.stats.comboCount)
    const multiplier = Math.min(GAME_CONFIG.score.comboMax, 1 + GAME_CONFIG.score.comboStep * (this.stats.comboCount - 1))
    const points = Math.round(growth * 100 * multiplier)
    this.player.xp += growth
    this.stats.score += points
    this.stats.fishEaten += 1
    const event = {
      id: fish.spawnSeq,
      fishLevel: fish.level,
      points,
      growth,
      combo: this.stats.comboCount,
      multiplier,
      x: fish.x,
      y: fish.y,
      width: fish.width,
      height: fish.height,
      direction: fish.direction,
      visualId: fish.visualId
    }
    this.releaseFish(fish)
    if (this.tutorial.enabled && !this.tutorial.ateFish) {
      this.tutorial.ateFish = true
      this.tutorial.enabled = false
      this.saveManager.setTutorialCompleted(true)
    }
    this.emit('fish_eaten', event)
  }

  consumeGrass(grass) {
    this.player.xp += 1
    this.stats.score += 10
    this.stats.grassEaten += 1
    grass.active = false
    grass.respawnRemaining = this.gameplayRng.range(GAME_CONFIG.grass.respawnMin, GAME_CONFIG.grass.respawnMax)
    grass.growRemaining = 0
    if (this.tutorial.enabled) this.tutorial.ateGrass = true
    this.emit('grass_eaten', { id: grass.spawnSeq, points: 10, growth: 1, x: grass.x, y: grass.y })
  }

  applyLevelUp() {
    const previous = this.player.level
    const need = upgradeNeed(previous)
    if (this.player.xp < need || previous >= 10) return false
    this.player.xp -= need
    this.player.level += 1
    this.levelUpRemaining = GAME_CONFIG.timing.levelUpVisual
    this.invincibleRemaining = GAME_CONFIG.timing.invincible
    this.pPlus2Protection = GAME_CONFIG.spawn.levelUpPPlus2Protection
    this.updatePlayerDimensions()
    this.clampPlayerToBounds()
    this.enforceGrassPopulationCap()
    this.emit('level_up', { previous, level: this.player.level, overflowXp: this.player.xp, runTimeMs: Math.round(this.runClock * 1000) })
    if (this.player.level >= 10) this.lockWin()
    return true
  }

  lockDeath(fish) {
    if (this.resultLocked) return
    this.resultLocked = true
    this.screenState = 'DEAD'
    this.pauseView = null
    this.cinematicClock = 0
    this.input.clear(true)
    this.player.vx = 0
    this.player.vy = 0
    this.result = this.makeResult(false, fish.level)
    this.emit('player_dead', { fishId: fish.spawnSeq, fishLevel: fish.level, level: this.player.level, score: this.stats.score })
  }

  lockWin() {
    if (this.resultLocked) return
    this.resultLocked = true
    this.screenState = 'WIN'
    this.pauseView = null
    this.cinematicClock = 0
    this.input.clear(true)
    this.result = this.makeResult(true, null)
    this.emit('game_win', { score: this.stats.score, durationMs: this.result.durationMs, highestCombo: this.stats.highestCombo })
  }

  makeResult(won, killerLevel) {
    return { won, killerLevel, score: this.stats.score, level: this.player.level, fishEaten: this.stats.fishEaten, grassEaten: this.stats.grassEaten, highestCombo: this.stats.highestCombo, durationMs: this.runClock * 1000, saved: null }
  }

  enterResult() {
    if (!this.resultLocked || this.resultCommitted) return
    this.resultCommitted = true
    this.screenState = 'RESULT'
    this.pauseView = null
    this.result.saved = this.saveManager.commitResult(this.result)
    this.emit('game_result', { ...this.result })
  }

  pause(reason = 'user') {
    if (this.screenState !== 'RUNNING') return false
    this.pausedFrom = 'RUNNING'
    this.screenState = 'PAUSED'
    this.pauseView = reason === 'catalog' ? 'CATALOG' : 'MENU'
    this.input.clear(true)
    this.player.vx = 0
    this.player.vy = 0
    this.emit('game_paused', { reason })
    return true
  }

  resume() {
    if (this.screenState !== 'PAUSED' || this.orientationBlocked) return false
    this.screenState = 'RUNNING'
    this.pausedFrom = null
    this.pauseView = null
    this.input.clear(true)
    this.emit('game_resumed', {})
    return true
  }

  quitRun() {
    if (!['RUNNING', 'PAUSED'].includes(this.screenState)) return false
    this.releaseAllEntities()
    this.screenState = 'HOME'
    this.pauseView = null
    this.resultLocked = false
    this.resultCommitted = false
    this.result = null
    this.input.clear(true)
    this.emit('game_quit', { runId: this.runId })
    return true
  }

  handleAction(action) {
    this.emit('ui_action', { action })
    if (action === 'start' && this.screenState === 'HOME') this.startRun()
    else if (action === 'catalog' && this.screenState === 'RUNNING') this.pause('catalog')
    else if (action === 'catalogClose' && this.screenState === 'PAUSED' && this.pauseView === 'CATALOG') this.resume()
    else if (action === 'pause' && this.screenState === 'RUNNING') this.pause('user')
    else if (action === 'resume' && this.screenState === 'PAUSED') this.resume()
    else if (action === 'quit' && this.screenState === 'PAUSED') this.quitRun()
    else if (action === 'retry' && this.screenState === 'RESULT') this.startRun()
    else if (action === 'home' && this.screenState === 'RESULT') { this.releaseAllEntities(); this.screenState = 'HOME'; this.pauseView = null; this.result = null; this.resultLocked = false; this.resultCommitted = false }
    else if (action === 'sound') { const enabled = !this.saveManager.data.soundEnabled; this.saveManager.setSoundEnabled(enabled); this.emit('setting_changed', { key: 'soundEnabled', value: enabled }) }
    else if (action === 'haptic') { const enabled = !this.saveManager.data.hapticEnabled; this.saveManager.setHapticEnabled(enabled); this.emit('setting_changed', { key: 'hapticEnabled', value: enabled }) }
  }

  interactionState() { return this.screenState === 'PAUSED' && this.pauseView === 'CATALOG' ? 'CATALOG' : this.screenState }

  handlePointer(type, pointer) { return this.input.handle(type, pointer, this.layout, this.interactionState()) }

  onHide() {
    this.hidden = true
    if (this.screenState === 'RUNNING') this.pause('background')
    else if (this.screenState === 'PAUSED') this.input.clear(true)
  }

  onShow() {
    this.hidden = false
    if (this.screenState === 'DEAD' || this.screenState === 'WIN') this.enterResult()
  }

  resize(viewport) {
    const old = this.layout
    const next = computeLayout(viewport)
    const normalizedPoint = (entity) => {
      const nx = (entity.x - old.playable.left) / Math.max(1, old.playable.right - old.playable.left)
      const ny = (entity.y - old.playable.top) / Math.max(1, old.playable.bottom - old.playable.top)
      return { nx, ny }
    }
    const mapPoint = (entity) => {
      const { nx, ny } = normalizedPoint(entity)
      entity.x = next.playable.left + clamp(nx, 0, 1) * (next.playable.right - next.playable.left)
      entity.y = next.playable.top + clamp(ny, 0, 1) * (next.playable.bottom - next.playable.top)
      if ('baseY' in entity) entity.baseY = entity.y
    }
    mapPoint(this.player)
    for (const fish of this.fishPool.items) {
      if (!fish.inUse) continue
      const { ny } = normalizedPoint(fish)
      const oldWidth = Math.max(1, fish.width)
      fish.width = Math.min(next.width * GAME_CONFIG.player.maxWidthRatio, next.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(fish.level))
      fish.height = fish.width * GAME_CONFIG.player.bodyAspect
      fish.vx *= fish.width / oldWidth
      const mappedY = next.playable.top + clamp(ny, 0, 1) * (next.playable.bottom - next.playable.top)
      const visual = fishVisualMargins(fish)
      fish.y = clamp(mappedY, next.playable.top + visual.top, next.playable.bottom - visual.bottom)
      fish.baseY = fish.y
      if (fish.pending || fish.entering) {
        fish.x = fish.side === 'left'
          ? next.playable.left - visual.right - GAME_CONFIG.fish.offscreenPadding
          : next.playable.right + visual.left + GAME_CONFIG.fish.offscreenPadding
      } else {
        const { nx } = normalizedPoint(fish)
        const mappedX = next.playable.left + clamp(nx, 0, 1) * (next.playable.right - next.playable.left)
        fish.x = clamp(mappedX, next.playable.left + visual.left, next.playable.right - visual.right)
      }
    }
    for (const grass of this.grassPool.items) {
      if (!grass.inUse) continue
      mapPoint(grass)
      const legal = this.grassPlacementBounds(grass, next)
      grass.x = clamp(grass.x, legal.xMin, legal.xMax)
      grass.y = clamp(grass.y, legal.yMin, legal.yMax)
    }
    this.layout = next
    this.input.clear(true)
    this.orientationBlocked = !next.isLandscape
    this.updatePlayerDimensions()
    this.clampPlayerToBounds()
    this.relayoutActiveGrass()
    const resizedPlayerBody = this.playerBody()
    for (const fish of this.fishPool.items) {
      if (fish.inUse && fish.active && relationFor(this.player.level, fish.level) === 'LETHAL' && ellipsesOverlap(resizedPlayerBody, fishBody(fish))) fish.dangerSuppressed = true
    }
    if (this.screenState === 'RUNNING') this.pause(this.orientationBlocked ? 'orientation' : 'resize')
    this.emit('viewport_changed', { width: next.width, height: next.height, landscape: next.isLandscape })
  }

  isDangerSpawnSafe(candidate, activationCheck) {
    const horizonTicks = Math.ceil(GAME_CONFIG.fish.safeContactTime * GAME_CONFIG.tickRate)
    const dt = 1 / GAME_CONFIG.tickRate
    const currentPath = this.simulateSafetyPath(candidate, this.player.vx, this.player.vy, horizonTicks, dt)
    if (!currentPath) return false
    const maxSpeed = this.layout.width * GAME_CONFIG.player.baseSpeedRatio * playerSpeedScale(this.player.level)
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2
      if (this.simulateSafetyPath(candidate, Math.cos(angle) * maxSpeed, Math.sin(angle) * maxSpeed, horizonTicks, dt, true)) return true
    }
    if (activationCheck) this.emit('danger_activation_rejected', { id: candidate.spawnSeq })
    return false
  }

  simulateSafetyPath(candidate, playerVx, playerVy, ticks, dt, requireClearance = false) {
    const bounds = this.layout.playable
    let px = this.player.x
    let py = this.player.y
    const hazards = this.fishPool.items.filter((fish) => fish.inUse && fish !== candidate && relationFor(this.player.level, fish.level) === 'LETHAL')
    if (ellipsesOverlap(this.playerBody(), this.predictedFishBody(candidate, 0))) return false
    for (let step = 1; step <= ticks; step += 1) {
      px = clamp(px + playerVx * dt, bounds.left + this.player.width * 0.35, bounds.right - this.player.width * 0.35)
      py = clamp(py + playerVy * dt, bounds.top + this.player.height * 0.35, bounds.bottom - this.player.height * 0.35)
      const playerBody = { x: px, y: py, rx: this.player.width * 0.35, ry: this.player.height * 0.35 }
      const elapsed = dt * step
      if (ellipsesOverlap(playerBody, this.predictedFishBody(candidate, elapsed))) return false
      for (const hazard of hazards) {
        const wait = hazard.pending ? Math.max(0, hazard.warningRemaining) : 0
        const moveTime = Math.max(0, elapsed - wait)
        if (ellipsesOverlap(playerBody, this.predictedFishBody(hazard, moveTime))) return false
      }
    }
    if (requireClearance) {
      const clearance = this.player.width * 0.25
      if (px - this.player.width * 0.35 < bounds.left + clearance || px + this.player.width * 0.35 > bounds.right - clearance) return false
      if (py - this.player.height * 0.35 < bounds.top + clearance || py + this.player.height * 0.35 > bounds.bottom - clearance) return false
    }
    return true
  }

  predictedFishBody(fish, moveTime) {
    const bounds = this.layout.playable
    const period = Number.isFinite(fish.period) && fish.period > 0 ? fish.period : 2
    const age = Math.max(0, fish.age + moveTime)
    const baseY = Number.isFinite(fish.baseY) ? fish.baseY : fish.y
    const amplitude = Number.isFinite(fish.amplitude) ? fish.amplitude : 0
    const phase = Number.isFinite(fish.phase) ? fish.phase : 0
    const visual = fishVisualMargins(fish)
    const y = moveTime <= 0
      ? fish.y
      : clamp(baseY + Math.sin(phase + (age * Math.PI * 2) / period) * amplitude, bounds.top + visual.top, bounds.bottom - visual.bottom)
    return { x: fish.x + fish.vx * moveTime, y, rx: fish.width * 0.35, ry: fish.height * 0.35 }
  }

  enforceGrassPopulationCap() {
    const maxGrass = this.player.level === 1 ? GAME_CONFIG.grass.maxAtLevelOne : GAME_CONFIG.grass.maxAfterLevelOne
    const inUse = this.grassPool.items.filter((grass) => grass.inUse)
    if (inUse.length <= maxGrass) return
    const byRetirementPriority = inUse.slice().sort((a, b) => {
      if (a.active !== b.active) return a.active ? 1 : -1
      const distanceA = (a.x - this.player.x) ** 2 + (a.y - this.player.y) ** 2
      const distanceB = (b.x - this.player.x) ** 2 + (b.y - this.player.y) ** 2
      if (distanceA !== distanceB) return distanceB - distanceA
      return b.spawnSeq - a.spawnSeq
    })
    const retireCount = inUse.length - maxGrass
    for (let index = 0; index < retireCount; index += 1) {
      const grass = byRetirementPriority[index]
      const data = { id: grass.spawnSeq, active: grass.active, level: this.player.level }
      this.grassPool.release(grass, resetGrass)
      this.emit('grass_retired', data)
    }
  }

  emit(type, data = {}) {
    const event = { type, tick: this.tick, runTime: this.runClock, data }
    this.events.push(event)
    this.eventLog.push(event)
    if (this.eventLog.length > 2048) this.eventLog.shift()
  }

  drainEvents() {
    const events = this.events
    this.events = []
    return events
  }

  releaseAllEntities() {
    this.fishPool.releaseAll(resetFish)
    this.grassPool.releaseAll(resetGrass)
  }

  snapshot() {
    return {
      version: GAME_CONFIG.version,
      screenState: this.screenState,
      pauseView: this.pauseView,
      orientationBlocked: this.orientationBlocked,
      layout: this.layout,
      tick: this.tick,
      seed: this.masterSeed,
      runClock: this.runClock,
      cinematicClock: this.cinematicClock,
      player: this.player,
      stats: this.stats,
      tutorial: this.tutorial,
      levelUpRemaining: this.levelUpRemaining,
      invincibleRemaining: this.invincibleRemaining,
      pPlus2Protection: this.pPlus2Protection,
      fish: this.fishPool.items,
      grass: this.grassPool.items,
      spawnCounts: this.spawnManager.counts(),
      lastSpawnDecision: this.spawnManager.lastDecision,
      save: this.saveManager.data,
      result: this.result,
      resultLocked: this.resultLocked,
      resultCommitted: this.resultCommitted,
      input: this.input.snapshot(),
      debug: this.debug
    }
  }
}

module.exports = { GameCore }
