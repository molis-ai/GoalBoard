# @adeptify/goalboard-app-desktop

Status: `partial`  
Workspace path: `apps/desktop`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/app-host`

## Purpose

GoalBoard macOS product shell and native bridge composition root.

This package explicitly does **not** own Business facts, Module rules, or Runtime state.

## Public entrypoint

`src/index.ts` exposes native-shell detection/bootstrap, Runtime launch recipes, guarded advance prompts, Desktop Panel lifecycle and the Capsule presentation shell. The legacy `src/desktop/` and `src/web/desktop-shell.ts` files have been removed; callers use this public package.

## Dependencies

`AliasDesktopPanelSessionInput` now has its sole definition in the App Host Contract; the Desktop entrypoint re-exports it. Alias behavior and persistence still belong to the existing Desktop Panel service. Local Host consumes it when connecting a late native Session to its original panel.

The app depends on public Contracts and the Feed native Plugin's external-content redactor. Panel persistence and Project context are injected ports. It does not deep-import legacy code, import SQLite, or own Module Stores.

The native adapter source lives under `adapters/tauri/src/`, split into window/Capsule composition, PTY, managed Web service and Runtime environment responsibilities. `../../desktop/src-tauri/` remains distribution configuration and points its binary at this adapter.

The public native bootstrap reads Tauri's real fullscreen state on page load and window resize. It publishes `data-native-fullscreen` and one `--desktop-window-safe-inline-start` value: 88px in a window, 2px in fullscreen. Workbench, settings and onboarding consume that same inset; maximization and viewport width are not fullscreen signals. The 48px Workbench titlebar places its controls at a visible 22px center in the packaged macOS App, matching the traffic lights. See `specs/native-titlebar-alignment/spec.md` for real-window verification and browser compatibility coverage.

## Commands

DV4 release tooling lives under `tooling/`: build, verified Node download/runtime preparation, App install/start and release-version checks. Root `pnpm desktop:*` commands call these files; they are not a second application package. `prepare-runtime-payload.mjs` consumes Local Host's public `createGoalBoardRuntimePayload`, verifies native dependencies and CLI using the payload's Node with the payload as cwd, then replaces generated resources. A failed preparation leaves the previous resources untouched. It does not run npm install over unresolved `workspace:*` manifests. Node checksum and target-architecture checks remain in the shell preparation step.

The Local Host dependency is for this release composition; Desktop still does not own installer rules or Module Stores. Tauri configuration remains under `desktop/src-tauri`; final DMG/signing/notarization and installed recovery acceptance are not implied by payload tests.

The release command preserves an explicit `APPLE_SIGNING_IDENTITY`; when absent, it explicitly selects ad-hoc (`-`). Before exporting DMG/zip and their SHA256 sidecars, it verifies the App signature and then reports the artifact's actual signing metadata. Local integrity verification is not notarization or Gatekeeper approval. The GitHub release workflow is currently manual-only; this migration does not enable automatic publication. Desktop first-run verification still uses the existing fixed 4173 endpoint and user LaunchAgent label, so changing GOALBOARD_HOME alone does not isolate it from a running user service.

```bash
pnpm --filter @adeptify/goalboard-app-desktop typecheck
pnpm --filter @adeptify/goalboard-app-desktop build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-ap4`
- `goal-reorg-dv4`

## Legacy sources

- `desktop/`
- `src/desktop/`

AP4 moved the real callers, Desktop Panel rules, Capsule presentation and Tauri source into this boundary while preserving existing behavior. System notifications and a Desktop Keychain were not present in the baseline and are not represented by fake implementations. Final install/sign/notarize/SBOM validation remains DV4. See [the Desktop boundary](../../docs/platform/DESKTOP.md), [architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md).
