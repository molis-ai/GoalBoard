# Goals

## 建库、历史升级与旧版覆盖记录（GW6）

Feed 的 Attention Goal 存在性校验由旧 Host facade 装配公开 `GoalsQueryService.getGoal(projectId, goalId)`，不直接查询 Goal 表。它不筛掉 archived/trashed Goal；缺失/跨项目继续返回原 Attention/Feed 错误，不新增记录。

`schema.ts` 唯一维护剩余 Goal 表、索引和字段约束；`guidance-migrations.ts` 接管 15/25/26；`revision-migration.ts` 接管 30 的 Goal 列及 revision/父子覆盖回填。Host 使用同一连接按原顺序调用各 owner，最后写成功 marker，跨 owner 的原子事务不能拆开。其他 owner 的表、Project 控制状态和共享事件不归 Goals。

V3 导入器保留旧格式和 ID/status 映射，调用 `commands.importLegacyCoverage`；Web 调用 `query.listLegacyCoverage`，保留字段、排序和空值。`coverage_items` 是旧需求覆盖记录，不是 `coverage_contract_revisions`，也不改成 Ledger。导入接口仅供受控整体导入使用，没有新增外部写入或绕过确认入口。完整验收见 [GW6](../../specs/goalboard-architecture-reorganization/gw6-validation.md)。
查询边界纠正（2026-09-06）：`query.listPolicyHistory` 保留全部状态的规则、来源、理由和原排序；它与仅用于策略计算的 active bindings 分开，持久化的 Goal 级 scope 是 `goal`。`listGoalRiskLinks`、`listDependencies`、`listOpenGoalRisks`、`activeReplacement` 提供现有 Web / Runtime 消费的事实，SQL 留在 Goals 内部 Repository。Web 不再直接读 Policy / Risk 关联，Coordinator 不再直读 Goal / Relation / Risk。原领取和完成规则仍由各自调用方负责，不增加通用 SQL 端口。验收与历史证据纠正见 `specs/goalboard-architecture-reorganization/goals-query-correction.md`。

DD2 决定组合通过公开 API：`markCandidateAwaitingRewire` 保留批准 Candidate 后的待线路确认状态；`reconcileRewireGoalValidity` 保留线路决定后受影响 Goal 的待重验与正式 Goal 恢复顺序。它们不提供任意状态改写入口。已确认历史 Risk 由 `ConfirmedRiskCommands.registerAcceptedRisk/registerAcceptedRewireRisk` 落地，后者保留原 Rewire 的 `risk.added` 事件；公开 CLI/MCP 没有新增绕过用户决定的入口。

提案协调：`planning.proposals` 共用 Candidate 与 standalone dependency 的原校验，包括 Goal/关系/Impact/Risk 输入、回收站限制和 ID 冲突；`planning.contracts.proposalGoalConflict/candidateGoalMatches` 负责 Goal Contract/验收引用和历史 Candidate 匹配。`query.hasGoalIdentity` 只回答全局 ID 是否已存在，不暴露其他 Board 的 Goal 内容；日常读取仍走带 Board 的 getGoal。Native 与 legacy 都消费这些端口。

DD2 后续：公开 Query 提供 Contract/coverage revision 和本模块 lifecycle history。`recordConfirmedDraftUpdate` 在 Governance supersession/关闭之后记录原最终事件，仍处于整份决定事务内；不开放独立 CLI/MCP 入口。`GoalRevisionDependentTransition` 类型归 Contracts，原 Module export 保持兼容。跨 Execution/Governance 的 revision 收尾由 Plugin 组合，Goals 不复制其他 owner 的状态机。

DD2 当前切片：`commands.createConfirmedGoal/updateConfirmedDraft/applyConfirmedPolicy/applyConfirmedRisk/applyConfirmedRelations` 承接已授权提案的有限写入，保留原规范化、持久化、Risk 状态变化和父级协调。普通创建与提案创建共用初始 Goal/验收/revision 写入；普通 `setPolicy` 与提案共用规则替换。Draft 的最终组合事件仍在 Governance supersession/关闭之后由应用记录。调用方必须保持用户决定与整份事务，不能把这些内部 Command 当成免确认的外部入口。

`planning.contracts` 拥有 accepted 业务 Contract 比较、父收口判断及有无子 Goal 的结构冲突；预检和决定共用，Plugin 不复制规则或读取表。`lifecycle.acceptDraft/applyAcceptedContractRevision/closeAcceptedCompound` 已纳入公开 Contracts，仍复用原 lifecycle 实现。DD2 已完成 legacy 物化、提案编排与 UI 迁移，验收见 `dd2-validation.md`；不代表全量 Cutover 完成。

Legacy Contract/Rewire 的 Policy、Risk 通过 `registerAcceptedPolicy/registerAcceptedRisk` 写入，保留应用既有总事件与顺序；所有 open Risk 创建共用 Repository。`applyAcceptedRewireRelations` 保留 legacy 专属的关系停用限制、图预检、重复关系拒绝、父级协调和待重验集合，与 native 的事件协议分开，不用新语义覆盖旧历史。`query.policyBindingVersion` 只返回兼容既有提案的版本结果，旧序列化 Policy 表示留在 owner 内；不能把历史 baseline 换成重新解析后的对象 hash。

资源占用声明 `ImpactBindingRecord` / `ImpactAccess` 归 Goals 公开 Contract；它描述 Goal 对一个 surface 的 read/write/decide/exclusive 使用，不是跨模块对象关系。Execution 消费声明判断并行兼容，不能修改声明。

`GoalsModule.impacts` 提供查询、新建、修改、停用和已确认 Proposal 应用入口。`impact-commands.ts` 复用 Goals 的事务、幂等、错误和事件机制；`impact-repository.ts` 唯一维护声明 schema、旧历史 migration 和读写。停用记录保留原作者、创建时间、声明原因与停用原因，不能原地改写或换所属 Goal。

Web、CLI、MCP 通过各 App 的 Goals adapter 调用 `impacts`；Coordinator 不再提供旧 add/update/deactivate 方法，也不再直接读写 Impact 表。Contract Proposal / Rewire 通过 `registerAccepted` 写入已确认声明：该入口仅用于已授权的整体应用事务，保留调用者原有的整体审计事件，不额外生成逐条 Impact 事件。它不是绕过用户确认的独立传输端点。Root Store 只调用本模块的 schema / migration / 查询入口，不保留字段映射副本。

**定位：** Goal Contract、关系图、Policy、Risk、Lifecycle、Project Guidance 与 Planning 规则的唯一 owner。

**拥有：** Goal identity/version、outcome/scope/criteria、parent/dependency graph、risk/policy、accepted contract revision、ready/completion lifecycle 和 planning analysis。

**公开面：** 查询列表/详情/关系/ready/read model；创建和修改 Draft、接受 Contract、管理关系/风险/策略、revalidate/complete/archive；发布 Goal 与图变化事件。

**不负责：** Claim/Run 属于 Execution，Evidence 属于 Evidence & Verification，Review/Proposal/Decision 属于 Governance，跨 Module provenance 属于 Context Ledger。Planning 可以提出变化，不能自行确认为正式 Goal 变化。

**特殊边界：** Goal 是官方签名保护的一等 Native Plugin；Module 仍与 UI Plugin 分离。引用使用 `goal_id + version`。

## 当前已经迁入

Draft 编辑后的旧 Contract Proposal 失效现在通过必需的 `supersedePendingContractProposals` 窄 port 调用 Governance，Goals 不再读写 `contract_proposals`。Host 必须把该 port 绑定到同一数据库连接的 Governance records；不能省略或提供空实现。Governance 返回原创建时间顺序的被替代 IDs，Goals 保留原 `goal.draft_updated` 事件，任一 owner 失败由原外层事务一起回滚。

- `GoalsModule.query`：Board/Goal 列表与详情、关系、Risk link、Policy 合并、Project Guidance、archive/trash 过滤和 Goal-owned snapshot。不存在的 Board/Goal 保持稳定错误。
- Goal read application：`plugins/native/goals/src/goal-query-application.ts` 只组合公开 Goals Query 与其他 owner 的只读 port；Web、MCP、CLI 的 Contract/Policy/Guidance/回收站入口不再调用 Coordinator 查询实现。
- `GoalsModule.commands`：创建 Goal、更新 Draft、建立/解除关系、设置 Policy、登记/更新/处理 Risk、添加/修订/停用/恢复 Project Guidance。
- `GoalsModule.lifecycle`：接受 Draft、按同一 `goal_id` 增加 Contract revision、完成/重新校验、归档、回收站恢复、复合父 Goal 协调。
- Goal lifecycle migrations：归档、回收站、历史 Run/澄清状态、Active Goal 指针和 Contract coverage schema；由旧 Store 启动流程调用公开迁移函数，不保留第二份实现。
- `GoalsModule.planning`：项目规划方法选择与版本递增、完整 Runtime instructions、方法组合、关系图循环检查、执行顺序指标和需求变化影响分析。
- `modules/goals/methods/`：37 个内置规划方法的唯一发布资产；源码、npm package 和本地安装包读取同一目录。Home installer 只在已安装 Runtime Skill 下创建指向该目录的包内兼容链接，不保留第二份源文件。
- Planning decomposition validation：叶子 Goal 粒度检查和复合 Goal 覆盖检查拆成两个文件，均通过 Goals public entrypoint 调用；Proposal/Decision 只作为待检查输入，事实仍归 Governance。
- `GoalsApplicationApi`：把 Command、Lifecycle 与 Planning 组合成一个公开应用端口；Workbench、MCP、CLI 分别用自己的薄 adapter 接入，不导入 Goals implementation、Store 或 Coordinator 实现。
- `GoalsRepository`：上述 Command 使用的 Goal、criteria、relation、policy、risk、goal-risk link、guidance、event 和 idempotency 基础写入。
- `GoalInputBindings`：输入确认 receipt 的公开读写和 schema owner。Web/Feed promotion 不再直接读写 `input_bindings`；跨 Project Goal 不能登记输入。可解析 Feed locator 迁入注入的 Ledger `goal.input` 关系，旧 endpoint 清空，Goals 仅保存 edge key 并通过公开 Query 还原兼容返回值。确认状态、snapshot digest、原始 actor/时间仍归 Goals；URL/不可解析 locator 保留，不自动注册为 Artifact。schema 补列、迁移与新写入失败均与关系一起回滚。
- 公开错误 Contract：旧 `GoalBoardV1Error` 通过兼容注入保留 `code/message/details`；直接使用 Module 时返回 `GoalsCommandError`。
- Web、MCP、CLI 和 Feed promotion 的 Goal 写入已经切到公开应用端口；旧 `GoalBoardCoordinator` 的写入、Lifecycle、Planning 同名转发方法已经删除，原有 payload、错误与结果保持不变。
- `plugins/native/goals` 的 `ExecutionValidationApplicationApi` 与 action projection 已成为 Claim → Run → Evidence → Review 的组合入口；三个 App adapter 共享同一 Query/Command port，具体事实仍由四个 Module 各自拥有。

## 仍未迁入

- Draft dialogue 与 Goal Tree Proposal/Decision 编排不属于本 Module：它们跨 Governance、Execution 和 Goals，也不属于 EX4 的执行验收链。DD1/DD2 已由 Goals Native Plugin 实现，消费本模块 Query/Command；不吸收进 Goals Module。
- Query 兼容入口：少量旧 Coordinator 只读委托仍保留到对应 caller 完成切换；不得重新加入 Goal SQL 或业务判断。
- Goals UI 与产品文案属于 `plugins/native/goals`，不是 Goals Module。GW5 全部页面、专属交互、route descriptor、就近文案及项目工作规则页面已完成工程验收；Workbench 只 mount contribution 和装配页面/请求，Host 保留数据、权限、HTTP 与跨 owner 输入。只读呈现消费公开事实/action projection，草稿保存仍走公开 Goals API，不能自动接受或启动 Run。175 项串行 Goals/Web/Desktop 回归和完整映射见 `specs/goalboard-architecture-reorganization/gw5-validation.md`。跨 Execution/Decision/共享 Shell 的剩余组合由最终 Cutover 处理。

Claims/Runs、Review obligation、Project active Goal 和 Action projection 通过窄 port 由各自 owner 提供；Goals Lifecycle 不跨模块直接读写 Store。Risk 的当前 Action 授权和 Lifecycle reconcile 仍是迁移接缝，后续 Execution/Governance/Query owner 会替换兼容实现。这个 port 不是第二套事实或通用 Event Bus。

**当前来源与 Goal：** Goals Query 与 GW1–GW4 已迁入 `modules/goals` 和三个 App adapter；零 caller 的 `src/planning/` re-export 与旧拆分校验文件已经删除。Goals Query 的遗漏 caller 本轮纠正，不能用原全绿报告覆盖新反证。EX3 已把 Proposal/Decision 事实迁入 Governance；EX4 已迁 action/work projection 和执行验收入口。DD1/DD2 已完成，不能据此提前关闭整个重组。

- Planning UI 消费公开 `PlanningMethodPack` / `PlanningMethodComposition`；组合规则仍在 Module。Plugin 拥有方法库/详情/编辑/项目组合呈现、专属客户端/样式/文案及页面 matcher，HTTP 宿主保留确认门槛与持久化。浏览器“加入组合”已补齐漏传的显式确认字段，未放宽 Module 规则。

- GW5 追加：完整记录中的 Goal 基础资料/只读关联归 Context contribution；进展的开放风险/检查规则摘要归 Safety/Policy contribution。初始和刷新导航数据由 `buildGoalsNavigationItems` 输出最小投影，Host 只组合 Project/Board/cursor 和安全 JSON。Execution/检查/历史外层组合不进入 Goals Module 或这次 UI 切片，最终 Cutover 必须单独审查该边界。

- 浏览器正文、面板/因素和记录/翻页均通过显式 Host factory 装配，分别持有请求状态；面板 keys 与 hash/键盘/点击由 Plugin 提供。Host 保留共享状态保存、focus/reveal、跨 owner 预览和事件分发顺序。取消会立即释放相应 busy/disabled 状态，迟到响应不能写 DOM；这些是 UI 请求规则，不是新的 Goal 事实或执行许可。
