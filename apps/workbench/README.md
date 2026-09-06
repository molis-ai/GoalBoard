# @adeptify/goalboard-app-workbench

Project work-rules settings mount Policy's `project` surface through `goals-policy-ui.ts`. The existing `PROJECT_RULES_CLIENT_SCRIPT` and `PROJECT_RULES_SETTINGS_STYLES` asset exports now forward the Goals-owned implementation; Workbench settings aggregates contain no copy of their code. Shared settings shell/navigation/control initialization remain Host-owned.

GW5 page/read composition: `createWorkbenchGoalsPageRenderer` assembles the existing full and refresh pages from Goals, Feed and Work owner output. Its generic view requires only collection/project navigation fields; it does not import the root Web model or own product facts. The root renderer binds finite content and Host primitives, retaining existing public signatures. Goals' first-level button is mounted from Tree's `root-entry` surface.

`renderWorkbenchGoalsReadRequest` and `renderWorkbenchGoalsPageRequest` reject unrelated/invalid requests before loading owner renderers, preserve collection lookup and asynchronous Project-operation ordering, and return HTTP-neutral results. `createWorkbenchGoalsFragmentRenderer` composes document/panel/records/event/quick-record/momentum owners with the original default arguments, null behavior and link-prefix ordering. Event ledger content, Execution/Decision and Quick Record composition remain with their original owners, not these adapters. Root HTTP still owns project isolation, authentication, scoped data reads and response headers/socket writes.

GW5 collection/refresh update: `goals-tree-ui.ts` mounts the public `directory`, `refresh` and `root-entry` surfaces. The Workbench page renderer consumes `buildGoalCollectionModel`, rather than the root owning Goal collection selection, labels or directory templates. `refresh-decisions.ts` binds the finite Goals refresh factory, supplies only navigation summaries and parsed owner HTML, and applies it after checking the original interaction/selection guards. Workbench retains cursor/fallback fetching, Decision/Feed handling, Shell links, shared UI-state restore and collection-move navigation. Goals clients do not acquire another owner's Store, execution authority or content.

`renderWorkbenchPlanningRequest` composes personal/project Planning GET pages using the Plugin's route and method selector. The Host provides already-resolved methods and the existing library/method page renderers; it retains workspace isolation, method writes/adoption and HTTP responses. Project new-method pages do not query effective methods. Invalid/unrelated paths never load page owners, and missing/scope-mismatched methods do not render them.

AR3 adds `artifactWorkbench.page` and `artifactWorkbench.embed`, both mounted through UI Host from the official Artifact contribution. Workbench owns the existing directory/detail layout and responsive document composition, not version selection or compatibility policy. The HTTP host supplies the selected Project's public Artifact query, locale and safe primitives. Artifact navigation uses an ordinary Project-prefixed link, preserving the existing Goal/Feed/Work in-page behavior.

`artifactWorkbench.goalContext` composes the explicit input/output embeds in the existing Goal context slot. `ARTIFACT_EMBED_STYLES` inherits the current theme; the host loads relations only for the requested visible Goal's context panel. Version selection and missing/unavailable/archived decisions remain in the public Artifact application, not Workbench.

AR3: `createArtifactReferenceRenderer` mounts the Native Artifacts reference contribution through the same UI Host. It preserves the existing result-link call signature; the host supplies escaping, icons and request-local translation. Workbench does not decide Evidence validity, choose source workspaces or read files.

Status: `partial`  
Workspace path: `apps/workbench`  
Contract entrypoint: `@adeptify/goalboard-contracts/platform/app-host`

## Purpose

Local product UI composition root for the Workbench. It owns the stable HTML document shell, named directory/main/overlay slots, and the execution-validation UI contribution, then mounts Native or Installed Plugin UI through UI Host.

This package explicitly does **not** own Business Stores, Node-only implementations, or Tauri commands.

## Public entrypoint

`src/index.ts` is the local UI composition root. It renders the stable document shell, declares Workbench slots, registers the official Feed Native Plugin, and binds Goal and execution-validation routes to public application ports. `src/execution-validation-ui.ts` renders Claim, Run, Evidence, and Review views from that public model. It does not own Goal/Feed facts, SQL, connector behavior, or Tauri commands.

## Dependencies

Dependencies are limited to public entrypoints from Contracts, UI Host, and the official Goals/Feed/Work Native Plugins.

WK3 adds the Work Session and terminal UI contributions. `work-ui.ts` supplies directory/main/overlay placement; `terminal-client.ts` only starts the Work-owned browser client. The root asset build keeps the existing `/desktop/pty-client.js` URL. Session state presentation, context autofill and terminal lifecycle rules live in Work, not in the Workbench bootstrap.

GW5 also registers `goalsRelationUiContribution`: `goals-relation-ui.ts` only mounts relation forms/lists. The Plugin owns all nine relation labels, direction previews and create/deactivate handlers. Dependency-proposal history remains separate owner-rendered input. Workbench's original browser concatenation points import the Plugin's script fragments; they no longer define relation behavior inline.

`goals-tree-ui.ts` mounts Plugin-owned tree/list and toolbar surfaces in `workbench.directory`. It neither traverses Goal relations nor computes status/progress. Root legacy callers consume Plugin presentation exports through Workbench; host-provided status markup and shared browser refresh/navigation remain explicit pending work, not a completed GW5 claim.

`goals-document-ui.ts` mounts Goals normal/archive/trash documents and overview through the main slot. Draft-gap and Companion Runtime content are explicit trusted owner inputs assembled by the legacy composition root; the adapter owns no product templates or permissions. Shared tab switching immediately updates visible state and returns its loading result so the draft primary action can await the real editor before focusing it. The legacy editor, detail subpanels, remaining document browser handlers and routes still require GW5 migration.

`goals-context-ui.ts` also mounts the Plugin's Context panel, acceptance/summary/scope and draft editor/gap surfaces. Record and Human Review callers reuse the public summary surface without moving their owning workflows. Draft criterion/save fragments are imported at the existing browser composition points; no payload normalization or product template is copied into Workbench. The remaining Planning, progress/record composition, shared status and routes are tracked in GW5.

Tree search/filter/collapse/keyboard fragments now come from the Goals Plugin too. Shared refresh, UI-state persistence, Graph interaction and cross-module navigation remain owned at their original composition points until their separate migrations; the assembled production script is checked for exact parity when transferring ownership.

Momentum graph interaction has now moved too: `goals-momentum-ui.ts` only mounts Plugin full/placeholder surfaces, and browser composition binds the Plugin's public momentum factory; viewport binding stays internal to that Plugin. Shared workspace mode, refresh and saved UI state remain Host dependencies; no graph calculation, lifecycle decision or product template is copied into this adapter. The public fragment renderer now composes collection selection and URL prefixing; root only supplies the owner and Host primitive.

## Commands

```bash
pnpm --filter @adeptify/goalboard-app-workbench typecheck
pnpm --filter @adeptify/goalboard-app-workbench build
```

## Migration Goals

- `goal-reorg-f2`
- `goal-reorg-ap3`
- `goal-reorg-fd4`
- `goal-reorg-gw4`
- `goal-reorg-gw5`
- `goal-reorg-ex4`

## Legacy sources

- `src/web/`

FD4 switched Feed UI composition, GW4 switched Web Goal writes to the public Goals application port, AP3 moved the document shell plus slot validation here, and EX4 moved Claim/Run/Evidence/Review presentation plus the execution-validation adapter here. Accepted GW5 is moving the remaining Goals UI and copy: `goals-policy-ui.ts` and `goals-safety-ui.ts` now mount Plugin-owned Policy/Risk/Impact surfaces through the public UI Host API. These adapters own no templates or business rules. Other Goals pages, clients and route composition remain pending. See [the architecture SSOT](../../docs/SSOT-MATRIX.md) and [migration matrix](../../docs/system/MIGRATION.md).

GW5 Planning: `goals-planning-ui.ts` only mounts the Native Goals contribution. Product body/links/client/style/copy and the public Planning page matcher belong to that Plugin; Workbench exports the matcher for the HTTP host. Settings navigation/frame and public Goals API composition remain host responsibilities. The adapter does not save methods or recompute Planning rules.

GW5 Status/Factors/Dialogs: `goals-status-ui.ts`, `goals-factors-ui.ts` and `goals-dialogs-ui.ts` only mount public contributions (main for status/factors, overlay for dialogs). Goal/action explanations, badge markup, factor tabs, create/trash templates and their dedicated browser handlers now live in Native Goals. The host only wires public inputs and existing shared dependencies. Decision/Execution compound UI, shared navigation and remaining routes are separate unfinished work; no module facts or permission decisions move into these adapters.

`goals-document-routes.ts` composes the owner callbacks selected by the Plugin's parsed route. It contains no HTTP objects, Store, path regex, product HTML or permission decision. Root HTTP dispatch supplies the view and explicit Artifact/record renderers, retains error statuses and no-store/nosniff headers, and calls the public parser only for GET. Main document, panel and record loader fragments now belong to Native Goals; Workbench keeps shared UI state/navigation, cross-owner deep links and refresh assembly. See GW5 progress for pre/post HTTP checks and real-browser late-response verification.

Goal selection/history, Goal-only tab rendering/limits/keyboard/clicks, lazy-panel retry, event pagination, editor opening and explicit current/archive actions now come from public Native Goals script exports. Workbench inserts them at the original event positions; it does not duplicate handlers. `renderWorkTabs` still combines the Goal fragment with utility tabs and binds the pane's ARIA label. Shared `applySelection` publishes the TUI event, while storage, generic focus decks and cross-surface refresh stay here. Initial Goal tab and empty collection markup mount the existing document contribution. This is an ownership migration within the existing client assembly, not a claim that the entire shared bootstrap has been retired.

Record basics/readonly relations and progress risk/check summaries now mount the existing Context/Safety/Policy contributions. Adapters do not render those templates or compute authority. The public `buildGoalsNavigationItems` re-export produces minimal initial/refresh Goal summaries; Host still combines Project/Board/cursor and escapes the embedded JSON. Execution/history/Companion composition is excluded from GW5: EX4 is canonically complete, so any remaining cross-owner cutover must be audited explicitly rather than silently counted as new GW5 work.

Main-document initialization now binds the public Goals browser factory to explicit Host ports in `refresh-decisions.ts`. `beforeReplace` cancels the existing panel/Quick Record requests; `afterReplace` restores relation/risk previews and panel/hash state, preserving their order and owners. Main-document request state is local to the Goals instance rather than `bootstrap.ts`. Workbench still owns cross-surface refresh, saved state and TUI notification; other lexical feature fragments remain pending. Run combined browser regressions with the repository's `--test-concurrency=1` policy.

`documents-state.ts` also instantiates the public panel and records factories. It injects focus/reveal, deferred persistence, cross-owner preview callbacks and the records API; the panel/factor keys and both request controllers no longer live in bootstrap. Click/keyboard listeners call finite owner handlers at the original positions. Record pagination returns a promise only when its button matched, keeping unrelated click dispatch synchronous. Panel/record cancellation clears the cancelled UI immediately and late replies are ignored. Record content and Execution/Decision authority are not transferred by this client migration.

Navigation, Goal tabs and draft editing now instantiate their public Native Goals factories. Bootstrap binds the tab instance with deferred shell/select/toast callbacks and storage access using the unchanged project key; it no longer owns the open Goal list. `navigation-feed.ts` appends Goal tabs then the original utility tabs and pane ARIA labels. `refresh-decisions.ts` binds navigation with live selected/active getters and existing applySelection/load/save ports; `initialization.ts` registers the returned history handlers. `editing-graph.ts` binds draft editing, deferring later-defined refresh/panel functions. Event listeners call finite handlers at the original positions and await only matched operations. Existing UI behavior and HTTP payloads are unchanged; no new dispatcher, state registry or compatibility exports were introduced.

Tree and Momentum clients now bind finite Host factories, not captured startup variables. Tree owns status/IME state, selection highlighting/ancestor expansion and collapsed-state read/restore; Momentum owns filter/period/selection/zoom/autofit/request state, with its internal viewport owning observation and pointer geometry. `documents-state.ts` preserves the old UI-state field names and restore order through finite methods, while side-panel/window resize calls `scheduleGoalGraphLayout`. Shared search busy/deferred refresh still serves Feed as well as Tree and remains here. No duplicate shared scheduler, new registry or generic dispatch bus was added.

Lifecycle, dialogs, relation, ordinary Risk facts, Impact and Policy now instantiate finite public Goals factories in `editing-graph.ts`. Later-defined shared callbacks are deferred. The browser locale port reads the existing document language; no server-only locale function is captured. Dialog-local controls/intent and create-draft snapshot/focus/choice replacement have left bootstrap/refresh; refresh only passes the new dialog and saved draft. Event files have no old Goals fragment imports and invoke matched handlers at their original positions. Each feature owns its payload builder; generic validation, feedback, shared refresh and Risk decision/Human Review remain with their existing owners. This does not declare the remaining cross-owner application composition retired.
