# @adeptify/goalboard-module-signals

Status: `partial`  
Workspace path: `modules/signals`  
Contract entrypoint: `@adeptify/goalboard-contracts/modules/signals`

## What it owns

Normalized external-event identity, Source-scoped provider dedupe identity, revision, controlled content references, adapter/provenance records and accepted validation state.

`SignalsModule.commands.submitDraft` validates and accepts a Draft. The SQLite repository creates one stable Signal per `project_id + source_id + provider_dedupe_id`; an unchanged duplicate returns the existing fact, while changed normalized content creates the next revision. Query methods never expose the repository.

It does not connect to Providers, store Listener cursor/lease, decide Feed/Attention placement or mutate Goals and Automation.

## FD1 implementation

The GitHub/Gmail compatibility caller now passes Raw Events through Listener Host and this Module before creating the current Feed projection. `signals` and `signal_revisions` are the formal external-event facts; `feed_items` are owned by the Feed Module.

## Current callers

Integration Plugins normalize Provider data, Listener Host manages durable receipt/delivery state, and Native Feed composes the Source/Signal/Feed path. Public RSS/YouTube provider code and source use cases have left the old `src/feed` tree. Workbench consumes Native Feed UI contributions.

## Commands

```bash
pnpm --filter @adeptify/goalboard-module-signals typecheck
pnpm --filter @adeptify/goalboard-module-signals build
```

Migration Goals: `goal-reorg-f2`, `goal-reorg-fd1`.
