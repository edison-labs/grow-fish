'use strict'

const { GAME_CONFIG } = require('../config/game-config')
const { clamp, length, normalize } = require('../core/math')
const { hitUi } = require('../render/layout')

class InputController {
  constructor(actionSink) {
    this.actionSink = actionSink
    this.captures = new Map()
    this.moveId = null
    this.move = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, directionX: 0, directionY: 0, ratio: 0, released: false }
  }

  handle(type, pointer, layout, screenState) {
    if (!['start', 'move', 'end', 'cancel'].includes(type) || !pointer || !this._validId(pointer.id)) return false
    const finitePosition = Number.isFinite(pointer.x) && Number.isFinite(pointer.y)
    if (type === 'start' && (!finitePosition || this.captures.has(pointer.id))) return false
    if (type === 'start') return this._start(pointer, layout, screenState)
    const capture = this.captures.get(pointer.id)
    if (!capture) return false
    if (!finitePosition) {
      if (type === 'end' || type === 'cancel') return this._finish(pointer, capture, layout, screenState, true)
      return false
    }
    if (type === 'move') return this._move(pointer, capture, layout, screenState)
    return this._finish(pointer, capture, layout, screenState, type === 'cancel')
  }

  _validId(id) { return (typeof id === 'number' && Number.isFinite(id)) || typeof id === 'string' }

  _start(pointer, layout, screenState) {
    const button = hitUi(layout, screenState, pointer.x, pointer.y)
    if (button) {
      this.captures.set(pointer.id, { owner: 'UI', button, inside: true })
      return true
    }
    if (screenState === 'RUNNING' && this.moveId === null) {
      this.moveId = pointer.id
      this.captures.set(pointer.id, { owner: 'MOVE' })
      Object.assign(this.move, { active: true, startX: pointer.x, startY: pointer.y, currentX: pointer.x, currentY: pointer.y, directionX: 0, directionY: 0, ratio: 0, released: false })
      return true
    }
    this.captures.set(pointer.id, { owner: 'IGNORED' })
    return false
  }

  _move(pointer, capture, layout, screenState) {
    if (capture.owner === 'UI') {
      capture.inside = hitUi(layout, screenState, pointer.x, pointer.y) === capture.button
      return true
    }
    if (capture.owner !== 'MOVE' || pointer.id !== this.moveId) return false
    this.move.currentX = pointer.x
    this.move.currentY = pointer.y
    const dx = pointer.x - this.move.startX
    const dy = pointer.y - this.move.startY
    const radius = Math.min(layout.width, layout.height) * GAME_CONFIG.input.radiusShortSideRatio
    const deadZone = radius * GAME_CONFIG.input.deadZoneRatio
    const distance = length(dx, dy)
    if (distance <= deadZone) {
      this.move.directionX = 0
      this.move.directionY = 0
      this.move.ratio = 0
    } else {
      const direction = normalize(dx, dy)
      this.move.directionX = direction.x
      this.move.directionY = direction.y
      this.move.ratio = clamp((distance - deadZone) / (radius - deadZone), 0, 1)
    }
    return true
  }

  _finish(pointer, capture, layout, screenState, cancelled) {
    if (capture.owner === 'UI' && !cancelled && capture.inside && hitUi(layout, screenState, pointer.x, pointer.y) === capture.button) this.actionSink(capture.button)
    if (capture.owner === 'MOVE' && pointer.id === this.moveId) {
      this.moveId = null
      this.move.active = false
      this.move.released = true
      this.move.ratio = 0
    }
    this.captures.delete(pointer.id)
    return true
  }

  clear(hard = false) {
    this.captures.clear()
    this.moveId = null
    this.move.active = false
    this.move.released = !hard
    this.move.ratio = 0
    this.move.directionX = 0
    this.move.directionY = 0
  }

  snapshot() { return { ...this.move } }
}

module.exports = { InputController }
