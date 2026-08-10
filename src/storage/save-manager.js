'use strict'

const SAVE_KEY = 'growFish.save.v1'

function defaults() {
  return {
    schemaVersion: 1,
    highestScore: 0,
    highestLevel: 1,
    fastestWinMs: null,
    tutorialCompleted: false,
    soundEnabled: true,
    hapticEnabled: true
  }
}

function normalizeSave(raw) {
  const result = defaults()
  if (!raw || typeof raw !== 'object') return result
  if (Number.isFinite(raw.highestScore) && raw.highestScore >= 0) result.highestScore = Math.floor(raw.highestScore)
  if (Number.isFinite(raw.highestLevel) && raw.highestLevel >= 1 && raw.highestLevel <= 10) result.highestLevel = Math.floor(raw.highestLevel)
  if (Number.isFinite(raw.fastestWinMs) && raw.fastestWinMs > 0) result.fastestWinMs = raw.fastestWinMs
  if (typeof raw.tutorialCompleted === 'boolean') result.tutorialCompleted = raw.tutorialCompleted
  if (typeof raw.soundEnabled === 'boolean') result.soundEnabled = raw.soundEnabled
  if (typeof raw.hapticEnabled === 'boolean') result.hapticEnabled = raw.hapticEnabled
  return result
}

class SaveManager {
  constructor(platform) {
    this.platform = platform
    this.data = normalizeSave(platform.load(SAVE_KEY))
    this.lastWriteOk = true
  }

  commitResult(result) {
    let changed = false
    const highestScore = Math.max(this.data.highestScore, result.score || 0)
    const highestLevel = Math.max(this.data.highestLevel, result.level || 1)
    if (highestScore !== this.data.highestScore) { this.data.highestScore = highestScore; changed = true }
    if (highestLevel !== this.data.highestLevel) { this.data.highestLevel = highestLevel; changed = true }
    if (result.won && Number.isFinite(result.durationMs)) {
      if (this.data.fastestWinMs === null || result.durationMs < this.data.fastestWinMs) { this.data.fastestWinMs = result.durationMs; changed = true }
    }
    if (!changed) { this.lastWriteOk = true; return true }
    return this.write()
  }

  setTutorialCompleted(value = true) { this.data.tutorialCompleted = !!value; return this.write() }
  setSoundEnabled(value) { this.data.soundEnabled = !!value; return this.write() }
  setHapticEnabled(value) { this.data.hapticEnabled = !!value; return this.write() }
  clear() { this.data = defaults(); return this.write() }
  import(raw) { this.data = normalizeSave(raw); return this.write() }
  export() { return JSON.parse(JSON.stringify(this.data)) }

  write() {
    this.lastWriteOk = this.platform.save(SAVE_KEY, this.data)
    return this.lastWriteOk
  }
}

module.exports = { SAVE_KEY, defaults, normalizeSave, SaveManager }
