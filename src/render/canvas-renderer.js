'use strict'

const { GAME_CONFIG, upgradeNeed, playerSizeScale } = require('../config/game-config')
const { clamp, relationFor } = require('../core/math')
const { fishBody, grassBody } = require('../core/entities')
const { catalogGeometry, uiRects } = require('./layout')

const COLORS = {
  ink: '#eaffff',
  muted: '#9bd5df',
  panel: 'rgba(3,27,46,.86)',
  panelLine: 'rgba(145,229,238,.34)',
  lethal: '#ff6174',
  accent: '#59e4ef'
}

const FISH_LEVEL_VISUALS = Object.freeze([
  Object.freeze({ id: 'silver-minnow', name: '银鳞鱼', body: 'slender', tail: 'fork', fin: 'tiny', pattern: 'shine', primary: '#8de9f2', secondary: '#26788f', accent: '#e8feff', eyeX: 0.27 }),
  Object.freeze({ id: 'lime-drop', name: '青露鱼', body: 'drop', tail: 'paddle', fin: 'triangle', pattern: 'band', primary: '#c8ea72', secondary: '#5c7a35', accent: '#f4ffd2', eyeX: 0.25 }),
  Object.freeze({ id: 'violet-butterfly', name: '蝶翼鱼', body: 'diamond', tail: 'swallow', fin: 'veil', pattern: 'diagonal', primary: '#c8a8ff', secondary: '#6551a6', accent: '#f0e7ff', eyeX: 0.25 }),
  Object.freeze({ id: 'coral-puffer', name: '珊瑚河豚', body: 'orb', tail: 'fan', fin: 'spikes', pattern: 'dots', primary: '#ff94a6', secondary: '#9b3f5c', accent: '#ffe1e7', eyeX: 0.18 }),
  Object.freeze({ id: 'sun-moonfish', name: '太阳月鱼', body: 'moon', tail: 'crescent', fin: 'sail', pattern: 'eyespot', primary: '#ffd166', secondary: '#a65c2e', accent: '#fff0ae', eyeX: 0.23 }),
  Object.freeze({ id: 'blue-swordfish', name: '蓝剑鱼', body: 'sword', tail: 'deepFork', fin: 'swept', pattern: 'zigzag', primary: '#80c7ff', secondary: '#27649a', accent: '#dff3ff', eyeX: 0.28 }),
  Object.freeze({ id: 'rose-lionfish', name: '狮子鱼', body: 'lion', tail: 'rayFan', fin: 'rays', pattern: 'wideBands', primary: '#f5e3b3', secondary: '#8a486f', accent: '#fff7dc', eyeX: 0.23 }),
  Object.freeze({ id: 'slate-shark', name: '灰礁鲨', body: 'shark', tail: 'shark', fin: 'shark', pattern: 'belly', primary: '#a8c6d4', secondary: '#334c60', accent: '#edf8fb', eyeX: 0.29 }),
  Object.freeze({ id: 'amber-armor', name: '铠甲鱼', body: 'armor', tail: 'trident', fin: 'double', pattern: 'plates', primary: '#f0a56a', secondary: '#6d4057', accent: '#ffe1b5', eyeX: 0.25 }),
  Object.freeze({ id: 'gold-dragon', name: '王冠龙鱼', body: 'dragon', tail: 'doubleLeaf', fin: 'crown', pattern: 'scales', primary: '#ffe36e', secondary: '#5a3e91', accent: '#fff6bd', eyeX: 0.24 })
])

const PUFFER_DOTS = Object.freeze([
  Object.freeze([-0.16, -0.16, 0.075]),
  Object.freeze([0.02, -0.24, 0.055]),
  Object.freeze([0.12, 0.1, 0.065]),
  Object.freeze([-0.09, 0.22, 0.05])
])

function fishVisualForLevel(level) {
  const normalized = Math.max(1, Math.min(10, Math.floor(Number(level) || 1)))
  return FISH_LEVEL_VISUALS[normalized - 1]
}

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.effects = []
    this.elapsed = 0
    this.playerPulse = 0
    this.scorePulse = 0
    this.playerLevelTransition = null
    this.lastLayoutKey = ''
  }

  resize(layout) {
    const key = `${layout.width}x${layout.height}@${layout.dpr}`
    if (key === this.lastLayoutKey) return
    this.lastLayoutKey = key
    this.canvas.width = Math.round(layout.width * layout.dpr)
    this.canvas.height = Math.round(layout.height * layout.dpr)
  }

  consumeEvents(events, snapshot) {
    for (const event of events) {
      const data = event.data || {}
      if (event.type === 'game_start' || event.type === 'game_quit') {
        this.resetRunEffects()
      } else if (event.type === 'fish_eaten' || event.type === 'grass_eaten') {
        this.addEffect({ kind: 'score', x: data.x ?? snapshot.player.x, y: data.y ?? snapshot.player.y, text: `+${data.points}`, color: event.type === 'fish_eaten' ? '#fff1a8' : '#9fffd2', age: 0, life: 0.6 })
        for (let index = 0; index < 7; index += 1) this.addEffect({ kind: 'bubble', x: data.x ?? snapshot.player.x, y: data.y ?? snapshot.player.y, dx: (index - 3) * 12, age: 0, life: 0.65 + index * 0.03 })
        this.playerPulse = 0.16
        this.scorePulse = 0.15
        if (event.type === 'fish_eaten') {
          this.addEffect({
            kind: 'suction',
            x: data.x ?? snapshot.player.x,
            y: data.y ?? snapshot.player.y,
            width: data.width ?? snapshot.player.width * 0.7,
            height: data.height ?? snapshot.player.height * 0.7,
            direction: data.direction || 1,
            visualId: data.visualId ?? 0,
            level: data.fishLevel ?? data.level ?? ((data.visualId ?? 0) + 1),
            age: 0,
            life: 0.28
          })
          const combo = Math.max(1, Math.floor(Number(data.combo) || 1))
          if (combo >= 3) {
            const trailCount = Math.min(12, combo * 2)
            for (let index = 0; index < trailCount; index += 1) {
              const angle = (index / trailCount) * Math.PI * 2
              this.addEffect({
                kind: 'comboTrail',
                x: data.x ?? snapshot.player.x,
                y: data.y ?? snapshot.player.y,
                dx: Math.cos(angle) * (22 + (index % 3) * 8),
                dy: Math.sin(angle) * (18 + (index % 2) * 7),
                color: index % 2 ? '#ffe879' : '#8cfff1',
                age: 0,
                life: 0.45 + (index % 3) * 0.04
              })
            }
          }
        }
      } else if (event.type === 'level_up') {
        for (let index = 0; index < 18; index += 1) this.addEffect({ kind: 'spark', x: snapshot.player.x, y: snapshot.player.y, angle: (index / 18) * Math.PI * 2, age: 0, life: 0.8 })
        this.addEffect({ kind: 'upgradeRing', x: snapshot.player.x, y: snapshot.player.y, age: 0, life: 0.8 })
        this.addEffect({ kind: 'levelText', text: `升级！Lv.${data.level ?? snapshot.player.level}`, age: 0, life: 0.8 })
        const previousLevel = Math.max(1, Math.floor(Number(data.previous) || Math.max(1, snapshot.player.level - 1)))
        const previousWidth = Math.min(
          snapshot.layout.width * GAME_CONFIG.player.maxWidthRatio,
          snapshot.layout.width * GAME_CONFIG.player.baseWidthRatio * playerSizeScale(previousLevel)
        )
        this.playerLevelTransition = {
          fromWidth: previousWidth,
          toWidth: snapshot.player.width,
          toLevel: data.level ?? snapshot.player.level,
          life: GAME_CONFIG.timing.levelUpVisual
        }
      } else if (event.type === 'equal_bounce') {
        this.addEffect({ kind: 'ring', x: snapshot.player.x, y: snapshot.player.y, age: 0, life: 0.35 })
      } else if (event.type === 'game_win') {
        const colors = ['#ffe879', '#8cfff1', '#ff9fca', '#a7ff8a']
        for (let index = 0; index < 24; index += 1) {
          this.addEffect({
            kind: 'celebration',
            x: snapshot.layout.width * ((index + 0.5) / 24),
            y: snapshot.layout.height * (0.08 + (index % 4) * 0.035),
            dx: ((index % 7) - 3) * 8,
            dy: snapshot.layout.height * (0.22 + (index % 5) * 0.025),
            angle: (index % 6) * 0.45,
            spin: (index % 2 ? -1 : 1) * (4 + (index % 3)),
            color: colors[index % colors.length],
            age: 0,
            life: GAME_CONFIG.timing.win
          })
        }
      }
    }
  }

  resetRunEffects() {
    this.effects.length = 0
    this.playerPulse = 0
    this.scorePulse = 0
    this.playerLevelTransition = null
  }

  addEffect(effect) {
    if (this.effects.length >= GAME_CONFIG.pools.effects) this.effects.shift()
    this.effects.push(effect)
  }

  update(dt) {
    this.elapsed += dt
    this.playerPulse = Math.max(0, this.playerPulse - dt)
    this.scorePulse = Math.max(0, this.scorePulse - dt)
    for (const effect of this.effects) effect.age += dt
    this.effects = this.effects.filter((effect) => effect.age < effect.life)
  }

  render(snapshot) {
    const { ctx } = this
    const layout = snapshot.layout
    this.resize(layout)
    ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0)
    ctx.clearRect(0, 0, layout.width, layout.height)
    this.drawOcean(layout)
    if (snapshot.screenState === 'HOME') this.drawHome(snapshot)
    else if (snapshot.screenState === 'RESULT') this.drawResult(snapshot)
    else {
      ctx.save()
      if (snapshot.screenState === 'DEAD' && snapshot.cinematicClock < GAME_CONFIG.timing.deadSlowMotion) {
        const strength = (1 - snapshot.cinematicClock / GAME_CONFIG.timing.deadSlowMotion) * Math.max(2, layout.width * 0.006)
        ctx.translate(Math.sin(this.elapsed * 57) * strength, Math.cos(this.elapsed * 43) * strength * 0.55)
      }
      this.drawRun(snapshot)
      ctx.restore()
    }
    if (snapshot.orientationBlocked) this.drawOrientationBlock(snapshot)
    if (snapshot.debug.enabled) this.drawDebug(snapshot)
  }

  drawOcean(layout) {
    const { ctx } = this
    const gradient = ctx.createLinearGradient(0, 0, 0, layout.height)
    gradient.addColorStop(0, '#087c9b')
    gradient.addColorStop(0.45, '#07516f')
    gradient.addColorStop(1, '#03263f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, layout.width, layout.height)
    ctx.save()
    ctx.globalAlpha = 0.13
    ctx.fillStyle = '#b9ffff'
    for (let ray = 0; ray < 6; ray += 1) {
      const x = layout.width * (0.02 + ray * 0.19)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + layout.width * 0.16, 0)
      ctx.lineTo(x + layout.width * 0.28, layout.height)
      ctx.lineTo(x + layout.width * 0.18, layout.height)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 0.2
    ctx.strokeStyle = '#9effff'
    ctx.lineWidth = 1.5
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 97 + this.elapsed * (9 + index % 4)) % (layout.width + 30) - 15
      const y = layout.height - ((index * 61 + this.elapsed * (18 + index % 5)) % (layout.height * 0.82))
      ctx.beginPath()
      ctx.arc(x, y, 2 + index % 4, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    ctx.fillStyle = '#03213a'
    ctx.beginPath()
    ctx.moveTo(0, layout.height)
    for (let x = 0; x <= layout.width; x += 40) ctx.lineTo(x, layout.height - 12 - Math.sin(x * 0.03) * 6)
    ctx.lineTo(layout.width, layout.height)
    ctx.fill()
  }

  drawHome(snapshot) {
    const { ctx } = this
    const { width, height } = snapshot.layout
    ctx.textAlign = 'center'
    ctx.fillStyle = '#dfffff'
    ctx.font = `800 ${Math.max(34, height * 0.105)}px sans-serif`
    ctx.fillText('大鱼吃小鱼', width * 0.5, height * 0.24)
    ctx.fillStyle = '#a5eef4'
    ctx.font = `600 ${Math.max(14, height * 0.035)}px sans-serif`
    ctx.fillText('吃水草起步 · 吃小鱼成长 · 躲避大鱼', width * 0.5, height * 0.31)
    this.drawFishShape({ x: width * 0.5, y: height * 0.42, width: width * 0.13, height: width * 0.067, direction: 1, visualId: 5, level: 6, player: true }, snapshot)
    const save = snapshot.save
    ctx.font = `500 ${Math.max(13, height * 0.03)}px sans-serif`
    ctx.fillStyle = '#b8e6ea'
    const fastest = save.fastestWinMs === null ? '--' : this.formatTime(save.fastestWinMs)
    ctx.fillText(`最高分 ${save.highestScore}   ·   最高 Lv.${save.highestLevel}   ·   最快 ${fastest}`, width * 0.5, height * 0.51)
    const rects = uiRects(snapshot.layout, 'HOME')
    this.drawButton(rects.start, '开始游戏', true)
    this.drawSettingButtons(snapshot, rects)
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(215,249,251,.65)'
    ctx.font = `400 ${Math.max(11, height * 0.023)}px sans-serif`
    ctx.fillText(`V${snapshot.version} · 原创程序化 Canvas 美术`, width * 0.5, height * 0.94)
  }

  drawRun(snapshot) {
    const { ctx } = this
    for (const grass of snapshot.grass) if (grass.inUse && grass.active) this.drawGrass(grass)
    for (const fish of snapshot.fish) if (fish.inUse && fish.active) this.drawFishShape(fish, snapshot)
    for (const fish of snapshot.fish) if (fish.inUse && fish.pending) this.drawWarning(fish, snapshot.layout)
    this.drawPlayer(snapshot)
    this.drawEffects(snapshot)
    this.drawHud(snapshot)
    if (snapshot.screenState === 'RUNNING') this.drawTutorial(snapshot)
    if (snapshot.screenState === 'PAUSED') {
      if (snapshot.pauseView === 'CATALOG') this.drawCatalog(snapshot)
      else this.drawPause(snapshot)
    }
    if (snapshot.screenState === 'DEAD') this.drawCinematicLabel(snapshot, '被大鱼吃掉了', '#ff9aa7')
    if (snapshot.screenState === 'WIN') this.drawCinematicLabel(snapshot, '称霸海域！', '#ffe879')
  }

  drawGrass(grass) {
    const { ctx } = this
    const grow = clamp(1 - grass.growRemaining / GAME_CONFIG.grass.growTime, 0.05, 1)
    const sway = Math.sin(this.elapsed * 2 + grass.swayPhase) * grass.width * 0.14
    const visualId = ((Number(grass.visualId) || 0) % 3 + 3) % 3
    ctx.save()
    ctx.translate(grass.x, grass.y)
    ctx.scale(grow, grow)
    ctx.lineCap = 'round'
    if (visualId === 0) {
      for (let blade = -2; blade <= 2; blade += 1) {
        const offset = blade * grass.width * 0.15
        ctx.strokeStyle = blade % 2 ? '#35c993' : '#62e0a7'
        ctx.lineWidth = Math.max(2, grass.width * 0.09)
        ctx.beginPath()
        ctx.moveTo(offset, grass.height * 0.35)
        ctx.bezierCurveTo(offset - sway * 0.3, 0, offset + sway, -grass.height * (0.48 + Math.abs(blade) * 0.04), offset + sway * 0.6, -grass.height * 0.67)
        ctx.stroke()
      }
    } else if (visualId === 1) {
      for (let frond = -1; frond <= 1; frond += 1) {
        const offset = frond * grass.width * 0.2
        const tipX = offset + sway * (0.45 + frond * 0.08)
        const tipY = -grass.height * (0.54 + Math.abs(frond) * 0.08)
        ctx.strokeStyle = frond === 0 ? '#86e38b' : '#3dbb78'
        ctx.lineWidth = Math.max(2.5, grass.width * 0.11)
        ctx.beginPath()
        ctx.moveTo(offset, grass.height * 0.35)
        ctx.quadraticCurveTo(offset - sway * 0.4, -grass.height * 0.12, tipX, tipY)
        ctx.stroke()
        ctx.fillStyle = frond === 0 ? '#a2ef9c' : '#59ce86'
        ctx.beginPath()
        ctx.ellipse(tipX - grass.width * 0.08, tipY + grass.height * 0.08, grass.width * 0.16, grass.height * 0.08, -0.55, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      for (let fan = 0; fan < 4; fan += 1) {
        const direction = fan < 2 ? -1 : 1
        const spread = (fan % 2 + 1) * grass.width * 0.18 * direction
        ctx.fillStyle = fan % 2 ? '#45c6a8' : '#76e0bd'
        ctx.beginPath()
        ctx.moveTo(direction * grass.width * 0.05, grass.height * 0.33)
        ctx.quadraticCurveTo(spread + sway * 0.2, -grass.height * 0.08, spread + sway * 0.45, -grass.height * (0.43 + fan * 0.045))
        ctx.quadraticCurveTo(spread * 0.4, -grass.height * 0.2, direction * grass.width * 0.05, grass.height * 0.33)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#125a54'
    ctx.beginPath()
    ctx.ellipse(0, grass.height * 0.34, grass.width * 0.48, grass.height * 0.14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawPlayer(snapshot) {
    const { ctx } = this
    const player = snapshot.player
    const deadFlip = snapshot.screenState === 'DEAD' ? Math.min(1, snapshot.cinematicClock / 0.4) * Math.PI : 0
    const pulse = this.playerPulse > 0 ? 1 + Math.sin((this.playerPulse / 0.16) * Math.PI) * 0.08 : 1
    let levelScale = 1
    const transitionActive = this.playerLevelTransition && this.playerLevelTransition.toWidth > 0 && this.playerLevelTransition.toLevel === player.level
    if (transitionActive && (snapshot.levelUpRemaining > 0 || snapshot.screenState === 'WIN')) {
      const progress = snapshot.screenState === 'WIN'
        ? clamp(snapshot.cinematicClock / this.playerLevelTransition.life, 0, 1)
        : clamp(1 - snapshot.levelUpRemaining / this.playerLevelTransition.life, 0, 1)
      const startScale = this.playerLevelTransition.fromWidth / this.playerLevelTransition.toWidth
      if (progress < 0.65) {
        const phase = progress / 0.65
        const eased = phase * phase * (3 - 2 * phase)
        levelScale = startScale + (1.05 - startScale) * eased
      } else {
        const phase = (progress - 0.65) / 0.35
        const eased = phase * phase * (3 - 2 * phase)
        levelScale = 1.05 + (1 - 1.05) * eased
      }
    }
    const nominalSpeed = Math.max(1, snapshot.layout.width * GAME_CONFIG.player.baseSpeedRatio)
    const swimRatio = snapshot.screenState === 'DEAD' ? 0 : clamp(Math.hypot(player.vx, player.vy) / nominalSpeed, 0, 1)
    const swimKick = swimRatio > 0.02
      ? swimRatio * (0.035 + Math.sin(this.elapsed * 12) * 0.025)
      : Math.sin(this.elapsed * 2.4) * 0.008
    ctx.save()
    ctx.translate(player.x, player.y)
    ctx.rotate(deadFlip)
    ctx.scale(pulse * levelScale * (1 + swimKick), pulse * levelScale * (1 - swimKick * 0.35))
    if (snapshot.invincibleRemaining > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(this.elapsed * 20) * 0.25
      ctx.strokeStyle = '#bfffff'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(0, 0, player.width * 0.48, player.height * 0.65, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    this.drawFishShape({ ...player, direction: player.facing, visualId: player.level - 1, player: true }, snapshot, true)
    ctx.restore()
  }

  traceFishBody(body, w, h) {
    const { ctx } = this
    ctx.beginPath()
    if (body === 'slender') {
      ctx.ellipse(0, 0, w * 0.41, h * 0.3, 0, 0, Math.PI * 2)
    } else if (body === 'drop') {
      ctx.moveTo(-w * 0.39, 0)
      ctx.bezierCurveTo(-w * 0.23, -h * 0.34, w * 0.24, -h * 0.48, w * 0.4, -h * 0.08)
      ctx.quadraticCurveTo(w * 0.42, 0, w * 0.4, h * 0.1)
      ctx.bezierCurveTo(w * 0.22, h * 0.42, -w * 0.23, h * 0.34, -w * 0.39, 0)
      ctx.closePath()
    } else if (body === 'diamond') {
      ctx.moveTo(-w * 0.39, 0)
      ctx.quadraticCurveTo(-w * 0.08, -h * 0.49, w * 0.34, -h * 0.2)
      ctx.lineTo(w * 0.42, 0)
      ctx.lineTo(w * 0.34, h * 0.2)
      ctx.quadraticCurveTo(-w * 0.08, h * 0.49, -w * 0.39, 0)
      ctx.closePath()
    } else if (body === 'orb') {
      ctx.ellipse(-w * 0.02, 0, w * 0.34, h * 0.49, 0, 0, Math.PI * 2)
    } else if (body === 'moon') {
      ctx.ellipse(-w * 0.01, 0, w * 0.37, h * 0.47, 0, 0, Math.PI * 2)
    } else if (body === 'sword') {
      ctx.moveTo(-w * 0.42, 0)
      ctx.quadraticCurveTo(-w * 0.08, -h * 0.34, w * 0.29, -h * 0.2)
      ctx.lineTo(w * 0.42, -h * 0.025)
      ctx.lineTo(w * 0.29, h * 0.11)
      ctx.quadraticCurveTo(-w * 0.08, h * 0.32, -w * 0.42, 0)
      ctx.closePath()
    } else if (body === 'lion') {
      ctx.moveTo(-w * 0.39, 0)
      ctx.bezierCurveTo(-w * 0.28, -h * 0.44, w * 0.26, -h * 0.49, w * 0.4, -h * 0.09)
      ctx.lineTo(w * 0.42, h * 0.12)
      ctx.bezierCurveTo(w * 0.12, h * 0.47, -w * 0.27, h * 0.38, -w * 0.39, 0)
      ctx.closePath()
    } else if (body === 'shark') {
      ctx.moveTo(-w * 0.42, h * 0.02)
      ctx.quadraticCurveTo(-w * 0.08, -h * 0.38, w * 0.37, -h * 0.16)
      ctx.lineTo(w * 0.42, h * 0.055)
      ctx.quadraticCurveTo(w * 0.05, h * 0.35, -w * 0.42, h * 0.02)
      ctx.closePath()
    } else if (body === 'armor') {
      ctx.moveTo(-w * 0.4, 0)
      ctx.lineTo(-w * 0.22, -h * 0.42)
      ctx.lineTo(w * 0.22, -h * 0.42)
      ctx.lineTo(w * 0.42, -h * 0.08)
      ctx.lineTo(w * 0.37, h * 0.25)
      ctx.lineTo(-w * 0.18, h * 0.43)
      ctx.closePath()
    } else {
      ctx.moveTo(-w * 0.4, h * 0.02)
      ctx.bezierCurveTo(-w * 0.3, -h * 0.48, w * 0.25, -h * 0.49, w * 0.41, -h * 0.12)
      ctx.quadraticCurveTo(w * 0.42, h * 0.02, w * 0.38, h * 0.17)
      ctx.bezierCurveTo(w * 0.18, h * 0.46, -w * 0.29, h * 0.46, -w * 0.4, h * 0.02)
      ctx.closePath()
    }
  }

  drawFishTail(style, w, h) {
    const { ctx } = this
    ctx.fillStyle = style.secondary
    ctx.beginPath()
    if (style.tail === 'fork') {
      ctx.moveTo(-w * 0.34, 0); ctx.lineTo(-w * 0.63, -h * 0.32); ctx.lineTo(-w * 0.52, 0); ctx.lineTo(-w * 0.63, h * 0.32)
    } else if (style.tail === 'paddle') {
      ctx.moveTo(-w * 0.34, 0); ctx.quadraticCurveTo(-w * 0.62, -h * 0.4, -w * 0.59, 0); ctx.quadraticCurveTo(-w * 0.62, h * 0.4, -w * 0.34, 0)
    } else if (style.tail === 'swallow') {
      ctx.moveTo(-w * 0.34, 0); ctx.lineTo(-w * 0.64, -h * 0.46); ctx.lineTo(-w * 0.54, 0); ctx.lineTo(-w * 0.64, h * 0.46)
    } else if (style.tail === 'fan') {
      ctx.moveTo(-w * 0.31, 0); ctx.quadraticCurveTo(-w * 0.53, -h * 0.28, -w * 0.56, -h * 0.18); ctx.lineTo(-w * 0.56, h * 0.18); ctx.quadraticCurveTo(-w * 0.53, h * 0.28, -w * 0.31, 0)
    } else if (style.tail === 'crescent') {
      ctx.moveTo(-w * 0.34, 0); ctx.quadraticCurveTo(-w * 0.64, -h * 0.43, -w * 0.61, -h * 0.2); ctx.quadraticCurveTo(-w * 0.48, 0, -w * 0.61, h * 0.2); ctx.quadraticCurveTo(-w * 0.64, h * 0.43, -w * 0.34, 0)
    } else if (style.tail === 'deepFork') {
      ctx.moveTo(-w * 0.36, 0); ctx.lineTo(-w * 0.65, -h * 0.4); ctx.lineTo(-w * 0.49, -h * 0.05); ctx.lineTo(-w * 0.49, h * 0.05); ctx.lineTo(-w * 0.65, h * 0.4)
    } else if (style.tail === 'rayFan') {
      ctx.moveTo(-w * 0.34, 0); ctx.lineTo(-w * 0.62, -h * 0.48); ctx.quadraticCurveTo(-w * 0.54, 0, -w * 0.62, h * 0.48)
    } else if (style.tail === 'shark') {
      ctx.moveTo(-w * 0.36, 0); ctx.lineTo(-w * 0.61, -h * 0.49); ctx.lineTo(-w * 0.55, -h * 0.03); ctx.lineTo(-w * 0.62, h * 0.26)
    } else if (style.tail === 'trident') {
      ctx.moveTo(-w * 0.35, 0); ctx.lineTo(-w * 0.63, -h * 0.38); ctx.lineTo(-w * 0.54, -h * 0.08); ctx.lineTo(-w * 0.64, 0); ctx.lineTo(-w * 0.54, h * 0.08); ctx.lineTo(-w * 0.63, h * 0.38)
    } else {
      ctx.moveTo(-w * 0.34, 0); ctx.quadraticCurveTo(-w * 0.55, -h * 0.49, -w * 0.64, -h * 0.34); ctx.quadraticCurveTo(-w * 0.53, 0, -w * 0.64, h * 0.34); ctx.quadraticCurveTo(-w * 0.55, h * 0.49, -w * 0.34, 0)
    }
    ctx.closePath()
    ctx.fill()
  }

  drawFishFins(style, w, h) {
    const { ctx } = this
    ctx.fillStyle = style.secondary
    ctx.strokeStyle = style.secondary
    ctx.lineWidth = Math.max(1.5, h * 0.045)
    if (style.fin === 'tiny') {
      ctx.beginPath(); ctx.moveTo(-w * 0.06, h * 0.18); ctx.lineTo(w * 0.03, h * 0.39); ctx.lineTo(w * 0.12, h * 0.16); ctx.closePath(); ctx.fill()
    } else if (style.fin === 'triangle') {
      ctx.beginPath(); ctx.moveTo(-w * 0.12, -h * 0.22); ctx.lineTo(w * 0.02, -h * 0.48); ctx.lineTo(w * 0.14, -h * 0.2); ctx.closePath(); ctx.fill()
    } else if (style.fin === 'veil') {
      ctx.beginPath(); ctx.moveTo(-w * 0.18, -h * 0.22); ctx.quadraticCurveTo(0, -h * 0.5, w * 0.15, -h * 0.18); ctx.lineTo(w * 0.06, -h * 0.08); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-w * 0.14, h * 0.2); ctx.quadraticCurveTo(0, h * 0.49, w * 0.16, h * 0.18); ctx.closePath(); ctx.fill()
    } else if (style.fin === 'spikes') {
      for (let spike = 0; spike < 6; spike += 1) {
        const x = -w * 0.25 + spike * w * 0.09
        ctx.beginPath(); ctx.moveTo(x - w * 0.025, -h * 0.31); ctx.lineTo(x, -h * (0.43 + (spike % 2) * 0.05)); ctx.lineTo(x + w * 0.025, -h * 0.31); ctx.closePath(); ctx.fill()
      }
    } else if (style.fin === 'sail') {
      ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.23); ctx.quadraticCurveTo(-w * 0.02, -h * 0.5, w * 0.18, -h * 0.21); ctx.closePath(); ctx.fill()
    } else if (style.fin === 'swept') {
      ctx.beginPath(); ctx.moveTo(-w * 0.18, -h * 0.17); ctx.lineTo(w * 0.08, -h * 0.43); ctx.lineTo(w * 0.18, -h * 0.16); ctx.closePath(); ctx.fill()
    } else if (style.fin === 'rays') {
      for (let ray = 0; ray < 5; ray += 1) {
        const x = -w * 0.18 + ray * w * 0.08
        ctx.beginPath(); ctx.moveTo(x, -h * 0.24); ctx.lineTo(x - w * 0.04, -h * (0.45 + (ray % 2) * 0.035)); ctx.stroke()
      }
    } else if (style.fin === 'shark') {
      ctx.beginPath(); ctx.moveTo(-w * 0.13, -h * 0.17); ctx.lineTo(w * 0.02, -h * 0.5); ctx.lineTo(w * 0.14, -h * 0.14); ctx.closePath(); ctx.fill()
    } else if (style.fin === 'double') {
      for (let fin = 0; fin < 2; fin += 1) {
        const x = -w * 0.14 + fin * w * 0.23
        ctx.beginPath(); ctx.moveTo(x - w * 0.07, -h * 0.22); ctx.lineTo(x, -h * (0.46 - fin * 0.05)); ctx.lineTo(x + w * 0.07, -h * 0.2); ctx.closePath(); ctx.fill()
      }
    } else {
      for (let crown = 0; crown < 3; crown += 1) {
        const x = -w * 0.16 + crown * w * 0.13
        ctx.beginPath(); ctx.moveTo(x - w * 0.055, -h * 0.21); ctx.lineTo(x, -h * (0.49 - Math.abs(crown - 1) * 0.06)); ctx.lineTo(x + w * 0.055, -h * 0.2); ctx.closePath(); ctx.fill()
      }
    }
  }

  drawFishPattern(style, w, h) {
    const { ctx } = this
    ctx.fillStyle = style.accent
    ctx.strokeStyle = style.accent
    ctx.lineWidth = Math.max(1.5, h * 0.04)
    if (style.pattern === 'shine') {
      ctx.beginPath(); ctx.moveTo(-w * 0.25, -h * 0.08); ctx.quadraticCurveTo(0, -h * 0.24, w * 0.22, -h * 0.08); ctx.stroke()
    } else if (style.pattern === 'band') {
      ctx.beginPath(); ctx.moveTo(-w * 0.12, -h * 0.34); ctx.lineTo(-w * 0.02, -h * 0.4); ctx.lineTo(w * 0.02, h * 0.35); ctx.lineTo(-w * 0.1, h * 0.3); ctx.closePath(); ctx.fill()
    } else if (style.pattern === 'diagonal') {
      for (let band = 0; band < 2; band += 1) {
        const x = -w * 0.14 + band * w * 0.2
        ctx.beginPath(); ctx.moveTo(x - w * 0.08, -h * 0.34); ctx.lineTo(x, -h * 0.4); ctx.lineTo(x + w * 0.12, h * 0.31); ctx.lineTo(x + w * 0.04, h * 0.36); ctx.closePath(); ctx.fill()
      }
    } else if (style.pattern === 'dots') {
      for (const [x, y, radius] of PUFFER_DOTS) { ctx.beginPath(); ctx.arc(w * x, h * y, h * radius, 0, Math.PI * 2); ctx.fill() }
    } else if (style.pattern === 'eyespot') {
      ctx.beginPath(); ctx.arc(-w * 0.08, 0, h * 0.14, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = style.secondary; ctx.beginPath(); ctx.moveTo(-w * 0.27, h * 0.2); ctx.lineTo(w * 0.18, h * 0.2); ctx.stroke()
    } else if (style.pattern === 'zigzag') {
      ctx.beginPath(); ctx.moveTo(-w * 0.25, -h * 0.08); ctx.lineTo(-w * 0.08, h * 0.13); ctx.lineTo(w * 0.04, -h * 0.1); ctx.lineTo(w * 0.2, h * 0.1); ctx.stroke()
    } else if (style.pattern === 'wideBands') {
      for (let band = 0; band < 3; band += 1) ctx.fillRect(-w * 0.22 + band * w * 0.16, -h * 0.34, w * 0.055, h * 0.68)
    } else if (style.pattern === 'belly') {
      ctx.beginPath(); ctx.ellipse(0, h * 0.16, w * 0.29, h * 0.16, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = style.secondary; ctx.beginPath(); ctx.moveTo(w * 0.2, -h * 0.08); ctx.lineTo(w * 0.12, h * 0.12); ctx.stroke()
    } else if (style.pattern === 'plates') {
      for (let plate = 0; plate < 3; plate += 1) {
        const x = -w * 0.17 + plate * w * 0.17
        ctx.beginPath(); ctx.moveTo(x - w * 0.075, 0); ctx.lineTo(x, -h * 0.24); ctx.lineTo(x + w * 0.075, 0); ctx.lineTo(x, h * 0.24); ctx.closePath(); ctx.stroke()
      }
    } else {
      for (let scale = 0; scale < 3; scale += 1) {
        const x = -w * 0.15 + scale * w * 0.14
        ctx.beginPath(); ctx.arc(x, 0, h * 0.13, -1.1, 1.1); ctx.stroke()
      }
      ctx.beginPath(); ctx.moveTo(-w * 0.25, -h * 0.2); ctx.quadraticCurveTo(0, -h * 0.34, w * 0.22, -h * 0.16); ctx.stroke()
    }
  }

  drawFishShape(fish, snapshot, alreadyTranslated = false) {
    const { ctx } = this
    const direction = fish.direction || 1
    const level = Math.max(1, Math.min(10, Math.floor(Number(fish.level) || (Number(fish.visualId) || 0) + 1)))
    const style = fishVisualForLevel(level)
    ctx.save()
    if (!alreadyTranslated) ctx.translate(fish.x, fish.y)
    ctx.scale(direction, 1)
    const w = fish.width
    const h = fish.height
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    this.drawFishTail(style, w, h)
    this.drawFishFins(style, w, h)
    const gradient = ctx.createLinearGradient(-w * 0.35, -h * 0.4, w * 0.42, h * 0.32)
    gradient.addColorStop(0, style.primary)
    gradient.addColorStop(1, style.secondary)
    ctx.fillStyle = gradient
    this.traceFishBody(style.body, w, h)
    ctx.fill()
    ctx.save()
    this.traceFishBody(style.body, w, h)
    ctx.clip()
    this.drawFishPattern(style, w, h)
    ctx.fillStyle = 'rgba(255,255,255,.28)'
    ctx.beginPath(); ctx.moveTo(-w * 0.08, h * 0.2); ctx.quadraticCurveTo(0, h * 0.45, w * 0.14, h * 0.16); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = fish.player ? '#edffff' : 'rgba(2,31,48,.72)'
    ctx.lineWidth = Math.max(fish.player ? 2.2 : 1.4, h * (fish.player ? 0.045 : 0.03))
    this.traceFishBody(style.body, w, h)
    ctx.stroke()
    const eyeX = w * style.eyeX
    ctx.fillStyle = '#f8ffff'
    ctx.beginPath(); ctx.arc(eyeX, -h * 0.1, Math.max(2.5, h * 0.09), 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#082737'
    ctx.beginPath(); ctx.arc(eyeX + w * 0.018, -h * 0.1, Math.max(1.3, h * 0.045), 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(2,31,48,.78)'
    ctx.lineWidth = Math.max(1.5, h * 0.035)
    ctx.beginPath(); ctx.arc(w * 0.25, h * 0.04, Math.min(w * 0.045, h * 0.07), 0.18, 1.3); ctx.stroke()
    if (!fish.player && snapshot?.player && relationFor(snapshot.player.level, fish.level) === 'LETHAL') this.drawDangerOutline(style, fish, w, h)
    ctx.restore()
  }

  drawDangerOutline(style, fish, w, h) {
    const { ctx } = this
    const phase = this.elapsed * Math.PI * 3.6 + (Number(fish.spawnSeq) || 0) * 0.61
    const alpha = clamp(0.55 + (Math.sin(phase) * 0.5 + 0.5) * 0.4, 0.55, 0.95)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#5b0b20'
    ctx.lineWidth = Math.max(2.2, h * 0.045)
    this.traceFishBody(style.body, w, h)
    ctx.stroke()
    ctx.strokeStyle = '#ff3b5c'
    ctx.lineWidth = Math.max(1.3, h * 0.024)
    this.traceFishBody(style.body, w, h)
    ctx.stroke()
    ctx.restore()
  }

  drawWarning(fish, layout) {
    const { ctx } = this
    const x = fish.side === 'left' ? layout.playable.left + 16 : layout.playable.right - 16
    const pulse = 0.75 + Math.sin(this.elapsed * 18) * 0.25
    ctx.save()
    ctx.translate(x, fish.y)
    ctx.scale(fish.side === 'left' ? 1 : -1, 1)
    ctx.globalAlpha = pulse
    ctx.fillStyle = COLORS.lethal
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -14); ctx.lineTo(-10, 14); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#ffd2d8'; ctx.lineWidth = 2
    for (let ring = 0; ring < 2; ring += 1) { ctx.beginPath(); ctx.arc(-3, 0, 20 + ring * 9, -0.8, 0.8); ctx.stroke() }
    ctx.restore()
  }

  drawEffects(snapshot) {
    const { ctx } = this
    for (const effect of this.effects) {
      const progress = effect.age / effect.life
      ctx.save()
      ctx.globalAlpha = 1 - progress
      if (effect.kind === 'score') {
        ctx.fillStyle = effect.color
        ctx.textAlign = 'center'
        ctx.font = `800 ${Math.max(16, snapshot.layout.height * 0.04)}px sans-serif`
        ctx.fillText(effect.text, effect.x, effect.y - progress * 42)
      } else if (effect.kind === 'bubble') {
        ctx.strokeStyle = '#c9ffff'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(effect.x + effect.dx * progress, effect.y - progress * 48, 2 + progress * 5, 0, Math.PI * 2); ctx.stroke()
      } else if (effect.kind === 'comboTrail') {
        const eased = 1 - Math.pow(1 - progress, 2)
        ctx.fillStyle = effect.color
        ctx.beginPath()
        ctx.arc(effect.x + effect.dx * eased, effect.y + effect.dy * eased - progress * 20, Math.max(1, 4 * (1 - progress)), 0, Math.PI * 2)
        ctx.fill()
      } else if (effect.kind === 'spark') {
        ctx.strokeStyle = '#fff29b'; ctx.lineWidth = 3
        const distance = progress * snapshot.player.width
        ctx.beginPath(); ctx.moveTo(effect.x + Math.cos(effect.angle) * distance * 0.5, effect.y + Math.sin(effect.angle) * distance * 0.5); ctx.lineTo(effect.x + Math.cos(effect.angle) * distance, effect.y + Math.sin(effect.angle) * distance); ctx.stroke()
      } else if (effect.kind === 'upgradeRing') {
        ctx.strokeStyle = '#fff29b'
        ctx.lineWidth = Math.max(2, snapshot.player.width * 0.045 * (1 - progress * 0.6))
        ctx.beginPath()
        ctx.arc(effect.x, effect.y, snapshot.player.width * (0.42 + progress * 0.9), 0, Math.PI * 2)
        ctx.stroke()
      } else if (effect.kind === 'ring') {
        ctx.strokeStyle = '#d8ffff'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(effect.x, effect.y, 10 + progress * snapshot.player.width * 0.6, 0, Math.PI * 2); ctx.stroke()
      } else if (effect.kind === 'levelText') {
        const lift = Math.sin(Math.min(1, progress) * Math.PI) * snapshot.layout.height * 0.025
        ctx.fillStyle = '#fff29b'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `900 ${Math.max(28, snapshot.layout.height * 0.075)}px sans-serif`
        ctx.fillText(effect.text, snapshot.layout.width * 0.5, snapshot.layout.height * 0.42 - lift)
      } else if (effect.kind === 'suction') {
        const eased = 1 - Math.pow(1 - progress, 2)
        const x = effect.x + (snapshot.player.x - effect.x) * eased
        const y = effect.y + (snapshot.player.y - effect.y) * eased
        const scale = Math.max(0.04, 1 - eased)
        ctx.translate(x, y)
        ctx.scale(scale, scale)
        this.drawFishShape({ x: 0, y: 0, width: effect.width, height: effect.height, direction: effect.direction, visualId: effect.visualId, level: effect.level, player: true }, snapshot, true)
      } else if (effect.kind === 'celebration') {
        const fall = progress * progress
        ctx.fillStyle = effect.color
        ctx.translate(effect.x + effect.dx * progress, effect.y + effect.dy * fall)
        ctx.rotate(effect.angle + effect.spin * progress)
        const size = Math.max(3, snapshot.layout.height * 0.014)
        ctx.fillRect(-size * 0.55, -size * 0.22, size * 1.1, size * 0.44)
      }
      ctx.restore()
    }
  }

  drawHud(snapshot) {
    const { ctx } = this
    const { layout, player, stats } = snapshot
    ctx.fillStyle = 'rgba(2,25,42,.72)'
    ctx.fillRect(0, 0, layout.width, layout.hudHeight)
    ctx.fillStyle = COLORS.ink
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.max(13, layout.height * 0.032)}px sans-serif`
    ctx.textAlign = 'left'
    const scoreX = layout.playable.left + 14
    const scoreY = layout.hudHeight * 0.5
    const scoreScale = this.scorePulse > 0 ? 1 + 0.18 * (this.scorePulse / 0.15) : 1
    ctx.save()
    ctx.translate(scoreX, scoreY)
    ctx.scale(scoreScale, scoreScale)
    ctx.fillText(`分数 ${stats.score}`, 0, 0)
    ctx.restore()
    const centerX = layout.width * 0.5
    const need = upgradeNeed(player.level)
    const barW = Math.min(layout.width * 0.27, 260)
    const barH = Math.max(8, layout.height * 0.021)
    ctx.textAlign = 'center'
    ctx.fillText(`Lv.${player.level}`, centerX - barW * 0.63, layout.hudHeight * 0.5)
    ctx.fillStyle = 'rgba(255,255,255,.16)'
    this.roundedRect(centerX - barW * 0.4, layout.hudHeight * 0.5 - barH / 2, barW, barH, barH / 2); ctx.fill()
    const ratio = player.level >= 10 ? 1 : clamp(player.xp / need, 0, 1)
    ctx.fillStyle = '#64e5e6'
    this.roundedRect(centerX - barW * 0.4, layout.hudHeight * 0.5 - barH / 2, barW * ratio, barH, barH / 2); ctx.fill()
    ctx.fillStyle = COLORS.ink
    ctx.font = `700 ${Math.max(10, layout.height * 0.022)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(player.level >= 10 ? 'MAX' : `${player.xp} / ${need}`, centerX + barW * 0.1, layout.hudHeight * 0.5)
    if (stats.comboCount >= 2 && stats.comboTimer > 0) {
      ctx.fillStyle = '#ffe984'
      ctx.font = `800 ${Math.max(14, layout.height * 0.034)}px sans-serif`
      ctx.fillText(`${stats.comboCount} 连吃  ×${Math.min(2, 1 + (stats.comboCount - 1) * 0.1).toFixed(1)}`, centerX, layout.hudHeight + 22)
    }
    if (snapshot.screenState === 'RUNNING') {
      const rects = uiRects(layout, 'RUNNING')
      this.drawCatalogButton(rects.catalog)
      this.drawIconButton(rects.pause, 'Ⅱ', true)
    }
  }

  drawTutorial(snapshot) {
    if (!snapshot.tutorial.enabled) return
    const { ctx } = this
    const leadVisible = snapshot.tutorial.elapsed <= GAME_CONFIG.timing.tutorialLead
    let text = ''
    if (leadVisible && !snapshot.tutorial.ateGrass) text = '任意位置拖动小鱼 · 先吃水草成长'
    else if (snapshot.player.level >= 2 && !snapshot.tutorial.ateFish) text = '吃体型更小的鱼，避开红色闪边的大鱼'
    if (!text) return
    const width = Math.min(snapshot.layout.width * 0.7, 560)
    const x = (snapshot.layout.width - width) / 2
    const y = snapshot.layout.height * 0.82
    ctx.fillStyle = 'rgba(2,24,40,.8)'
    this.roundedRect(x, y, width, 38, 19); ctx.fill()
    ctx.fillStyle = '#e9ffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.max(13, snapshot.layout.height * 0.03)}px sans-serif`
    ctx.fillText(text, snapshot.layout.width / 2, y + 19)
  }

  drawCatalog(snapshot) {
    const { ctx } = this
    const panel = catalogGeometry(snapshot.layout)
    const headerH = clamp(panel.height * 0.14, 44, 60)
    const padding = clamp(panel.width * 0.016, 8, 16)
    const gapX = clamp(panel.width * 0.012, 6, 12)
    const gapY = clamp(panel.height * 0.018, 6, 12)
    const cardW = Math.max(1, (panel.width - padding * 2 - gapX * 4) / 5)
    const cardH = Math.max(1, (panel.height - headerH - padding * 2 - gapY) / 2)
    const maxScale = playerSizeScale(10)
    ctx.save()
    ctx.fillStyle = 'rgba(1,16,29,.88)'
    ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height)
    ctx.fillStyle = COLORS.panel
    this.roundedRect(panel.x, panel.y, panel.width, panel.height, Math.min(24, panel.height * 0.08))
    ctx.fill()
    ctx.strokeStyle = COLORS.panelLine
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.ink
    ctx.font = `900 ${Math.max(20, Math.min(30, snapshot.layout.height * 0.055))}px sans-serif`
    ctx.fillText('鱼类图鉴', panel.x + panel.width / 2, panel.y + headerH * 0.36)
    ctx.fillStyle = COLORS.muted
    ctx.font = `500 ${Math.max(10, Math.min(14, snapshot.layout.height * 0.026))}px sans-serif`
    ctx.fillText('用外形和体型记住每个等级', panel.x + panel.width / 2, panel.y + headerH * 0.76)
    const gridY = panel.y + headerH + padding
    for (let index = 0; index < FISH_LEVEL_VISUALS.length; index += 1) {
      const level = index + 1
      const column = index % 5
      const row = Math.floor(index / 5)
      const cardX = panel.x + padding + column * (cardW + gapX)
      const cardY = gridY + row * (cardH + gapY)
      ctx.fillStyle = 'rgba(6,45,64,.76)'
      this.roundedRect(cardX, cardY, cardW, cardH, Math.min(12, cardH * 0.14))
      ctx.fill()
      ctx.strokeStyle = level === snapshot.player.level ? '#65e7ea' : 'rgba(157,222,229,.26)'
      ctx.lineWidth = level === snapshot.player.level ? 2.4 : 1
      ctx.stroke()
      const maxFishW = Math.max(1, Math.min(cardW * 0.72, (cardH * 0.5) / GAME_CONFIG.player.bodyAspect))
      const fishWidth = maxFishW * playerSizeScale(level) / maxScale
      this.drawFishShape({
        x: cardX + cardW * 0.5,
        y: cardY + cardH * 0.43,
        width: fishWidth,
        height: fishWidth * GAME_CONFIG.player.bodyAspect,
        direction: 1,
        level,
        visualId: index,
        spawnSeq: index + 1
      }, null)
      ctx.fillStyle = COLORS.ink
      if (cardW >= 100) {
        ctx.font = `800 ${Math.max(10, Math.min(14, cardH * 0.13))}px sans-serif`
        ctx.fillText(`Lv.${level} · ${FISH_LEVEL_VISUALS[index].name}`, cardX + cardW / 2, cardY + cardH * 0.84)
      } else {
        ctx.font = `800 ${Math.max(9, Math.min(12, cardH * 0.12))}px sans-serif`
        ctx.fillText(`Lv.${level}`, cardX + cardW / 2, cardY + cardH * 0.77)
        ctx.fillStyle = COLORS.muted
        ctx.font = `600 ${Math.max(8, Math.min(11, cardH * 0.105))}px sans-serif`
        ctx.fillText(FISH_LEVEL_VISUALS[index].name, cardX + cardW / 2, cardY + cardH * 0.91)
      }
    }
    this.drawIconButton(uiRects(snapshot.layout, 'CATALOG').catalogClose, '×', true)
    ctx.restore()
  }

  drawCatalogButton(rect) {
    if (!rect) return
    const { ctx } = this
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    ctx.save()
    ctx.fillStyle = 'rgba(88,222,224,.24)'
    this.roundedRect(rect.x, rect.y, rect.width, rect.height, 12)
    ctx.fill()
    ctx.strokeStyle = '#89f3ef'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#dfffff'
    ctx.beginPath()
    ctx.moveTo(centerX - 5, centerY - 2)
    ctx.lineTo(centerX - 12, centerY - 7)
    ctx.lineTo(centerX - 11, centerY + 3)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + 2, centerY - 2, 9, 5.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#07384a'
    ctx.beginPath()
    ctx.arc(centerX + 6, centerY - 3, 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#dfffff'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(centerX - 10, centerY + 8)
    ctx.quadraticCurveTo(centerX - 5, centerY + 5, centerX, centerY + 8)
    ctx.quadraticCurveTo(centerX + 5, centerY + 5, centerX + 10, centerY + 8)
    ctx.stroke()
    ctx.restore()
  }

  drawPause(snapshot) {
    const { ctx } = this
    ctx.fillStyle = 'rgba(1,16,29,.72)'; ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height)
    ctx.fillStyle = COLORS.ink; ctx.textAlign = 'center'; ctx.font = `800 ${Math.max(30, snapshot.layout.height * 0.075)}px sans-serif`; ctx.fillText('已暂停', snapshot.layout.width / 2, snapshot.layout.height * 0.31)
    const rects = uiRects(snapshot.layout, 'PAUSED')
    this.drawButton(rects.resume, '继续游戏', true)
    this.drawButton(rects.quit, '退出本局', false)
  }

  drawCinematicLabel(snapshot, text, color) {
    const { ctx } = this
    ctx.fillStyle = 'rgba(1,16,29,.28)'; ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height)
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = `900 ${Math.max(34, snapshot.layout.height * 0.1)}px sans-serif`; ctx.fillText(text, snapshot.layout.width / 2, snapshot.layout.height * 0.44)
  }

  drawResult(snapshot) {
    const { ctx } = this
    const result = snapshot.result || { won: false, score: 0, level: 1, fishEaten: 0, grassEaten: 0, highestCombo: 0, durationMs: 0 }
    const width = Math.min(snapshot.layout.width * 0.72, 620)
    const height = snapshot.layout.height * 0.54
    const x = (snapshot.layout.width - width) / 2
    const y = snapshot.layout.height * 0.08
    ctx.fillStyle = COLORS.panel; this.roundedRect(x, y, width, height, 24); ctx.fill()
    ctx.strokeStyle = COLORS.panelLine; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = result.won ? '#ffe879' : '#ff9fad'
    ctx.font = `900 ${Math.max(28, snapshot.layout.height * 0.075)}px sans-serif`
    ctx.fillText(result.won ? '称霸海域' : `被 Lv.${result.killerLevel || '?'} 鱼吃掉`, snapshot.layout.width / 2, y + height * 0.18)
    ctx.fillStyle = COLORS.ink
    ctx.font = `800 ${Math.max(20, snapshot.layout.height * 0.052)}px sans-serif`
    ctx.fillText(`总分 ${result.score}   ·   Lv.${result.level}`, snapshot.layout.width / 2, y + height * 0.36)
    ctx.fillStyle = COLORS.muted
    ctx.font = `500 ${Math.max(13, snapshot.layout.height * 0.03)}px sans-serif`
    ctx.fillText(`吃鱼 ${result.fishEaten}   水草 ${result.grassEaten}   最高连吃 ${result.highestCombo}`, snapshot.layout.width / 2, y + height * 0.52)
    ctx.fillText(`生存时间 ${this.formatTime(result.durationMs)}`, snapshot.layout.width / 2, y + height * 0.65)
    if (result.saved === false) { ctx.fillStyle = '#ffbc8d'; ctx.fillText('记录未保存（不影响本局结果）', snapshot.layout.width / 2, y + height * 0.79) }
    const rects = uiRects(snapshot.layout, 'RESULT')
    this.drawButton(rects.retry, '再来一局', true)
    this.drawButton(rects.home, '返回首页', false)
    this.drawSettingButtons(snapshot, rects)
  }

  drawSettingButtons(snapshot, rects) {
    this.drawIconButton(rects.sound, snapshot.save.soundEnabled ? '♪' : '×♪', snapshot.save.soundEnabled)
    this.drawIconButton(rects.haptic, snapshot.save.hapticEnabled ? '≈' : '×≈', snapshot.save.hapticEnabled)
  }

  drawButton(rect, label, primary) {
    if (!rect) return
    const { ctx } = this
    ctx.fillStyle = primary ? '#43d4d7' : 'rgba(8,49,70,.88)'
    this.roundedRect(rect.x, rect.y, rect.width, rect.height, rect.height * 0.42); ctx.fill()
    ctx.strokeStyle = primary ? '#bfffff' : 'rgba(169,230,235,.45)'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = primary ? '#032838' : '#dcf9fa'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(15, rect.height * 0.38)}px sans-serif`
    ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2)
  }

  drawIconButton(rect, label, enabled) {
    if (!rect) return
    const { ctx } = this
    ctx.fillStyle = enabled ? 'rgba(88,222,224,.24)' : 'rgba(5,31,48,.5)'
    this.roundedRect(rect.x, rect.y, rect.width, rect.height, 12); ctx.fill()
    ctx.strokeStyle = enabled ? '#89f3ef' : '#799ca3'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = enabled ? '#e8ffff' : '#9db7bb'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(13, rect.height * 0.45)}px sans-serif`
    ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2)
  }

  drawOrientationBlock(snapshot) {
    const { ctx } = this
    ctx.fillStyle = 'rgba(1,17,29,.94)'; ctx.fillRect(0, 0, snapshot.layout.width, snapshot.layout.height)
    ctx.fillStyle = '#e9ffff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.max(22, snapshot.layout.height * 0.06)}px sans-serif`; ctx.fillText('请旋转设备至横屏', snapshot.layout.width / 2, snapshot.layout.height * 0.46)
    ctx.fillStyle = COLORS.muted; ctx.font = `500 ${Math.max(13, snapshot.layout.height * 0.03)}px sans-serif`; ctx.fillText('回到横屏后点击继续', snapshot.layout.width / 2, snapshot.layout.height * 0.55)
  }

  drawDebug(snapshot) {
    const { ctx } = this
    if (snapshot.debug.showCollision && snapshot.screenState !== 'HOME' && snapshot.screenState !== 'RESULT') {
      ctx.save(); ctx.strokeStyle = '#f2ff7a'; ctx.lineWidth = 1
      const player = snapshot.player; ctx.beginPath(); ctx.ellipse(player.x, player.y, player.width * 0.35, player.height * 0.35, 0, 0, Math.PI * 2); ctx.stroke()
      for (const fish of snapshot.fish) if (fish.inUse && fish.active) { const body = fishBody(fish); ctx.beginPath(); ctx.ellipse(body.x, body.y, body.rx, body.ry, 0, 0, Math.PI * 2); ctx.stroke() }
      for (const grass of snapshot.grass) if (grass.inUse && grass.active) { const body = grassBody(grass); ctx.beginPath(); ctx.ellipse(body.x, body.y, body.rx, body.ry, 0, 0, Math.PI * 2); ctx.stroke() }
      ctx.restore()
    }
    const lines = [
      `tick ${snapshot.tick}  seed ${snapshot.seed}`,
      `fish ${snapshot.spawnCounts.active}+${snapshot.spawnCounts.pending}  eat ${snapshot.spawnCounts.edibleActive}  danger ${snapshot.spawnCounts.lethalReserved}`,
      `pool F ${snapshot.spawnCounts.totalReserved}/${GAME_CONFIG.fish.capacity}  dropped ${snapshot.debug.droppedTicks}`,
      snapshot.lastSpawnDecision ? `spawn ${snapshot.lastSpawnDecision.result || '-'}` : 'spawn -'
    ]
    ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(snapshot.layout.width - 260, snapshot.layout.hudHeight + 8, 250, 76)
    ctx.fillStyle = '#baff95'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    lines.forEach((line, index) => ctx.fillText(line, snapshot.layout.width - 252, snapshot.layout.hudHeight + 14 + index * 15))
  }

  roundedRect(x, y, width, height, radius) {
    const { ctx } = this
    const r = Math.max(0, Math.min(radius, width / 2, height / 2))
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r); ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height); ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
  }

  formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }
}

module.exports = { CanvasRenderer, FISH_LEVEL_VISUALS, fishVisualForLevel }
