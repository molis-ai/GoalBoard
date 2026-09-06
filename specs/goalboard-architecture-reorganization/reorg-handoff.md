# 重组续接点

2026-09-06。仓库交接不代替 GoalBoard；生命周期只用 host 提供的 goalboard_v1 MCP。

## 最新可信进度

- **本轮修复已完成（08:21 UTC，优先于下方历史）**：桌面确认框和真实自重启通过实际 App，见 `dv4-restart-repair.md`；新增 Onboarding 重叠/高度对齐修复通过最终 DMG 实机截图与迁移/跳过操作、普通 Web/390px 验证，见 `../onboarding-native-titlebar/spec.md`。08:20:58 UTC 原服务恢复、原配置不变，测试进程已退出。未替换原用户安装，DV4/总重组不因此自动完成；“等待是否修复”已过时，不重复询问。
- **Goals 父项收口已批准并落地**：`goal-tree-proposal-b7c484f1-c5c2-478f-8077-b67debd222a9` approved，item applied；07:16:45 UTC，cursor1201。父项 accepted/closed_compound、valid/satisfied，GW1–GW6 保持完成。已按 receipt 顺序读完 19 项受影响 Contract，原范围/消费关系仍成立，图检查 0 issues；不需要重做子项或重复问这份提案。下面 pending 记录为历史。
- **DV4 临时停服已获明确授权，首轮真实 GUI 验证和原服务恢复已完成**：见 `dv4-gui-validation.md`。当前代码重新构建 App/DMG/zip；隔离 Home 自动首装、首启设置/诊断、断线恢复、自有进程退出与重开已验证。07:28:27 UTC 原服务已恢复 running，原 plist/服务收据/安装清单字节未变，本次测试 LaunchAgent 已移除，临时日志/数据保留。
- **DV4 不能完成**：实际 Native App 诊断页“重启”不出现确认框；当前 `window.confirm` 和 Tauri adapter 相对 HEAD 未改，支持旧 WebView 兼容缺口判断，尚不是迁移前 GUI 对比证明。需决定是否把此既有缺口修复纳入本轮；不能绕过确认或以 CLI 成功代替 GUI 成功。DD 独立提案仍未批准。

- **当前唯一收口确认请求：Goals 父项** `goal-tree-proposal-b7c484f1-c5c2-478f-8077-b67debd222a9`，仅 `item-gw-parent-closure-20260906`，pending；read/check通过，cursor1195，conflict_item_ids=[]、planning_issues=[]。完整四承诺三条件及方法依赖已复核，见 `goals-parent-closure-audit.md`。只将原父 accepted/frontier_open 结束为 accepted/closed_compound，保留原字段、子项与关系；不同时批准 DD 或暂停4173。下次用户明确确认这一整份提案后正式decide，再逐项读semantic_review与图检查。
- **Query 的 Feed 间接 caller 补齐已完成**：发现 src/feed/store.ts Attention Goal exists 旁路后，在原Query Contract下修复并revalidate；未新增Goal。旧 evidence-8f29fc8c-e202-4f4b-98bf-579329e64416 作为全caller结论已用 evidence-correction-6645c811-397b-44d7-8c73-35ad1b8ce159 retract（原Policy/Risk事实保留）。新 evidence-cb2bb926-f03a-4fc7-872b-0bcd95cb9b06 verified，04:17:42UTC revalidated=true/completed，cursor1187。78/0/0定向Feed/Query/Web回归、类型/边界通过，见 goals-feed-query-correction.md。下面旧Query completed记录为阶段历史，不再使用已撤回Evidence。

- **GW6 canonical 已完成**：2026-09-06T04:07:30.455Z，cursor 1173，projection completed；Evidence evidence-aac845f5-3542-4a21-a377-e4248b7c5d7b verified，Review review-b0db70e2-abab-4d19-948c-85bd65230d25 pass；执行/复核均结束。schema、15/25/26/30 Goals 内容和 V3 coverage caller 已迁移，193/0/0 前后端回归、补强历史数据对账 6/0/0，见 gw6-validation.md，不重复 GW6。
- **DD 收口仍未批准**：用户短答“确认”后的 decide 被权限审核拒绝（未明确授权具体提案），canonical 未变。不要使用自动续接或旧“确认”重试，不经 CLI/SQLite/其他提案绕过。独立 pending 仍为 `goal-tree-proposal-84bdb63c-4da2-4996-9af5-8a93e2cec4b4`。GW6 提案不包含它，也不包含暂停 4173 的权限。

- **Goals Query 读取边界纠正已完成**：原已完成 Goal `goal-f826dfb8-bf63-4e98-b6b7-57f6b4b7c3b8` 的 caller Evidence 过度声称，已正式 retract（`evidence-correction-a5996146-ffd0-44e9-bc4b-a93d62761037`），不是新增 Goal。当前 Web Policy 历史/Risk 关联及 Coordinator 替代/依赖/风险 SQL 已退出。182/0/0 串行真实浏览器/Runtime/Web 回归，25.47 秒，`/private/tmp/goals-query-correction-acceptance.log`；构建、边界、diff check 通过。Evidence `evidence-8f29fc8c-e202-4f4b-98bf-579329e64416` verified；2026-09-05T21:31:42.224Z revalidate=true，valid/satisfied/verified/completed，cursor 1141，primary=null。该流程无需重复 Run report 或 select reviewer；按返回完成状态继续。
- 当前 Coordinator / renderer / server 为 2,675 / 2,240 / 3,230 行。查询纠正范围及证据见 `goals-query-correction.md`、`goals-query-correction-validation.md`。全部测试进程已结束。该证据不替代整个旧 Host/Store/schema 的退出审查。
- **GW5 canonical 已完成**，2026-09-05 17:01:04 UTC self Review pass 后 projection=completed。完成 Evidence `evidence-8efddec5-17d9-4437-ab5a-c78b64f2ef91`，Review `review-15084847-4b63-438c-93fe-74e011422203`，映射全三项。原执行租约到期历史保留，收尾 Run `run-9daddff5-6b88-4aec-89b1-df447a7b691e` 与 reviewer Run 均完成/释放。
- 完整范围、caller 和无损证据：`gw5-validation.md`、`gw5-caller-audit.md`、`gw5-progress.md`。最后补迁项目工作规则 document/client/styles/19 条文案；Plugin Policy project surface + Workbench mount。root renderer **3,827** / server **3,353**，边界 48 packages / 448 sources / 1,236 imports / 71 edges / 30 contract subpaths / 10 compatibility / 5 legacy huge，0 errors。
- 最终串行 Goals/Web/Desktop **175/0/0，86.9 秒**，真实日志 `/private/tmp/gw5-acceptance-regression.log`，已复核。不重跑无变化的已终止测试。原中英文 full/refresh 和项目规则页面对比、失败与修复历史均保留。后续仅改文档，diff check 通过。
- 开发文档 UI Platform、Goals、SSOT Matrix、Migration、Huge Class 和总 spec 的旧 GW5 状态已同步；既有 5 个 legacy huge files 仍需 Cutover，不是整体 retired。DV1/DV2/DV3 已完成，不重做。

## DD1 / DD2 已完成，进入父项覆盖审查

DD2 已于 **2026-09-05T21:10:21.787Z** self Review pass 后 canonical completed，cursor **1126**。Evidence `evidence-5bbb9ca4-957d-4ca0-bd52-e64547da2bd4` verified；Review `review-ed351489-139c-409e-be42-f3f33afdcf6b` pass。执行与复核 Claim/Run 均完成并释放，不复用旧租约或 token。native/legacy 应用、完整提案呈现、分组/最近结果、客户端与文案/样式均已迁。root renderer 2,240 行；Workbench 只组合各 owner HTML，跨 Feed/Goal 的刷新与 receipt 留在 Workbench。

最终 12 文件串行 **209/0/0，38.70 秒**，`/private/tmp/dd2-acceptance-regression.log`，所有测试进程已结束。包含 3 条新 Chrome 决定/修订/历史链及共享 Draft/Relation/Safety 表单；边界故障保护 **12/0/0**，512 sources / 1,585 imports / 71 edges / 0 errors。细节见 `dd2-validation.md`、`dd2-caller-audit.md`。

DD 父项已完成逐项覆盖审查，待确认提案 **`goal-tree-proposal-84bdb63c-4da2-4996-9af5-8a93e2cec4b4`**，仅一项 `item-dd-parent-closure-20260906`：保留原结果/范围/标准/关系，结束父项拆分为 accepted/closed_compound。21:18:46 UTC 预检 conflict_item_ids=[]、planning_issues=[]，cursor 1133；目前 pending，未决定。审查见 `dd-parent-closure-audit.md`。下一次用户针对这份提案明确确认后，走正式 decide，再读 semantic_review 和受影响 Contract；不可把此前确认当本提案批准。DD2 不重复 report / Evidence / Review。

Goals Mutation 父项仍开放：DD2、Query 纠正及 GW6 已分别处理实际发现的遗漏，完整父项需结合 GW1–GW6 与下游消费核对后正式收口，不能直接当作全量 Host/Store Cutover 完成。DV4 GUI 仍无暂停 4173 的明确授权。

已接受父 Goal **迁移 Draft Dialogue 与 Goal Tree Decision 入口**
`goal-1cb5db42-232a-426a-ac79-36c6320d621e`，canonical accepted/frontier_open/unmet revision 2；DD1/DD2 均 accepted/closed_leaf revision 1。

完整拆分提案：**`goal-tree-proposal-d6a1fac6-8695-4d89-8096-0d6eb3ba7f85`**，用户本轮明确确认后，2026-09-05T17:32:32.277Z 全部 11 项 applied，cursor 1097；不再等待重复确认。22 个 semantic_review Contract 已逐条读过，图检查 0 issues。
计划详情 `dd-work-plan.md`；使用迁移重构、软件开发、开发工具、AI 人工复核方法，目录与完整正文已读。

DD1 已完成：2026-09-05T17:57:57.712Z，projection=completed，cursor 1108；Evidence `evidence-4a0cc5ee-ba83-4d4b-a828-b5da26e0368a` locator verified，Review `review-8bca2c40-37c6-4d02-aa6b-6cc1df332898` pass，执行与复核 Claim/Run 均自动释放/结束。三个真实应用方法/独占 helper 与 root snapshot 澄清映射已退出，无 schema 改动。最终串行 **182/0/0，28.97 秒**，含真实 Chrome/独立 Runtime 争用/重开/到期/回滚。详见 `dd1-validation.md`。sandbox 失败日志保留，正常获准环境完整通过；没有停止现用 4173。

DD2 完成记录见本节顶部，不使用历史检查点租期恢复执行。

提案 11 项是两个子 Goal、两条子项归属、父项保持开放的计划、总重组归属、Cutover 消费依赖，以及四条已完成公共契约前置：
1. DD1 `goal-reorg-dd1`：草稿 start/turn/resume、现有 UI/CLI/MCP、错误身份/幂等/到期恢复/进程重开/分页，旧三方法退出。
2. DD2 `goal-reorg-dd2`：提案 submit/list/check/decide、Workbench Proposal/Decision UI/copy/client、可信确认/拒绝/修订、冲突原子性和 legacy 恢复，旧四方法退出。
3. 原父项关联总重组（不是 Goals Mutation 父项，避免既有 Execution 消费形成组合循环），最终 Cutover 消费 DD 完整结果。
4. 复用已完成 EX3/EX4/GW3/DV1。顺序先 DD1 后 DD2，不为共享文件制造 DD2→DD1 硬依赖，不新增并行 Agent。

### 预检中已遇到的具体问题

以下是 DD 拆分与迁移过程中的历史问题；DD1/DD2 现已完成，不以旧记录重新安排已验收工作。

- 第一版 `goal-tree-proposal-85670aad-bf9e-4bab-8c51-9825eaa42160` 缺完整 parent Contract 字段；第二版 `goal-tree-proposal-0f28df0d-9628-48b7-8b57-5af3f4f1ef08` 补齐后发现真问题：materialization 顺序先 goal/contract 后 relation，accepted compound closure 看不到同批新建 children，`goal.accepted_compound_closure_children_required`。
- 当前第三版按完整范围阶段性提交：parent accepted/frontier_open，review paused，open_goal_ids 保留 parent，明确两子项完成后再收口；完整 outcome/scope/criteria 未改。失败提案由当前版 supersede，不偷偷部分采用，不直接修产品绕门禁。DD2 负责已复现的同批预检/决定顺序问题的回归与必要纠正。
- Proposal 提交会自动释放 clarifier Run。修订时用 draft_dialogue_resume，同一 Goal；新 item_id 必须全局唯一，并用 supersedes_item_id 关联。当前 revision3 的 preflight 全过，不再无意义修订。
- 上述决定、semantic_review 和 DD1 Available/Contract/select 已完成；没有重开历史已完成 Goal。DD1 完成后按原授权顺序继续 DD2。

## 整体未完成及禁区

- **父项仍需独立审查**：`goals-parent-closure-audit.md` 的旧 Coordinator Proposal 写入反证已由 DD2 消除；Web/Coordinator 的读取旁路已由 Query 纠正消除。不能以子项完成直接关闭原父项，也不能把不再存在的旧读写重复当成缺口。Cutover 本身等待父项，需核对剩余初始化/迁移与 Host 职责的范围和真实消费顺序，不能先假报父项完成或制造反向环。

- Goals Mutation 父项 `goal-ccdd09e2-7bfe-4b4b-82e2-29b632b51b5d` 当前 draft/frontier_open，五个子项已完成，仍待按原结果做父项收口确认；不当作已完成，也不重复子项。
- 数据迁移/安全恢复等待 Developer 与 Goals Mutation；Cutover 仍 needs_revalidation/未执行。其 Contract 单读 primary 可能显示 revalidate，但 Available 会给依赖门禁，必须以实际 eligibility 为准。
- 整体终点仍是全部开发 → 模拟真实用户的前端/后端详细 E2E → 代码清理 → 再 E2E → 初始分包、边界、Huge Class、调用链、开发规范/逻辑逐项审查。175 项只证明 GW5。
- root Execution/Decision/历史/共享 Shell 复合内容不能全塞 Goals；按 `gw5-caller-audit.md` 走真实 owner，最终 Cutover 对 EX4 等历史验收有反证才正式纠正。
- 工作树大量长程修改，不 reset、不自动 commit。不改现用 4173、用户 Home/Applications/项目/Runtime 配置。测试进程状态以当前执行记录为准，不重跑已经终止且无改动的成功用例。
- actor `codex-runtime-01a05baf-e423-7581-a362-f8b3ecd6de49`；Board `project-c0128512-0062-45b7-be0e-81b5fe444898`，同一 Runtime 绑定。MCP 可用；reader 3 / schema 5 诊断不以换 DB/CLI 规避。
- GPT-6 Astra 检查已结束：本机默认 gpt-6-astra/xhigh，不等于本对话实际模型证明；不再迁移模型或改配置。
- 保留已实证修复：属性转义、草稿首次打开、Planning 显式采用、焦点、panel/records 取消恢复、旧响应身份保护、无重复分页。历史失败不能用最后全绿抹掉。

## DV4 已有证据与待授权步骤

- DV4 发布 tooling 已迁 Apps；旧孤立 npm payload 构建已改为 Local Host 自包含 release。干净副本 `/private/tmp/goalboard-dv4-clean.ITjqKC` 已通过锁文件 118 项供应链策略、全部 48 包+root 构建、Plugin CLI bin/manifest、官方 Node 下载校验和 Tauri App/DMG 构建。使用 Tauri Local Development 签名，公证因无凭据跳过；没有公开发布。
- npm workspace:* 分发失败已修复：App Local Host npm staging + root `pnpm package:npm`，35 个内部/vendor 包随包交付，外部原生依赖由目标环境正常安装。干净副本完整构建/打包与 `/private/tmp/goalboard-dv4-npm-consumer.JbALTN` 正常安装、npm ls、真实 CLI/PTY/SQLite/方法/Home/MCP 验证成功，含升级/故障回滚/版本恢复/demo 数据比较/卸载预览确认。`tests/npm-package.test.ts` 通过；显式端到端复验命令 `node tests/npm-distribution-smoke.mjs /absolute/consumer`。首测裸 node-pty 绕过既有 helper 初始化，已改用真实 GoalBoardPtyHost；没有生产补丁。旧失败产物仅作历史复现在 `/private/tmp/goalboard-dv4-npm.iJUCGg`。
- DMG 已通过真实安装脚本复制到临时 installed-apps，并用复制后的 App 内 Node/CLI 安装临时 dmg-user-home；installed/self_contained 与实际 CLI 启动成功。没有打开 App GUI、没有替换用户 Applications/Home。所有本轮 build/test/install 进程已终止，临时副本与产物保留用于后续验收。当前工作区的 `pnpm` 自动安装问题未通过删除 node_modules 规避；正式干净副本链已实证通过。
- 最新完整 macOS release 命令两种签名环境都成功：保留 Tauri Local Development、以及未设置身份时默认 `-` 的真实 ad-hoc。DMG/zip/SHA256、解包 App 签名和正式 DMG 临时安装通过；最终产物在干净副本 release/macos，解包/安装在 `/private/tmp/goalboard-dv4-release-check.tmaj5v`。先前 sandbox 证书校验失败已在正常获准环境对同一 App 验证成功，不是包损坏；不可继续误报默认环境没设签名身份。
- GUI 首启需暂停当前 4173 服务的明确授权：Desktop 和 LaunchAgent 固定端口/label，临时 GOALBOARD_HOME 不足以隔离。已确认用户服务运行中，没有停止它。待允许后只暂停现有服务、临时 Home 测试、清除本次临时服务并恢复原服务，不擅自更新用户 Home/项目/Runtime 配置。未获授权时该验证步骤保持未完成。
# 2026-09-06 本轮最新补充

用户明确“修”后，桌面重启确认框及 Web 自重启失败已修复，并通过实际 DMG 安装 App：取消保持 PID，确认后 48298→48829，受管服务 healthy/running/owned，退出重开正常。08:09:49 UTC 原服务恢复、配置字节不变。详见 `dv4-restart-repair.md`。旧“等待是否修复”说明已失效。

用户随后明确新增修复：首次引导左上角品牌与红黄绿重叠、未垂直对齐。已修复并完成实际 App 验证，见 `../onboarding-native-titlebar/spec.md`；不改其他标题栏或引导功能。最终合并包为当前工作区 `release/macos/GoalBoard-0.1.14-macos-arm64.dmg`，仅在临时目录安装测试。
