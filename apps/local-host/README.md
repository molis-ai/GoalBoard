# @adeptify/goalboard-app-local-host

DV3: `PluginHostExecutor` composes the existing Runtime context with private storage, protected Artifact access and UI registration as `context.services`. Authors receive no database or module implementation. UI registrations are disposed after failed start and all stop attempts. The public `runPluginDevelopment` fixture is used by `goalboard plugin dev` for real install/start/health/poll/render/uninstall with retained developer data. The executor remains trusted in-process execution, not an OS sandbox. See the [developer guide](../../docs/platform/PLUGIN-DEVELOPMENT.md).

Status: `partial`  
Workspace path: `apps/local-host`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/app-host`

## Purpose

The single local composition root for Modules, services, plugins, and storage.

This package explicitly does **not** own a second business coordinator or user-facing product shell.

## Public entrypoint

DV4: the former `src/install/` implementations are removed. `RuntimeIntegrationService` owns explicit Runtime configuration / Skill preview, confirmation and rollback; its six implementation files separate adapters, text preservation, file IO, planning and execution. Launcher validation consumes the MCP App public API.

`installGoalBoardHome` requires an explicit `sourceDirectory`. Only the root CLI supplies the default product root from its own entry location. Source inspection, production dependency collection, release staging/promotion/rollback, launchers and the install transaction have separate owners under `installer/`. `writeGoalBoardBuildManifest` owns build inputs, including workspace source/configuration; `apps/local-host/tooling/write-build-manifest.mjs` is only the invocation adapter. Build output and node_modules are not source inputs.

`GoalBoardWebServiceManager` preserves detect/prepare/confirm and separates platform configuration/health/IO, read-only detection, launchctl transitions, recovery transactions and plan policy. `GoalBoardUninstallService` takes an explicit `UninstallProjectAccess`: it never opens or queries a project database. The root `src/local-host/uninstall.ts` composes a read-only Projects inspection and the remaining catalog Demo-deletion lifecycle. Unknown ownership, exact purge confirmation, stale plans and failure receipts keep their existing behavior. `resolveWebControlToken` and its relative path also have one Local Host owner for Web and uninstall.

`createGoalBoardRuntimePayload` accepts a built source, a new output directory and a verified Node executable. It reuses source inspection, recursive dependency collection and release creation; it neither installs a Home nor starts a service. Existing outputs are rejected and partial staging is removed on failure. Shared release assets include vendor tarballs/provenance/SBOM, license and READMEs, and are included in the source-content digest. No vendor is turned into a business package.

DV4 migration review passed on 2026-09-06. Current npm consumer, macOS App/DMG, installed upgrade/recovery and legacy-output removal have separate production-path evidence in the [DV4 validation](../../specs/goalboard-architecture-reorganization/dv4-validation.md). This is internal migration verification, not Apple notarization, public release, an update to the user's installation or whole-product E2E certification. See [installation](../../docs/installation.md) for distribution boundaries.

`LocalHost` discovers one runtime per Project storage key, exposes a typed `LocalHostProjectClient`, serializes Capability calls, and owns runtime close/reopen. Concurrent clients for the same Project reuse the same runtime rather than opening competing writers.

`src/project-host.ts` opens the single project database and application, while `src/project-capabilities.ts` binds public capabilities to their owners. Web, CLI, and MCP consume the public Host; Desktop consumes it through Web. The old root composition adapter has been removed.

The AP2 transport is embedded/in-process and supports explicit Host injection. A standalone daemon or cross-process transport is not claimed here; the Client Contract is kept independent from those future deployment choices.

`openWorkSessionRegistry` composes the public Private Work Context and Context Ledger factories on one local transaction connection. Web/MCP callers use this entrypoint; it contains no Session association or lifecycle rules. Closing the returned Registry closes its owned connection as before.

`prepareLocalProjectStorage` resolves the storage path and either prepares a parent directory for creation or reports an existing location as missing. It does not open a runtime, create a database, select a Project or authorize a write. CLI and MCP preserve their own error presentation while sharing this preparation path.

The compatibility composition registers the Goals Plugin's public initialize/snapshot/create, V3-import, project-resume-facts and trashed-Goals capabilities. Input/output types and declarations have one public owner; old root exports remain compatibility aliases. Import delegates to the existing migration implementation. Resume combines one snapshot with the public execution-validation query; trash combines the public Goal query with its event cursor. Callers no longer access a Store for these operations. These handlers do not copy import rules, derive lifecycle policy or decide the MCP display order.

Goals, Execution and availability are registered through their finite public entry capabilities. Available/action projections, trash/work state and planning methods/composition retain uninterrupted owner calls inside one handler, without a second transaction or copied business rule. The CLI/MCP runtime application fields have no callers and were removed; Workbench's separate migration can still use the compatibility composition port.

## Dependencies

`runtimeGoalTreeDecisionAuthority` composes the existing audit reference from host Session identity and already-validated dialogue fields. It preserves the original attestation digest and embedding fallback; it does not inspect model context, decide whether a proposal is valid, or grant extra domain authority. The compatibility root registers public full-Contract, project-guidance and active-goal capabilities against the same original owners, without duplicating their rules.

`RuntimeProjectConnection` manages only the existing in-process resolved-connection cache. An explicit injected connection retains its embedding behavior; host Session/workspace changes invalidate a resolved connection and preserve the resolve-and-retry state until a resolution is accepted. It does not establish or persist a binding. Public runtime/project context request/result types live in the Private Work Context Contract; the cross-owner catalog provider and host configuration types live in the App Host Contract.

`createRuntimePanelSessionLinker` composes late native Session aliasing with the existing Desktop owner and Registry migration/link commands. Its scoped catalog callbacks are injected by the root; Registry closure is guaranteed, and only the host-classified missing-Panel error is ignored. It introduces neither a transaction across both stores nor an automatic retry.

`runtime-context.ts` owns host environment ingestion and separates GoalBoard Session, native Runtime Session, legacy work-context, panel, Goal and workspace identities. The old MCP and Session exports remain aliases for compatibility. Inputs are host-provided; no model argument becomes a Session identity or binding.

`RuntimeSessionHost` owns Registry resource lifetime around migration, context reads and secondary activity recording. It consumes a typed activity, finds the Session through the Private Work Context public query, checks its Project and calls the existing association/event commands. The legacy catalog reconciliation callback is explicitly injected by the current composition root; this package does not open or import that catalog. A failed activity index write preserves the committed Goal result and remains visible on later context reads.

The compatibility Host registers the protected Goals Plugin's named `draftDialogueCapabilities`, `goalTreeCapabilities` and `legacyProposalsCapabilities` against the same Coordinator. CLI/MCP obtain asynchronous application clients from `createGoalProposalClients`; the former `draftDialogue`, `goalTree` and `legacyProposals` fields have been removed from the temporary runtime scope after their callers migrated. Resume and proposal check are commands because their existing implementations persist state. Goals/Execution/Available groups now also use typed Client operations; the temporary availability field has been removed.

The package consumes App Host Contracts, Kernel and the public Private Work Context / Context Ledger construction entrypoints. Module-to-Module calls remain Contract-only; only this application composition layer constructs both owners. It does not import legacy Stores.

`LocalHostProjectClient.withScope` opens the runtime before invoking the caller, supplies only the Client, and holds the existing active-use resource reference through response composition. It does not put the entire callback in the capability queue; nested `invoke` calls still use the normal queue without deadlock. Closing waits for the response scope. Opening failures occur before wire adaptation, preserving existing entrypoint error ordering.

## Commands

Web diagnostics use `GoalBoardWebServiceManager.confirmFromWeb` for a restart of the serving process. It consumes the same validated plan, returns a pending `restarting` result, and supplies a one-shot `afterResponse` operation. The HTTP adapter sends 202 before invoking it. Local Host uses launchd's loaded-job restart rather than booting out its own caller; the Workbench verifies a different healthy service PID plus managed running status before reporting success. CLI and non-self operations retain synchronous `confirm` semantics. Cancel and stale-plan checks are unchanged. Do not execute the deferred operation before flushing the response or label the pending result as completed.

```bash
pnpm --filter @adeptify/goalboard-app-local-host typecheck
pnpm --filter @adeptify/goalboard-app-local-host build
```

## Migration Goals

DV4 also owns `createGoalBoardNpmPackageDirectory` and `tooling/pack-npm.mjs`. They reuse installer build freshness and dependency discovery, stage declared distribution assets, bundle local workspace/vendor packages and leave registry/native dependencies to the consumer. Root `pnpm package:npm` builds first; staging never changes source manifests or publishes to a registry. Desktop uses the separate self-contained runtime payload with bundled Node and native dependencies for its target architecture.

- `goal-reorg-f2`
- `goal-reorg-ap2`

## Legacy sources

- `src/web/server.ts`
- `src/cli/`
- `src/mcp/`

AP2 supplied the first real Contract → capability registry → Local Host → CLI/MCP/Web caller → compatibility-test slice. See [the architecture SSOT](../../docs/SSOT-MATRIX.md), [Local Host design](../../docs/platform/LOCAL-HOST.md), and [migration matrix](../../docs/system/MIGRATION.md).
`readPersonalPlanningMethodPacks` locates the existing Home catalog and delegates the readonly personal library to Goals. Missing Home or pre-library catalogs return an empty list without provisioning or schema writes. All connections close after the read; Home path selection stays in Local Host, while SQLite access, method facts and validation stay in Goals.
