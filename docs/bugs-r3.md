# 《大鱼吃小鱼》V0.1 R3 缺陷清单

## 1. 基线与结论

- 日期：2026-08-10（Asia/Dubai）
- 轮次 / 版本：R3 / `0.1.0`
- 首个 Git 基线提交：`e94897f`
- R3 候选标签：`v0.1.0-r3-candidate.1`（由标签解析最终候选提交）
- 配置哈希：`1768c34e`
- 微信 debug SHA-256：`647fcf2156397684f032558ae5666cd81a845801e60db9c4f3de28bd9a526528`
- Web debug SHA-256：`37316e5f5208fd2b2289b16606dbdb7aacc6596ae8ea3bcf61c710a7ea8dc936`
- 微信 release 验证 SHA-256：`2703e705c8acc798dc80e07f95907da9f347196ab92239ef8dc7ab1a55b64d63`
- Web release 验证 SHA-256：`fe6d52b4f1a64a8a9e58b6582db375762517b2fab8cc86f296111fc93f3ec58a`
- R3 新增缺陷：5 个，其中 S1 2 个、S2 3 个；代码级均已修复并由 7 条定点回归覆盖。
- 本地结论：BUG-R3-001～005 的 7/7 定点回归及完整 75/75 Node 测试通过。
- 准出结论：代码级修复可进入外部复验；微信开发者工具、正式 AppID、目标真机、性能/长稳和产品人工验收仍为 **Blocked**，不能据此宣告发布通过。

统一回归入口：

```bash
node --test tests/r3-release-compat.test.js
```

## 2. 缺陷总表

| ID | 严重度 / 优先级 | 问题与影响 | R3 修复 | 自动回归 / 状态 |
| --- | --- | --- | --- | --- |
| BUG-R3-001 | S2 / P0 | `AudioContext.resume()` 返回拒绝 Promise 时，`unlock()` 与暂停恢复路径未可靠消费拒绝，可能产生未处理拒绝；恢复失败后音频状态也可能与真实能力不一致 | 统一通过 `observeOperation()` 观察异步操作；拒绝时关闭 unlocked 状态并清理环境音和短音，所有回调异常静默降级 | 1 条：分别注入 `unlock()`、`resumePaused()` 拒绝并确认均已挂接拒绝处理；Passed |
| BUG-R3-002 | S1 / P0（启动）；S2 / P1（存储降级） | 微信可选 `setPreferredFramesPerSecond()` 抛错时可能阻断启动；存储失败后 `getLogManager()` 或 logger 方法再次抛错时可能逃出原有保存降级路径 | FPS 偏好调用增加异常隔离；平台日志获取及实际日志方法统一在保护边界内执行，保存失败稳定返回 `false` | 2 条：启动 API 故障注入、日志管理器/日志方法故障注入；Passed |
| BUG-R3-003 | S2 / P0 | release 入口若暴露 `growFishApp`，可由应用对象间接到达核心 debug 状态、Renderer 调试方法或测试夹具，违反发布构建隔离要求 | 微信与 Web 入口仅在编译期 `DEBUG_TOOLS=true` 时暴露应用句柄和 `__growFishDebug`；release 不挂载这些全局对象 | 1 条：同一入口分别以 debug/release 条件执行，确认 release 无可达句柄、debug 保留 QA 入口；Passed |
| BUG-R3-004 | S2 / P0 | seed `613` 从 1366×768 resize 到 700×300 后，活动水草可能越界、与玩家过近或互相间距不足 | resize 后按稳定顺序校验活动水草；非法项在确定性网格中选择最近合法位置，保持边界、玩家净空和水草间距约束 | 1 条：固定 seed/视口检查 6 株水草的 bounds、玩家净空、互相间距及 `isGrassPositionLegal()`；Passed |
| BUG-R3-005 | S1 / P0 | 初次获取视口时现代和 legacy API 同时失败，或运行中两者临时同时失败，可能让启动/resize 得到不可用几何 | 平台持有可用的 800×450 横屏默认视口；成功读取后缓存最后有效视口；双 API 失败时返回防引用污染的缓存副本 | 2 条：初始双失败验证有限且支持范围内的横屏默认值；运行时双失败验证复用最后有效视口；Passed |

## 3. 回归追溯

R3 定点门禁位于 `tests/r3-release-compat.test.js`，严格限定 BUG-R3-001～005，共 7 条：

1. BUG-R3-001：音频 `resume()` 拒绝 Promise 被消费。
2. BUG-R3-002：帧率偏好 API 抛错不阻断微信入口启动。
3. BUG-R3-002：日志管理器及日志方法抛错不破坏存储失败降级。
4. BUG-R3-003：release 无调试可达性，debug 保留两项测试句柄。
5. BUG-R3-004：seed `613` resize 后全部活动水草位置合法。
6. BUG-R3-005：首次视口双 API 失败时返回可用横屏默认值。
7. BUG-R3-005：运行期视口双 API 失败时复用最后有效值。

完整 Node 测试由 R2 的 68 条增加至 75 条，本轮实跑结果为 75/75 通过、0 失败、0 跳过。R3 的 7 条是新增定点回归，不替代原 R1 41 条冻结回归、R2 属性回归或完整门禁。

## 4. 外部复验要求

- BUG-R3-001 仍需在 iOS/Android 微信真机覆盖首次交互解锁、前后台切换、系统音频中断与拒绝/恢复体验；代码故障注入不能替代真实 WebAudio 行为。
- BUG-R3-002 与 BUG-R3-005 仍需在目标微信客户端/基础库验证可选 API 缺失、抛错、异常几何和旋转恢复；正式 AppID 与微信开发者工具当前未提供。
- BUG-R3-003 在本地 release 构建和自动检查中关闭；正式发布前仍须从冻结源码重建 release、重跑 release smoke，并以记录哈希识别产物。
- BUG-R3-004 仍需在左右横屏、4:3～21:9、安全区/胶囊和动态 resize 真机矩阵中人工确认画面与可玩性。
- 最低支持设备 FPS/P95、>200 ms 长帧、10 局内存、30 分钟 soak 以及产品视觉/听觉/触控验收均为 **Blocked**。

## 5. 产物说明

当前仓库 `dist` 保留的是 debug 提测产物，包含 sourcemap 和调试入口；上述 release SHA-256 来自隔离 release 验证，不代表当前 `dist`。若进入发布流程，必须重新执行 release 构建与 smoke，记录新产物身份，并避免把 debug 包送审。
