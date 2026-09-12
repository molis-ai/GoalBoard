/** The canvas composition belongs to Workbench; Goal and Work keep their own content. */
export const GOAL_CANVAS_STYLES = `
  .immersive-plugin-stage > .goal-canvas-shell { position: absolute; inset: 0; min-width: 0; min-height: 0; overflow: hidden; overscroll-behavior: contain; background: var(--canvas); }
  .goal-canvas-shell [hidden] { display: none !important; }
  .goal-canvas-shell .goal-canvas-map { position: absolute; inset: 0; width: 100%; height: 100%; display: block; padding: 0; margin: 0; overflow: hidden; background: transparent; }
  .goal-canvas-viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; cursor: grab; background-image: radial-gradient(circle, color-mix(in srgb, var(--muted) 28%, transparent) .8px, transparent .9px); background-size: 22px 22px; }
  .goal-canvas-viewport.is-panning { cursor: grabbing; user-select: none; }
  .goal-canvas-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
  .goal-canvas-edges { position: absolute; width: 1px; height: 1px; overflow: visible; pointer-events: none; }
  .goal-canvas-edges g path { fill: none; stroke: color-mix(in srgb, var(--muted) 62%, var(--line)); stroke-width: 1.5; }
  .goal-canvas-edges marker path { fill: var(--muted); }
  .goal-canvas-edges .is-selected-path path { stroke: var(--blue); stroke-width: 2; }
  .goal-canvas-node { position: absolute; inset: 0 auto auto 0; width: 258px; height: 190px; padding: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; background: var(--paper); color: var(--ink); border: 1px solid var(--line-strong); border-radius: 12px; text-align: left; cursor: pointer; touch-action: none; }
  .goal-canvas-open { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 5px; color: var(--muted); background: transparent; cursor: pointer; }
  .goal-canvas-open svg { width: 15px; height: 15px; }
  .goal-canvas-open:hover { color: var(--ink); background: var(--rail); }
  .goal-canvas-node > .goal-status { max-width: calc(100% - 26px); }
  .goal-canvas-node:focus-visible, .goal-canvas-open:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
  .goal-canvas-node:hover { background: color-mix(in srgb, var(--blue-soft) 30%, var(--paper)); }
  .goal-canvas-node.is-selected { border-color: var(--blue); }
  .goal-canvas-node.is-complete { background: color-mix(in srgb, var(--rail) 45%, var(--paper)); }
  .goal-canvas-node.is-expanded-node { visibility: hidden; }
  .goal-canvas-node strong { font-size: 16px; line-height: 1.5; font-weight: 630; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex-shrink: 0; }
  .goal-canvas-node-outcome, .goal-canvas-node small { color: var(--muted); font-size: 12px; line-height: 1.6; }
  .goal-canvas-node-outcome { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .goal-canvas-node small { padding-top: 3px; border-top: 1px solid var(--line); width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .goal-canvas-map-heading { position: absolute; top: 22px; left: 26px; z-index: 1; pointer-events: none; max-width: calc(100% - 52px); }
  .goal-canvas-map-heading h1 { font-size: 17px; margin: 0 0 6px; }
  .goal-canvas-map-heading p { margin: 0; font-size: 12px; color: var(--muted); }
  .goal-canvas-tools { position: absolute; inset: auto 22px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; pointer-events: none; }
  .goal-canvas-tools > span { font-size: 11px; color: var(--muted); }
  .goal-canvas-tools > div { pointer-events: auto; display: flex; align-items: center; gap: 4px; padding: 4px; background: var(--paper); border: 1px solid var(--line); border-radius: 9px; }
  .goal-canvas-tools button { width: 32px; height: 32px; display: grid; place-items: center; border: 0; background: transparent; color: var(--ink); cursor: pointer; border-radius: 6px; font-size: 17px; }
  .goal-canvas-tools button:hover { background: var(--rail); }
  .goal-canvas-tools output { min-width: 48px; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; }
  .goal-canvas-tools svg { width: 16px; height: 16px; }
  .goal-canvas-shell[data-expanded="true"] .goal-canvas-map-heading, .goal-canvas-shell[data-expanded="true"] .goal-canvas-tools { visibility: hidden; }
  .goal-canvas-empty { position: absolute; top: 35%; left: 15%; right: 15%; text-align: center; }
  .goal-canvas-empty h2 { font-size: 23px; }
  .goal-canvas-empty p { color: var(--muted); font-size: 14px; }
  .goal-canvas-empty button, .goal-canvas-map [data-retry-goal-momentum] { background: var(--paper); color: var(--blue); border: 1px solid var(--line-strong); border-radius: 7px; padding: 9px 14px; cursor: pointer; }
  .goal-canvas-map [data-goal-momentum-status] { position: absolute; bottom: 74px; left: 26px; right: 26px; padding: 12px; background: var(--paper); color: var(--ink); font-size: 13px; }
  .goal-canvas-map [data-retry-goal-momentum] { position: absolute; bottom: 25px; left: 26px; }
  .goal-node-workspace { position: absolute; inset: 24px; z-index: 3; background: var(--paper); border-radius: 12px; box-shadow: 0 12px 40px #08091035; overflow: hidden; display: flex; flex-direction: column; min-width: 0; min-height: 0; container: goal-workspace / inline-size; }
  .goal-canvas-shell[data-expanded="true"]::before { content: ""; position: absolute; inset: 0; z-index: 2; background: #11121655; pointer-events: none; }
  .goal-node-toolbar { flex: none; min-height: 64px; display: flex; justify-content: space-between; align-items: center; padding: 12px 18px 12px 24px; gap: 16px; border-bottom: 1px solid var(--line); }
  .goal-node-heading { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .goal-node-heading h1 { margin: 0; min-width: 0; font-size: 16px; line-height: 1.5; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .goal-node-heading > span { font-size: 10px; color: var(--muted); white-space: nowrap; flex: none; }
  .goal-node-actions { display: flex; align-items: center; gap: 4px; }
  .goal-node-toolbar button { display: grid; place-items: center; height: 30px; width: 30px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .goal-node-toolbar button:hover { background: var(--rail); color: var(--ink); }
  .goal-node-toolbar svg { width: 16px; height: 16px; }
  .goal-node-workbench { position: relative; flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) 300px; grid-template-rows: minmax(0, 1fr); }
  .goal-node-workspace[data-details-open="false"] .goal-node-workbench { grid-template-columns: minmax(0, 1fr); }
  .goal-work-main { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); grid-column: 1; grid-row: 1; overflow: hidden; }
  .goal-work-modebar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 22px; font-size: 10px; color: var(--muted); }
  .goal-work-modebar > [role="tablist"] { display: flex; gap: 4px; }
  .goal-work-modebar button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 6px; padding: 6px 9px; font: inherit; font-size: 11px; color: var(--muted); background: transparent; cursor: pointer; }
  .goal-work-modebar button[aria-selected="true"] { background: var(--rail); color: var(--ink); }
  .goal-work-modebar svg { width: 13px; height: 13px; }
  body.immersive-workbench .goal-node-workbench > .document-pane { display: flex; grid-column: 2; grid-row: 1; padding: 0; margin: 0; border: 0; border-left: 1px solid var(--line); min-width: 0; min-height: 0; width: auto; overflow: hidden; position: static; background: color-mix(in srgb, var(--rail) 30%, var(--paper)); }
  .goal-canvas-shell [data-work-surface="goal"] { display: flex; width: 100%; min-width: 0; min-height: 0; padding: 0; }
  .goal-canvas-shell .goal-event-document { display: flex; flex-direction: column; flex: 1; width: 100%; min-width: 0; min-height: 0; position: static; container-type: normal; margin: 0; padding: 0; background: transparent; }
  .goal-canvas-shell .goal-layout { display: contents; }
  .goal-workspace-hero { min-width: 0; min-height: 0; padding: 16px; flex: none; }
  .goal-canvas-shell .goal-workspace-hero { background: transparent; padding: 12px 14px 4px; }
  .goal-info-popover { background: transparent; border-radius: 0; box-shadow: none; }
  .goal-info-popover > summary { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 12px; cursor: pointer; list-style: none; font-size: 12px; font-weight: 600; }
  .goal-info-popover > summary::-webkit-details-marker, .timeline-compose > summary::-webkit-details-marker { display: none; }
  .goal-info-popover .goal-info-collapsed-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .goal-info-popover:not([open]) .goal-info-label, .goal-info-popover[open] .goal-info-collapsed-title { display: none; }
  .goal-info-popover > summary > .goal-status { margin-left: auto; font-size: 10px; }
  .goal-info-popover > summary > svg { width: 14px; height: 14px; flex: none; color: var(--muted); transform: rotate(-90deg); }
  .goal-info-popover[open] > summary > svg { transform: none; }
  .goal-info-body { padding: 0 14px 8px; max-height: min(43vh, 365px); overflow: auto; overscroll-behavior: contain; }
  .goal-canvas-shell .goal-info-body h1 { display: none; }
  .goal-info-body h1 { font-size: 16px; font-weight: 650; line-height: 1.5; letter-spacing: -.02em; margin: 4px 0 8px; overflow-wrap: anywhere; }
  .goal-info-outcome { color: var(--muted); font-size: 12px; line-height: 1.65; margin: 0 0 12px; overflow-wrap: anywhere; }
  .goal-info-status { font-size: 12px; line-height: 1.6; margin-bottom: 10px; }
  .goal-info-status p { margin: 0; }
  .goal-info-status .overview-timestamp { color: var(--muted); font-size: 10px; }
  .goal-info-requirements, .goal-info-attention { display: flex; align-items: center; gap: 5px; width: 100%; padding: 9px 0; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
  .goal-info-requirements > span:nth-child(2) { margin-left: auto; color: var(--muted); }
  .goal-info-attention { color: var(--blue); }
  .goal-info-attention > svg { margin-left: auto; }
  .goal-info-actions { display: flex; align-items: center; justify-content: space-between; gap: 6px; border-top: 1px solid var(--line); margin-top: 5px; padding-top: 4px; }
  .goal-info-actions > button { display: flex; align-items: center; gap: 4px; min-height: 34px; }
  .goal-info-body svg { width: 14px; height: 14px; flex: none; }
  .goal-info-actions .goal-more > div { top: auto; bottom: calc(100% + 4px); right: 0; }
  .goal-info-requirements:hover, .goal-info-attention:hover { color: var(--blue); }
  .timeline-compose { position: relative; }
  .timeline-compose > summary { display: flex; align-items: center; gap: 4px; min-height: 32px; padding: 5px 8px; list-style: none; border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--ink); }
  .timeline-compose > summary:hover, .timeline-compose[open] > summary { background: var(--rail); }
  .timeline-compose > summary > svg { width: 14px; height: 14px; }
  .timeline-compose-options { position: absolute; right: 0; top: calc(100% + 5px); z-index: 6; width: 250px; max-width: calc(100vw - 56px); padding: 5px; border-radius: 12px; background: var(--paper); box-shadow: 0 6px 24px color-mix(in srgb, var(--ink) 16%, transparent); }
  .timeline-compose-options button { display: block; width: 100%; padding: 10px; border: 0; border-radius: 7px; background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
  .timeline-compose-options button:hover { background: var(--rail); }
  .timeline-compose-options strong { display: block; font-size: 12px; font-weight: 600; }
  .timeline-compose-options small { display: block; margin-top: 4px; font-size: 11px; color: var(--muted); line-height: 1.5; }
  .record-templates { margin-bottom: 18px; font-size: 12px; }
  .record-templates summary { cursor: pointer; padding: 6px 0; color: var(--muted); }
  body.immersive-workbench .goal-work-main .tui-pane { display: grid; position: relative; inset: auto; z-index: auto; visibility: visible; pointer-events: auto; box-shadow: none; grid-column: 1; grid-row: 2; min-width: 0; min-height: 0; width: auto; height: auto; padding: 0 18px 18px; margin: 0; border: 0; border-radius: 0; background: var(--paper); grid-template-rows: auto minmax(0, 1fr); }
  .goal-canvas-shell .tui-resizer, .goal-canvas-shell .tui-focus-return, .goal-canvas-shell .tui-owner { display: none !important; }
  .goal-canvas-shell .tui-tabs { min-height: 34px; padding: 3px 2px; }
  .goal-canvas-shell .tui-stage { min-height: 0; padding: 5px 0 0; gap: 8px; }
  .goal-canvas-shell .tui-terminal { min-height: 100px; }
  .goal-canvas-shell .tui-empty { min-height: 0; overflow: auto; align-content: center; padding: 24px; }
  .goal-canvas-shell .goal-event-document .timeline-pane { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; width: 100%; border: 0; padding: 0 14px; overflow: hidden; background: transparent; }
  .goal-canvas-shell .stream-toolbar { min-height: 42px; padding: 8px 4px; border: 0; }
  .goal-canvas-shell .stream-toolbar h2 { font-size: 11px; font-weight: 550; }
  .goal-canvas-shell .timeline-pane [data-event-timeline] { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
  .goal-canvas-shell .timeline-footer { font-size: 10px; padding: 10px 4px; }
  .goal-canvas-shell .timeline-footer > span { display: none; }
  .goal-canvas-shell .timeline-item { padding: 9px 5px; font-size: 11px; }
  .goal-canvas-shell [data-timeline-item] strong { font-size: 11px; font-weight: 500; line-height: 1.65; }
  .goal-canvas-shell [data-timeline-item] small { font-size: 10px; }
  .goal-canvas-shell .event-sheet { padding: 10px 8px; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
  .goal-canvas-shell .goal-event-document .detail-pane { display: none !important; }
  .goal-canvas-shell .goal-event-document.is-editing-goal .detail-pane { display: flex !important; position: absolute; inset: 0; z-index: 6; width: auto; min-width: 0; overflow: hidden; background: var(--paper); border: 0; }
  .goal-canvas-shell .goal-event-document.is-editing-goal .reader, .goal-canvas-shell .goal-event-document.is-editing-goal .event-form { min-height: 0; overflow: auto; overscroll-behavior: contain; }
  .goal-canvas-shell .is-editing-goal .detail-toolbar { flex: none; padding: 12px 20px; }
  .goal-canvas-shell .is-editing-goal .detail-toolbar > :not([data-event-back]), .goal-canvas-shell .is-editing-goal .reader-header [data-event-back] { display: none; }
  .goal-canvas-shell .goal-event-document.is-editing-goal .detail-pane > .event-sheet { display: none; }
  .goal-canvas-shell :focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .goal-canvas-shell ::selection { background: var(--blue-soft); color: var(--ink); }
  .goal-canvas-shell :is(input, textarea) { caret-color: var(--blue); }
  .goal-canvas-shell :is(.goal-info-body, [data-event-timeline], .reader-content, .event-form) { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
  @container goal-workspace (max-width: 839px) {
    .goal-node-workbench { grid-template-columns: minmax(0, 1fr); }
    body.immersive-workbench .goal-node-workbench > .document-pane { grid-area: 1 / 1; position: absolute; inset: 0 0 0 auto; width: min(330px, 100%); z-index: 5; background: var(--paper); box-shadow: -8px 0 24px #08091025; }
    body.immersive-workbench .goal-node-workbench > .document-pane:has(.is-editing-goal) { inset: 0; width: auto; }
    .goal-node-toolbar { min-height: 58px; padding: 12px 14px; gap: 8px; }
    .goal-node-heading > span { display: none; }
    .goal-node-heading h1 { font-size: 14px; }
    .goal-work-modebar { padding: 8px 14px; }
  }
  /* Archive/read-only documents share the integrated timeline, without a terminal frame. */
  .document-pane:not(.goal-canvas-shell .document-pane) .goal-event-document { position: relative; container-type: normal; }
  .document-pane:not(.goal-canvas-shell .document-pane) .goal-layout { display: flex; flex-direction: column; }
  .document-pane:not(.goal-canvas-shell .document-pane) .timeline-pane { flex: 1; border: 0; }
  .document-pane:not(.goal-canvas-shell .document-pane) .is-editing-goal .detail-pane { display: flex !important; position: absolute; inset: 0; z-index: 4; }
  @media (max-width: 600px) {
    .goal-node-workspace { inset: 10px; border-radius: 10px; }
    .goal-work-main .tui-pane { padding: 0 10px 10px; }
    .goal-canvas-tools > span { display: none; }
    .goal-canvas-tools { justify-content: flex-end; }
    .goal-canvas-node { width: 240px; }
    .goal-node-toolbar button, .goal-work-modebar button { min-height: 36px; }
    .goal-canvas-shell .event-form :is(input, textarea, select) { font-size: 16px; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .goal-node-workspace:not([hidden]) { animation: immersive-goal-open .2s cubic-bezier(.16, 1, .3, 1); }
    @keyframes immersive-goal-open { from { clip-path: inset(1% 1% round 14px); transform: translateY(5px); } to { clip-path: inset(0 round 12px); transform: translateY(0); } }
  }
`;
