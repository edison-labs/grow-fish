# 大鱼吃小鱼 · 微信小游戏 V0.1

原生 Canvas 2D 微信小游戏实现。玩家从 Lv.1 吃水草起步，随后吞食低等级鱼、躲避高等级鱼，死亡或升至 Lv.10 后进入结算，可立即重开。项目同时提供浏览器同核预览；两端共用状态机、生成、碰撞、数值和渲染代码，仅平台适配层不同。

## 当前进度

- 当前为 **V0.1 R3 本地代码候选**，候选标签为 `v0.1.0-r3-candidate.1`，不是正式发布版本。
- 本地自动化 75/75 通过；Debug/Release 双构建及对应微信 bundle smoke 均通过。
- 正式 AppID、微信开发者工具、真机兼容与性能、30 分钟 soak、人工产品验收仍待外部环境完成。
- 候选证据见 [R3 测试执行记录](docs/test-execution-r3.md)、[R3 缺陷清单](docs/bugs-r3.md)和[正式提测单](docs/test-submission.md)。

## 运行基线

- 微信小游戏基础库：2.25.3+
- 微信客户端：8.0.40+
- iOS：13+
- Android：8.0+
- 逻辑帧：固定 60 Hz；目标渲染 60 FPS
- Node.js：22.23.0+

## 安装、验证与构建

```bash
npm ci
npm run verify
```

- `npm test`：公式、状态机、碰撞优先级、生成、公平性、存储、输入、渲染和 100 局稳定性回归。
- `npm run test:r3`：单独执行 BUG-R3-001～005 的 7 条定点回归。
- `npm run build`：生成带测试接口的 `dist/wechat/game.js` 和 `dist/web/app.js`。
- `npm run smoke:wechat`：在最小微信 API 模拟环境中加载实际 bundle，验证首页、开局首帧、暂停、继续和 resize。
- `npm run verify`：执行全部测试、Debug 构建与 smoke、Release 构建与 smoke，并在结束时恢复 Debug `dist`；这是 R3 本地完整门禁。
- `npm run build:release`：生成压缩发布候选，移除 `__growFishDebug` 和 TestHarness。
- `npm run smoke:wechat:release`：加载 release 微信 bundle 并断言完整闭环可运行且测试接口不存在。
- `npm run preview:web`：在 `http://127.0.0.1:4173` 启动浏览器预览。

## 微信开发者工具

1. 先执行 `npm ci && npm run build`。
2. 在微信开发者工具中导入本仓库根目录，项目类型选择“小游戏”。
3. `project.config.json` 默认使用 `touristappid`；体验版或真机调试前必须替换为项目主体提供的合法 AppID。
4. 默认构建为提测调试版；发布前执行 `npm run build:release` 并重新完成冒烟与真机回归。

## 操作

- 首页点击“开始游戏”。
- 在非 UI 区域任意位置按住并相对拖动；第一根有效触点拥有移动控制权。
- 绿色 `✓` 为可吃，黄色 `=` 为同级，红色 `!` 为危险。
- 右上角暂停；首页和结算页可独立切换音效、震动。
- 竖屏只显示旋转提示；回到横屏后需主动继续。

## 调试与缺陷复现

调试构建在 `GameGlobal.__growFishDebug`（浏览器为 `globalThis.__growFishDebug`）暴露测试接口。例如：

```js
__growFishDebug.startRun(20260731)
__growFishDebug.pauseClock()
__growFishDebug.stepTicks(60)
__growFishDebug.setPlayer({ level: 6, xp: 0 })
__growFishDebug.setStats({ score: 1000, comboCount: 4 })
__growFishDebug.spawnFish({ level: 8, side: 'left', pending: true })
__growFishDebug.counts()
__growFishDebug.spawnTrace()
__growFishDebug.poolStats()
__growFishDebug.toggleDebug(true)
```

测试接口还支持固定/重置 seed、设置无敌和 P+2 保护、生成草、注入同 tick 碰撞集合、冻结 AI、单步、查看配置哈希/事件日志/结果锁、清档及导入导出存档。发布构建不暴露该对象。

## 架构

- `src/core`：固定步长状态机、实体、随机流、成长与计时。
- `src/spawn`：目标数量、权重、配额、预警、短重试和安全出生。
- `src/collision`：椭圆碰撞及“致命优先”的稳定排序。
- `src/render`：程序化海洋、5 种鱼形态、草、HUD、教程、预警与结果页。
- `src/platform`：微信、浏览器和测试假平台端口。
- `src/debug`：固定 seed 与可观测测试夹具。
- `tests`：Node 自动化回归；`docs`：评审、技术方案、测试方案与提测材料。

## 数据、网络与资源

- 只使用本地存储键 `growFish.save.v1`；无账号、后端、广告、支付或网络业务埋点。
- 美术、动画和音频均由仓库内代码原创程序化生成；没有抓取或嵌入第三方素材。完整来源说明见 [assets/README.md](assets/README.md)。
- 音频或震动能力不可用时静默降级，玩法与视觉反馈继续。

## 交付边界

源码、自动化、微信 bundle 和浏览器同核预览已具备。正式 AppID、微信体验版权限、开发者工具导入、iOS/Android 真机兼容与性能、30 分钟 soak、人工产品验收及发布审核属于外部门禁，必须由测试与项目主体完成后才能宣称发布可用。
