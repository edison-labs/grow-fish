'use strict'

const TONES = Object.freeze({
  grass_eaten: [440, 0.08, 0.025],
  fish_eaten: [620, 0.11, 0.035],
  equal_bounce: [180, 0.08, 0.025],
  danger_warning: [120, 0.16, 0.03],
  level_up: [880, 0.24, 0.04],
  dead: [90, 0.35, 0.05],
  win: [1040, 0.42, 0.045],
  click: [520, 0.05, 0.02]
})

class AudioManager {
  constructor(platform, settings) {
    this.platform = platform
    this.settings = settings
    this.context = null
    this.unlocked = false
    this.ambient = null
    this.voices = []
    this.maxVoices = 6
  }

  unlock() {
    try {
      if (!this.context) this.context = this.platform.createAudioContext()
      this.unlocked = !!this.context
      const operation = this.context?.resume?.()
      this.observeOperation(operation, () => {
        this.unlocked = false
        this.stopAmbient()
        this.stopVoices()
      })
    } catch {
      this.unlocked = false
      this.stopAmbient()
      this.stopVoices()
    }
    return this.unlocked
  }

  observeOperation(operation, onRejected = () => {}) {
    if (!operation || typeof operation.then !== 'function') return
    try {
      operation.then(undefined, () => {
        try { onRejected() } catch {}
      })
    } catch {
      try { onRejected() } catch {}
    }
  }

  play(name, combo = 1) {
    if (!this.settings.soundEnabled || !this.unlocked || !this.context || !TONES[name]) return false
    const [baseFrequency, duration, volume] = TONES[name]
    try {
      const now = Number.isFinite(this.context.currentTime) ? this.context.currentTime : 0
      this.pruneVoices(now)
      const priority = this.voicePriority(name)
      if (this.voices.length >= this.maxVoices) {
        let victim = null
        for (const voice of this.voices) {
          if (voice.priority >= priority) continue
          if (!victim || voice.priority < victim.priority || (voice.priority === victim.priority && voice.startedAt < victim.startedAt)) victim = voice
        }
        if (!victim) return false
        this.stopVoice(victim)
      }
      const oscillator = this.context.createOscillator()
      const gain = this.context.createGain()
      const voice = { oscillator, gain, name, priority, startedAt: now, endAt: now + duration + 0.02 }
      oscillator.onended = () => {
        const index = this.voices.indexOf(voice)
        if (index >= 0) this.voices.splice(index, 1)
      }
      oscillator.type = name === 'danger_warning' || name === 'dead' ? 'sawtooth' : 'sine'
      oscillator.frequency.setValueAtTime(baseFrequency * Math.min(1.5, 1 + (combo - 1) * 0.04), now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain)
      gain.connect(this.context.destination)
      oscillator.start(now)
      oscillator.stop(voice.endAt)
      this.voices.push(voice)
      return true
    } catch { return false }
  }

  pruneVoices(now) {
    this.voices = this.voices.filter((voice) => voice.endAt > now)
  }

  voicePriority(name) {
    if (name === 'dead' || name === 'win') return 4
    if (name === 'level_up') return 3
    if (name === 'danger_warning') return 2
    return 1
  }

  stopVoice(voice) {
    const index = this.voices.indexOf(voice)
    if (index >= 0) this.voices.splice(index, 1)
    try { voice.oscillator.stop() } catch {}
  }

  stopVoices() {
    for (const voice of this.voices.slice()) this.stopVoice(voice)
  }

  startAmbient() {
    if (!this.settings.soundEnabled || !this.unlocked || !this.context || this.ambient) return
    try {
      const oscillator = this.context.createOscillator()
      const gain = this.context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = 56
      gain.gain.value = 0.008
      oscillator.connect(gain)
      gain.connect(this.context.destination)
      oscillator.start()
      this.ambient = { oscillator, gain }
    } catch { this.ambient = null }
  }

  stopAmbient() {
    try { this.ambient?.oscillator?.stop() } catch {}
    this.ambient = null
  }

  setEnabled(enabled) {
    if (!enabled) {
      this.stopAmbient()
      this.stopVoices()
    }
  }
  suspend() {
    try { this.observeOperation(this.context?.suspend?.()) } catch {}
  }

  resumePaused() {
    try {
      this.observeOperation(this.context?.resume?.(), () => {
        this.unlocked = false
        this.stopAmbient()
        this.stopVoices()
      })
    } catch {
      this.unlocked = false
      this.stopAmbient()
      this.stopVoices()
    }
  }

  haptic(kind) {
    if (this.settings.hapticEnabled) this.platform.vibrate(kind)
  }
}

module.exports = { AudioManager, TONES }
