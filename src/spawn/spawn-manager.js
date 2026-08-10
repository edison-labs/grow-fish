'use strict'

const { GAME_CONFIG, targetFishCount, spawnInterval, lethalCap } = require('../config/game-config')
const { relationFor } = require('../core/math')
const { fishVisualMargins } = require('../core/entities')

class SpawnManager {
  constructor(world) {
    this.world = world
    this.timer = 0
    this.retryRemaining = 0
    this.initialFill = true
    this.lastDecision = null
    this.trace = []
  }

  reset() {
    this.timer = 0
    this.retryRemaining = 0
    this.initialFill = true
    this.lastDecision = null
    this.trace.length = 0
  }

  update(dt) {
    const player = this.world.player
    if (this.world.screenState !== 'RUNNING' || player.level >= 10) return
    if (this.updatePending(dt)) return
    if (this.retryRemaining > 0) {
      this.retryRemaining = Math.max(0, this.retryRemaining - dt)
      if (this.retryRemaining <= 1e-9) this.retryRemaining = 0
      if (this.retryRemaining > 0) return
      this.timer = Number.POSITIVE_INFINITY
    }
    const counts = this.counts()
    const target = targetFishCount(player.level)
    if (counts.totalReserved >= target) {
      this.initialFill = false
      this.timer = Math.min(this.timer, spawnInterval(player.level))
      return
    }
    if (this.initialFill) {
      this.tryReserve(counts, target)
      return
    }
    this.timer += dt
    let interval = spawnInterval(player.level)
    if (counts.totalReserved < target * GAME_CONFIG.spawn.lowPopulationRatio) interval *= GAME_CONFIG.spawn.lowPopulationMultiplier
    if (this.timer + 1e-9 < interval) return
    this.timer = 0
    this.tryReserve(counts, target)
  }

  updatePending(dt) {
    let due = null
    for (const fish of this.world.fishPool.items) {
      if (!fish.inUse || !fish.pending) continue
      fish.warningRemaining = Math.max(0, fish.warningRemaining - dt)
      if (fish.warningRemaining <= 1e-9) fish.warningRemaining = 0
      if (fish.warningRemaining <= 0 && (!due || fish.spawnSeq < due.spawnSeq)) due = fish
    }
    if (!due) return false
    const relation = relationFor(this.world.player.level, due.level)
    if (relation === 'LETHAL' && !this.world.isDangerSpawnSafe(due, true)) {
      const data = { result: 'activation_unsafe_cancelled', fishLevel: due.level, side: due.side, id: due.spawnSeq }
      this.world.releaseFish(due)
      this.record(data)
      return true
    }
    due.pending = false
    due.active = true
    due.entering = true
    this.world.emit('fish_activated', { id: due.spawnSeq, level: due.level, side: due.side, relation })
    return true
  }

  tryReserve(counts = this.counts(), target = targetFishCount(this.world.player.level)) {
    const playerLevel = this.world.player.level
    const decision = {
      tick: this.world.tick,
      playerLevel,
      target,
      counts: { ...counts },
      openingProtection: this.world.runClock < GAME_CONFIG.spawn.openingProtectionTime,
      pPlus2Protection: this.world.pPlus2Protection > 0,
      rngBefore: this.world.gameplayRng.snapshot(),
      rawWeights: null,
      weights: null,
      rejections: [],
      result: null
    }
    let weights = this.buildWeights(playerLevel)
    decision.rawWeights = { ...weights }
    if (decision.openingProtection) weights = this.keepOpeningLevels(weights)
    const edibleMinimum = playerLevel >= 2 ? Math.ceil(target * GAME_CONFIG.spawn.edibleMinRatio) : 0
    if (counts.edibleActive < edibleMinimum) weights = this.keepRelation(weights, (level) => level < playerLevel)
    weights = this.applyCaps(weights, counts, playerLevel)
    decision.weights = { ...weights }
    const level = this.weightedLevel(weights)
    if (level === null) {
      decision.result = 'no_allowed_level'
      this.scheduleRetry(GAME_CONFIG.fish.retryDelay)
      return this.record(decision)
    }
    const relation = relationFor(playerLevel, level)
    const side = this.chooseSide(relation, counts)
    if (!side) {
      decision.result = 'side_cap_full'
      this.scheduleRetry(GAME_CONFIG.fish.retryDelay)
      return this.record(decision)
    }
    for (let attempt = 1; attempt <= GAME_CONFIG.fish.spawnAttempts; attempt += 1) {
      const candidate = this.world.acquireFish(level, side, true)
      if (!candidate) {
        decision.result = 'pool_exhausted'
        this.scheduleRetry(GAME_CONFIG.fish.retryDelay)
        return this.record(decision)
      }
      this.placeCandidate(candidate, side)
      if (!this.hasVerticalSpacing(candidate)) {
        decision.rejections.push({ attempt, reason: 'vertical_spacing', y: candidate.y })
        this.world.releaseFish(candidate)
        continue
      }
      if (relation === 'LETHAL' && !this.world.isDangerSpawnSafe(candidate, false)) {
        decision.rejections.push({ attempt, reason: 'unsafe_path', y: candidate.y })
        this.world.releaseFish(candidate)
        continue
      }
      decision.result = relation === 'LETHAL' ? 'warning_reserved' : 'spawn_reserved'
      decision.level = level
      decision.side = side
      decision.y = candidate.y
      decision.attempt = attempt
      if (relation === 'LETHAL') {
        candidate.pending = true
        candidate.active = false
        candidate.warningRemaining = GAME_CONFIG.fish.warningTime
        this.world.emit('danger_warning', { id: candidate.spawnSeq, level, side, y: candidate.y })
      } else {
        candidate.active = true
        candidate.pending = false
        candidate.entering = true
        this.world.emit('fish_activated', { id: candidate.spawnSeq, level, side, relation })
      }
      return this.record(decision)
    }
    decision.result = 'position_attempts_exhausted'
    this.scheduleRetry(GAME_CONFIG.fish.retryDelay)
    return this.record(decision)
  }

  buildWeights(playerLevel) {
    const weights = {}
    const add = (level, weight) => {
      const bounded = Math.max(1, Math.min(10, level))
      weights[bounded] = (weights[bounded] || 0) + weight
    }
    if (playerLevel === 1) {
      add(1, 0.55); add(2, 0.4); add(3, 0.05)
    } else {
      if (playerLevel - 2 < 1) add(playerLevel - 1, 0.2); else add(playerLevel - 2, 0.2)
      add(playerLevel - 1, 0.45)
      add(playerLevel, 0.15)
      add(playerLevel + 1, 0.17)
      if (playerLevel + 2 > 10) add(playerLevel + 1, 0.03); else add(playerLevel + 2, 0.03)
    }
    return weights
  }

  keepOpeningLevels(weights) {
    const kept = {}
    if (weights[1]) kept[1] = weights[1]
    if (weights[2]) kept[2] = weights[2]
    if (!Object.keys(kept).length) { kept[1] = 0.65; kept[2] = 0.35 }
    return kept
  }

  keepRelation(weights, predicate) {
    const kept = {}
    for (const [key, weight] of Object.entries(weights)) if (predicate(Number(key))) kept[key] = weight
    return kept
  }

  applyCaps(weights, counts, playerLevel) {
    const result = { ...weights }
    for (const key of Object.keys(result)) {
      const level = Number(key)
      if (level > playerLevel && counts.lethalReserved >= lethalCap(playerLevel)) delete result[key]
      if (level === playerLevel + 2 && (counts.pPlus2Reserved >= 1 || this.world.pPlus2Protection > 0)) delete result[key]
    }
    return result
  }

  weightedLevel(weights) {
    const entries = Object.entries(weights).filter(([, value]) => value > 0).sort((a, b) => Number(a[0]) - Number(b[0]))
    const total = entries.reduce((sum, entry) => sum + entry[1], 0)
    if (!total) return null
    let roll = this.world.gameplayRng.next() * total
    for (const [level, weight] of entries) {
      roll -= weight
      if (roll <= 0) return Number(level)
    }
    return Number(entries[entries.length - 1][0])
  }

  chooseSide(relation, counts) {
    if (relation === 'LETHAL') {
      if (counts.enteringLeft >= 1 && counts.enteringRight >= 1) return null
      if (counts.enteringLeft >= 1) return 'right'
      if (counts.enteringRight >= 1) return 'left'
    }
    return this.world.gameplayRng.next() < 0.5 ? 'left' : 'right'
  }

  placeCandidate(fish, side) {
    const bounds = this.world.layout.playable
    const padding = Math.max(12, fish.height * 0.5 + 12)
    fish.y = this.world.gameplayRng.range(bounds.top + padding, bounds.bottom - padding)
    fish.baseY = fish.y
    const visual = fishVisualMargins(fish)
    fish.x = side === 'left'
      ? bounds.left - visual.right - GAME_CONFIG.fish.offscreenPadding
      : bounds.right + visual.left + GAME_CONFIG.fish.offscreenPadding
  }

  hasVerticalSpacing(candidate) {
    for (const fish of this.world.fishPool.items) {
      if (!fish.inUse || fish === candidate || (!fish.pending && !fish.entering)) continue
      if (fish.side !== candidate.side) continue
      if (Math.abs(fish.y - candidate.y) < Math.max(fish.height, candidate.height) * 1.2) return false
    }
    return true
  }

  counts() {
    const result = { active: 0, pending: 0, totalReserved: 0, edibleActive: 0, lethalReserved: 0, pPlus2Reserved: 0, enteringLeft: 0, enteringRight: 0 }
    const playerLevel = this.world.player.level
    for (const fish of this.world.fishPool.items) {
      if (!fish.inUse) continue
      if (fish.active) result.active += 1
      if (fish.pending) result.pending += 1
      result.totalReserved += 1
      const relation = relationFor(playerLevel, fish.level)
      if (fish.active && relation === 'EDIBLE') result.edibleActive += 1
      if (relation === 'LETHAL') {
        result.lethalReserved += 1
        if (fish.pending || fish.entering) result[fish.side === 'left' ? 'enteringLeft' : 'enteringRight'] += 1
      }
      if (fish.level === playerLevel + 2) result.pPlus2Reserved += 1
    }
    return result
  }

  record(decision) {
    if (!decision.rngAfter) decision.rngAfter = this.world.gameplayRng.snapshot()
    this.lastDecision = decision
    this.trace.push(decision)
    if (this.trace.length > 256) this.trace.shift()
    this.world.emit('spawn_decision', decision)
    return decision
  }

  scheduleRetry(delay) {
    this.retryRemaining = delay
    this.timer = 0
  }
}

module.exports = { SpawnManager }
