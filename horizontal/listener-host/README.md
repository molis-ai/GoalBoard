# @adeptify/goalboard-service-listener-host

Status: `partial`  
Workspace path: `horizontal/listener-host`  
Contract entrypoint: `@adeptify/goalboard-contracts/services/listener-host`

## What it owns

Durable Source cursor/checkpoint, single-listener lease, Raw Event delivery, attempts, retry boundary, quarantine and technical Run receipts. It calls a declared Integration Adapter for a Signal Draft and advances the cursor only after Signals returns an accepted Receipt.

It does not own Source configuration, formal Signal facts, Feed/Attention decisions, credentials or Provider protocol rules.

## FD1 implementation and recovery

`ListenerHost` persists `listener_instances` and `listener_deliveries`; the former `feed_source_runs` table is now owned through this package. Existing `feed_sources.cursor_json` is copied once for migration and then ignored as an authority.

Call `migrateListenerHost` after Sources initialization before using the standalone recovery/checkpoint functions. Local Host does this when assembling the Feed application: pre-reorganization installations already recorded historical Feed migrations 22–29, so those markers cannot prove that Listener storage exists. Repeated initialization keeps the current Listener checkpoint and never replaces it with the legacy cursor. The old-project HTTP opening and reopen regression is `tests/feed-upgrade.test.ts`.

On a process or Adapter failure, the Raw Event stays durable and the Run becomes interrupted. Retrying the same operation recovers the pending delivery. Repeated Provider delivery is safe because both Raw Event and Signal identities are Source-scoped and idempotent. A live lease rejects concurrent consumption of the same Source; repeated conversion failure enters quarantine.

## Current callers

Native Feed owns source scheduling and dispatch use cases; Local Host owns the Web timer and lifecycle. Integration Plugins own public-source protocols. The old `src/feed/sources/scheduler.ts` has been removed. The general-purpose Scheduler package remains contract-only; this migration does not claim future automation scheduling.

## Commands

```bash
pnpm --filter @adeptify/goalboard-service-listener-host typecheck
pnpm --filter @adeptify/goalboard-service-listener-host build
```

Migration Goals: `goal-reorg-f2`, `goal-reorg-fd1`.
