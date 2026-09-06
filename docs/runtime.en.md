# Runtime Protocol: Core Concepts, Goal Contract, and Workflow

## Core concepts

| Concept | One-liner |
| --- | --- |
| Goal | An outcome with acceptance criteria: a leaf is directly executable; a compound Goal is delivered by its children |
| Goal Tree | The user-confirmed goal breakdown; Plans and boards are derived views of it |
| Dependency | A confirmed prerequisite; a hard gate for claiming and completing work |
| Risk | Something that may block claiming or completion, and needs a human decision on how to handle it |
| Claim | A time-limited occupancy of a Goal by a Runtime, not a task assignment |
| Run | One execution, review, or revalidation process |
| Evidence | Proof mapped to acceptance criteria (tests, inspections, human confirmations, etc.) |
| Review | Self, cross, or adversarial review that must pass for work to count as done |
| Candidate | New work discovered during execution, which only the user can decide to accept |
| Rewire | A user-confirmed rearrangement of goal relationships |

A normal Runtime can only read, select, claim, execute, and submit proposals and evidence; it cannot rule on canonical Goals itself. Inferences and suggestions are not authoritative facts until the user confirms them.

## Goal Contract

A user can raise a rough idea in the current Runtime; the GoalBoard Skill uses MCP to create a title-only `draft / abstract` Goal. The clarifier Runtime reads project facts and progressively proposes completions for Outcome, Why, non-technical business logic, scope, inputs and outputs, acceptance, dependencies, risks, and Review Policy; these suggestions become an accepted Contract only after the user confirms them.

The smallest executable Goal is at the same granularity as a Task: results close within the Goal and have observable or quantifiable acceptance criteria. For example, "design the user Domain and provide testable CRUD methods" can be a leaf Goal; "make the account system good" still needs further breakdown.

A Runtime cannot directly rewrite an accepted Contract. Changed requirements for the same outcome use a Contract-update Proposal on the same Goal ID; user confirmation records a new revision and preserves history. A separately useful new outcome becomes a Candidate Goal. Relation changes also require an explicit decision.

## Runtime workflow

The protocol entrypoint is the MCP tool surface, not Web routes or internal classes. `apps/mcp` owns tool names, input schemas and presentation; Goals/Execution/Governance own their public fact Contracts, with cross-owner operations published by the protected Goals Plugin and registered by Local Host. The Skill imports none of that source and never reimplements eligibility, idempotency or completion. Read planning instructions through `planning_methods`; Goals Module owns the assets, and the installed Skill link is not another copy.

After the user invokes the Skill, resolve context read-only. A confirmed Session binding or exactly one verified workspace membership can return bound and recover work; directory names, ordinary suggestions and model guesses do not authorize binding. For suggested/unbound, reuse an unambiguous project selection in the current user request or ask. Normal binding never saves a directory default. Creation, switching, unlinking and deletion require their own authority; deletion still protects valid Claims and unfinished Runs.

Normal Skill replies first explain, in the user's current language, "what I understand, why this still needs confirmation, and what I'm asking or doing next" — never dumping MCP tool names or internal IDs. New ideas, resuming an existing Draft, and direction changes show an editable structured checkpoint that clearly separates user-confirmed facts, traceable project facts, Runtime assumptions, and suggestions; every material answer is written to a dialogue turn before the next question. When a proposal is ready, a readable Goal Tree summarizes the outcome, non-goals, relations and dependencies, leaf acceptance, risks, and post-confirmation states, and the user can decide as a whole or revise named items.

Once the project connection is clear, the current Runtime reads `available` and the selected Goal's Contract and decides on its own whether to pick an item. GoalBoard never returns "the one and only next task"; a Claim is a time-limited occupancy, not a task assignment.

Tool names below omit the `goalboard_v1_` prefix.

```text
new idea / existing Draft:
  draft_dialogue_start / draft_dialogue_resume → persist each material answer
  → planning_methods (catalog first, then selected instruction bodies)
  → goal_tree_propose / read / check → explicit user decision → goal_tree_decide
  → follow semantic_review and returned actions; never rewrite other Goals silently

executor:
  available → contract → select_goal(action_id, action_token)
  → implement and verify → run_report(completed) → evidence_submit
  → complete Evidence releases the executor and returns a review action

reviewer:
  contract → select_goal(returned review action)
  → review_submit → reviewer Run and Claim close automatically
  → completed when the final gate passes; no extra complete/release

revalidator:
  available → contract → select_goal(returned revalidate action)
  → check current requirements, dependencies, Risks and evidence → revalidate
  → continue from transition.projection

recovery:
  mcp.context_refresh_required → read-only context_resolve
  → retry unchanged with the same key after bound; otherwise resolve project selection
  stale action token → use the returned current action, not blind retries
  completion blocker → resolve the stated gate, not repeat finished execution
```

`select_goal` creates Claim and Run atomically, with neither left behind on failure. Continue through the public `action_projection` / `transition.projection` instead of reconstructing eligibility from internal objects. `complete`, `release`, `ready`, `claim` and `run_start` retain management/compatibility uses; they are not mandatory extra steps in the normal completion workflow.

For a new idea, the Runtime doesn't require the user to open Web first or fill in a Contract field by field: `draft-dialogue-start` atomically creates a minimal `draft / abstract` Goal, a clarifier Claim, and a Run in one transaction; every material clarification step in the conversation then calls `draft-dialogue-turn` to save the user's answer, current understanding, sourced facts, assumptions, and the one next question; after an interruption, `draft-dialogue-resume` restores the session. When clarification completes, the current Runtime submits the whole confirmable breakdown/change plan once via `goal-tree-propose`, and can restore and check it across Sessions with `goal-tree-read` and `goal-tree-check`; inferences and suggestions are not canonical Goals, relations, Risks, or Policy before user confirmation. The user then confirms, rejects, or requests changes item by item in the current Runtime conversation; after the user's explicit answer, the Runtime calls `goal-tree-decide` with `user_confirmed=true`, a confirmation summary, and the concrete decisions, and GoalBoard records the audit source together with host Session metadata. This is a local conversational provenance record, not a fake cryptographic identity. Only confirmed safe items are materialized; expired, dangling, or cyclic items stay conflicted without affecting other confirmed items.

Materialization adds no second "is clarification done" state: a confirmed compound parent with children shows "clarified, waiting for children"; a confirmed minimal leaf shows "ready to execute"; only Drafts or still-open breakdowns show "needs clarification".

A normal Runtime cannot independently decide canonical Goals, accepted Contracts or relations. It can carry the user's explicit current-conversation decision through the unified Goal Tree decision entry without forging user identity. Independently useful new work uses a Candidate; changed requirements for the same Goal use a same-ID Contract revision Proposal; dependency changes use explicit relation proposals.
