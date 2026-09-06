# Execution

**定位：** Claim、Run、attempt、lease 与执行生命周期的唯一 owner。

**拥有：** Claim ownership/role、Run state、attempt、lease、start/report/release/revoke、block/failure/recovery 和 Runtime invocation reference。

**公开面：** `ExecutionModule.query` 查询 Claim、Run 和关联租约；`ExecutionModule.commands` 执行已授权的 claim、start、renew、report、release、revoke 和过期恢复；Repository 与 migration helper 维护唯一 schema。

**不负责：** 不拥有 Goal Contract、Evidence、Review、Session 或 Runtime process。Runtime Host 返回技术 Receipt 后，本 Module 才更新正式 Run；Goal 是否满足由 Goals 与 Evidence/Governance 门禁共同决定。

**当前实现：** EX1 已把 Claim/Run 类型、schema、历史 migration、Repository、状态机、租约过期和未结束 Run 恢复迁入 `modules/execution`。EX4 又把 Web/CLI/MCP 切到同一个 `ExecutionValidationApplicationApi`，并从 Coordinator 删除 Claim、Run、Evidence、Review 的公开编排方法。跨 owner 应用服务只把已授权的请求转给 Execution/Evidence/Governance/Goals 公开端口；Execution Module 本身仍不判断 Goal 是否 ready。

**边界说明：** Execution 接收已经由上层确认可执行的 Goal/Action 引用，不判断 Goal 是否 ready，也不修改 Goal Contract、Evidence、Review、Session 或 Runtime process。Run 完成只代表本次执行结束，不等于 Goal 已验收完成。

## 资源占用兼容规则（AR2）

`commands.transitionGoalContractRevision` 由 `contract-revision.ts` 实施原确认后收尾。metadata 变化只前移 active Claim 的 revision，保留 Run 与验收连续性；其他变化按原顺序结束旧 Run、撤销 Claim并写原事件。之后由 Plugin 调用 Governance 豁免旧 obligation。所有动作仍在同一决定事务内；Coordinator 原 `transitionGoalRevisionDependents` 已删除。

DD2 收尾：`query.listLifecycleEvents` 只返回原 `run.started/run.completed` 历史；`commands.completeRunForProposal/releaseClaimForLifecycleFacts` 接收应用已经检查的收尾结果，在调用者原事务内写 Run/Claim 与原事件。它们不是面向 CLI/MCP 的免授权入口，也不自行判断 Evidence/Review 是否齐全；该组合由 Goals Plugin 的 lifecycle application 完成。原 Coordinator 收尾写入已删除。

`executionImpactPolicy` 是公开的纯计算入口。应用层提供有效 Claim 对应的 confirmed Goal 资源声明，由 `conflicts` 返回占用冲突原因，`allowsParallel` 判断两组已确认声明是否允许并行。声明类型 `ImpactBindingRecord` 归 Goals Contract；Execution 不读取 Goals 的表，不把资源路径冒充 Ledger ObjectRef。

相同 surface 的 read/read 可并行；read/write 只有读取方带输入快照时放行；write/write、decide 和 exclusive 冲突。不同 surface 不互相阻塞。此规则已退出 Coordinator 并被领取门禁与并行建议共同消费；它只回答资源是否兼容，不代替 Goal ready、权限、依赖或其他门禁。
