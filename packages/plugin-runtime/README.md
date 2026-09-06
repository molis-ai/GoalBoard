# @adeptify/goalboard-plugin-runtime

Status: `partial`  
Workspace path: `packages/plugin-runtime`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/plugin`

## Purpose

Plugin identity, install, grants, isolation, lifecycle, and rollback boundary.

This package explicitly does **not** own Module business facts or provider-specific protocols.

## Public entrypoint

`src/index.ts` exports the in-process reference Runtime: definition registration, signature-bound installation identity, Manifest grant ceiling, start, crash reporting, bounded recovery, uninstall, Receipts, and an injectable repository/executor boundary.

DV3 Host clients use the same Runtime grant context. Each start/recovery gets a new context; failed start, crash and successful uninstall revoke it. Retaining an old client does not regain access after recovery. This controls the exposed Host APIs, not arbitrary in-process JavaScript; it is not a claim of OS sandboxing.

`SqlitePluginPrivateStorage` owns opaque string values in its separate table, partitioned by Runtime install ID. The Host supplies a database and obtains a grant-checked per-Plugin client; authors cannot supply SQL, paths or namespaces. A successful non-retaining uninstall must be followed by the Host's `deleteInstallationData`; ordinary uninstall retains data and never deletes exchanged Artifacts. A failed stop during uninstall records crashed and revokes access so a retry can finish.

## Dependencies

The only workspace dependency is the public Plugin Contract. Provider protocols and Module Stores are deliberately absent.

## Commands

```bash
pnpm --filter @adeptify/goalboard-plugin-runtime typecheck
pnpm --filter @adeptify/goalboard-plugin-runtime build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-fd3`
- `goal-reorg-dv3`

## Legacy sources

- `src/install/`

`SqlitePluginRuntimeRepository` persists installation records through an injected database port. `loadDevelopmentPlugin` validates the Manifest and contained entrypoint before loading explicitly trusted local source, then checks the exported definition matches. Package verification authenticates bundled bytes against an explicitly trusted Ed25519 key; it does not execute the package or authorize a different source directory.

FD3 supplies the first real Contract → Runtime → official Plugin → Listener/Signal caller slice. DV3 adds durable developer state; production distribution and process isolation remain separate work. See [the developer guide](../../docs/platform/PLUGIN-DEVELOPMENT.md), [architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md).
