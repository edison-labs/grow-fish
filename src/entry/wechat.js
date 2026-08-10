'use strict'

const { WechatPlatform } = require('../platform/wechat-platform')
const { GameApp } = require('../app/game-app')

if (typeof wx === 'undefined') throw new Error('微信小游戏 wx API 不可用')
try { wx.setPreferredFramesPerSecond?.(60) } catch {}
const platform = new WechatPlatform(wx)
const app = new GameApp(platform).start()
const root = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis
if (typeof DEBUG_TOOLS !== 'undefined' && DEBUG_TOOLS) {
  root.growFishApp = app
  root.__growFishDebug = app.harness
}
