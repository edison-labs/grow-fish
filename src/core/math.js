'use strict'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const lerp = (from, to, alpha) => from + (to - from) * alpha
const length = (x, y) => Math.sqrt(x * x + y * y)

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const magnitude = length(x, y)
  return magnitude > 1e-9 ? { x: x / magnitude, y: y / magnitude } : { x: fallbackX, y: fallbackY }
}

function ellipsesOverlap(a, b) {
  const rx = a.rx + b.rx
  const ry = a.ry + b.ry
  if (rx <= 0 || ry <= 0) return false
  const dx = a.x - b.x
  const dy = a.y - b.y
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
}

function relationFor(playerLevel, fishLevel) {
  if (fishLevel < playerLevel) return 'EDIBLE'
  if (fishLevel === playerLevel) return 'EQUAL'
  return 'LETHAL'
}

module.exports = { clamp, lerp, length, normalize, ellipsesOverlap, relationFor }

