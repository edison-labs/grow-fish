'use strict'

const { GAME_CONFIG } = require('../config/game-config')

function configHash() {
  const source = JSON.stringify(GAME_CONFIG)
  let hash = 2166136261 >>> 0
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

class TestHarness {
  constructor(core, app = null) {
    this.core = core
    this.app = app
  }

  startRun(seed = 20260731) { this.core.startRun(seed); return this.snapshot() }
  setSeed(seed) { this.core.setSeed(seed); return this.rng() }
  resetSeed() { this.core.setSeed(this.core.masterSeed); return this.rng() }
  rng() { return { seed: this.core.masterSeed, gameplay: this.core.gameplayRng.snapshot(), appearance: this.core.appearanceRng.snapshot(), fx: this.core.fxRng.snapshot() } }

  pauseClock() { if (this.app) this.app.manualClock = true }
  resumeClock() { if (this.app) this.app.manualClock = false }
  stepTicks(count = 1) {
    const events = []
    for (let index = 0; index < count; index += 1) {
      if (this.app) events.push(...this.app.stepCore(1 / GAME_CONFIG.tickRate))
      else { this.core.update(1 / GAME_CONFIG.tickRate); events.push(...this.core.drainEvents()) }
    }
    return events
  }

  stepDt(seconds) {
    const ticks = Math.max(0, Math.round(seconds * GAME_CONFIG.tickRate))
    return this.stepTicks(ticks)
  }

  setPlayer(patch) {
    Object.assign(this.core.player, patch)
    this.core.player.level = Math.max(1, Math.min(10, Math.floor(this.core.player.level)))
    this.core.updatePlayerDimensions()
    this.core.clampPlayerToBounds()
    return { ...this.core.player }
  }

  setStats(patch) { Object.assign(this.core.stats, patch); return { ...this.core.stats } }
  setInvincible(seconds = GAME_CONFIG.timing.invincible) { this.core.invincibleRemaining = Math.max(0, Number(seconds) || 0); return this.core.invincibleRemaining }
  setProtection(seconds = GAME_CONFIG.spawn.levelUpPPlus2Protection) { this.core.pPlus2Protection = Math.max(0, Number(seconds) || 0); return this.core.pPlus2Protection }
  setTutorial(patch) { Object.assign(this.core.tutorial, patch); return { ...this.core.tutorial } }

  setState(state) {
    const allowed = ['HOME', 'RUNNING', 'PAUSED', 'DEAD', 'WIN', 'RESULT']
    if (!allowed.includes(state)) throw new Error(`Invalid state: ${state}`)
    this.core.screenState = state
    return state
  }

  spawnFish(options = {}) {
    const fish = this.core.acquireFish(options.level || 1, options.side || 'left', options.randomize !== false)
    if (!fish) throw new Error('Fish pool exhausted')
    fish.x = options.x ?? this.core.player.x
    fish.y = options.y ?? this.core.player.y
    fish.baseY = fish.y
    fish.vx = options.vx ?? 0
    fish.pending = !!options.pending
    fish.active = fish.pending ? false : options.active !== false
    fish.warningRemaining = options.warningRemaining ?? (fish.pending ? GAME_CONFIG.fish.warningTime : 0)
    fish.entering = !!options.entering
    return fish
  }

  spawnGrass(options = {}) {
    const grass = this.core.grassPool.acquire((item) => {
      item.active = true
      item.x = options.x ?? this.core.player.x
      item.y = options.y ?? this.core.player.y
      item.width = options.width || 24
      item.height = options.height || 42
      item.growRemaining = options.mature === false ? GAME_CONFIG.grass.growTime : 0
      item.respawnRemaining = 0
    })
    if (!grass) throw new Error('Grass pool exhausted')
    grass.spawnSeq = ++this.core.spawnSeq
    return grass
  }

  injectCollisionSet(entries) {
    const events = entries.map((entry) => {
      if (entry.entity) return entry
      const pool = entry.kind === 'grass' ? this.core.grassPool.items : this.core.fishPool.items
      const entity = pool.find((item) => item.inUse && (entry.id === undefined || item.spawnSeq === entry.id))
      if (!entity) throw new Error(`Collision entity not found: ${JSON.stringify(entry)}`)
      return { type: entry.type, entity }
    })
    this.core.collisionSystem.inject(events)
  }

  counts() { return this.core.spawnManager.counts() }
  config() { return { version: GAME_CONFIG.version, hash: configHash(), values: JSON.parse(JSON.stringify(GAME_CONFIG)) } }
  spawnTrace() { return this.core.spawnManager.trace.slice() }
  poolStats() { return { fish: this.core.fishPool.stats(), grass: this.core.grassPool.stats() } }
  performance() { return this.app ? this.app.performanceSnapshot() : null }
  freezeAI(value = true) { this.core.debug.freezeAI = !!value }
  showCollision(value = true) { this.core.debug.showCollision = !!value; this.core.debug.enabled = true }
  toggleDebug(value = !this.core.debug.enabled) { this.core.debug.enabled = !!value }
  clearStorage() { return this.core.saveManager.clear() }
  exportStorage() { return this.core.saveManager.export() }
  importStorage(data) { return this.core.saveManager.import(data) }
  eventLog() { return this.core.eventLog.slice() }
  resultState() { return { locked: this.core.resultLocked, committed: this.core.resultCommitted, result: this.core.result ? { ...this.core.result } : null } }
  snapshot() { return this.core.snapshot() }
}

module.exports = { TestHarness, configHash }
