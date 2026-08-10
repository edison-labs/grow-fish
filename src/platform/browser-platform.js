'use strict'

const { PlatformPort } = require('./platform-port')

class BrowserPlatform extends PlatformPort {
  constructor(canvas) {
    super()
    this.canvas = canvas
  }

  createCanvas() { return this.canvas }

  getViewport() {
    return { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1, safeArea: null, menuButton: null }
  }

  requestFrame(callback) { return window.requestAnimationFrame(callback) }
  cancelFrame(id) { window.cancelAnimationFrame(id) }
  now() { return performance.now() }

  onPointer(listener) {
    const options = { passive: false }
    const adapt = (type) => (event) => {
      event.preventDefault()
      if (type === 'start') this.canvas.setPointerCapture?.(event.pointerId)
      listener(type, { id: event.pointerId, x: event.clientX, y: event.clientY, timeStamp: event.timeStamp })
    }
    const start = adapt('start')
    const move = adapt('move')
    const end = adapt('end')
    const cancel = adapt('cancel')
    this.canvas.addEventListener('pointerdown', start, options)
    this.canvas.addEventListener('pointermove', move, options)
    this.canvas.addEventListener('pointerup', end, options)
    this.canvas.addEventListener('pointercancel', cancel, options)
    return () => {
      this.canvas.removeEventListener('pointerdown', start, options)
      this.canvas.removeEventListener('pointermove', move, options)
      this.canvas.removeEventListener('pointerup', end, options)
      this.canvas.removeEventListener('pointercancel', cancel, options)
    }
  }

  onHide(listener) {
    const handler = () => { if (document.hidden) listener() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }

  onShow(listener) {
    const handler = () => { if (!document.hidden) listener() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }

  onResize(listener) { window.addEventListener('resize', listener); return () => window.removeEventListener('resize', listener) }

  load(key) {
    try { const value = localStorage.getItem(key); return value === null ? undefined : JSON.parse(value) } catch { return undefined }
  }

  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
  }

  createAudioContext() {
    try { const AudioCtor = window.AudioContext || window.webkitAudioContext; return AudioCtor ? new AudioCtor() : null } catch { return null }
  }

  vibrate(kind = 'light') {
    const duration = kind === 'heavy' ? 35 : kind === 'medium' ? 25 : 15
    try { return !!navigator.vibrate?.(duration) } catch { return false }
  }

  log(level, event, data) { (console[level] || console.log)(`[grow-fish] ${event}`, data || '') }
}

module.exports = { BrowserPlatform }

