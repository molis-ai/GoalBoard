# MCP 接入

GoalBoard 通过统一 Skill 连接项目。Runtime 消费 `goalboard_v1_context_resolve` 返回的公开状态、项目身份和连接，不读取 catalog 或数据库路径，也不从仓库名推断项目。已绑定 Session 或唯一、已验证 workspace membership 可以只读恢复；候选本身不授权绑定。

## Runtime 工作入口绑定（推荐）

Runtime 宿主只在自己能保证稳定性的情况下提供 Session ID；它不是 Git 地址、目录名、仓库结构或模型从对话中推断的字符串。GoalBoard 支持任意 MCP Runtime 在每次 `tools/call` 的 `_meta.threadId`、`_meta.sessionId` 或 `_meta["goalboard/sessionId"]` 中提供 Session ID，也支持 Claude Code 等 adapter 的稳定环境信号；普通工具参数不会被当成宿主身份。同一个长驻 MCP 进程收到不同 Session ID 时会清掉前一个 Session 的连接。没有 Session ID 时，GoalBoard 仍可把 canonical workspace 用于查找历史候选，但绝不把目录或 MCP 进程伪装成 Session。一个 workspace 可关联多个 `project_id`；普通选择不自动设默认。

安装本身不会写入 Runtime 配置。Codex 和 Claude Code 应由用户在接入预览中确认后使用稳定 launcher；其他 Runtime host 可以显式提供同一组环境值：

```bash
GOALBOARD_HOME="$HOME/.goalboard" \
GOALBOARD_RUNTIME_ID="<runtime-id>" \
GOALBOARD_WORK_CONTEXT_ID="<宿主提供的稳定工作入口 ID>" \
GOALBOARD_WORK_CONTEXT_STABLE="true" \
GOALBOARD_WEB_URL="http://127.0.0.1:4173" \
GOALBOARD_MCP_AUDIENCE="runtime" \
"$HOME/.goalboard/bin/goalboard-mcp"
```

这个 MCP 进程启动时仍是“未连接项目”状态，不会打开某个 Board。统一 Skill 先调用 `goalboard_v1_context_resolve`：

> **宿主身份**：GoalBoard 优先读取单次调用 `_meta["goalboard/sessionId"]`、`_meta.threadId`、`_meta.sessionId`，再沿用宿主启动时提供的身份。是否提供这些字段由 Runtime host 决定；不能假设所有版本都会提供。没有 Session 信号时，唯一已验证 workspace membership 仍可只读恢复；其他情况按返回的候选/未绑定状态处理。

- `bound`：返回唯一 `project_id`、`board_id` 和固定数据库连接；之后普通 GoalBoard MCP 调用只能使用该 `board_id`。
- `suggested`：新 Session 有 workspace 历史或其他宿主线索。结果只含候选项目和不泄露原始路径的通用原因，没有项目连接。若当前用户消息已经明确要求用 GoalBoard 连接或推进一个已命名项目，且返回的现有项目中只有一个无歧义匹配，Skill 直接调用 `context_bind`；否则才展示候选并询问。
- `unbound`：返回 `missing_stable_context` 或 `unknown_context`，不连接任何项目；同样先复用当前消息中对一个现有项目的明确选择，否则展示项目列表并询问选择或新建。
- 用户明确拒绝某个 `suggested` 候选时，Skill 调用 `goalboard_v1_context_reject_suggestion` 并传入 `user_confirmed=true`。它只在这个 Session 不再提示该候选，随后可返回另一个候选或显式的项目列表／新建路径；不会解绑、删除或影响其他 Session。
- 用户明确选定已有项目后，Skill 调用 `goalboard_v1_context_bind`，传入 `user_confirmed=true`。有稳定 Session 时可使用 `binding_scope=session`；workspace 只记录关联，不保存目录默认。切换已绑定项目还需明确的切换授权与 `rebind_confirmed=true`。不要发送已移除的 `workspace_default`。
- 用户在当前对话明确要求新建一个命名项目后，Skill 调用 `goalboard_v1_context_create_and_bind` 并传入 `user_confirmed=true`、项目名称和幂等键。它只在 `~/.goalboard` 创建项目 DB 并绑定；失败不会留下孤儿项目。
- 用户要求查看项目时，Skill 调用 `goalboard_v1_context_list_projects`；它不暴露数据库路径，也不改变当前连接。
- 用户明确要求仅解绑当前工作入口时，Skill 调用 `goalboard_v1_context_unbind` 并传入 `user_confirmed=true`。它不删除项目、DB 或其他 Runtime 的绑定。
- 删除项目及其 DB 是另一项单独确认：用户明确点名项目并确认删除后，Skill 调用 `goalboard_v1_project_delete` 并传入 `delete_confirmed=true` 和幂等键。项目有有效 Claim 或未结束 Run 时会被拒绝；成功后返回删除收据，Runtime 不能继续使用旧连接。

Web 是可选查看和用户确认界面，不是连接项目或推进 Goal 的前置条件。浏览页面不会绑定 Runtime；项目设置管理 Session 关联与 workspace membership，不保存目录默认项目。项目创建、Runtime 配置、解除关联与删除仍各有自己的授权。

Runtime audience 对新 Goal 和已转交 Goal 暴露工作入口解析/显式绑定、读取，以及事件工具 `goal_intent_create`、`goal_state`、`event_configure`、`event_report`、`event_list`、`event_read`、`event_progress`、`event_concern`、`event_decision_request`、`event_cite_decision`、`event_agree`、`event_close`、`event_resume`。它也保留 Goal Tree Proposal/Decision、Candidate/Dependency Proposal，以及未转交 `legacy_claim_run` Goal 的 Available/原子选择/Run、Evidence、Runtime Review、重新验证和释放。`event_decide` 不属于 Runtime audience。`goal-tree-decide` 不是 Runtime 自己随意改树的权限：只有用户刚刚在当前对话明确决定后，Runtime 才能传 `user_confirmed=true`、确认摘要和具体决定；GoalBoard 结合宿主 Session 元数据生成审计引用。Runtime 不能通过普通工具参数伪造 Session 身份、自填 user，或覆盖已解析的项目连接。

新 Goal / 已转交 Goal 的普通继续路径是 `goal_intent_create` → `event_configure` / `event_report` → `goal_state` / `event_list` / `event_read`。上报返回记录成功，不是正式完成；显式 `event_close` 才可能让 `completion_applied` 为 true。已有有效同范围授权不重复问。未转交 Goal 才把 Available 的 `action_projections` 当作领取入口：选定后读 Contract 并携带返回的 `action_id`、`action_token` 调用 `select_goal`。生命周期写后直接消费 `transition.projection`。不要把 `complete → release` 当成新 Goal 的默认完成步骤。要开始新版事件写入须显式「使用事件记录继续」；读取不会转交，转交后旧状态写入拒绝。

受信用户入口需要创建 Goal、维护关系/风险/Policy、决定 Contract/Candidate/Rewire 或导入旧数据时，单独使用 `GOALBOARD_MCP_AUDIENCE=management`。不要把 management MCP 交给自主 Runtime。

服务不可用时报告失败，不切换数据库、改 URL 或使用 CLI 兜底。`mcp.context_refresh_required` 仅要求只读 resolve：返回 bound 后用原 idempotency_key 原样重试；未绑定则按项目选择流程处理。旧 reader 的版本错误与连接缓存刷新不同，按返回诊断恢复。完整协议见 [Runtime Skill](../skills/goal-advance/SKILL.md)。
