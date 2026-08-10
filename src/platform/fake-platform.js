'use strict'

const { PlatformPort } = require('./platform-port')

class FakePlatform extends PlatformPort {
  constructor(options = {}) {
    super()
    this.viewport = options.viewport || { width: 800, height: 450, dpr: 1, safeArea: null, menuButton: null }
    this.canvas = options.canvas || null
    this.audioContext = options.audioContext || null
    this.failVibrations = !!options.failVibrations
    this.storage = new Map()
    this.failWrites = false
    this.listeners = { pointer: [], hide: [], show: [], resize: [] }
    this.logs = []
    this.vibrations = []
    this.clock = 0
  }

  createCanvas() { return this.canvas }
  getViewport() { return { ...this.viewport } }
  requestFrame() { return 0 }
  now() { return this.clock }
  onPointer(fn) { this.listeners.pointer.push(fn); return () => this._remove('pointer', fn) }
  onHide(fn) { this.listeners.hide.push(fn); return () => this._remove('hide', fn) }
  onShow(fn) { this.listeners.show.push(fn); return () => this._remove('show', fn) }
  onResize(fn) { this.listeners.resize.push(fn); return () => this._remove('resize', fn) }
  load(key) { return this.storage.get(key) }
  save(key, value) { if (this.failWrites) return false; this.storage.set(key, JSON.parse(JSON.stringify(value))); return true }
  createAudioContext() { return this.audioContext }
  vibrate(kind) { if (this.failVibrations) return false; this.vibrations.push(kind); return true }
  log(level, event, data) { this.logs.push({ level, event, data }) }

  emit(type, payload) { for (const fn of this.listeners[type]) fn(payload) }
  emitPointer(type, payload) { for (const fn of this.listeners.pointer) fn(type, payload) }
  advance(ms) { this.clock += ms }
  setViewport(viewport) { this.viewport = { ...this.viewport, ...viewport }; this.emit('resize', this.viewport) }
  _remove(type, fn) { this.listeners[type] = this.listeners[type].filter((candidate) => candidate !== fn) }
}

module.exports = { FakePlatform }
