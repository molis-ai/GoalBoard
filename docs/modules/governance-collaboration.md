# Governance & Collaboration

**定位：** “谁提出了什么、谁复核了什么、谁确认了什么”的唯一事实 owner。

**拥有：** Review obligation、Runtime/Human Review、Contract Proposal、Candidate、Rewire、Goal Tree Proposal/Item/Decision、状态迁移，以及用户确认的 actor、来源、对话和消息引用。

## 公开入口

调用方只从 `@adeptify/goalboard-module-governance-collaboration` 进入，并持有 `GovernanceApplicationApi`：

- `query`：读取 Review、Proposal、Candidate、Rewire、Decision 和完整 Governance snapshot。
- `clarification`：读取/写入现有澄清会话与回答；`execute` 保持三种 Dialogue 操作原有的事务和幂等重放。跨 owner 写入必须由应用层在这个同步事务内调用各 owner 的公开 Command。
- `reviews`：提交已经完成授权检查的 Review，对账、重开或作废 obligation。
- `records`：保存已经授权的 Proposal / Candidate / Rewire / Decision，并执行正式状态迁移。
- `decisions.materializeAtomically`：把“记录决定”和“调用目标 owner 修改正式对象”放在同一事务中；任一步失败都会整体回滚。
- `provenance`：整理事实与假设，校验 Contract 字段来源和 native Goal Tree 条目的来源、理由、置信度、待确认状态，读取旧提案的统一展示。提交和修订共用此接口；只处理来源与确认规则，不授予决定权限、不保存对象内容、不把 locator 推断成 Artifact。

授权、action token、幂等 Receipt 与跨 owner 用例编排由 EX4 的 `ExecutionValidationApplicationApi` 组合；Web、CLI、MCP 都通过各自 App adapter 进入，不再调用 Coordinator 的 Review/Evidence facade。

## 边界

- Governance 不直接修改 Goal、Artifact 或 Project Store。确认后的变更调用对应 owner 的公开 Command。
- Planning 只分析“可以怎么改”；正式 Proposal 和 Decision 只由 Governance 保存。未确认建议不会进入 canonical Goal graph。
- Evidence 保存证明材料；Governance 保存 Review verdict 和协作决定，两者不复制对方的事实。
- Identity / Team / Access 判断 actor 是否有权操作；Governance 只接收已经验证的授权上下文并保存审计来源。

## 当前实现

后续 DD2：`proposal-operation-store.ts` 取代提交专用文件，复用 submit/check 的原幂等表与原事件，不重复 schema；`GoalTreeProposalCheckResult` 的原结构进入 public Contract，Plugin 保留类型导出兼容。`decision-transactions.ts` 拥有原两层预检 savepoint，成功条目仅临时保留给同批后续项，整批最终始终回退。Candidate 来源证明查询和 Candidate/Rewire 树决定事件也归本模块，Plugin 只组合事实与 Goals 物化。

`proposal-operation-store.ts` 管原提交、预检和历史 Contract 决定各自的原子重放与事件。仍用原 idempotency 表、operation/key/hash、结果 JSON 与原保存时间，回滚覆盖同连接上的 owner 写入；Plugin 不接收 Store 或任意 SQL 端口。`goal-tree-records.ts` 独占 native 提案、条目、决定与状态聚合，公共 RecordStore 只按职责组合；没有提高 owner 文件大小限制。用户确认与目标物化仍是独立于提交的步骤。

DD2：`records.supersedePendingContractProposals` 是 Draft 编辑使旧提案失效的唯一写入点，返回原创建时间顺序的受影响 ID；Goals 通过必需的窄端口调用，Host 绑定同一事务连接。`query.listLifecycleEvents` 仅返回原 `review.submitted` 记录，用于 Plugin 收尾事实组合，不接管其他 owner 的事件。

DV1 将澄清记录类型移入 Governance public Contract。DD1 进一步让 `clarification-store.ts` 拥有现有会话/回答的读写、事件和操作重放；Goals Native Plugin 的 `DraftDialogueApplication` 组合 Goal/Claim/Run 的公开端口。Host 已切到新应用，旧 Coordinator 三方法和对应私有 helper 已删除。没有新增表或修改历史记录。

- `schema.ts` / `migrations.ts`：接管 Review、Proposal、Candidate、Rewire、Goal Tree Proposal/Decision 的 SQLite schema 与历史迁移。
- `repository.ts` / `mappers.ts`：Query、snapshot、Review 存储与事件序号读取。
- `review-lifecycle.ts`：obligation 对账、不同 reviewer 计数、Review 提交、满足、重开和作废。
- `record-store.ts` / `state-machine.ts`：Proposal、Decision、Candidate 与 Rewire 的正式写入和允许状态转换。
- `provenance.ts` / `legacy-proposal-view.ts`：来源规则与历史展示。用户回答默认确认，资料事实保留确认位，推断保持待确认；旧提案保留原 ID、payload、决定、时间与最低置信度。
- root Store 的澄清 snapshot 读取委托 `GovernanceClarificationStore`。DD2 首切片已删除 `closeOpenClarificationSessions`，决定 caller 改走 `clarification.closeAccepted`，仅在批准事务内使用。澄清 schema 的既有启动初始化仍留 root；其余 Goal Tree 编排由 DD2 继续清理，不宣称全部旧职责已退出。

**迁移 Goal：** EX3 已迁事实、状态机与公开端口；EX4 已切换 Claim → Run → Evidence → Review 入口并删除对应 Coordinator 编排。Goal Tree Proposal/Draft Dialogue 是另一条规划与决定入口，不被执行验收适配器吸收。
