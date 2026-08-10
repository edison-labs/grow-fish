'use strict'

const { GAME_CONFIG } = require('../config/game-config')
const { ellipsesOverlap, normalize, relationFor } = require('../core/math')
const { fishBody, grassBody } = require('../core/entities')

class CollisionSystem {
  constructor(world) {
    this.world = world
    this.lethal = []
    this.edible = []
    this.grass = []
    this.equal = []
    this.injected = null
  }

  inject(events) {
    this.injected = Array.isArray(events) ? events.slice() : null
  }

  resolve(frameSnapshot) {
    this.lethal.length = 0
    this.edible.length = 0
    this.grass.length = 0
    this.equal.length = 0
    if (this.injected) this.collectInjected(frameSnapshot)
    else this.collectDetected(frameSnapshot)
    this.injected = null
    const byId = (a, b) => a.spawnSeq - b.spawnSeq
    this.lethal.sort(byId)
    this.edible.sort(byId)
    this.grass.sort(byId)
    this.equal.sort(byId)
    if (this.lethal.length) {
      this.world.lockDeath(this.lethal[0])
      return
    }
    for (const fish of this.edible) if (fish.inUse && fish.active) this.world.consumeFish(fish)
    for (const grass of this.grass) if (grass.inUse && grass.active && grass.growRemaining <= 0) this.world.consumeGrass(grass)
    for (const fish of this.equal) if (fish.inUse && fish.active) this.bounceEqual(fish)
  }

  collectDetected(frameSnapshot) {
    const playerBody = this.world.playerBody()
    for (const fish of this.world.fishPool.items) {
      if (!fish.inUse || !fish.active) continue
      const overlaps = ellipsesOverlap(playerBody, fishBody(fish))
      if (!overlaps) {
        fish.dangerSuppressed = false
        continue
      }
      const relation = relationFor(frameSnapshot.level, fish.level)
      if (relation === 'LETHAL') {
        if (frameSnapshot.invincible) fish.dangerSuppressed = true
        else if (!fish.dangerSuppressed) this.lethal.push(fish)
      } else if (relation === 'EDIBLE') this.edible.push(fish)
      else if (fish.equalCooldown <= 0) this.equal.push(fish)
    }
    for (const grass of this.world.grassPool.items) {
      if (!grass.inUse || !grass.active || grass.growRemaining > 0) continue
      if (ellipsesOverlap(playerBody, grassBody(grass))) this.grass.push(grass)
    }
  }

  collectInjected(frameSnapshot) {
    for (const event of this.injected) {
      if (!event || !event.entity) continue
      const type = event.type || (event.entity.level ? relationFor(frameSnapshot.level, event.entity.level) : 'GRASS')
      if (type === 'LETHAL') {
        if (frameSnapshot.invincible) event.entity.dangerSuppressed = true
        else if (!event.entity.dangerSuppressed) this.lethal.push(event.entity)
      } else if (type === 'EDIBLE') this.edible.push(event.entity)
      else if (type === 'EQUAL') this.equal.push(event.entity)
      else if (type === 'GRASS') this.grass.push(event.entity)
    }
  }

  bounceEqual(fish) {
    const fallbackAngle = ((fish.spawnSeq * 2654435761) >>> 0) / 4294967296 * Math.PI * 2
    const direction = normalize(this.world.player.x - fish.x, this.world.player.y - fish.y, Math.cos(fallbackAngle), Math.sin(fallbackAngle))
    const speed = this.world.layout.width * GAME_CONFIG.fish.equalBounceSpeedRatio
    this.world.player.vx += direction.x * speed
    this.world.player.vy += direction.y * speed
    if (!this.world.input.move.active) {
      this.world.input.move.released = true
      this.world.player.releaseElapsed = 0
      this.world.player.releaseVx = this.world.player.vx
      this.world.player.releaseVy = this.world.player.vy
    }
    fish.x -= direction.x * Math.min(fish.width * 0.12, this.world.layout.width * 0.015)
    fish.y -= direction.y * Math.min(fish.height * 0.12, this.world.layout.width * 0.015)
    fish.equalCooldown = GAME_CONFIG.fish.equalCooldown
    this.world.emit('equal_bounce', { id: fish.spawnSeq, level: fish.level })
  }
}

module.exports = { CollisionSystem }
