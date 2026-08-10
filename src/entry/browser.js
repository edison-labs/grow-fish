'use strict'

const { BrowserPlatform } = require('../platform/browser-platform')
const { GameApp } = require('../app/game-app')

const canvas = document.getElementById('game')
if (!canvas) throw new Error('Missing #game canvas')
const platform = new BrowserPlatform(canvas)
const app = new GameApp(platform).start()
if (typeof DEBUG_TOOLS !== 'undefined' && DEBUG_TOOLS) {
  globalThis.growFishApp = app
  globalThis.__growFishDebug = app.harness
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'd') app.harness.toggleDebug()
    if (event.key.toLowerCase() === 'c') app.harness.showCollision(!app.core.debug.showCollision)
  })
}
