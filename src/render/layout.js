'use strict'

const { GAME_CONFIG } = require('../config/game-config')
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function finiteOr(value, fallback) { return Number.isFinite(value) ? value : fallback }
function positiveFiniteOr(value, fallback) { return Number.isFinite(value) && value > 0 ? value : fallback }

function computeLayout(viewport = {}) {
  const width = Math.max(1, positiveFiniteOr(viewport.width, 1))
  const height = Math.max(1, positiveFiniteOr(viewport.height, 1))
  const safe = viewport.safeArea && typeof viewport.safeArea === 'object' ? viewport.safeArea : {}
  let safeLeft = clamp(finiteOr(safe.left, 0), 0, width)
  let safeRight = clamp(finiteOr(safe.right, width), 0, width)
  let safeTop = clamp(finiteOr(safe.top, 0), 0, height)
  let safeBottom = clamp(finiteOr(safe.bottom, height), 0, height)
  if (safeRight - safeLeft < 1) { safeLeft = 0; safeRight = width }
  if (safeBottom - safeTop < 1) { safeTop = 0; safeBottom = height }
  const hudHeight = Math.max(height * GAME_CONFIG.layout.hudHeightRatio, safeTop)
  const rawMenu = viewport.menuButton && typeof viewport.menuButton === 'object' ? viewport.menuButton : null
  const menu = rawMenu ? {
    ...rawMenu,
    left: clamp(finiteOr(rawMenu.left, safeRight), 0, width),
    top: clamp(finiteOr(rawMenu.top, safeTop), 0, height),
    width: Math.max(0, finiteOr(rawMenu.width, 0)),
    height: Math.max(0, finiteOr(rawMenu.height, 0))
  } : null
  return {
    width,
    height,
    dpr: Math.min(positiveFiniteOr(viewport.dpr, 1), GAME_CONFIG.layout.maxDpr),
    isLandscape: width >= height,
    hudHeight,
    safeTop,
    playable: { left: safeLeft, top: Math.min(hudHeight, safeBottom - 1), right: safeRight, bottom: safeBottom },
    menuButton: menu
  }
}

function catalogGeometry(layout) {
  const outer = clamp(Math.min(layout.width, layout.height) * 0.025, 8, 18)
  const safeLeft = layout.playable.left
  const safeRight = layout.playable.right
  const safeTop = Math.max(0, layout.safeTop || 0)
  const safeBottom = layout.playable.bottom
  const safeWidth = Math.max(1, safeRight - safeLeft)
  const safeHeight = Math.max(1, safeBottom - safeTop)
  const width = Math.max(1, Math.min(1000, safeWidth - outer * 2))
  const height = Math.max(1, Math.min(520, safeHeight - outer * 2))
  const x = safeLeft + (safeWidth - width) / 2
  const y = safeTop + (safeHeight - height) / 2
  const closeSize = Math.min(44, Math.max(1, height - 16))
  const preferredCloseX = x + width - closeSize - 8
  const capsuleCloseX = layout.menuButton ? layout.menuButton.left - closeSize - 8 : preferredCloseX
  const close = {
    x: Math.max(x + 8, Math.min(preferredCloseX, capsuleCloseX)),
    y: y + 8,
    width: closeSize,
    height: closeSize
  }
  return { x, y, width, height, outer, close }
}

function uiRects(layout, screenState) {
  const w = layout.width
  const h = layout.height
  const safeLeft = layout.playable.left
  const safeRight = layout.playable.right
  const buttonW = Math.min(240, w * 0.34)
  const buttonH = Math.max(44, h * 0.12)
  const center = (y) => ({ x: (w - buttonW) / 2, y, width: buttonW, height: buttonH })
  const top = Math.max(8, layout.safeTop || 0)
  const settings = {
    sound: { x: safeLeft + 12, y: top, width: 46, height: 38 },
    haptic: { x: safeLeft + 66, y: top, width: 46, height: 38 }
  }
  const menuLeft = layout.menuButton ? layout.menuButton.left : safeRight
  const pauseX = Math.max(safeLeft + 120, Math.min(safeRight - 54, menuLeft - 58))
  const catalogX = Math.max(safeLeft + 12, pauseX - 54)
  if (screenState === 'HOME') return { ...settings, start: center(h * 0.58) }
  if (screenState === 'RUNNING') return {
    catalog: { x: catalogX, y: top, width: 46, height: 38 },
    pause: { x: pauseX, y: top, width: 46, height: 38 }
  }
  if (screenState === 'PAUSED') return { resume: center(h * 0.44), quit: center(h * 0.61) }
  if (screenState === 'CATALOG') return { catalogClose: catalogGeometry(layout).close }
  if (screenState === 'RESULT') return { ...settings, retry: center(h * 0.62), home: center(h * 0.78) }
  return {}
}

function pointInRect(x, y, rect) {
  return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

function hitUi(layout, state, x, y) {
  const rects = uiRects(layout, state)
  for (const [name, rect] of Object.entries(rects)) if (pointInRect(x, y, rect)) return name
  return null
}

module.exports = { computeLayout, catalogGeometry, uiRects, pointInRect, hitUi }
