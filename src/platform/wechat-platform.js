'use strict'

const { PlatformPort } = require('./platform-port')

class WechatPlatform extends PlatformPort {
  constructor(wxApi) {
    super()
    this.wx = wxApi
    this.canvas = null
    this.lastViewport = {
      width: 800,
      height: 450,
      dpr: 1,
      safeArea: null,
      menuButton: null
    }
  }

  createCanvas() {
    if (!this.canvas) this.canvas = this.wx.createCanvas()
    return this.canvas
  }

  getViewport() {
    const validInfo = (candidate) => candidate && Number.isFinite(candidate.windowWidth) && candidate.windowWidth > 0 && Number.isFinite(candidate.windowHeight) && candidate.windowHeight > 0
    let info = null
    if (this.wx.getWindowInfo) {
      try { info = this.wx.getWindowInfo() } catch { info = null }
    }
    if (!validInfo(info)) info = null
    if (!info && this.wx.getSystemInfoSync) {
      try { info = this.wx.getSystemInfoSync() } catch { info = null }
    }
    if (!validInfo(info)) return this.cloneViewport(this.lastViewport)
    let menuButton = null
    try { menuButton = this.wx.getMenuButtonBoundingClientRect ? this.wx.getMenuButtonBoundingClientRect() : null } catch { menuButton = null }
    this.lastViewport = {
      width: info.windowWidth,
      height: info.windowHeight,
      dpr: Number.isFinite(info.pixelRatio) && info.pixelRatio > 0 ? info.pixelRatio : 1,
      safeArea: info.safeArea || null,
      menuButton
    }
    return this.cloneViewport(this.lastViewport)
  }

  cloneViewport(viewport) {
    return {
      ...viewport,
      safeArea: viewport.safeArea ? { ...viewport.safeArea } : null,
      menuButton: viewport.menuButton ? { ...viewport.menuButton } : null
    }
  }

  requestFrame(callback) {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
    if (this.canvas && this.canvas.requestAnimationFrame) return this.canvas.requestAnimationFrame(callback)
    return setTimeout(() => callback(this.now()), 16)
  }

  cancelFrame(id) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
    else if (this.canvas && this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(id)
    else clearTimeout(id)
  }

  now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  }

  onPointer(listener) {
    const adapt = (type) => (event) => {
      const touches = event.changedTouches || []
      for (const touch of touches) listener(type, { id: touch.identifier, x: touch.clientX, y: touch.clientY, timeStamp: event.timeStamp || this.now() })
    }
    const start = adapt('start')
    const move = adapt('move')
    const end = adapt('end')
    const cancel = adapt('cancel')
    this.wx.onTouchStart(start)
    this.wx.onTouchMove(move)
    this.wx.onTouchEnd(end)
    this.wx.onTouchCancel(cancel)
    return () => {
      if (this.wx.offTouchStart) this.wx.offTouchStart(start)
      if (this.wx.offTouchMove) this.wx.offTouchMove(move)
      if (this.wx.offTouchEnd) this.wx.offTouchEnd(end)
      if (this.wx.offTouchCancel) this.wx.offTouchCancel(cancel)
    }
  }

  onHide(listener) { this.wx.onHide(listener); return () => this.wx.offHide && this.wx.offHide(listener) }
  onShow(listener) { this.wx.onShow(listener); return () => this.wx.offShow && this.wx.offShow(listener) }
  onResize(listener) { if (this.wx.onWindowResize) this.wx.onWindowResize(listener); return () => this.wx.offWindowResize && this.wx.offWindowResize(listener) }

  load(key) {
    try { return this.wx.getStorageSync(key) } catch { return undefined }
  }

  save(key, value) {
    try { this.wx.setStorageSync(key, value); return true } catch (error) { this.log('warn', 'storage_write_failed', { message: error.message }); return false }
  }

  createAudioContext() {
    try { return this.wx.createWebAudioContext ? this.wx.createWebAudioContext() : null } catch { return null }
  }

  vibrate(kind = 'light') {
    if (!this.wx.vibrateShort) return false
    try { this.wx.vibrateShort({ type: kind, fail: () => {} }); return true } catch { return false }
  }

  log(level, event, data) {
    try {
      const logger = this.wx.getLogManager ? this.wx.getLogManager({ level: 1 }) : console
      const method = logger?.[level] || logger?.log
      if (typeof method === 'function') method.call(logger, `[grow-fish] ${event}`, data || '')
    } catch {}
  }
}

module.exports = { WechatPlatform }
