# 《大鱼吃小鱼》V0.1 研发自测报告

## 1. 结论

R2 已完成 BUG-R1-001～031 修复、影响域回归、属性回归和 debug/release 双构建验证。研发侧未发现开放的本地 S0/S1/P0/P1 问题，达到 R2 正式提测条件；本结论不替代微信开发者工具、真机矩阵或产品最终准出。

## 2. 自测基线

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-08-01（Asia/Dubai） |
| 轮次 | R2 |
| 版本 | 0.1.0 |
| 提交 | 当前仓库尚无可引用提交哈希，提测前由主代理落库后补充 |
| 配置哈希 | `1768c34e` |
| Node | 22.23.0 |
| esbuild | 0.25.0 |
| 微信基础库目标 | 2.25.3+ |
| 目标系统 | iOS 13+ / Android 8.0+ |
| 仓库最终产物 | debug 提测版，暴露 `__growFishDebug` |
| 微信 debug SHA-256 | `7f502077ad1a5430f876bea3b2556057abe0427a7473e88ffaf34d78e4536223` |
| Web debug SHA-256 | `68d1bcf4a182c74cb7d95fdee5a0bdd3b89d4ad67d916314df27c419b9f466b5` |
| 微信 release 验证 SHA-256 | `c3d46378c67212a26b93a4ede5122e9d7356f92d64dc059879c87ce119450d25` |
| Web release 验证 SHA-256 | `a7313c182c11b5fd7cd0e8a1b7c41bdf79541acc4e186aec47cbcdc9d2e43227` |

## 3. 执行结果

| 门禁 | 命令/方式 | 结果 |
| --- | --- | --- |
| 完整研发门禁 | `npm run verify` | 68/68 通过，0 失败；debug 双端构建及微信 bundle smoke 通过 |
| 独立 QA 冻结回归 | `node --test tests/qa-r1-regression.test.js` | 41/41 通过，覆盖 BUG-R1-001～031 |
| 100+ seed 属性回归 | `tests/r2-property.test.js` | 128 seeds 初始草布局、160 seeds 生产参数危险出生预测/0.8 秒窗口全部通过 |
| 微信/浏览器构建 | `npm run build` | 通过 |
| 微信 bundle 冒烟 | `npm run smoke:wechat` | 通过：HOME→RUNNING、首 tick、PAUSED→RUNNING、resize 后 PAUSED |
| Canvas 渲染 smoke | Node mock Canvas | HOME、RUNNING、PAUSED、DEAD、WIN、RESULT、调试覆盖层均无异常；save/restore 成对 |
| 100 局稳定性 | 无渲染确定性循环 | 通过；鱼池 24、草池 10 固定，不扩容，事件日志受 2048 上限约束 |
| 发布构建隔离 | `npm run build:release` + `npm run smoke:wechat:release` | 通过；`debugHarness=false`，无 `.map`，`__growFishDebug`、`TestHarness`、`test-harness`、`spawnTrace`、`toggleDebug` 均不存在 |
| 网络边界扫描 | 源码 API 扫描 | 通过；玩法运行时代码无 fetch/XHR/WebSocket/业务网络地址 |

自动化覆盖重点：

- 数值公式、关系、椭圆碰撞边界和 RNG 子流隔离。
- 固定 seed 世界复现、同 tick 致命优先、死亡/通关单次结算。
- 升级最多一级、0.3 秒覆盖层后下一 tick 连续升级、0.8 秒无敌分离锁。
- Lv.2 草丛安全收缩、开局 5 秒绝对 Lv.1/Lv.2、首 tick 补鱼、0.2 秒失败短重试。
- 初始 6 草/4 鱼几何约束、危险上下左右逃生净空、预警/入场鱼 resize 后保持场外。
- 前后台暂停、存储脏数据/写失败/不重复覆盖、safeArea/胶囊布局、多指捕获。
- Renderer 首帧和全状态运行错误防回归、特效上限回收、暂停冻结、跨局清理、100 局对象池稳定。
- 升级文字/环/体型过渡、分数反馈、鱼吸入、连吃拖尾、死亡慢动作、通关庆祝、玩家游动态和三种水草形态。
- 60 秒玩法性能滑窗、nearest-rank P95、HOME/PAUSED/后台排除及长帧随窗口淘汰。
- 短音 6 voice 上限、死亡/通关优先抢占、重复 `onended` 幂等及跨局 voice 清理。
- 微信现代视口 API 抛错/畸形时回退 legacy，非有限宽高/DPR/safeArea/menu rect 净化。

## 4. 已修复的研发自测问题

| ID | 问题 | 修复与回归 |
| --- | --- | --- |
| DEV-001 | RUNNING 首帧 `drawPlayer` 未绑定 `ctx`，会触发 ReferenceError | 已修复；Renderer HOME+RUNNING 全状态 smoke 覆盖 |
| DEV-002 | Lv.2 后初始 6 草可能超过 4 株上限 | 升级时优先安全回收非活跃/远处草，池中只保留 4 株；自动化覆盖 |
| DEV-003 | resize 可能把 pending/entering 鱼夹进可视区 | 按出生侧重新放回完整屏外；自动化覆盖 |
| DEV-004 | 安全逃生只检查左右净空 | 已补上、下净空；自动化覆盖 |
| DEV-005 | 生成失败重试可能叠加正常刷新间隔 | 使用独立 0.2 秒重试钟；池耗尽/位置失败均覆盖 |
| DEV-006 | 0.3 秒计时存在 `4.857e-17` 浮点尾差 | 所有关键倒计时以 `1e-9` epsilon 精确归零；严格断言通过 |
| DEV-007 | 发布 bundle 仍可能包含测试入口 | 调整编译期条件分支；发布 bundle 的 TestHarness、全局测试对象与测试接口符号移除 |

## 5. R1 缺陷修复摘要

| 缺陷范围 | R2 修复与回归 |
| --- | --- |
| BUG-R1-001～003 | 危险鱼垂直漂移纳入 0.8 秒预测；每 tick 仅一次生成生命周期迁移；同级弹开保留玩家冲量 |
| BUG-R1-004～008 | 玩法性能滑窗纠正；完整鱼轮廓 resize/进出场；原始毫秒结算；草 5% 边距与 21:9 初始 6 草兜底 |
| BUG-R1-009～015 | 夹具 pending 语义、非有限/重复触控、防后台音频误恢复、safeArea/HUD 净化、3 秒连吃边界修复 |
| BUG-R1-016～025 | XP 数字、分数脉冲、升级文字/环、吸入、庆祝、慢动作、连吃拖尾、0.6 秒飘字及旧尺寸起步的升级过渡 |
| BUG-R1-026～031 | 6 voice/高优先抢占、游动与草形态、暂停视觉冻结、跨局视觉/音频清理、微信视口异常回退与畸形几何净化 |

## 6. 未由研发环境证明的项目

- 当前会话没有可连接浏览器实例，且最终 R2 本地 HTTP 监听受沙箱 `EPERM` 限制，未生成实际页面截图；双端构建、微信实际 bundle 冒烟和全状态 Canvas mock 已通过，但不替代浏览器/真机人工画面验收。
- 本机未提供微信开发者工具、合法 AppID、体验版权限或真机，故尚未执行基础库 2.25.3 工具导入、iOS/Android/平板/折叠屏矩阵、左右横屏、安全区、触控、系统静音、音频中断和震动实测。
- D25 的 60 秒 FPS/P95、>200 ms 长帧、10 局真机内存及 30 分钟 soak 需要测试团队在最低支持真机采集。
- 当前音频为原创 WebAudio 程序化合成；不支持该能力的环境按产品决策静默降级，仍需真机确认体验。

## 7. 研发提测判断

R2 debug 候选已冻结，可进入独立测试复验及产品验收。当前仓库保留 debug 提测产物；release 哈希仅记录本轮隔离验证，若用于发布须重新执行 `npm run build:release`、release smoke 和真机全回归。外部微信工具/真机门禁继续按测试报告标记为 Blocked，不能据本报告宣称已上线。
