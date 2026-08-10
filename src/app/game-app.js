'use strict'

const { GAME_CONFIG } = require('../config/game-config')
const { GameCore } = require('../core/game-core')
const { CanvasRenderer } = require('../render/canvas-renderer')
const { AudioManager } = require('../audio/audio-manager')

class GameApp {
  constructor(platform, options = {}) {
    this.platform = platform
    this.canvas = platform.createCanvas()
    this.core = new GameCore(platform, { viewport: platform.getViewport(), seed: options.seed })
    this.renderer = new CanvasRenderer(this.canvas)
    this.audio = new AudioManager(platform, this.core.saveManager.data)
    this.harness = null
    if (typeof DEBUG_TOOLS !== 'undefined' && DEBUG_TOOLS) {
      const { TestHarness } = require('../debug/test-harness')
      this.harness = new TestHarness(this.core, this)
    }
    this.running = false
    this.manualClock = false
    this.frameId = null
    this.lastTime = null
    this.accumulator = 0
    this.fixedDt = 1 / GAME_CONFIG.tickRate
    this.unsubscribers = []
    this.metrics = { frameIntervals: [], longFrames: 0, ticks: 0, startedAt: platform.now() }
    this.loop = this.loop.bind(this)
  }

  start() {
    if (this.running) return this
    this.running = true
    this.unsubscribers.push(this.platform.onPointer((type, pointer) => {
      if (type === 'start') this.audio.unlock()
      this.core.handlePointer(type, pointer)
    }))
    this.unsubscribers.push(this.platform.onHide(() => {
      this.core.onHide()
      this.audio.stopAmbient()
      this.audio.suspend()
      this.resetFrameClock()
    }))
    this.unsubscribers.push(this.platform.onShow(() => {
      this.core.onShow()
      this.resetFrameClock()
    }))
    this.unsubscribers.push(this.platform.onResize(() => this.core.resize(this.platform.getViewport())))
    this.renderer.render(this.core.snapshot())
    this.frameId = this.platform.requestFrame(this.loop)
    return this
  }

  stop() {
    this.running = false
    if (this.frameId !== null) this.platform.cancelFrame(this.frameId)
    for (const unsubscribe of this.unsubscribers) unsubscribe?.()
    this.unsubscribers.length = 0
    this.audio.stopAmbient()
    this.audio.stopVoices()
  }

  loop(time) {
    if (!this.running) return
    const clockReset = this.lastTime === null
    if (clockReset) this.lastTime = time
    let frameDelta = clockReset ? 0 : Math.max(0, (time - this.lastTime) / 1000)
    this.lastTime = time
    if (this.core.hidden) {
      this.frameId = this.platform.requestFrame(this.loop)
      return
    }
    if (!clockReset) this.recordFrame(frameDelta)
    frameDelta = Math.min(GAME_CONFIG.maxFrameDelta, frameDelta)
    if (!this.manualClock) {
      this.accumulator += frameDelta
      let steps = 0
      while (this.accumulator + 1e-9 >= this.fixedDt && steps < GAME_CONFIG.maxCatchUpTicks) {
        this.stepCore(this.fixedDt)
        this.accumulator -= this.fixedDt
        steps += 1
      }
      if (this.accumulator >= this.fixedDt) {
        const dropped = Math.floor(this.accumulator / this.fixedDt)
        this.core.debug.droppedTicks += dropped
        this.accumulator %= this.fixedDt
      }
    }
    if (this.core.screenState !== 'PAUSED') this.renderer.update(frameDelta)
    this.renderer.render(this.core.snapshot())
    this.frameId = this.platform.requestFrame(this.loop)
  }

  stepCore(dt = this.fixedDt) {
    this.core.update(dt)
    this.metrics.ticks += 1
    const snapshot = this.core.snapshot()
    const events = this.core.drainEvents()
    this.renderer.consumeEvents(events, snapshot)
    this.processEvents(events)
    return events
  }

  processEvents(events) {
    for (const event of events) {
      const data = event.data || {}
      if (event.type === 'game_start') { this.audio.stopVoices(); this.audio.startAmbient() }
      else if (event.type === 'game_quit') { this.audio.stopAmbient(); this.audio.stopVoices() }
      else if (event.type === 'game_paused' || event.type === 'game_result') this.audio.stopAmbient()
      else if (event.type === 'game_resumed') { this.audio.unlock(); this.audio.startAmbient() }
      else if (event.type === 'grass_eaten') this.audio.play('grass_eaten')
      else if (event.type === 'fish_eaten') { this.audio.play('fish_eaten', data.combo); this.audio.haptic('light') }
      else if (event.type === 'equal_bounce') this.audio.play('equal_bounce')
      else if (event.type === 'danger_warning') this.audio.play('danger_warning')
      else if (event.type === 'level_up') { this.audio.play('level_up'); this.audio.haptic('medium') }
      else if (event.type === 'player_dead') { this.audio.play('dead'); this.audio.haptic('heavy'); this.audio.stopAmbient() }
      else if (event.type === 'game_win') { this.audio.play('win'); this.audio.haptic('medium'); this.audio.stopAmbient() }
      else if (event.type === 'ui_action') this.audio.play('click')
      else if (event.type === 'setting_changed') {
        this.audio.settings = this.core.saveManager.data
        if (data.key === 'soundEnabled') {
          this.audio.setEnabled(data.value)
          if (data.value && this.core.screenState === 'RUNNING') { this.audio.unlock(); this.audio.startAmbient() }
        }
      }
    }
  }

  recordFrame(delta) {
    if (this.core.hidden || this.core.screenState !== 'RUNNING') return
    const ms = delta * 1000
    this.metrics.frameIntervals.push(ms)
    const sampleCapacity = GAME_CONFIG.tickRate * 60
    if (this.metrics.frameIntervals.length > sampleCapacity) this.metrics.frameIntervals.shift()
  }

  resetFrameClock() {
    this.lastTime = null
    this.accumulator = 0
  }

  performanceSnapshot() {
    const sorted = this.metrics.frameIntervals.slice().sort((a, b) => a - b)
    const average = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0
    const p95Index = sorted.length ? Math.max(0, Math.ceil(sorted.length * 0.95) - 1) : 0
    const p95 = sorted.length ? sorted[p95Index] : 0
    const longFrames = sorted.reduce((count, value) => count + (value > 200 ? 1 : 0), 0)
    return { samples: sorted.length, averageFrameMs: average, averageFps: average > 0 ? 1000 / average : 0, p95FrameMs: p95, longFrames, ticks: this.metrics.ticks }
  }
}

module.exports = { GameApp }
