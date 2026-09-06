# @adeptify/goalboard-module-private-work-context

Status: `partial`  
Workspace path: `modules/private-work-context`  
Contract entrypoint: `@adeptify/goalboard-contracts/modules/private-work-context`

## Purpose

Private Session, content reference, association semantics, resume, and handoff facts. Cross-Module association persistence belongs to Context Ledger.

This package explicitly does **not** own Execution Runs, Goals, Artifacts, or Runtime process handles.

## Public entrypoint

`src/index.ts` exports the Contract, `GoalBoardSessionRegistry`, encrypted local content store, Runtime context binding Repository and schema migration helpers. Callers must not deep-import the internal responsibility files.

Applications open the Registry through `openWorkSessionRegistry` from `@adeptify/goalboard-app-local-host`. Direct composition must supply `GoalBoardSessionRegistry.open({ createLedger, ... })`; the factory is given the same transaction connection. No Module implementation dependency is introduced into this package.

Schema v5 includes the v4 Session association migration and moves Handoff source Goal / target Project / workspace references into Ledger. Old link IDs, actors and timestamps are retained; unknown historical Project IDs or Goal versions stay unknown. Old endpoint columns and `session_goal_links` are cleared after successful migration and no longer queried for product state. Schema upgrade and Ledger transfer commit atomically, as do Handoff create/update operations. Session identity, local workspace path hints, encrypted content and Handoff delivery facts remain here. A private recovery package is not automatically a published Artifact.

## Dependencies

Project-context request/result types are exported through the existing Contract subpath from `runtime-project-context.ts`; the old Catalog types are aliases. `LegacySessionMigrationApi` publishes only the existing `migrateLegacy` operation so compatibility composition need not depend on a concrete Registry class. These type/entry changes do not claim that the remaining Catalog routing algorithms have migrated.

`findSessionForHostSignals` consumes `WorkSessionQueryApi` and the public `RuntimeSessionHostSignals`. It owns the existing GoalBoard ID → native ID → surface → stable-context lookup, retaining the conflicting native-ID checks. Runtime/workspace/suggestion-clue types also have one public Contract definition here; environment parsing belongs to Local Host, not this Module.

The only declared workspace dependency is `@adeptify/goalboard-contracts`; `better-sqlite3` is the package-local persistence adapter. It does not depend on Projects, Goals, Execution, Runtime Host, Web or Desktop implementations.

## Commands

```bash
pnpm --filter @adeptify/goalboard-module-private-work-context typecheck
pnpm --filter @adeptify/goalboard-module-private-work-context build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-wk1`

## Legacy sources

- `src/sessions/`
- `src/projects/catalog.ts`

WK1 moved the Session Registry, encrypted content, events, handoff state, legacy migration and Runtime context binding facts into this owner. WK2/WK3 removed the legacy Runtime/UI implementations. AR2 moves cross-Module association persistence to Ledger; Session APIs continue to enforce their own confirmation and identity rules. See [the architecture SSOT](../../docs/SSOT-MATRIX.md), [module boundary](../../docs/modules/private-work-context.md) and [migration matrix](../../docs/system/MIGRATION.md).
