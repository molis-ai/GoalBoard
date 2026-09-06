# @adeptify/goalboard-plugin-sdk

Status: `partial`  
Workspace path: `packages/plugin-sdk`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/plugin`

## Purpose

Stable author-facing Plugin APIs, UI extension types, and testing entrypoints.

This package explicitly does **not** own Internal Host implementations or an automatically published marketplace.

## Public entrypoint

`src/index.ts` exports Manifest validation, `definePlugin`, and the polling Integration helper that converts a provider-neutral port into a Connector Driver plus Raw Event → Signal Adapter contribution.

DV3: Manifest rules now live in the public Plugin Contract's `parsePluginManifest`; SDK `assertManifest` delegates and retains `PluginDefinitionError`. The CLI uses the same parser for untrusted JSON. Typed valid definitions keep their original identity/version and polling behavior.

Author-facing Plugin, Artifact client/reference and UI contribution types are re-exported publicly. The protected Artifacts Plugin implements the Host-bound `publish`/`read` client; the SDK does not create an Artifact Store. Local Host injects private storage, Artifact and UI clients through `context.services`. See the [developer guide](../../docs/platform/PLUGIN-DEVELOPMENT.md) for the real CLI workflow and public Local Host testing fixture.

## Dependencies

The only workspace dependency is the public Plugin Contract. The SDK does not import Runtime internals, any Module implementation, or another Plugin.

## Commands

```bash
pnpm --filter @adeptify/goalboard-plugin-sdk typecheck
pnpm --filter @adeptify/goalboard-plugin-sdk build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-fd3`
- `goal-reorg-dv3`

## Legacy sources

- The pre-FD3 connector wrapper embedded in `src/feed/connectors/service.ts`.

FD3 supplies the first real Integration authoring surface; DV3 adds the local author workflow. Production distribution and process isolation are separate from this trusted-source development path. See [the architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md).
