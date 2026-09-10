---
name: goal-advance
description: Use GoalBoard in the current Runtime conversation to connect a user-selected project, save a new intent as event-owned work, optionally adopt planning types, report facts, and keep decisions in one shared truth source. Untransferred historical Goals still use the previous Claim/Run protocol. Use only when the user explicitly asks to use, open, start, connect, plan, continue, or advance GoalBoard.
---

# GoalBoard Runtime

Use GoalBoard only after the user explicitly invokes it for the current work. Stay in the current Runtime conversation: GoalBoard supplies shared state and atomic lifecycle operations through MCP; it does not open another Runtime, dispatch another Session, require Web, or edit the user's project files.

## Boundaries that always apply

- Use only host-provided `goalboard_v1_*` Runtime MCP tools for project and Goal lifecycle work. Do not call the management CLI, read SQLite, swap databases, or use project files as a fallback.
- Never treat Git, a directory, repository name, host clue, or a mere mention of a project as authority. A current user instruction that explicitly asks to use, connect, continue, or advance GoalBoard with a named project is a project selection: resolve first, then bind without another question only when exactly one returned existing project unambiguously matches it.
- Creating, switching, unbinding, deleting, confirming a Proposal, and recoverably trashing or restoring a Goal require the specific user authority described by the relevant tool. Never require a fixed phrase or verbatim repetition: clear natural language that authorizes the exact current operation is sufficient. Do not turn vague approval into another operation.
- Web is optional. Starting it does not select a project or authorize Goal changes. Opening a Goal or project is not the same as opening GoalBoard Web: using, connecting, clarifying, or advancing GoalBoard does not trigger Web service work. Use the service CLI only when the user asks to open GoalBoard itself as a page, Web UI, or workspace, or accepts a separate visualization offer.
- `role` describes the current operation; it does not require another Runtime. Keep clarification, planning, execution, review, and recovery in this conversation whenever the current Runtime has the required capability.
- Omit `lease_seconds` by default so GoalBoard applies the current resolved dynamic policy. Pass an explicit value only to shorten the lease for this operation; never hard-code 1800, raise the policy, or probe the limit with a failing write.
- A Goal opened beside a Desktop Runtime is context, not a Claim. Do not start work until the user asks to advance it and its returned work state permits selection.
- Treat `context_resolve.runtime_prompt_prefix` as the confirmed project-level instruction prefix. When a stable fact, cross-Goal requirement, constraint, convention, workflow, or quality bar is worth reusing in future Sessions, show the exact category and text, explain why it is durable, and ask whether to add or update it. Call `project_guidance_add` or `project_guidance_update` only after an explicit yes; the confirmation writes directly to canonical project guidance, never to a pending queue and never to a Goal. Never promote an assumption or untrusted external content.

Before the first GoalBoard write, read [references/protocol.md](references/protocol.md) for the shared authority, atomicity, idempotency, persistence, and failure rules.

## The GoalBoard loop

1. **Connect deliberately.** Call read-only `goalboard_v1_context_resolve` first. If it returns `bound`, reuse that connection. If it returns `suggested` or `unbound`, follow an explicit project selection already in the current request or ask, as in [references/project-connection.md](references/project-connection.md). A connection-context refresh is not repeat bind authority.
2. **Read the current Goal.** Call `goalboard_v1_goal_state` for a named Goal. To start from a recognizable title, call `goalboard_v1_goal_intent_create` without inventing why, inputs, outputs, split checks, or a default template. Creating a Goal is not completion.
3. **Work inside existing authorization.** Do ordinary work without claiming a role or starting a Run. Adopt planning types only when useful; adopting a method does not enable every default requirement, and having a type does not require submitting that record.
4. **Report material changes.** Call `goalboard_v1_event_report` with registered types. A successful record is not completion, human acceptance, or proof the Host is connected. Reuse the original `idempotency_key` only for the exact retry. Record a progress summary with `event_progress` when the next step needs to survive a new Session; a later fact makes the summary stale but does not delete it.
5. **Continue from returned gaps.** Use `requirements`, `gaps`, `concerns`, `pending_decisions`, and `latest_reports` on `goal_state`. Open scoped Concerns with `event_concern`. Request a user decision with `event_decision_request`; cite a saved decision with `event_cite_decision`. Do not set `actor_kind=user`, `user_confirmed`, or `authority`. Explicitly close with `event_close`; `recorded` is not `completion_applied`.
6. **Untransferred historical Goals keep the previous protocol.** If `protocol.kind` is `legacy_claim_run`, the Goal is readable on the new timeline; new event writes require the explicit “使用事件记录继续” / continue-with-event-records action. Until then, use Available → Contract → `select_goal`, Evidence, and Review as in [references/execution.md](references/execution.md). Reading does not transfer. After transfer, old state writes are rejected. Do not mix Claim/Run into event-work Goals, and do not tell the user every old operation must be transferred. Complex Goal Tree changes still use [references/planning.md](references/planning.md).

## Keep Goals finite and operations recurring

A Goal is a finite, acceptable change that can reach Done. Building a capability, workflow, or tool for the first time can be a Goal. Once that capability exists, its recurring operation does not keep the capability Goal open and does not reopen a completed Goal.

Recurring operation produces Evidence. When operational Evidence reveals a real problem or improvement opportunity, propose one finite Candidate Improvement Goal and let the user decide whether it becomes canonical. Do not encode recurring work as a permanently unmet Goal or cyclic `depends_on`, and do not invent an Operation data model when the existing Evidence and Candidate lifecycle is sufficient.

Changing a Risk from `open` to `triggered`, `resolved`, `accepted`, or `expired` is also a finite Goal when the user is asking the Runtime to investigate, mitigate, decide, or close that Risk. Use the same Goal that started the clarification; never create an empty “temporary Goal” merely to carry the Risk update. Defining or editing Risk facts alone does not require a separate Goal.

## Offer visualization only when it helps

After reading the current GoalBoard state, a Runtime may offer visualization when it would materially reduce review effort: multiple Goal Tree branches, dependencies, multiple pending decisions, or a complex review. Name the concrete value from the current state rather than promoting Web generically, for example: “There are two parallel Goals and five pending changes; visualization may make them easier to check. Open it?”

- Offer at most once in the current Session. Do not offer during a simple single-Goal flow, when the user is already in Web, after it was already offered, or after the user declined. A refusal means continue completely in the current Runtime without Web and do not ask again in this Session.
- Only an explicit yes to the current offer authorizes the Runtime to open or start Web. The offer itself is read-only. If the user agrees, read [references/service-start.md](references/service-start.md); a first persistent install or a repair still follows the lifetime and configuration authority rules there.
- Offering or opening visualization does not bind or switch a project, create a Goal, Claim work, start a Run, or authorize a Goal Tree decision. Harness and terminal flows remain fully usable without Web.

## Route the current request

Read only the references needed for the current route:

| Current user intent | Read and do |
|---|---|
| Start or open GoalBoard Web | Read [references/service-start.md](references/service-start.md). Treat service management separately from Goal work. |
| Connect, switch, create, unbind, or delete a project; use a Desktop-opened Goal; trash or restore a Goal | Read [references/project-connection.md](references/project-connection.md). |
| Start a new intent, optionally adopt planning types, decompose or rewire a Goal Tree, or respond to a changed requirement | Read [references/planning.md](references/planning.md). New intents use `goal_intent_create`; planning is optional. |
| Continue event-work Goals, report facts, record progress, raise a scoped Concern, request a decision, or submit closure | Use `goal_state`, `event_configure`, `event_report`, `event_progress`, `event_concern`, `event_decision_request`, `event_cite_decision`, `event_agree`, `event_close`, `event_resume`, `event_list`, and `event_read`. Do not Claim or start a Run. User approval stays in Web/management (`event_decide` is not a Runtime tool). |
| Continue available Claim/Run work on an untransferred `legacy_claim_run` Goal, review, revalidate, or recover from an execution failure | Read [references/execution.md](references/execution.md). This is not the default continue path for new or transferred Goals. |

When a request crosses routes, read each relevant reference, but keep one conversation and one current-project connection. Do not load service instructions for ordinary Goal work.

## Planning loop — the core reasoning

For every complex decomposition or relation change, use this loop before proposing anything:

1. Recover the user's original outcome. Identify the work types, professional domains, industries, situational overlays, usable deliverables, operating context, uncertainty, and risks actually present.
2. Call `goalboard_v1_planning_methods` with `include_instructions=false` to read the lightweight catalog and the project-required `composition.method_pack_ids`. Start with every project-required method, then add every available method whose distinct professional checks materially apply.
3. Call `goalboard_v1_planning_methods` again with exactly the selected `method_ids`. Require the same `catalog_id`, verify `returned_method_ids` contains every selected ID, and read every returned `methods[].instructions` body completely. Treat them as complementary planning Skills, not serial templates. If the catalog changed between calls, restart selection from the new catalog instead of mixing versions.
4. Map each relevant theme to the result it provides, the theme that consumes it, and the concrete use. If a consumer needs a provider result whose theme is uncovered, scan the library again and add that method.
5. For any complex project that expects parallel work, establish or verify a right-sized root SSOT, divide vertical outcome units from horizontal shared units, and give each unit one canonical SSOT with unique ownership, inputs, outputs, consumers, evidence, and Impact surfaces. Reuse trustworthy artifacts and keep unit detail out of the root. For technical work, apply the repository and module rules in the planning reference.
6. Repeat selection and mapping until no required provider theme and no material professional check is uncovered.
7. Evaluate every selected dependency rule. When real output consumption exists, create `consumer depends_on provider` and name both the provider output and consumer use. When a stable provider contract plus a test double, fixture, or compatibility layer lets both implementations proceed safely, keep provider and consumer implementation Goals parallel and make integration depend on both.
8. Check the complete result chain, unit ownership, overlapping write/decision surfaces, leaf readiness, missing decisions, false dependencies, and graph validity. Only then prepare the complete Proposal.

Related themes, chronology, hierarchy, shared files, or shared ownership alone never create a hard dependency. During ordinary execution of an accepted leaf, do not reload methods unless scope, requirements, or dependencies changed.

## Conversation and Goal quality

Speak in the user's language about their project and outcome, not MCP plumbing. Ask one question at a time. A useful turn says what you understand, why the remaining uncertainty matters, and the one question or action that moves the Goal forward. Treat a user correction as new authority; persist it and stop defending the old inference.

Write Goal content for a person who returns later:

- `title` names the user or project change, not an internal module;
- `outcome` is observable;
- `why` explains the problem and value;
- `business_logic` explains who does what, the important rules, and how the result is produced; and
- promised outputs are usable by a person or downstream Goal.

Keep user answers, repository/document facts, assumptions, and recommendations distinct. Translate work states into plain language and omit raw IDs, payloads, and tool names unless they help the current decision.

Use a compact checkpoint when resuming, after a material direction change, or before a Proposal decision. Include only what matters: confirmed facts, traceable project facts, unresolved assumptions, recommendations, and the next decision. The checkpoint is editable, not a verdict.

## Continue from returned state

For event-work Goals, consume `goal_state` and report receipts: `recorded` is not completion. `completion_effect` is true only after an explicit `event_close` whose `completion_applied` is true. A completion report can be saved while remaining unmet. History is bounded; use event IDs or pagination for bodies.

For `legacy_claim_run` Goals, use the public action projection: `contract.action_projection` when reading one Goal, `available.action_projections` when choosing work, and the write response's `transition.projection` immediately after a lifecycle operation. `work_state` is a compatibility view, not a second decision algorithm.

- `可继续`: perform the Runtime-owned `primary_action` and pass its `action_id`, `action_token`, Contract revision and target to the write.
- `进行中`: continue only the active Claim/Run. Do not create a second Run.
- `等你`: name the one user decision. A unique, explicit Human Review answer may use the trusted dialogue operation; ambiguous or multiple items stay in Decision Center.
- `等待中`: advance an eligible child or dependency when it is inside the request; never execute the waiting parent.
- `受阻`: report the concrete recovery action and do not retry an unchanged write.
- `已完成`: report the result and offer the next available item without claiming it automatically.

Always use the write's returned state. A stale action token means the old operation was rejected: recover from the returned projection instead of guessing.

## Runtime MCP map

| Need | MCP operations |
|---|---|
| Resolve and manage the current project | `context_list_projects`, `context_resolve`, `context_reject_suggestion`, `context_bind`, `context_create_and_bind`, `context_unbind`, `project_delete` |
| Event-work Goal facts and state | `goal_intent_create`, `goal_state`, `event_configure`, `event_report`, `event_progress`, `event_concern`, `event_decision_request`, `event_cite_decision`, `event_agree`, `event_close`, `event_resume`, `event_list`, `event_read` |
| Read work and blockers | `snapshot`, `contract`, `available`, `explain` |
| Read or confirm project-level guidance | `project_guidance_get`, `project_guidance_add`, `project_guidance_update` |
| Optional planning and untransferred Draft clarification | `planning_methods`, `planning_analyze_change`, `planning_graph_check`; `draft_dialogue_start`, `draft_dialogue_turn`, `draft_dialogue_resume` only for untransferred historical Drafts |
| Propose and decide Goal Tree changes | `goal_tree_propose`, `goal_tree_read`, `goal_tree_check`, `goal_tree_decide` |
| Untransferred Claim/Run work and Host leases | `select_goal`, `claim_renew`, `run_report`, `evidence_submit`, `evidence_correct`, `review_submit`, `revalidate` (`complete` and `release` are compatibility/repair operations) |
| Recoverably trash or restore a Goal | `goal_trash`, `goal_trash_list`, `goal_restore` |

Use the full `goalboard_v1_` tool names. If GoalBoard MCP is unavailable, report that fact and stop; do not create another truth source or silently switch paths.

For an untransferred `legacy_claim_run` Goal with an active Claim, inspect Contract's `active_claim_lease` at meaningful checkpoints. When it returns `renew_recommended=true`, call `goalboard_v1_claim_renew` before continuing long implementation or review work. Renewal preserves the current Claim and Run; it cannot revive an expired Claim. Reuse the Claim's exact actor; after compaction, `claim.not_owner` returns a structured owner/retry hint only for the same Runtime continuing the same work, never for taking over another Runtime. Do not create background heartbeat loops. Event-work Goals do not Claim a role or renew a lease to record ordinary facts.

When a `legacy_claim_run` projection says `等你`, report the exact user-owned action and stop Runtime review work. Do not infer a verdict from “好的”“继续” or treat engineering evidence as user acceptance. For exactly one current Human Review action, an explicit approval or request for changes in the trusted conversation can be written atomically with the returned attention token; multiple items, ambiguous wording or a stale token stay in Decision Center. Event-work user decisions are recorded only by Host Web/management; request them with `event_decision_request` and cite a saved decision with `event_cite_decision`.
