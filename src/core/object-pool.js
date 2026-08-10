'use strict'

class ObjectPool {
  constructor(name, capacity, factory) {
    this.name = name
    this.items = Array.from({ length: capacity }, (_, index) => factory(index))
    this.created = capacity
    this.borrowed = 0
    this.returned = 0
    this.peakActive = 0
  }

  acquire(reset) {
    const item = this.items.find((candidate) => !candidate.inUse)
    if (!item) return null
    item.inUse = true
    item.generation = (item.generation + 1) >>> 0
    this.borrowed += 1
    if (reset) reset(item)
    this.peakActive = Math.max(this.peakActive, this.activeCount())
    return item
  }

  release(item, clear) {
    if (!item || !item.inUse) return
    if (clear) clear(item)
    item.inUse = false
    this.returned += 1
  }

  releaseAll(clear) {
    for (const item of this.items) this.release(item, clear)
  }

  activeCount() {
    let count = 0
    for (const item of this.items) if (item.inUse) count += 1
    return count
  }

  stats() {
    return { name: this.name, created: this.created, borrowed: this.borrowed, returned: this.returned, active: this.activeCount(), peakActive: this.peakActive }
  }
}

module.exports = { ObjectPool }

