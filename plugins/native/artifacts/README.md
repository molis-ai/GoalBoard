# @adeptify/goalboard-plugin-artifacts

DV3 author integration: `createPluginArtifactClient` binds a Runtime grant context, Manifest, project and actor to the existing public Artifacts API. Authors can publish personal versions of declared types and read supported exact references regardless of producer Plugin. It checks declared permissions and actual grants, rejects another user's personal content, and does not accept caller-supplied identity or Team sharing authority. Content/version rules remain in the Artifacts Module. This adapter is being connected to the developer Host; it alone is not a complete Plugin installation experience.

Status: `partial`
Workspace path: `plugins/native/artifacts`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/plugin`

## Purpose

Protected first-party Artifact browsing, embedding, and composition.

This package explicitly does **not** own Artifact facts, Stores, or producer/consumer implementations.

## Public entrypoint

`openArtifactProjectReference` opens existing result/file locators through injected public Evidence queries and the host's safe content reader. `ArtifactProjectReferenceError` preserves the existing 404/409 application failures. The Plugin checks the exact Evidence locator and verification status, prefers its recorded workspace, and returns only file name and bytes; it does not expose the reader's absolute file path.

`artifactReferenceUiContribution` renders the existing external/file/copy reference controls. Workbench registers it with UI Host and exposes `createArtifactReferenceRenderer`; legacy Goal/Evidence/Run renderers retain their call signature but no longer decide reference presentation. Styling, icons, request-local translation and copy behavior remain unchanged. The host injects UI primitives; this Plugin does not import another Plugin's renderer.

`readArtifactBrowser` reads Project-scoped exact versions through `ArtifactsQueryApi`; `matchArtifactBrowserRoute` requires explicit positive integer versions. `exportArtifactVersion` returns the exact local JSON record without registering, publishing, sharing or changing it. No consumer is inferred from producer identity.

`artifactBrowserUiContribution` provides `directory`, `detail` and `embed` surfaces; `ARTIFACT_EN` owns their English copy. Workbench mounts them and supplies the document shell, existing theme, icons and request locale. The root HTTP adapter binds the selected Project and public query to `/artifacts`, `/artifacts/:id/versions/:version` and `/api/artifacts/:id/versions/:version/export`; missing versions return 404 rather than latest. Consumer declarations are type/schema pairs supplied to the application; the current Web host supplies none. Raw JSON is not an application-specific preview, and a content locator is not a promise that today's file still matches an old version.

`readGoalArtifactEmbeds` consumes explicit `goal.input` / `goal.output` relations from the public Context Ledger query and resolves each exact Artifact version. Workbench mounts those results in the Goal's lazily loaded context panel. Missing versions retain their reference; unavailable/archived versions retain their state. No relation, payload or Goal snapshot is written by viewing. The reader never interprets legacy locators as Artifact identities or searches private Sessions for results.

## Dependencies

The only declared workspace dependency is `@adeptify/goalboard-contracts`. Implementation dependencies are added by the Goal that migrates a complete use case, never by deep-importing legacy code.

## Commands

```bash
pnpm --filter @adeptify/goalboard-plugin-artifacts typecheck
pnpm --filter @adeptify/goalboard-plugin-artifacts build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-ar1`
- `goal-reorg-ar3`

## Legacy sources

- `src/web/render.ts`
- `src/web/server.ts`

AR1 owns the formal Artifact Contract and Core. AR3 has moved the first existing Web project-reference caller here; filesystem containment, symlink, size and text checks remain in Evidence & Verification. No Artifact version is invented for a URL, file locator or private Work result, and opening a result does not mutate Goal, Evidence, Run or Review state.

The browser and Goal-context embedding now have real HTTP and navigation callers. Legacy string references keep their original identity and history while using the new contribution and application. No installation or Team-sync workflow is claimed. AR3 acceptance and the remaining full-product E2E are tracked separately; see [the architecture SSOT](../../../docs/SSOT-MATRIX.md) and [migration matrix](../../../docs/system/MIGRATION.md).
