# @adeptify/goalboard-module-governance-collaboration

Status: `partial`  
Workspace path: `modules/governance-collaboration`  
Contract entrypoint: `@adeptify/goalboard-contracts/modules/governance-collaboration`

Review obligation、Review、Proposal、Decision 与用户确认来源的唯一 owner。

公开入口是 `GovernanceCollaborationModule`：调用方通过 `query` 读取正式记录，
通过 `reviews` 提交已经完成调用方授权检查的复核结果，通过 `records` 保存正式
Proposal/Decision，通过 `decisions` 保证跨 owner 物化的原子性。SQLite 表、映射和
状态更新都留在本包内；Planning 只生产分析结果，不直接写这些正式事实。

## Internal boundaries

- `schema.ts` / `migrations.ts`: Governance 自己的 SQLite schema 与历史升级。
- `repository.ts` / `mappers.ts`: 只读 Query、快照和 Review 存储。
- `review-lifecycle.ts`: Review obligation 对账、复核写入和重开。
- `record-store.ts` / `state-machine.ts`: Proposal、Decision、Candidate、Rewire 的正式状态迁移。
- `GovernanceApplicationApi.decisions`: Decision 与目标 owner Command 的原子事务边界。
- `provenance.ts`: 事实/假设整理、Contract 字段及 native Goal Tree 条目来源校验；提交和修订共用同一路径，用户回答、资料事实与 Runtime 推断保持区别，不自动转成 Ledger edge。
- `legacy-proposal-view.ts`: 旧 Contract/Candidate/Rewire 的只读统一展示，保留原决定、来源和状态，不改写历史。
- `clarification-store.ts`: DD1 的现有会话/回答 Query、写入、事件及操作幂等；DD2 已把批准后关闭会话迁为 `closeAccepted`。`clarification.execute` 保留同一 SQLite 连接上的同步原子事务；跨 owner Command 由 Goals Plugin 组合，不在此包写 Goal/Claim/Run。原 schema 初始化留待最终清理，不新增第二数据库。

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-ex3`
- `goal-reorg-ex4`
- `goal-reorg-ar2`（来源规则与兼容投影）
- `goal-reorg-dd1`（草稿澄清的记录端口）
