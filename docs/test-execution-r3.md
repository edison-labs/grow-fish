# 《大鱼吃小鱼》V0.1 测试执行记录 R3

## 1. 测试结论

R3 本地代码门禁通过：完整 Node 测试 75/75 通过，其中 BUG-R3-001～005 新增的定点回归 7/7 通过；debug 双端构建、微信 bundle smoke 及隔离 release 构建/smoke 已有通过记录。

本记录不构成最终产品准出。当前没有正式 AppID、微信开发者工具目标环境、目标真机和产品人工验收证据，因此真机功能/兼容、音频震动、性能、内存、30 分钟稳定性和人工体验统一为 **Blocked**，不是 Passed。R3 当前判断是“可提交外部复验”，不是“可发布”或“已上线”。

## 2. 候选与环境

| 项目 | 内容 |
| --- | --- |
| 日期 | 2026-08-10（Asia/Dubai） |
| 版本 / 轮次 | `0.1.0` / R3 |
| 首个 Git 基线提交 | `e94897f` |
| R3 候选标签 | `v0.1.0-r3-candidate.1`（由标签解析最终候选提交） |
| 配置哈希 | `1768c34e` |
| Node / esbuild | 22.23.0 / 0.25.0 |
| 微信 debug SHA-256 | `647fcf2156397684f032558ae5666cd81a845801e60db9c4f3de28bd9a526528` |
| Web debug SHA-256 | `37316e5f5208fd2b2289b16606dbdb7aacc6596ae8ea3bcf61c710a7ea8dc936` |
| 微信 release 验证 SHA-256 | `2703e705c8acc798dc80e07f95907da9f347196ab92239ef8dc7ab1a55b64d63` |
| Web release 验证 SHA-256 | `fe6d52b4f1a64a8a9e58b6582db375762517b2fab8cc86f296111fc93f3ec58a` |
| 当前仓库产物 | debug：`dist/wechat/game.js`、`dist/web/app.js` 及 sourcemap；不是 release |
| 目标运行基线 | 微信基础库 2.25.3+、iOS 13+、Android 8.0+ |
| 测试依据 | `docs/test-plan.md`、`docs/test-submission.md`、`docs/bugs-r3.md` |

最终候选提交以标签 `v0.1.0-r3-candidate.1` 解析；`e94897f` 仅记录首个仓库基线，避免在文档中硬编码尚未形成的候选提交而造成自引用。候选身份还须结合配置哈希和四项 bundle SHA-256 追溯。release 哈希仅标识本轮隔离验证产物；验证完成后仓库已恢复为 debug `dist`。

## 3. 执行结果

| 维度 | 方法 / 范围 | 结果 | 说明 |
| --- | --- | --- | --- |
| R3 完整门禁 | `npm run verify` | Passed | 75/75，0 失败、0 跳过；debug/release 构建及 smoke 通过并恢复 debug `dist` |
| R3 定点回归 | `tests/r3-release-compat.test.js` | Passed | 7/7，覆盖 BUG-R3-001～005 |
| R1 冻结回归 | `tests/qa-r1-regression.test.js` | Passed | 41/41，覆盖 BUG-R1-001～031 |
| R2 属性/影响域回归 | 128 seeds 初始草布局、160 seeds 危险出生窗口及音频抢占 | Passed | 原有 3 条持续通过 |
| debug 双端构建 | `npm run build` | Passed | 微信/Web debug bundle 与 sourcemap 生成 |
| 微信 debug bundle smoke | `npm run smoke:wechat` | Passed | HOME→RUNNING、首 tick、暂停/恢复、resize 路径 |
| release 隔离构建 | `npm run build:release` | Passed | 双端 release bundle 生成；无 sourcemap |
| 微信 release smoke / 调试隔离 | `npm run smoke:wechat:release` 与 R3 发布可达性回归 | Passed | `debugHarness=false`，release 不暴露应用/测试全局句柄 |
| 微信 DevTools 导入 | 基础库 2.25.3+ | **Blocked** | 缺少开发者工具目标环境及合法 AppID |
| iOS/Android 真机功能与兼容 | 触控、左右横屏、safeArea、resize、生命周期 | **Blocked** | 无目标真机证据 |
| 音频/震动真机 | 解锁、拒绝、焦点、中断、恢复、震动层级 | **Blocked** | 代码故障注入已过，不能替代真机 |
| 最低设备性能 | 60 秒 FPS/P95、>200 ms 长帧、输入延迟 | **Blocked** | 无最低支持真机采样 |
| 资源增长/稳定性 | 10 局内存、30 分钟 soak | **Blocked** | 100 局无渲染对象池测试通过，但不等价于真机长稳 |
| 产品人工验收 | 视觉、听觉、触控、教学与整体体验 | **Blocked** | 尚无产品签字或验收记录 |

## 4. R3 定点证据

| 缺陷 | 回归数 | 已证明的代码行为 | 尚未证明的外部行为 |
| --- | ---: | --- | --- |
| BUG-R3-001 | 1 | `unlock()` 与 `resumePaused()` 均消费 `resume()` 拒绝，并安全清理音频状态 | 真实微信 WebAudio 解锁、系统中断和听感 |
| BUG-R3-002 | 2 | 可选 FPS API 抛错不阻断 bootstrap；日志二次故障不逃出保存失败降级 | 不同客户端/基础库的真实 API 差异 |
| BUG-R3-003 | 1 | release 入口无 `growFishApp`、`__growFishDebug`、`TestHarness` 可达性；debug 保留 QA 句柄 | 正式送审包需重新构建并复核身份 |
| BUG-R3-004 | 1 | seed `613` resize 后 6 株活动水草满足边界、玩家净空与互相间距 | 多设备 resize 画面与人工可玩性 |
| BUG-R3-005 | 2 | 首次双 API 失败使用 800×450 可用默认值；运行时双失败复用最后有效视口 | 真机 API 故障、旋转与恢复链路 |

## 5. 缺陷与准出状态

| 范围 | 数量 | 本地状态 | 准出影响 |
| --- | ---: | --- | --- |
| BUG-R3-001～005 | 5 个唯一缺陷 | 修复，7/7 定点回归 Passed | 可进入外部复验 |
| 完整 Node 门禁 | 75 条 | 75/75 Passed | 本地代码门禁通过 |
| 开放本地 S0/S1/S2 | 0 | 未发现 | 不再构成本地阻断 |
| 外部真机/性能/产品门禁 | 多项 | **Blocked** | 阻止最终产品准出与发布声明 |

## 6. 下一阶段执行要求

1. 以本记录的 debug SHA-256 校验候选包，在微信开发者工具使用正式 AppID 完成导入和核心 smoke。
2. 在 iOS/Android 最低支持及代表性设备完成左右横屏、安全区、触控、前后台、音频/震动和动态 resize 矩阵。
3. 在最低支持真机采集 60 秒 FPS/P95、>200 ms 长帧、输入延迟，执行 10 局内存与 30 分钟 soak。
4. 由产品按关键状态、成长反馈、死亡/通关、教学和整体体验完成画面/声音人工验收并留存证据。
5. 外部门禁全部关闭后，从冻结源码重新构建 release，重跑 release smoke，记录最终哈希；不要直接发布当前 debug `dist`。

## 7. 已知非阻断工程债务

- `validateConfig()` 当前只覆盖部分关键字段，尚未达到技术方案描述的完整 schema/概率/时间边界校验；当前配置为仓库内冻结常量且相关行为回归已通过，因此不阻断本轮外部复验，但在开放配置化之前应补齐。
- `GameCore.snapshot()` 依赖调用方只读约定，仍直接返回部分核心对象与池数组引用；现有 Renderer 未修改这些对象，release 也不暴露应用句柄，但后续扩展公开观察接口前应收紧可变性边界。
- 项目尚未配置 lint 或静态类型门禁；当前以 Node 语法检查、75 条自动化和双构建 smoke 作为本地门禁，后续可增加无运行时依赖的静态检查。
