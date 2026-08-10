# 《大鱼吃小鱼》V0.1 R1 缺陷清单

## 1. 基线与结论

- 提测轮次：R1，版本 `0.1.0`，配置哈希 `1768c34e`
- 微信 debug SHA-256：`8f6a23110c0daa47106fe8ed96ada7ed1943a2cb97743046e94a1f5246628495`
- Web debug SHA-256：`5666ec428f9f65070c7e4e2ed0e37212cd075051f1ba21996d078de1d40b440e`
- 独立测试环境：macOS 26.5.2 arm64、Node 22.23.0、npm 10.9.8、固定逻辑步长 60 Hz
- 缺陷总计：31 个，其中 S1 1 个、S2 14 个、S3 16 个。
- R1 结论：**No-Go**。存在开放 S1/S2，且 P0/P1 规则、适配、反馈和性能观测门禁未满足。

统一自动复现入口：

```bash
/private/tmp/node-v22.23.0-darwin-arm64/bin/node --test tests/qa-r1-regression.test.js
```

该文件最终包含 41 个回归子测试，对应下列 31 个唯一缺陷；同一缺陷的多个影响域使用多个子测试锁定。R1 之后的修复只能记入 R2 回归状态，不改变本清单的 R1“已复现”结论。

## 2. 缺陷总表

| ID | 严重度 / 优先级 | 追溯 | seed / tick | R1 实际结果与证据 | R1 状态 |
| --- | --- | --- | --- | --- | --- |
| BUG-R1-001 | S1 / P0 | SPN-026、D15 | `41233`；激活后 tick 28；自然样本 `3`/tick 29 | 安全预测只推进 x，遗漏正弦 y 漂移；候选被接受后 0.467 s 内死亡，低于 0.8 s 安全底线 | 已复现，阻断 |
| BUG-R1-002 | S2 / P0 | SPN-024、D23 | `20260731`；tick 1 | 同一刷新 tick 先激活 pending，再预约/激活另一条鱼；事件同时出现 `fish_activated` 两次，总占位 1→2 | 已复现 |
| BUG-R1-003 | S2 / P0 | COL-003 | `314159`；tick 1–2 | 静止玩家与同级鱼碰撞后仅鱼位移；玩家 tick 1 获得速度 `(19.154,-61.067)`，tick 2 移动前被清零，位置始终不变 | 已复现 |
| BUG-R1-004 | S2 / P0 | LIF-002、PER-002、D25 | `7`；hide/show 后首帧 | 后台 30 s 被计为 30000 ms、`longFrames=1`、P95 污染且产生 dropped tick；HOME/PAUSED 也被采样；窗口仅 600 样本，不能覆盖 60 s；P95 算法偏一且离窗长帧仍永久累计 | 已复现 |
| BUG-R1-005 | S2 / P0 | LIF-008、SPN-029、D10 | `31003`–`31005` | resize、入场完成、离场回收按 `0.5w`，渲染尾鳍达 `0.65w`；1200×600 时鱼 x=48、w=96，视觉左界 `-14.4px`；入场提前结束、离场提前回收 | 已复现 |
| BUG-R1-006 | S2 / P0 | STO-003、D12 | `271828`；`runClock=74/60` | 原始 `1233.333333... ms` 被 `Math.round` 保存为 `1233 ms`，不符合最快通关取未四舍五入毫秒值 | 已复现 |
| BUG-R1-007 | S2 / P0 | GRA-005 | `0`；首个候选 | 1024×768 要求短边 5%=38.4 px；水草中心距左边仅 24 px 仍被接受。固定 width/height 边距同样影响顶部/底部 | 已复现 |
| BUG-R1-008 | S2 / P0 | GRA-001、CMP-003、D21 | `951`；开局 | 700×300、DPR 3、合法 safeArea 下初始只激活 5 株水草，要求为 6 株 | 已复现 |
| BUG-R1-009 | S3 / P2（测试设施） | 调试接口 | `61001`；创建时 | `spawnFish({pending:true})` 默认同时 `active=true`，与生产 pending 的不可见/不移动/无碰撞语义冲突，容易制造假阳性或漏测 | 已复现 |
| BUG-R1-010 | S3 / P2 | INP-013、异常输入降级 | `51001`；tick 1 | 非有限触摸坐标使摇杆比例与玩家 x/y/vx/vy 传播为 NaN，本局世界状态永久损坏 | 已复现 |
| BUG-R1-011 | S3 / P1 | INP-012、D09 | `51002`；重复 pointer id | 相同 id 的第二次 start 覆盖 capture；end 后 `captures=0`，但 `moveId=9`、`move.active=true`，形成幽灵移动 | 已复现 |
| BUG-R1-012 | S2 / P1 | AV-004、LIF-002、D24 | `77`；hide/show | 返回状态为 PAUSED 时仍无条件 `AudioContext.resume()`；暂停事件尚未被 RAF 消费时环境音会短暂/持续恢复 | 已复现 |
| BUG-R1-013 | S2 / P1 | CMP-004、D18 | 无 seed；布局计算 | 异常 safeArea `{left:900,top:500,right:-1,bottom:-1}` 产生倒置/越界活动矩形，没有按字段校验并回退到有序视口 | 已复现 |
| BUG-R1-014 | S2 / P0 | CMP-003、D10 | 无 seed；800×450 | 合法 `safeArea.top=16` 时 HOME 音效/震动与 RUNNING 暂停按钮 y=8，位于安全区外 | 已复现 |
| BUG-R1-015 | S2 / P0 | SCR-004 | `62001`；第 180 tick | 第一条后恰好 3.000 s 吃第二条时，计时器先归零，连吃按第 1 条重开；策划规定“超过 3 秒”才重置 | 已复现 |
| BUG-R1-016 | S2 / P1 | SCR-007 | `63001`；HUD 首帧 | HUD 只有 `Lv.X` 与无数字进度条，没有“当前 XP / 需求 XP”数值 | 已复现 |
| BUG-R1-017 | S3 / P1 | SCR-007 | `63002`；得分事件 | 左上总分字体/变换在得分前后相同；现有 0.16 s pulse 放大玩家鱼，不是要求的总分 0.15 s 放大 | 已复现 |
| BUG-R1-018 | S3 / P1 | SCR-007 | `63003`；age 0 与 0.79 s | `level_up` 只有 spark，没有中央“升级！Lv.2”文字；0.8 s 内两次绘制均找不到该文本 | 已复现 |
| BUG-R1-019 | S3 / P1 | AV-001 | `63004`；吞鱼后 0.1 s | 猎物立即 release/reset；事件缺少完整外观数据，特效只有飘字/气泡，绘制链无缩小吸入变换 | 已复现 |
| BUG-R1-020 | S3 / P1 | AV-001 | `64001`；升级后 0.2 s | 升级只有 18 条 spark 与文字；`drawEffects` 无圆弧/椭圆升级环 | 已复现 |
| BUG-R1-021 | S3 / P1 | STA-009、AV-001 | `64002`；`game_win` | WIN 只有静态标题、音效和震动；`game_win` 后 `effects=[]`，无庆祝粒子/气泡或等价动态庆祝 | 已复现 |
| BUG-R1-022 | S3 / P1 | STA-008、AV-001 | `64003`；DEAD 首 tick | DEAD 后仅推进 cinematicClock，场景位置完全冻结；有震屏/翻肚但没有要求的前 0.4 s 慢动作 | 已复现 |
| BUG-R1-023 | S3 / P1 | AV-001 | `64004`；combo 1/4 | combo=4 与 combo=1 创建相同数量、相同类型反馈，无高连吃短粒子拖尾 | 已复现 |
| BUG-R1-024 | S3 / P1 | SCR-007 | `64005`；得分事件 | 得分飘字 `life=0.75 s`，策划与用例要求约 `0.6 s` | 已复现 |
| BUG-R1-025 | S3 / P1 | GRW-010、视觉方案 | `64006`；升级首帧 | 玩家逻辑和视觉宽高立即跳到新尺寸，再做 ±5% pulse；没有从旧尺寸到新尺寸的 0.3 s 平滑放大 | 已复现 |
| BUG-R1-026 | S2 / P1 | AV-003、技术方案第 9 节 | 无逻辑 tick；20 次同刻播放 | 每次短音都新建 oscillator/gain；20 次调用创建 20 个 voice，没有并发上限 6、复用或结果音优先淘汰 | 已复现 |
| BUG-R1-027 | S3 / P0 | AV-002、D17 | `64007`、`64008` | idle 与 swimming 的 Canvas 操作序列完全相同；3 个 visualId/spawnSeq 水草的绘制序列也完全相同，不满足玩家四状态及 2–3 种水草盘点 | 已复现 |
| BUG-R1-028 | S3 / P1 | LIF-001、GRW-010 | `65001`；PAUSED 后 10×100 ms RAF | 核心升级计时在暂停中冻结，但 Renderer 继续推进墙钟；0.8 s 升级文字/环在暂停期间过期消失 | 已复现 |
| BUG-R1-029 | S3 / P0 | SMK-004、D11 | `65002`→`65003`；快速退出/新局 | 吃鱼高连吃并升级后暂停退出、立即新局，Renderer 仍保留 37 个旧 effects 及 player/score pulse、level transition | 已复现 |
| BUG-R1-030 | S2 / P1 | CMP-004/005、D18 | 无玩法 seed；平台故障注入 | `getWindowInfo()` 抛错时不回退 `getSystemInfoSync()`；NaN/负数宽高、DPR、menu 字段传播成 NaN 布局、负 DPR 和不可点击按钮 | 已复现 |
| BUG-R1-031 | S3 / P1 | SMK-004、D11、AV-003 | `65004`；quit/start 边界 | 吃鱼与升级短音仍存活时退出，`game_quit` 只停 ambient，2 个旧 voice 未 stop 并可叠到 HOME/新局 | 已复现 |

## 3. 重点复现日志

### BUG-R1-001：危险出生竖向漂移漏算

1. 以 seed `41233` 开局并清空实体，禁用后续刷新。
2. 玩家置于 `(22.4,225)`；构造左侧 Lv.2 pending：`x=-58.56,y/baseY=251,vx=109.76,amplitude=13.5,phase=-π/2,period=3`。
3. R1 `isDangerSpawnSafe(fish,true)` 返回 `true`。
4. 推进 0.8 s：tick 28、有效时间 0.4667 s 进入 DEAD；碰撞时鱼约为 `(-7.339,243.451)`。

期望：预测必须包含与生产 `updateFish` 相同的纵向正弦轨迹；该候选应返回 `false`。自然生产 RNG seed `3` 也可在约 0.4833 s 复现。

### BUG-R1-002：单 tick 两次鱼生命周期转换

1. seed `20260731`，`runClock=6`，场上只保留一条 `warningRemaining=1/60` 的右侧危险 pending。
2. 推进一个逻辑 tick。
3. R1 同一 tick 产生两条 `fish_activated`：id 11/Lv.2/right 与 id 12/Lv.1/left；总占位由 1 变 2。

期望：一次刷新器逻辑 tick 在“预约或激活”之间最多执行一次转换。

### BUG-R1-004：性能口径不可用于 D25 准出

1. RUNNING 下记录正常帧 `0 ms`、`16.667 ms`。
2. hide 30 s 后 show，再调用首帧 `30016.667 ms`。
3. R1 输出约为 `samples=3, averageFrameMs=10005.56, averageFps=0.0999, p95FrameMs=30000, longFrames=1, droppedTicks=1`。
4. HOME 和 PAUSED 的 RAF 帧也进入 gameplay 样本。
5. 连续写入 3600 个 60 Hz 游戏帧，R1 仅保留 600；手工放入 1–20 ms 时 P95 返回 20 ms，nearest-rank 应为 19 ms。
6. 一个 250 ms 长帧被后续 3600 个正常帧挤出滑窗后，`longFrames` 仍为 1。

期望：只统计 RUNNING 有效玩法帧，排除首帧、后台与暂停；保留完整 60 s 观测窗并按 nearest-rank 计算 P95。

### BUG-R1-005：视觉边界和实体生命周期使用了不同宽度

渲染尾鳍最远到鱼中心后方 `0.65w`，R1 resize/entering/departed 使用 `0.5w`。seed `31003` 从 800×450 resize 至 1200×600 后，鱼中心 `x=48`、宽 `w=96`，碰撞/夹取认为已合法，实际尾部到 `x=-14.4`。seed `31004/31005` 分别证明入场标记和离场回收也提前 `0.15w`。

## 4. 修复与回归要求

- BUG-R1-001 必须先定点回归已知 seed，再以生产参数做 100+ seed 属性验证：所有被安全判定接受的危险候选，0.8 s 内不得接触玩家且保留逃生方向。
- BUG-R1-004 必须验证后台/暂停/首帧排除、60 s 样本容量、nearest-rank P95，并明确这些代码指标不能替代最低支持真机数据。
- BUG-R1-005 必须共同回归 resize、入场完成、离场回收、危险重叠 suppression/分离重入，不得只修 resize 夹取。
- BUG-R1-012 修复后需真机验证系统音频焦点；代码级回归通过不能替代 iOS/Android 听感。
- BUG-R1-016～031 需要逐事件录屏/听音由产品人工验收；自动化只证明反馈路径、时长、暂停语义和跨局清理存在。
- 所有 S1/S2 必须关闭；所有 P0/P1 回归必须通过。R2 需提供新 bundle SHA-256、配置哈希、影响范围和完整 `npm run verify` 结果。
