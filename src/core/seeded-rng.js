'use strict'

function hashLabel(label) {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < label.length; i += 1) {
    hash ^= label.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

class SeededRng {
  constructor(seed = 1) {
    this.initialSeed = seed >>> 0
    this.state = this.initialSeed
    this.cursor = 0
  }

  reset(seed = this.initialSeed) {
    this.initialSeed = seed >>> 0
    this.state = this.initialSeed
    this.cursor = 0
  }

  nextUint() {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    this.cursor += 1
    return (value ^ (value >>> 14)) >>> 0
  }

  next() {
    return this.nextUint() / 4294967296
  }

  range(min, max) {
    return min + (max - min) * this.next()
  }

  int(min, maxInclusive) {
    return min + Math.floor(this.next() * (maxInclusive - min + 1))
  }

  derive(label) {
    return new SeededRng((this.initialSeed ^ hashLabel(label)) >>> 0)
  }

  snapshot() {
    return { seed: this.initialSeed, state: this.state, cursor: this.cursor }
  }
}

module.exports = { SeededRng, hashLabel }

