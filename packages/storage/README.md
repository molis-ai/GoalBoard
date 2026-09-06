# @adeptify/goalboard-storage

Status: `partial`
Workspace path: `packages/storage`
Contract entrypoint: `@adeptify/goalboard-contracts/platform/storage`

`LocalSqliteStorage` owns the existing connection settings (WAL, FULL synchronous, foreign keys and five-second busy timeout), immediate transactions, the shared event journal and idempotency records. `LOCAL_JOURNAL_SCHEMA_SQL` exposes their original schema for the Host migration transaction.

Module schemas and migration ordering remain outside Storage. The package depends on Contracts and the existing `better-sqlite3` driver. It does not implement Outbox or Exchange.

## Commands

```bash
pnpm --filter @adeptify/goalboard-storage typecheck
pnpm --filter @adeptify/goalboard-storage build
```

Migration source: `src/v1/store.ts`. Host assembly and remaining Feed storage consumers are tracked in the [Cutover work plan](../../specs/goalboard-architecture-reorganization/cutover-work-plan.md).

Migration Goals: `goal-reorg-f2`, `goal-reorg-ap2` and the accepted final Cutover.

`LocalSqliteJournal` borrows an existing connection for shared events and idempotency. Its caller retains connection ownership; only `LocalSqliteStorage` opens and closes a connection.
