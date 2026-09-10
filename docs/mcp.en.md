# MCP Integration

GoalBoard connects projects through the unified Skill. The Runtime consumes the public status, project identity and connection returned by `goalboard_v1_context_resolve`; it does not inspect the catalog/database or infer a project from a repository name. A bound Session or one exact, verified workspace membership can recover read-only; a suggestion alone does not authorize binding.

## Runtime work-entry binding (recommended)

The Runtime host only provides a Session ID when it can guarantee stability; it is not a Git URL, directory name, repository structure, or a string inferred from conversation. GoalBoard supports any MCP Runtime providing a Session ID in `_meta.threadId`, `_meta.sessionId`, or `_meta["goalboard/sessionId"]` on each `tools/call`, and also supports stable environment signals from adapters like Claude Code; ordinary tool arguments are never treated as host identity. When the same long-lived MCP process receives a different Session ID, it clears the previous Session's connection. Without a Session ID, GoalBoard can still use the canonical workspace to find historical candidates, but never pretends a directory or MCP process is a Session. One workspace can associate multiple `project_id`s; a normal selection does not set a default automatically.

The install itself never writes Runtime configuration. Codex and Claude Code should use the stable launcher after the user confirms the integration preview; other Runtime hosts can explicitly provide the same set of environment values:

```bash
GOALBOARD_HOME="$HOME/.goalboard" \
GOALBOARD_RUNTIME_ID="<runtime-id>" \
GOALBOARD_WORK_CONTEXT_ID="<host-provided stable work-entry ID>" \
GOALBOARD_WORK_CONTEXT_STABLE="true" \
GOALBOARD_WEB_URL="http://127.0.0.1:4173" \
GOALBOARD_MCP_AUDIENCE="runtime" \
"$HOME/.goalboard/bin/goalboard-mcp"
```

This MCP process starts "not connected to a project" and opens no Board. The unified Skill calls `goalboard_v1_context_resolve` first:

> **Host identity**: GoalBoard reads per-call `_meta["goalboard/sessionId"]`, `_meta.threadId`, then `_meta.sessionId` before falling back to the host's startup identity. Availability is host-dependent; do not assume every Runtime version supplies these fields. Without a Session signal, one exact verified workspace membership may still recover read-only; otherwise follow the returned suggested/unbound state.

- `bound`: returns the unique `project_id`, `board_id`, and a fixed database connection; later normal GoalBoard MCP calls can only use that `board_id`.
- `suggested`: the new Session has workspace history or other host clues. The result contains only candidate projects and generic reasons that don't leak the original path, with no project connection. If the current user message already explicitly asks to use GoalBoard with a named project and exactly one returned existing project unambiguously matches it, the Skill calls `context_bind` directly; otherwise it shows the candidates and asks.
- `unbound`: returns `missing_stable_context` or `unknown_context` and connects to no project. The Skill likewise reuses an explicit current-message selection of one unambiguous existing project; otherwise it shows the project list and asks the user to select or create one.
- When the user explicitly rejects a `suggested` candidate, the Skill calls `goalboard_v1_context_reject_suggestion` with `user_confirmed=true`. It only stops suggesting that candidate in this Session, then may return another candidate or an explicit project list/create path; it never unbinds, deletes, or affects other Sessions.
- After the user explicitly selects an existing project, call `goalboard_v1_context_bind` with `user_confirmed=true`. A stable Session may use `binding_scope=session`; workspace membership records association, not a directory default. Switching an existing binding also needs explicit switch authority and `rebind_confirmed=true`. Do not send the removed `workspace_default` option.
- After the user explicitly asks to create a named project in the current conversation, the Skill calls `goalboard_v1_context_create_and_bind` with `user_confirmed=true`, the project name, and an idempotency key. It creates the project DB and binds it only under `~/.goalboard`; a failure leaves no orphan project.
- When the user asks to view projects, the Skill calls `goalboard_v1_context_list_projects`; it doesn't expose database paths and changes nothing.
- When the user explicitly asks to unbind only the current work entry, the Skill calls `goalboard_v1_context_unbind` with `user_confirmed=true`. It doesn't delete the project, DB, or other Runtimes' bindings.
- Deleting a project and its DB is a separate confirmation: after the user names the project and confirms deletion, the Skill calls `goalboard_v1_project_delete` with `delete_confirmed=true` and an idempotency key. It refuses while the project has a valid Claim or unfinished Run; on success it returns a deletion receipt and the Runtime can no longer use the old connection.

Web is an optional viewing and user-confirmation surface, not a prerequisite for project connection or Goal work. Browsing does not bind the Runtime. Project Settings manages Session associations and workspace memberships, not directory defaults. Project creation, Runtime configuration, unlinking and deletion each retain their own authorization.

For new and transferred Goals, the Runtime audience exposes work-entry resolution/explicit binding, reads, and the event tools `goal_intent_create`, `goal_state`, `event_configure`, `event_report`, `event_list`, `event_read`, `event_progress`, `event_concern`, `event_decision_request`, `event_cite_decision`, `event_agree`, `event_close`, and `event_resume`. It also keeps Goal Tree Proposal/Decision, Candidate/Dependency Proposal, and — only for untransferred `legacy_claim_run` Goals — Available/atomic selection/Run, Evidence, Runtime Review, revalidation, and release. `event_decide` is not in the Runtime audience. `goal-tree-decide` is not a license for the Runtime to reshape the tree on its own: only after the user has just explicitly decided in the current conversation may the Runtime pass `user_confirmed=true`, a confirmation summary, and the concrete decisions; GoalBoard generates the audit reference from host Session metadata. The Runtime cannot forge a Session identity, fill in a user actor, or override a resolved project connection through ordinary tool arguments.

The ordinary continue path for new and transferred Goals is `goal_intent_create` → `event_configure` / `event_report` → `goal_state` / `event_list` / `event_read`. A successful report is recorded, not completed; only an explicit `event_close` can set `completion_applied` to true. A valid authorization already in the same scope is not asked again. Only an untransferred Goal uses Available's `action_projections` as the claim entry: read the chosen Contract, then send the returned `action_id` and `action_token` to `select_goal`. After lifecycle writes, consume `transition.projection` directly. Do not treat `complete → release` as the default completion steps for a new Goal. New event writes require the explicit “使用事件记录继续” action; reading does not transfer ownership, and old state writes are rejected after transfer.

Trusted user entries that need to create Goals, maintain relations/risks/Policy, decide Contract/Candidate/Rewire, or import legacy data should use `GOALBOARD_MCP_AUDIENCE=management` separately. Never hand the management MCP to an autonomous Runtime.

If the service is unavailable, report the failure without switching databases, rewriting URLs or falling back to CLI. `mcp.context_refresh_required` asks for read-only resolution: retry unchanged with the same idempotency key only after `bound`; otherwise follow project selection. An older-reader version error is different from a connection-cache refresh and follows its returned diagnosis. See the complete [Runtime Skill](../skills/goal-advance/SKILL.md).
