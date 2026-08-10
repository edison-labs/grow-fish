import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const release = process.argv.includes('--release')
const bundleUrl = new URL('../dist/wechat/game.js', import.meta.url)
const source = await readFile(bundleUrl, 'utf8')
const callbacks = { touchstart: [], touchmove: [], touchend: [], touchcancel: [], hide: [], show: [], resize: [] }
const drawnText = []
const gradient = { addColorStop() {} }
const context2d = new Proxy({
  createLinearGradient: () => gradient,
  fillText: (value) => drawnText.push(String(value))
}, {
  get(target, property) { return property in target ? target[property] : () => {} },
  set(target, property, value) { target[property] = value; return true }
})
let nextFrame = null
let frameId = 0
const canvas = {
  width: 0,
  height: 0,
  getContext: () => context2d,
  requestAnimationFrame(callback) { nextFrame = callback; frameId += 1; return frameId },
  cancelAnimationFrame() {}
}
const storage = new Map()
let viewport = { windowWidth: 800, windowHeight: 450, pixelRatio: 1, safeArea: null }
const on = (name) => (listener) => callbacks[name].push(listener)
const off = (name) => (listener) => { callbacks[name] = callbacks[name].filter((candidate) => candidate !== listener) }
const wx = {
  createCanvas: () => canvas,
  getWindowInfo: () => viewport,
  getMenuButtonBoundingClientRect: () => null,
  setPreferredFramesPerSecond() {},
  onTouchStart: on('touchstart'), offTouchStart: off('touchstart'),
  onTouchMove: on('touchmove'), offTouchMove: off('touchmove'),
  onTouchEnd: on('touchend'), offTouchEnd: off('touchend'),
  onTouchCancel: on('touchcancel'), offTouchCancel: off('touchcancel'),
  onHide: on('hide'), offHide: off('hide'),
  onShow: on('show'), offShow: off('show'),
  onWindowResize: on('resize'), offWindowResize: off('resize'),
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, JSON.parse(JSON.stringify(value))),
  createWebAudioContext: () => null,
  vibrateShort() {},
  getLogManager: () => ({ log() {}, warn() {}, error() {}, info() {} })
}
const GameGlobal = {}
const sandbox = { wx, GameGlobal, console, Date, Math, Map, Set, JSON, performance: { now: () => 0 }, setTimeout: () => 1, clearTimeout() {} }
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'dist/wechat/game.js', timeout: 3000 })

const app = GameGlobal.growFishApp
assert.equal(canvas.width, 800)
assert.equal(canvas.height, 450)
assert.equal(drawnText.includes('大鱼吃小鱼'), true, '首页必须完成首帧绘制')

const touch = (name, id, x, y) => callbacks[name].forEach((listener) => listener({ changedTouches: [{ identifier: id, clientX: x, clientY: y }], timeStamp: 0 }))
const driveFrame = (time) => {
  const callback = nextFrame
  assert.equal(typeof callback, 'function', '应用必须持续请求动画帧')
  nextFrame = null
  callback(time)
}

if (release) {
  assert.equal(app, undefined, 'release 不得暴露 growFishApp')
  assert.equal(GameGlobal.__growFishDebug, undefined, 'release 不得暴露测试接口')

  drawnText.length = 0
  touch('touchstart', 1, 400, 280)
  touch('touchend', 1, 400, 280)
  driveFrame(0)
  driveFrame(1000 / 60)
  assert.equal(drawnText.some((value) => value.startsWith('分数 ')), true, '开局后必须绘制 HUD')

  drawnText.length = 0
  touch('touchstart', 2, 760, 22)
  touch('touchend', 2, 760, 22)
  driveFrame(2000 / 60)
  assert.equal(drawnText.includes('已暂停'), true, '暂停入口必须可用')

  drawnText.length = 0
  touch('touchstart', 3, 400, 220)
  touch('touchend', 3, 400, 220)
  driveFrame(3000 / 60)
  assert.equal(drawnText.some((value) => value.startsWith('分数 ')), true, '继续入口必须恢复 HUD')

  drawnText.length = 0
  viewport = { ...viewport, windowWidth: 900, windowHeight: 450 }
  callbacks.resize.forEach((listener) => listener({ windowWidth: 900, windowHeight: 450 }))
  driveFrame(4000 / 60)
  assert.equal(canvas.width, 900)
  assert.equal(canvas.height, 450)
  assert.equal(drawnText.includes('已暂停'), true, 'resize 后必须安全暂停')
} else {
  assert.ok(app, '调试入口必须暴露 growFishApp')
  assert.equal(app.core.screenState, 'HOME')
  touch('touchstart', 1, 400, 280)
  touch('touchend', 1, 400, 280)
  assert.equal(app.core.screenState, 'RUNNING')
  app.stepCore(1 / 60)
  app.renderer.render(app.core.snapshot())
  assert.equal(app.core.tick, 1)
  assert.equal(app.core.spawnManager.counts().totalReserved, 5)

  touch('touchstart', 2, 760, 22)
  touch('touchend', 2, 760, 22)
  assert.equal(app.core.screenState, 'PAUSED')
  touch('touchstart', 3, 400, 220)
  touch('touchend', 3, 400, 220)
  assert.equal(app.core.screenState, 'RUNNING')

  viewport = { ...viewport, windowWidth: 900, windowHeight: 450 }
  callbacks.resize.forEach((listener) => listener({ windowWidth: 900, windowHeight: 450 }))
  assert.equal(app.core.screenState, 'PAUSED')
  assert.equal(app.core.layout.width, 900)
  assert.equal(typeof GameGlobal.__growFishDebug?.config, 'function')
  app.stop()
}

console.log(JSON.stringify({ mode: release ? 'release-public' : 'debug', canvas: [canvas.width, canvas.height], debugHarness: !release }))
