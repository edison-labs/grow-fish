'use strict'

// Bounded R3 release/compatibility gate for the five must-fix findings raised
// after the R2 freeze. Keep this file focused on BUG-R3-001..005.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { AudioManager } = require('../src/audio/audio-manager')
const { GameCore } = require('../src/core/game-core')
const { FakePlatform } = require('../src/platform/fake-platform')
const { WechatPlatform } = require('../src/platform/wechat-platform')

const entrySource = fs.readFileSync(path.resolve(__dirname, '../src/entry/wechat.js'), 'utf8')

function rejectionProbe(message) {
  const error = new Error(message)
  const probe = { observed: false }
  const thenable = {
    then(_fulfilled, rejected) {
      if (typeof rejected === 'function') {
        probe.observed = true
        rejected(error)
      }
      return thenable
    },
    catch(rejected) {
      probe.observed = true
      rejected(error)
      return thenable
    }
  }
  return { probe, thenable }
}

function runWechatEntry({ debugTools, setPreferredFramesPerSecond = () => {} }) {
  const app = {
    harness: { freezeAI() {}, drawDebug() {} },
    core: { debug: { freezeAI: false } },
    renderer: { drawDebug() {} }
  }
  let started = false
  class EntryPlatform {
    constructor(wxApi) { this.wx = wxApi }
  }
  class EntryApp {
    constructor(platform) { this.platform = platform }
    start() { started = true; return app }
  }
  const sandbox = {
    DEBUG_TOOLS: debugTools,
    GameGlobal: {},
    wx: { setPreferredFramesPerSecond },
    console,
    module: { exports: {} },
    exports: {},
    require(request) {
      if (request === '../platform/wechat-platform') return { WechatPlatform: EntryPlatform }
      if (request === '../app/game-app') return { GameApp: EntryApp }
      throw new Error(`unexpected entry dependency: ${request}`)
    }
  }
  vm.createContext(sandbox)
  vm.runInContext(entrySource, sandbox, { filename: 'src/entry/wechat.js' })
  return { app, root: sandbox.GameGlobal, started }
}

test('BUG-R3-001 S2/P0: rejected AudioContext resume promises are consumed silently', async () => {
  const probes = []
  const context = {
    resume() {
      const item = rejectionProbe(`resume rejected ${probes.length + 1}`)
      probes.push(item.probe)
      return item.thenable
    }
  }
  const audio = new AudioManager({ createAudioContext: () => context }, { soundEnabled: true, hapticEnabled: true })
  await audio.unlock()
  await audio.resumePaused()
  assert.equal(probes.length, 2)
  assert.equal(probes.every((probe) => probe.observed), true, 'unlock and resumePaused must attach rejection handling')
})

test('BUG-R3-002 S1/P0: setPreferredFramesPerSecond throwing cannot block bootstrap', () => {
  let result
  assert.doesNotThrow(() => {
    result = runWechatEntry({
      debugTools: true,
      setPreferredFramesPerSecond() { throw new Error('optional FPS API failed') }
    })
  })
  assert.equal(result.started, true)
})

test('BUG-R3-002 S2/P1: getLogManager and logger failures cannot escape the save fallback', () => {
  const storageFailure = () => { throw new Error('storage unavailable') }
  const managerFailure = new WechatPlatform({
    setStorageSync: storageFailure,
    getLogManager() { throw new Error('log manager unavailable') }
  })
  assert.doesNotThrow(() => assert.equal(managerFailure.save('key', { value: 1 }), false))

  const methodFailure = new WechatPlatform({
    setStorageSync: storageFailure,
    getLogManager() { return { warn() { throw new Error('logger method unavailable') } } }
  })
  assert.doesNotThrow(() => assert.equal(methodFailure.save('key', { value: 1 }), false))
})

test('BUG-R3-003 S2/P0: release entry exposes no debug reachability while debug entry keeps both handles', () => {
  const release = runWechatEntry({ debugTools: false })
  assert.equal(release.started, true)
  assert.equal(release.root.growFishApp, undefined, 'release must not expose the application object')
  assert.equal(release.root.__growFishDebug, undefined)
  assert.equal(release.root.growFishApp?.core?.debug?.freezeAI, undefined)
  assert.equal(release.root.growFishApp?.renderer?.drawDebug, undefined)
  assert.equal(release.root.TestHarness, undefined)

  const debug = runWechatEntry({ debugTools: true })
  assert.equal(debug.root.growFishApp, debug.app, 'debug build must retain the app handle used by smoke tests')
  assert.equal(debug.root.__growFishDebug, debug.app.harness, 'debug build must retain the QA harness')
})

test('BUG-R3-004 S2/P0: seed 613 resize keeps every active grass placement legal', () => {
  const initialViewport = {
    width: 1366,
    height: 768,
    dpr: 1,
    safeArea: { left: 24, top: 20, right: 1342, bottom: 752 },
    menuButton: null
  }
  const targetViewport = {
    width: 700,
    height: 300,
    dpr: 1,
    safeArea: { left: 44, top: 16, right: 656, bottom: 300 },
    menuButton: null
  }
  const core = new GameCore(new FakePlatform({ viewport: initialViewport }), { seed: 613 })
  core.startRun(613)
  core.drainEvents()
  core.resize(targetViewport)

  const grass = core.grassPool.items.filter((item) => item.inUse && item.active)
  assert.equal(grass.length, 6)
  const violations = []
  for (const item of grass) {
    const bounds = core.grassPlacementBounds(item)
    if (item.x < bounds.xMin || item.x > bounds.xMax || item.y < bounds.yMin || item.y > bounds.yMax) violations.push(`grass ${item.spawnSeq}: bounds`)
    if (Math.hypot(item.x - core.player.x, item.y - core.player.y) < core.player.width - 1e-9) violations.push(`grass ${item.spawnSeq}: player overlap`)
    if (!core.isGrassPositionLegal(item, false)) violations.push(`grass ${item.spawnSeq}: isGrassPositionLegal=false`)
  }
  for (let left = 0; left < grass.length; left += 1) {
    for (let right = left + 1; right < grass.length; right += 1) {
      const distance = Math.hypot(grass[left].x - grass[right].x, grass[left].y - grass[right].y)
      const minimum = Math.max(grass[left].width, grass[right].width) * 1.5
      if (distance + 1e-9 < minimum) violations.push(`grass ${grass[left].spawnSeq}/${grass[right].spawnSeq}: ${distance} < ${minimum}`)
    }
  }
  assert.deepEqual(violations, [])
})

test('BUG-R3-005 S1/P0: initial viewport API failure returns a usable landscape default', () => {
  const platform = new WechatPlatform({
    getWindowInfo() { throw new Error('modern unavailable') },
    getSystemInfoSync() { throw new Error('legacy unavailable') }
  })
  const viewport = platform.getViewport()
  assert.equal(Number.isFinite(viewport.width) && viewport.width >= 320, true)
  assert.equal(Number.isFinite(viewport.height) && viewport.height >= 180, true)
  assert.equal(viewport.width > viewport.height, true)
  assert.equal(viewport.width / viewport.height >= 4 / 3 && viewport.width / viewport.height <= 21 / 9, true)
  assert.equal(Number.isFinite(viewport.dpr) && viewport.dpr > 0, true)
})

test('BUG-R3-005 S1/P0: runtime viewport API failure reuses the last valid viewport', () => {
  let fail = false
  const valid = {
    windowWidth: 844,
    windowHeight: 390,
    pixelRatio: 3,
    safeArea: { left: 44, top: 16, right: 810, bottom: 390 }
  }
  const platform = new WechatPlatform({
    getWindowInfo() { if (fail) throw new Error('modern unavailable'); return valid },
    getSystemInfoSync() { if (fail) throw new Error('legacy unavailable'); return valid },
    getMenuButtonBoundingClientRect() { return { left: 704, top: 10, width: 88, height: 32 } }
  })
  const first = platform.getViewport()
  fail = true
  const recovered = platform.getViewport()
  assert.deepEqual(recovered, first)
})
