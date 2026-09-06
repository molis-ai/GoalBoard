# @adeptify/goalboard-app-cli

Status: `partial`  
Workspace path: `apps/cli`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/app-host`

## Purpose

Thin CLI protocol, argument, and presentation adapter.

This package explicitly does **not** own Business decisions, Module Stores, or duplicated application rules.

## Public entrypoint

`src/index.ts` binds CLI Goal writes to `GoalsApplicationApi` and Claim → Run → Evidence → Review operations to `ExecutionValidationApplicationApi`. It does not create a Store or copy business rules.

`cliFlagValue`, `readCliJsonPayload`, `printV1Help`, `printCliJson` and `cliGoalUrl` own the actual V1 input/help/output path consumed by the legacy executable. Flags keep first-match semantics; non-empty `--json` wins over `--file`. JSON is decoded here once and business validation stays with the application owner. Help does not touch storage. `DEFAULT_CLI_DATABASE` retains the existing default; Local Host prepares its location before input decoding so error and side-effect ordering stay compatible.

V3 import invokes a typed Host capability, not a Store in the CLI. The executable retains command dispatch and injected Host construction; business application registration lives in Local Host. Installation behavior remains with its existing owner and DV4.

`createCliGoalCommandHandlers` and `createCliExecutionCommandHandlers` bind the existing named CLI operations to their public application commands. Their input is decoded CLI JSON; they retain the legacy field conversions, preserve command results/errors and do not retry or implement business validation. The executable switch selects only declared handlers. Production now awaits their typed Host Client operations; there is no arbitrary-name execution bus.

`createCliAvailabilityQueryHandlers` consumes `GoalAvailabilityQueryApi` supplied by the Host for `ready`, `available` and `explain`. It keeps the existing full CLI response and flag conversions without selecting a Goal or changing query rules. The executable no longer calls these Coordinator methods directly.

## Dependencies

Full Contract reads and active-goal writes invoke the Goals Plugin's `readGoalContractCapability` and `setActiveGoalCapability` through the same Host Client. CLI retains its original string conversion and URL output; the Host calls the original query/command owner. Board initialization, full snapshot, Goal creation and V3 import also use public Goals Plugin declarations. All Goal application groups now use the Host Client; DV1 acceptance is recorded in `specs/goalboard-architecture-reorganization/dv1-validation.md`.

`createCliDraftDialogueHandlers`, `createCliGoalTreeHandlers` and `createCliLegacyProposalHandlers` accept the protected Goals Plugin's existing synchronous application or its typed asynchronous client. These handlers return promises, and the executable awaits them before JSON output. Production uses `createGoalProposalClients` over the Host Client; decoded inputs and full history/results remain unchanged. Host binds the existing implementation without moving transaction or decision algorithms into this App.

Dependencies are limited to public Contracts and the protected Goals Native Plugin entrypoint that publishes the execution-validation application Contract.

All CLI application handlers return promises and accept the existing synchronous port or its typed asynchronous client. Production uses `createGoalsEntryClient`, `createExecutionEntryClient`, `createGoalEntryCompositionClient` and `createGoalProposalClients`; it no longer obtains a Coordinator or application from `withProject`. `client.withScope` preserves opening before request adaptation and keeps resources until output completes without exposing a Runtime. The old synchronous adapter factories remain compatibility exports for existing consumers.

## Commands

```bash
pnpm --filter @adeptify/goalboard-app-cli typecheck
pnpm --filter @adeptify/goalboard-app-cli build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-dv1`
- `goal-reorg-gw4`
- `goal-reorg-ex4`

## Legacy sources

- `src/cli/`

GW4 moved Goal write and Lifecycle operations through this adapter. EX4 moved execution and acceptance calls through the same public application port while preserving existing CLI payloads, errors, and results. See [the architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md).
