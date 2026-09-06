# @adeptify/goalboard-module-context-ledger

Status: `partial`
Workspace path: `modules/context-ledger`  
Contract entrypoint: `@adeptify/goalboard-contracts/modules/context-ledger`

## Purpose

Object references, cross-owner relationships, publication, and materialization records.

This package explicitly does **not** own The referenced Goal, Artifact, Feed, or Session content.

## Public entrypoint

`createContextLedger(db, { authorize })` returns the public `ContextLedgerApi`: active edge queries, reference history, put and removal. The Repository owns only `context_edges`; authorization is supplied by the host. Object contents are never copied into this table.

The first AR2 slice moves Feed → Goal associations through this API. Feed still validates its transitions and updates disposition/Attention. The root composes both Modules against the same local transaction connection. `linked_goal_id` is now a compatibility response field, derived from Ledger. Existing stored links are moved atomically and their old column cleared; no dual writes remain.

Artifact references require an exact version. Existing identity references are represented with `version: null`, never guessed into a historical version. Ledger edge revisions track relation changes, not Plugin-owned Artifact versions. Scope checks reject personal references in Team records.

Session → Project/Goal/workspace associations use the same public API in the private Session database. Schema v5 also migrates Handoff cross-module endpoints, preserving the original package's references even if its source Session later moved. New Handoff prepares pin the actual Goal Contract revision; legacy unknown versions stay null. The local application host constructs both Modules against one transaction connection. Optional ObjectRef Project namespace and object type distinguish same-named objects without changing privacy scope.

Goal input provenance uses separate `goal.input` edges. Goals retains confirmation state and snapshot metadata, while its Feed endpoint is reconstructed from the Ledger edge key. This history is independent of mutable `feed.goal` links. Legacy URL locators remain opaque and are not automatically converted into Artifacts.

`createContextMaterializer(ledger)` exposes `ContextMaterializationApi.rebuild`. It walks selected relation types within the authorized scope, resolves content through injected owner Query ports, and returns typed transient nodes and provenance edges. Missing, denied, unavailable and stale exact references are explicit; cyclic references are visited once and an exhausted object budget reports `truncated`. Each retry reads owner state again; no payload cache or second content store is created. Native Feed uses this API for the existing Runtime advance-prompt context, preserving selection order and redaction.

Runtime work-entry → Project bindings now use Ledger edges; Work retains authorization and binding event history. Resource Impact declarations belong to Goals, occupancy rules to Execution, and proposal/fact confirmation provenance to Governance. None of those facts is converted into a fabricated object relation.

AR2's existing-behavior migration and caller audit have passed the GoalBoard evidence/self-review gates. Maturity remains partial: Publication Receipts and the future asynchronous materialization lifecycle are not implemented. Private encrypted Handoff content remains with its Work owner under spec §20.11; it is not automatically an Artifact. See [the validation record](../../specs/goalboard-architecture-reorganization/ar2-validation.md).

## Dependencies

The only declared workspace dependency is `@adeptify/goalboard-contracts`. Implementation dependencies are added by the Goal that migrates a complete use case, never by deep-importing legacy code.

## Commands

```bash
pnpm --filter @adeptify/goalboard-module-context-ledger typecheck
pnpm --filter @adeptify/goalboard-module-context-ledger build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-ar2`

## Legacy sources

- `src/v1/coordinator.ts`
- `src/feed/`
- `src/sessions/`

See [the architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md). Contract and transaction regressions are in `tests/context-ledger.test.ts`.
