# @adeptify/goalboard-app-mcp

Status: `partial`  
Workspace path: `apps/mcp`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/app-host`

## Purpose

Thin MCP schema, audience, and capability adapter.

This package explicitly does **not** own Business rules, direct Store access, or Runtime Skill policy.

## Public entrypoint

`src/index.ts` binds MCP Goal tools to `GoalsApplicationApi` and Claim → Run → Evidence → Review tools to `ExecutionValidationApplicationApi`. It does not register a Runtime provider, create a Store, or copy business rules.

`handleMcpMessage` owns the stdio message/reply protocol independently of storage: initialization, notifications, discovery, tool replies and errors. The host injects audience-filtered tools, the authorized tool application and domain-error formatting. Per-call session identity comes only from host `_meta` in the existing priority order (`goalboard/sessionId`, `threadId`, `sessionId`), never from the model's tool arguments.

`MCP_TOOLS`, `RUNTIME_MCP_TOOLS` and `MCP_SERVER_INFO` provide the actual management/Runtime discovery catalog. `isRuntimeMcpTool` and `isRuntimeContextMcpTool` let the host classify calls using the same audience definition before executing them. Classification is not permission to mutate data: the host and Module application still enforce identity, project binding and operation-specific authority, including calls made directly without discovery.

Inside this package, `tool-schemas.ts` owns shared wire schemas, `goal-tools.ts` and `context-tools.ts` own their tool definitions, and `tool-catalog.ts` owns audience projection. Schema changes belong here, not in the legacy server. Runtime projection clones definitions before removing management-only fields, so it cannot alter the management catalog. These are protocol declarations, not a second business validator.

`buildMcpResumeView` renders Host-provided Goal summaries and existing action projections. It preserves host focus, Session focus and the original fallback ordering without claiming work or mutating facts. The Host reads resume facts and the trash list/cursor through typed capabilities; MCP no longer accesses Store directly, including V3 import.

The legacy server delegates protocol, discovery and audience classification through this public entrypoint and re-exports its old catalog names for compatibility. It retains executable routing, trusted-host checks and injection of catalog/Session implementations; Local Host owns resource and identity composition, while the App owns context wire conversion and presentation.

`createMcpGoalToolHandlers` and `createMcpExecutionToolHandlers` adapt named tools to public Goals and execution-validation commands. Call them only after the host's audience/connection/impersonation checks. `mcpBoardPayload` keeps the selected top-level Board over a nested payload's Board; it is wire conversion, not business validation. Risk actor kind comes from the host audience. Evidence location context is lazily supplied by the host and overrides any model field. Errors, idempotency and lifecycle decisions remain with the application owner; the adapters never retry.

`createMcpAvailabilityToolHandlers` consumes the typed `GoalEntryCompositionApi` client for Ready / Available / Explain; Available and its action projections arrive from one Host operation. `query-presentation.ts` owns method catalog presentation, Available summary/full shaping and Draft history pagination. It preserves existing catalog IDs, field selection, sorting, cursors and JSON formatting. A host-supplied error factory retains the original error class, code and details without importing legacy errors. Draft pagination knows only `turn_index`; it preserves the rest of the result and full turns rather than duplicating a Draft domain model.

## Dependencies

`createMcpGoalTrashHandlers` adapts confirmed trash/restore requests and presents the lifecycle result with its current work state. Blocking activity, relation changes, persistence and replay remain with Goals/Execution. `mcpGoalContractResponse` and `mcpWebUrl` own links and the existing URL error presentation.

`runtimeGoalTreeDecisionInput` validates the existing Runtime confirmation fields before invoking an injected host provenance function. Host identity never comes from model arguments; Local Host retains the original attestation format. Management decisions retain their original input. Full Contract and project-guidance reads, plus active-goal writes, invoke the protected Goals Plugin's named public capabilities through the Host Client. Board/import/resume/trash-list capabilities and their full snapshot/input/report types also come from the public Goals Plugin entrypoint; root keeps compatibility re-exports, not duplicate definitions. DV1 acceptance is recorded in `specs/goalboard-architecture-reorganization/dv1-validation.md`.

`createMcpRuntimeContextHandlers` owns the seven existing project/context tools' argument conversions and list presentation. It consumes `RuntimeProjectCatalogProvider` and `RuntimeProjectConnectionState` from the public App Host Contract. The host supplies identity and the scoped catalog operation; a model-supplied context is not consumed. The catalog remains open until asynchronous response composition settles. Denied bind leaves the existing connection intact; resolve clears its old cache before reading, while unbind/rejection/deletion retain their original invalidation conditions.

`mcpRuntimeSessionActivity` converts successful Goal tool input/result into the existing secondary Session activity descriptor. It preserves operation labels, Goal/result lookup order and depth, nested idempotency-key priority and source IDs; denied selection and unrelated tools produce no activity. It neither opens a Registry nor writes an association. Local Host records the descriptor against the host-selected Session and Project.

`createMcpDraftDialogueHandlers`, `createMcpGoalTreeHandlers` and `createMcpLegacyProposalHandlers` consume the protected Goals Plugin's public application Contracts. Draft turn/resume pagination is validated before invoking a write; start still returns its original full result. Legacy tools preserve top-level Board precedence. Runtime Goal Tree decisions first pass this App's confirmation-field checks and the injected host provenance function; this App neither manufactures user authority nor implements proposal materialization. The existing method implementations are bound by the Host pending their own owner migration.

Dependencies are limited to public Contracts and the protected Goals Native Plugin entrypoint that publishes the execution-validation application Contract.

`createMcpContextPresenter` assembles the existing resolution response through typed Host ports: URL, guidance, connection acceptance, Session read, resume facts, then JSON. Guidance/URL failure cannot accept a new connection; an unavailable secondary Session still leaves the primary connection and recovery response visible. Session result fields are declared once in the Private Work Context Contract.

The Draft/Goal Tree/legacy proposal handlers now return promises and accept either the existing synchronous application or its `AsyncApplicationMethods` client. Production uses `createGoalProposalClients` over finite public capabilities; the old runtime scope fields have no callers and were removed. History validation still runs before invoking a write, and root awaits handler completion before serialization or Session activity recording. Goals, Execution and availability handlers also await typed Host Client operations.

`createGoalsEntryClient`, `createExecutionEntryClient` and `createGoalEntryCompositionClient` supply the remaining production handlers. Host combines Available/projections, trash/work state and planning methods/composition as named operations without an async gap between their owner calls. App handlers only validate wire data and present these completed facts. `client.withScope` retains the original open-before-adaptation and close-after-response lifetime without exposing Coordinator or Store. The legacy synchronous adapter factories remain compatibility exports.

## Commands

`validateGoalBoardMcpLauncher` owns the existing installer-to-MCP stdio probe: initialize, tool discovery, timeout/failure, and child cleanup. It consumes a host-owned `McpLauncherValidationContext`, not model arguments, and does not bind a project or write Runtime configuration. The installer retains confirmation, backup and rollback; its former embedded handshake now calls this public function. DV2 verifies the real launcher and failure rollback as well as the public Runtime lifecycle journey.

```bash
pnpm --filter @adeptify/goalboard-app-mcp typecheck
pnpm --filter @adeptify/goalboard-app-mcp build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-dv1`
- `goal-reorg-dv2`
- `goal-reorg-gw4`
- `goal-reorg-ex4`

## Legacy sources

- `src/mcp/`

GW4 moved Goal write, Lifecycle, and Planning calls through this adapter. EX4 moved execution and acceptance calls through the same public application port while preserving the existing MCP schema, errors, authority checks, and results. See [the architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md).
