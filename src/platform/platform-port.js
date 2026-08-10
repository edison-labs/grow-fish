'use strict'

class PlatformPort {
  createCanvas() { throw new Error('createCanvas not implemented') }
  getViewport() { throw new Error('getViewport not implemented') }
  requestFrame() { throw new Error('requestFrame not implemented') }
  cancelFrame() {}
  now() { return Date.now() }
  onPointer() { return () => {} }
  onHide() { return () => {} }
  onShow() { return () => {} }
  onResize() { return () => {} }
  load() { return undefined }
  save() { return false }
  createAudioContext() { return null }
  vibrate() { return false }
  log() {}
}

module.exports = { PlatformPort }

