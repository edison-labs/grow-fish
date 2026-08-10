# 《大鱼吃小鱼》V0.1 正式提测单

## 1. 提测信息

| 项目 | 内容 |
| --- | --- |
| 轮次 | R2 |
| 提测日期 | 2026-08-01 |
| 版本 | 0.1.0 |
| 配置哈希 | `1768c34e` |
| 构建 | `npm run build` 生成的 debug 提测版 |
| 微信 debug SHA-256 | `7f502077ad1a5430f876bea3b2556057abe0427a7473e88ffaf34d78e4536223` |
| Web debug SHA-256 | `68d1bcf4a182c74cb7d95fdee5a0bdd3b89d4ad67d916314df27c419b9f466b5` |
| 微信 release 验证 SHA-256 | `c3d46378c67212a26b93a4ede5122e9d7356f92d64dc059879c87ce119450d25` |
| Web release 验证 SHA-256 | `a7313c182c11b5fd7cd0e8a1b7c41bdf79541acc4e186aec47cbcdc9d2e43227` |
| 测试方案 | `docs/test-plan.md`（156 条设计用例） |
| 研发证据 | `docs/development-self-test.md` |
| 数据变更 | 新增本地键 `growFish.save.v1`，schemaVersion=1；无后端/数据库 |
| 账号/网络 | 无账号、无业务网络请求 |

当前工作区尚未形成可引用的 Git 提交哈希。测试以本单 debug bundle SHA-256 和配置哈希识别 R2 候选包，避免与 R1 或临时 release 产物混测。仓库最终保留的是 debug 提测包。

### R2 变更摘要

- 关闭 BUG-R1-001～031：安全出生/生成节流/弹开、性能滑窗、完整轮廓与布局、输入和生命周期、成长/反馈、音频上限与优先级、跨局清理、微信视口异常降级。
- 新增 128 seeds 初始草布局和 160 seeds 生产参数危险出生属性回归。
- 发布构建会主动移除旧 debug sourcemap；新增 `npm run smoke:wechat:release` 验证测试接口不可达。

## 2. 提测范围

- HOME→首次教学→PLAYING→LEVEL_UP 覆盖层→DEAD/WIN→RESULT→重开/返回首页完整闭环。
- 相对拖动、多指所有权、边界滑动、暂停、前后台、横竖屏与动态 resize。
- 水草、同级、可吃、危险碰撞；同 tick 致命优先；成长、连吃、得分和 Lv.10 锁定。
- 目标数量、可吃占比、危险/P+2/同侧入场配额、0.5 秒预警、安全出生、开局保护和失败短重试。
- 本地记录、教学状态、音效/震动开关及能力失败降级。
- 原创程序化美术、音频、调试可观测性、性能与连续运行。

明确不含账号、云存档、排行、广告、支付、复活、商城、皮肤、任务、多人和线上业务埋点。

## 3. 获取与运行

```bash
npm ci
npm run verify
```

微信开发者工具导入仓库根目录；基础库选择 2.25.3。`project.config.json` 当前为 `touristappid`，体验版/真机必须由项目主体替换合法 AppID。浏览器辅助预览使用：

```bash
npm run preview:web
```

发布候选使用 `npm run build:release && npm run smoke:wechat:release`；该产物不含测试接口或 sourcemap。调试版与发布版玩法代码相同，仅编译期剔除测试入口并压缩。执行 release 后会覆盖 `dist`，如需继续测试本单 debug SHA，必须重新执行 `npm run build`。

## 4. 测试接口

调试构建控制台对象：微信 `GameGlobal.__growFishDebug`；浏览器 `globalThis.__growFishDebug`。

| 能力 | 示例 |
| --- | --- |
| 固定局 | `startRun(20260731)` |
| 单步 | `pauseClock()`、`stepTicks(1)`、`stepDt(0.5)` |
| 玩家/统计 | `setPlayer({level:6,xp:0})`、`setStats({score:1000})` |
| 保护/教程 | `setInvincible(0.8)`、`setProtection(2)`、`setTutorial({...})` |
| 实体 | `spawnFish({...})`、`spawnGrass({...})` |
| 同 tick 碰撞 | `injectCollisionSet([...])` |
| 生成观测 | `counts()`、`spawnTrace()` |
| 状态观测 | `snapshot()`、`resultState()`、`eventLog()`、`config()` |
| 稳定性 | `poolStats()`、`performance()`、`freezeAI()` |
| 可视调试 | `toggleDebug()`、`showCollision()` |
| 存档 | `clearStorage()`、`exportStorage()`、`importStorage(data)` |

SpawnDecisionTrace 含 tick、玩家等级、计数、开局/P+2 保护、RNG 前后游标、原始/裁剪权重、位置拒绝原因和最终结果，可直接附在缺陷单中。

## 5. 研发已执行

- `npm run verify`：68/68 通过，0 失败；debug 构建和微信 bundle smoke 通过。
- 独立 QA 冻结回归：41/41 通过，覆盖 BUG-R1-001～031。
- 属性回归：128 seeds 初始草布局、160 seeds 危险出生预测/实际窗口通过。
- 实际微信 debug bundle 冒烟：HOME、开局、首 tick 补鱼、暂停/继续、resize 后暂停通过。
- Canvas 全状态渲染 smoke：通过。
- 100 局无渲染稳定性：通过，实体池不扩容。
- Web debug bundle 与 `index.html` 已生成；最终 R2 的本地 HTTP 监听受当前沙箱限制，需测试环境执行页面级复验。
- release smoke：通过，`debugHarness=false`；无 `.map` 和测试接口符号。

以上仅为研发自测，独立测试尚未在本提测单中宣告通过。

## 6. 已知限制与外部门禁

1. 缺少正式 AppID、体验版权限、微信开发者工具实机结果与目标真机；相关用例状态应为“待环境验证”，不是“通过”。
2. 当前会话无可连接浏览器实例，未附浏览器截图；测试应在开发者工具/真机保留关键路径截图或录屏。
3. 真机兼容、音频/震动、系统中断、最低设备 FPS/P95、内存增长和 30 分钟 soak 尚未执行。
4. 程序化音频在 WebAudio 不可用时静默；需确认目标真机均符合产品可接受的降级体验。
5. 正式上线仍依赖名称、图标、主体权限、隐私/审核材料与微信审核，不属于代码自测结论。

## 7. 建议测试顺序

1. 校验候选文件哈希、配置哈希及 `npm run verify`。
2. 执行 `SMK-001`～`SMK-005`，分别完成死亡局与调试通关局。
3. 执行 P0/P1 功能、随机公平性、生命周期、存储异常和适配用例。
4. 完成基础库/客户端/系统/设备矩阵以及左右横屏、安全区、音频震动。
5. 在最低支持真机执行 D25 性能、10 局和 30 分钟稳定性。
6. 缺陷定点验证与影响域回归后输出独立测试报告，决定是否建议产品验收。

## 8. 缺陷回传字段

每个缺陷至少包含：候选 build/文件哈希、设备与系统、微信版本、基础库、seed、逻辑 tick/有效时间、复现步骤、期望/实际、严重度、截图/录屏、`spawnTrace()`、相关 `eventLog()` 和必要的 `snapshot()`。涉及 resize 时同时附前后视口/safeArea/胶囊数据。
