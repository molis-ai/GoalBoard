# @adeptify/goalboard-plugin-work

Handoff preparation passes the actual Goal Contract revision to Work's public draft command. Work's cross-module source/target endpoints are recorded through Ledger; encrypted private content and delivery state remain with Private Work Context. Preparing or sending a private Handoff does not automatically publish an Artifact or Team content. Existing edit, native/fallback delivery, retry and cancellation behavior is preserved.

Status: `partial`
Workspace path: `plugins/native/work`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/plugin`

## Purpose

First-party Session, Runtime, resume, and handoff product UI.

This package explicitly does **not** own Session/Run/Goal facts or Runtime adapter implementations.

## Public entrypoint

`src/index.ts` exposes Session creation/discovery, content/resume, handoff preparation/delivery and TUI recording. Applications supply `WorkSessionApi` and `RuntimeHostApi`; the Plugin never opens a database or writes another owner's Store. Handoff draft coordination, delivery/recovery and package rendering are separate implementation units.

Work UI contributes Session directory/detail/dialog surfaces through UI Host. Content/resume, directory navigation, creation, associations and handoff browser initializers have explicit inputs and separate local state. Session HTTP handlers preserve the existing project checks, confirmation rules and public serialization; Local Host supplies authentication, HTTP IO and workspace checks.

The public `terminal-client` entry starts the browser UI from Workbench. Terminal channel authentication/reconnect, panel lifecycle, context autofill, and xterm rendering have independent controllers. Browser code is typechecked with the package; Workbench retains the asset bootstrap and the existing public asset URL.

Work also owns the Session/workspace read model, terminal markup, panel HTTP flow and workspace recovery coordination. The Host supplies public Project/Session/Panel APIs, authenticated HTTP IO and filesystem observations. No Store or implementation dependency crosses into the Plugin. See [WK3 validation](../../../specs/goalboard-architecture-reorganization/wk3-validation.md).

## Dependencies

The only declared workspace dependency is `@adeptify/goalboard-contracts`. xterm and its fit addon belong to this package's terminal rendering. Implementation dependencies are added by the Goal that migrates a complete use case, never by deep-importing legacy code.

## Commands

```bash
pnpm --filter @adeptify/goalboard-plugin-work typecheck
pnpm --filter @adeptify/goalboard-plugin-work build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-wk3`

## Legacy sources

- `src/web/render.ts`
- `src/web/server.ts`
- `src/web/pty-client.ts`

The production Web server and Workbench consume these public entries. Full regression passed 535 tests; final workspace recovery cutover passed 90 targeted tests. This does not replace final whole-product simulated-user verification. See [the architecture SSOT](../../../docs/SSOT-MATRIX.md) and [migration matrix](../../../docs/system/MIGRATION.md).
