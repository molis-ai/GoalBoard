# Runtime Protocol: Core Concepts, Goal Contract, and Workflow

## Core concepts

| Concept | One-liner |
| --- | --- |
| Goal | An outcome with acceptance criteria. New and transferred Goals record work as events; untransferred historical Goals can still be claimed. A parent may record its own integration; child count does not prove completion |
| Goal Tree | The user-confirmed goal breakdown; Plans and boards are derived views of it |
| Dependency | A confirmed prerequisite; a hard gate for claiming and completing work |
| Risk | Something that may block claiming or completion, and needs a human decision on how to handle it |
| Claim | A time-limited occupancy of a Goal by a Runtime, not a task assignment |
| Run | One execution, review, or revalidation process |
| Evidence | Proof mapped to acceptance criteria (tests, inspections, human confirmations, etc.) |
| Review | Self, cross, or adversarial review that must pass for work to count as done |
| Candidate | New work discovered during execution, which only the user can decide to accept |
| Rewire | A user-confirmed rearrangement of goal relationships |

A normal Runtime reads, configures/reports events, requests decisions, and closes explicitly on new and transferred Goals. It cannot rule on canonical Goals itself and cannot fill in a user identity. Untransferred `legacy_claim_run` Goals can still be selected, claimed, and given Evidence and Runtime Review. Inferences and suggestions are not authoritative facts until the user confirms them.

## Goal Contract

A user can raise a rough idea in the current Runtime; the GoalBoard Skill uses `goal_intent_create` to save a recognizable title, optionally with an outcome note. A new intent becomes event-owned immediately. No complete tree, default template, or Claim is required first. A work plan offers types and default requirements that may be adopted; the adopted version and this Goal’s local changes persist, and later template edits do not change old meaning. Local types can also be registered with no plan. A clarifier Runtime may still read project facts for an untransferred Draft and progressively propose Outcome, Why, non-technical business logic, scope, inputs and outputs, acceptance, dependencies, risks, and Review Policy; those suggestions become an accepted Contract only after the user confirms them.

The smallest executable Goal is at the same granularity as a Task: results close within the Goal and have observable or quantifiable acceptance criteria. For example, "design the user Domain and provide testable CRUD methods" can be a leaf Goal; "make the account system good" still needs further breakdown.

On an untransferred legacy Goal, a Runtime cannot directly rewrite an accepted Contract. Changed Contract requirements for the same outcome use a Contract-update Proposal on the same Goal ID; user confirmation records a new revision and preserves history. A separately useful new outcome becomes a Candidate Goal. Event-work current agreements use `event_agree` / `event_configure`, following the returned version and the actual authorization. Tree or relation changes still go through the corresponding proposals.

## Runtime workflow

The protocol entrypoint is the MCP tool surface, not Web routes or internal classes. `apps/mcp` owns tool names, input schemas and presentation; Goals/Execution/Governance own their public fact Contracts, with cross-owner operations published by the protected Goals Plugin and registered by Local Host. The Skill imports none of that source and never reimplements eligibility, idempotency or completion. Read planning instructions through `planning_methods`; Goals Module owns the assets, and the installed Skill link is not another copy.

After the user invokes the Skill, resolve context read-only. A confirmed Session binding or exactly one verified workspace membership can return bound and recover work; directory names, ordinary suggestions and model guesses do not authorize binding. For suggested/unbound, reuse an unambiguous project selection in the current user request or ask. Normal binding never saves a directory default. Creation, switching, unlinking and deletion require their own authority; deletion still protects valid Claims and unfinished Runs.

Normal Skill replies first explain, in the user's current language, "what I understand, why this still needs confirmation, and what I'm asking or doing next" — never dumping MCP tool names or internal IDs. After a new intent is saved, continue from `goal_state`. Complex splits show an editable structured checkpoint that clearly separates user-confirmed facts, traceable project facts, Runtime assumptions, and suggestions. Untransferred Drafts persist each material answer as a dialogue turn; event-work Goals record facts with `event_report`. When a proposal is ready, a readable Goal Tree summarizes the outcome, non-goals, relations and dependencies, leaf acceptance, risks, and post-confirmation states, and the user can decide as a whole or revise named items.

Once the project connection is clear, the current Runtime first reads `goal_state` for the selected Goal. The ordinary continue path for new and transferred Goals is the event tools, not Available → Claim/Run. GoalBoard never returns "the one and only next task" and does not dispatch work.

Tool names below omit the `goalboard_v1_` prefix.

```text
new Goal / transferred event_work:
  goal_intent_create → optional event_configure (adopt planning types/selected default requirements, or register local types only)
  → work with event_report / event_progress / event_concern
  → goal_state / event_list / event_read
  → event_decision_request when a decision is needed; event_cite_decision to reuse a valid saved decision
  → event_agree for current-agreement changes; event_close for explicit close-out; event_resume after cancel
  → recorded is not completion_applied; ordinary support does not complete the Goal

untransferred legacy_claim_run only:
  available → contract → select_goal(action_id, action_token)
  → run_report → evidence_submit → review_submit / revalidate
  → untransferred Drafts still use draft_dialogue_*; Host leases use claim_renew
  → new event writes require the explicit “使用事件记录继续” action; reading does not transfer
  → after transfer, old state writes are rejected

complex Goal Tree:
  planning_methods → goal_tree_propose / read / check
  → explicit user decision → goal_tree_decide
  → follow semantic_review and returned actions; never rewrite other Goals silently

recovery:
  mcp.context_refresh_required → read-only context_resolve
  → retry unchanged with the same key after bound; otherwise resolve project selection
  stale action token → use the returned current action, not blind retries
  completion blocker → resolve the stated gate, not repeat finished execution
```

`event_decide` accepts only a user source injected by the Host Web/management entry. It is not in the Runtime audience. A valid authorization already in the same scope is not asked again; a wider scope follows the actual authorization. A parent Goal may record its own integration or acceptance; child count does not prove completion.

On the untransferred path, `select_goal` still creates Claim and Run atomically, with neither left behind on failure. Continue through the public `action_projection` / `transition.projection`. `complete`, `release`, `ready`, `claim` and `run_start` retain management/compatibility uses; they are not the default completion steps for a new Goal. Original Run/Evidence/Review/Decision records stay readable by original ID and source; they are not rewritten as fake approvals. `GET/POST /api/goals/:id/panels` (no subpath, JSON) is still the Runtime terminal panel API, distinct from the removed Goal-detail fragments.

For a new idea, the Runtime doesn't require the user to open Web first or fill in a Contract field by field: `goal_intent_create` saves the original intent and makes the event service the owner. Complex splits or tree changes still use one `goal-tree-propose` for the confirmable plan, and can restore and check it across Sessions with `goal-tree-read` and `goal-tree-check`; inferences and suggestions are not canonical Goals, relations, Risks, or Policy before user confirmation. The user can then confirm, reject, or request changes item by item in the current Runtime conversation; after the user's explicit answer, the Runtime calls `goal-tree-decide` with `user_confirmed=true`, a confirmation summary, and the concrete decisions, and GoalBoard records the audit source together with host Session metadata. This is a local conversational provenance record, not a fake cryptographic identity. Only confirmed safe items are materialized; expired, dangling, or cyclic items stay conflicted without affecting other confirmed items.

`draft-dialogue-start` / `turn` / `resume` serve untransferred historical Drafts only: they create or resume a clarifier Claim and Run in one transaction and persist each material answer. That protocol is not the default continue path for every Goal, and not every old operation has to be transferred.

Materialization adds no second "is clarification done" state: a confirmed compound parent with children shows "clarified, waiting for children"; a confirmed minimal leaf shows "ready to execute"; only Drafts or still-open breakdowns show "needs clarification".

A normal Runtime cannot independently decide canonical Goals, accepted Contracts or relations. A Goal Tree decision can still be recorded with `goal_tree_decide` after the user has just answered explicitly. User decisions on event-work Goals are recorded by Host Web/management; the Runtime may only request or cite a valid saved decision. Independently useful new work uses a Candidate; Contract requirement changes on an untransferred Goal use a same-ID Contract revision Proposal; event-work current agreements use `event_agree` / `event_configure`; dependency changes use explicit relation proposals.
