/** Shared first-use journey presentation. */
export const ONBOARDING_STYLES = `
  :root {
    color-scheme: light;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif;
    background: #f1f3f2;
    color: #1f272b;
  }
  * { box-sizing: border-box; }
  html, body { min-height: 100%; margin: 0; }
  body { min-height: 100dvh; overflow-x: hidden; background: transparent; color: #1f272b; isolation: isolate; }
  .onboarding-page:not(.onboarding-page--update) { height: 100dvh; min-height: 0; overflow: hidden; }
  button, input, textarea { font: inherit; }
  button, a { -webkit-tap-highlight-color: transparent; }
  ::selection { background: #c8d2ec; color: #172027; }
  :focus-visible { outline: 2px solid #5068b7; outline-offset: 4px; }
  * { scrollbar-width: thin; scrollbar-color: rgba(91, 105, 113, .38) transparent; }
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: rgba(91, 105, 113, .38); background-clip: padding-box; }
  .icon-sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
  .onboarding-atmosphere {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: #f1f3f2;
  }
  .onboarding-topbar,
  .onboarding-room,
  .onboarding-update { position: relative; z-index: 1; }
  .onboarding-page [hidden] { display: none !important; }
  .onboarding-topbar {
    position: fixed;
    inset: 0 0 auto;
    min-height: 60px;
    padding: 8px clamp(20px, 3.2vw, 46px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #465158;
  }
  .onboarding-brand { color: #263036; font-size: 10px; font-weight: 760; letter-spacing: .1em; text-decoration: none; text-transform: uppercase; }
  .onboarding-topbar-actions { display: flex; align-items: center; gap: clamp(8px, 1.4vw, 16px); }
  .onboarding-topbar-actions a { min-height: 44px; display: inline-flex; align-items: center; color: #566268; font-size: 11px; text-decoration: none; transition: color 130ms ease, transform 130ms ease; }
  .onboarding-topbar-actions a:hover { color: #1f272b; transform: translateY(-1px); }
  .onboarding-topbar button {
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: #4e5a60;
    font-size: 11px;
    cursor: pointer;
    transition: color 130ms ease, transform 130ms ease, background 130ms ease;
  }
  .onboarding-topbar button:hover { background: #e5e8e7; color: #1f272b; transform: translateY(-1px); }
  .onboarding-room { height: 100dvh; min-height: 0; overflow: hidden; }
  .onboarding-flow {
    position: absolute;
    inset: clamp(118px, calc(61.8dvh - 112px), 430px) auto 32px clamp(24px, 9vw, 136px);
    width: min(calc(100% - clamp(48px, 18vw, 272px)), 480px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    transition: top 280ms cubic-bezier(.16, 1, .3, 1);
    animation: onboarding-session-ready 460ms cubic-bezier(.16, 1, .3, 1) both;
  }
  .onboarding-flow-header {
    width: min(100%, 480px);
    min-height: 44px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .onboarding-progress {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #59666d;
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    font-weight: 620;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .onboarding-progress::before { content: ""; width: 5px; height: 5px; flex: none; border-radius: 1px; background: #5068b7; transition: background 130ms ease; }
  .onboarding-stage { position: relative; min-height: 0; }
  .onboarding-step { position: absolute; inset: 0; width: 100%; }
  .onboarding-step.is-current { z-index: 2; }
  .onboarding-step.is-leaving { z-index: 1; pointer-events: none; }
  .onboarding-flow[data-step-direction="forward"] .onboarding-step.is-entering { animation: onboarding-step-in-forward 300ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-flow[data-step-direction="forward"] .onboarding-step.is-leaving { animation: onboarding-step-out-forward 260ms cubic-bezier(.4, 0, 1, 1) both; }
  .onboarding-flow[data-step-direction="backward"] .onboarding-step.is-entering { animation: onboarding-step-in-backward 300ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-flow[data-step-direction="backward"] .onboarding-step.is-leaving { animation: onboarding-step-out-backward 260ms cubic-bezier(.4, 0, 1, 1) both; }
  .onboarding-step h1, .onboarding-update h1 {
    max-width: 22ch;
    margin: 0 0 8px;
    color: #1f272b;
    font-size: clamp(19px, 1.45vw, 21px);
    font-weight: 600;
    letter-spacing: -.025em;
    line-height: 1.3;
    text-wrap: balance;
  }
  .onboarding-step h1:focus { outline: none; }
  .onboarding-intro { max-width: 48ch; margin: 0 0 16px; color: #59656b; font-size: 11.5px; line-height: 1.6; }
  .onboarding-visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
  .onboarding-composer {
    width: min(100%, 480px);
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: end;
    gap: 12px;
  }
  .onboarding-intent { position: relative; min-width: 0; align-self: stretch; display: flex; }
  .onboarding-intent-trigger {
    min-width: 82px;
    min-height: 46px;
    padding: 0 2px 0 0;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 0;
    border-radius: 0;
    outline: 0;
    background: transparent;
    box-shadow: inset 0 -1px #cbd3d3;
    color: #344148;
    font-size: 12px;
    font-weight: 660;
    cursor: pointer;
    transition: color 140ms ease, box-shadow 140ms ease;
  }
  .onboarding-intent-trigger:hover { color: #1f272b; box-shadow: inset 0 -1px #9aa8a8; }
  .onboarding-intent-trigger:focus-visible,
  .onboarding-intent.is-open .onboarding-intent-trigger { color: #314d9b; box-shadow: inset 0 -1px #5068b7; }
  .onboarding-intent-trigger svg { width: 13px; height: 13px; color: #68757b; stroke-width: 1.7; transition: color 140ms ease, transform 180ms cubic-bezier(.16, 1, .3, 1); }
  .onboarding-intent.is-open .onboarding-intent-trigger svg { color: #405aa1; transform: rotate(180deg); }
  .onboarding-intent-options {
    position: absolute;
    left: -8px;
    bottom: calc(100% + 8px);
    z-index: 8;
    width: 210px;
    padding: 6px;
    display: grid;
    gap: 1px;
    visibility: hidden;
    opacity: 0;
    transform: translateY(5px) scale(.985);
    transform-origin: left bottom;
    pointer-events: none;
    border-radius: 9px;
    background: rgba(247, 249, 248, .98);
    box-shadow: 0 16px 38px rgba(40, 49, 52, .14);
    transition: opacity 150ms ease, transform 180ms cubic-bezier(.16, 1, .3, 1), visibility 0s linear 180ms;
  }
  .onboarding-intent.is-open .onboarding-intent-options { visibility: visible; opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; transition-delay: 0s; }
  .onboarding-intent-options button {
    width: 100%;
    min-height: 38px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #455158;
    font-size: 11px;
    font-weight: 560;
    text-align: left;
    cursor: pointer;
  }
  .onboarding-intent-options button:hover,
  .onboarding-intent-options button:focus-visible { outline: 0; background: #ecefee; color: #20292d; }
  .onboarding-intent-options button[aria-selected="true"] { background: #e3e7e6; color: #20292d; font-weight: 640; }
  .onboarding-intent-options button > span { min-width: 0; display: flex; align-items: center; gap: 8px; }
  .onboarding-intent-options button > span svg { width: 13px; height: 13px; flex: none; color: #718086; stroke-width: 1.5; }
  .onboarding-intent-options button > span b { min-width: 0; font: inherit; }
  .onboarding-intent-options button[aria-selected="true"] > span svg { color: #405aa1; }
  .onboarding-intent-options i { width: 5px; height: 5px; flex: none; border-radius: 50%; background: transparent; }
  .onboarding-intent-options button[aria-selected="true"] i { background: #5068b7; box-shadow: 0 0 0 3px rgba(80, 104, 183, .09); }
  .onboarding-answer {
    position: relative;
    width: min(100%, 360px);
    min-height: 46px;
    padding: 3px 10px;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    overflow: hidden;
    border: 1px solid #d4dad9;
    border-radius: 5px;
    background: #e6eae9;
    color: #546168;
    font-size: 14px;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }
  .onboarding-answer::before { content: ""; position: absolute; inset: 0; z-index: 0; background: rgba(80, 104, 183, .08); opacity: 0; transform: scaleX(0); transform-origin: left center; pointer-events: none; }
  .onboarding-step.is-current .onboarding-answer::before { animation: onboarding-control-ready 420ms 80ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-answer::after { content: ""; position: absolute; inset: -1px auto -1px -1px; z-index: 2; width: 1px; background: #5068b7; transform: scaleY(0); transform-origin: center; transition: transform 140ms cubic-bezier(.16, 1, .3, 1); }
  .onboarding-answer > span { position: relative; z-index: 1; flex: none; padding-top: 8px; font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 9px; font-weight: 650; letter-spacing: .06em; line-height: 1.5; }
  .onboarding-composer .onboarding-answer { width: 100%; }
  .onboarding-answer--plain {
    padding: 3px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: inset 0 -1px #cbd3d3;
  }
  .onboarding-answer--plain::before,
  .onboarding-answer--plain::after { display: none; }
  .onboarding-answer textarea,
  .onboarding-answer input,
  .onboarding-workspace input {
    width: 100%;
    position: relative;
    z-index: 1;
    padding: 7px 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #1f272b;
    caret-color: #5068b7;
  }
  .onboarding-answer textarea { min-height: 38px; max-height: 76px; resize: none; line-height: 1.5; }
  .onboarding-answer input { font-size: inherit; }
  .onboarding-answer textarea::placeholder,
  .onboarding-answer input::placeholder,
  .onboarding-workspace input::placeholder { color: #5d696f; opacity: 1; }
  .onboarding-answer:focus-within { background: #fbfcfb; border-color: #7184c6; box-shadow: 0 8px 22px rgba(41, 54, 59, .07); color: #334047; transform: translateY(-1px); }
  .onboarding-answer:focus-within::after { transform: scaleY(1); }
  .onboarding-answer--plain:focus-within { background: transparent; border-color: transparent; box-shadow: inset 0 -1px #5068b7; transform: none; }
  .onboarding-field-error, .onboarding-error { max-width: 56ch; margin: 10px 0 0; color: #8c3e43; font-size: 11px; line-height: 1.5; }
  .onboarding-echo { max-width: 56ch; margin: 0 0 16px; display: inline-flex; align-items: baseline; gap: 7px; color: #5d696f; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; animation: onboarding-receipt-lock 320ms 60ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-echo::before { content: ""; width: 5px; height: 5px; flex: none; align-self: center; border-radius: 1px; background: #5068b7; animation: onboarding-receipt-confirm 360ms 120ms cubic-bezier(.16, 1, .3, 1) both; }
  .onboarding-echo strong { color: #344047; font-size: 11px; font-weight: 570; }
  .onboarding-echo span + strong::before { content: none; }
  .onboarding-workspace { width: min(100%, 360px); display: grid; gap: 2px; color: #59656b; font-size: 9.5px; }
  .onboarding-workspace input { min-height: 34px; padding: 0; border: 0; border-bottom: 1px solid #cbd3d3; border-radius: 0; background: transparent; font-size: 11.5px; transition: border-color 140ms ease, color 140ms ease; }
  .onboarding-workspace input:focus { border-color: #5068b7; background: transparent; box-shadow: none; }
  .onboarding-runtime { max-width: 360px; margin: 9px 0 0; padding: 0; border: 0; }
  .onboarding-runtime legend { margin-bottom: 3px; color: #59656b; font-size: 9.5px; }
  .onboarding-runtime { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; }
  .onboarding-runtime legend { grid-column: 1 / -1; }
  .onboarding-runtime-choice { position: relative; min-width: 0; cursor: pointer; }
  .onboarding-runtime-choice input { position: absolute; opacity: 0; pointer-events: none; }
  .onboarding-runtime-choice > span {
    min-height: 34px;
    padding: 0 8px;
    display: grid;
    grid-template-columns: 13px minmax(0, 1fr) 5px;
    align-items: center;
    gap: 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #3f4a50;
    font-size: 10.5px;
    transition: background 130ms ease, color 130ms ease;
  }
  .onboarding-runtime-choice > span > svg { width: 13px; height: 13px; color: #718086; stroke-width: 1.45; }
  .onboarding-runtime-choice strong { min-width: 0; font-weight: 540; line-height: 1.25; }
  .onboarding-runtime-choice i { width: 5px; height: 5px; border-radius: 50%; background: #b6bfbe; transition: background 130ms ease, box-shadow 130ms ease; }
  .onboarding-runtime-choice:not(:has(input:checked)) i { background: transparent; }
  .onboarding-runtime-choice:hover > span { background: #e9eceb; color: #1f272b; }
  .onboarding-runtime-choice input:checked + span { background: #e2e5e4; color: #1f272b; }
  .onboarding-runtime-choice input:checked + span i { background: #5068b7; }
  .onboarding-runtime-choice input:focus-visible + span { outline: 2px solid #5068b7; outline-offset: 3px; }
  .onboarding-hint { max-width: 360px; margin: 5px 0 0; color: #657177; font-size: 9px; line-height: 1.4; }
  .onboarding-review { max-width: 480px; margin: 1px 0 0; display: grid; gap: 2px; }
  .onboarding-review div { min-height: 34px; padding: 6px 0; display: grid; grid-template-columns: 92px minmax(0, 1fr); align-items: baseline; gap: 14px; }
  .onboarding-review dt { color: #647077; font-size: 10px; }
  .onboarding-review dd { margin: 0; color: #303a3f; font-size: 11.5px; line-height: 1.5; overflow-wrap: anywhere; }
  .onboarding-confirm { max-width: 480px; margin-top: 13px; display: flex; align-items: flex-start; gap: 9px; color: #566168; font-size: 11px; line-height: 1.55; cursor: pointer; }
  .onboarding-confirm input { width: 16px; height: 16px; margin: 1px 0 0; accent-color: #5068b7; }
  body[data-onboarding-tone="4"] .onboarding-flow {
    inset: 72px auto 18px clamp(24px, 6vw, 92px);
    width: min(calc(100% - clamp(48px, 12vw, 184px)), 760px);
  }
  body[data-onboarding-tone="4"] .onboarding-flow-header { width: 100%; margin-bottom: 8px; }
  .onboarding-step--runtime-embedded {
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) 34px;
    gap: 9px;
  }
  .onboarding-runtime-heading { display: grid; grid-template-columns: minmax(0, .75fr) minmax(250px, 1fr); align-items: end; gap: 24px; }
  .onboarding-runtime-heading h1 { max-width: none; margin: 0; }
  .onboarding-runtime-heading .onboarding-intro { max-width: 58ch; margin: 0; font-size: 10.5px; }
  .onboarding-runtime-viewport {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #c5cccb;
    border-radius: 7px;
    background: #17191c;
  }
  .onboarding-runtime-viewport iframe { width: 100%; height: 100%; display: block; border: 0; background: #17191c; }
  .onboarding-runtime-state { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .onboarding-runtime-state p { min-width: 0; margin: 0; display: flex; align-items: center; gap: 7px; color: #5c686e; font-size: 9.5px; line-height: 1.45; }
  .onboarding-runtime-state p::before { content: ""; width: 5px; height: 5px; flex: none; border-radius: 50%; background: #8d999e; }
  .onboarding-runtime-state p[data-state="ready"]::before { background: #5068b7; }
  .onboarding-runtime-state p[data-state="error"] { color: #8c3e43; }
  .onboarding-runtime-state p[data-state="error"]::before { background: #a64c52; }
  .onboarding-runtime-state button { min-height: 34px; padding: 0; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: #405aa1; font-size: 10px; font-weight: 620; cursor: pointer; }
  .onboarding-runtime-state button svg { width: 12px; height: 12px; }
  .onboarding-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
  }
  .onboarding-actions button {
    min-height: 44px;
    padding: 0 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #344148;
    font-size: 10.5px;
    font-weight: 620;
    cursor: pointer;
    box-shadow: none;
    transition: color 130ms ease, opacity 130ms ease;
  }
  .onboarding-actions button svg { width: 14px; height: 14px; stroke-width: 1.45; transition: transform 140ms cubic-bezier(.16, 1, .3, 1); }
  .onboarding-actions button:hover { color: #314d9b; }
  .onboarding-actions .onboarding-back:hover svg { transform: translateX(-2px); }
  .onboarding-actions .onboarding-next:hover svg,
  .onboarding-actions .onboarding-submit:hover svg { transform: translateX(2px); }
  .onboarding-actions button:active { opacity: .62; }
  .onboarding-actions button:disabled { opacity: .42; cursor: wait; }
  .onboarding-actions .onboarding-back { color: #657177; }
  .onboarding-flow > .onboarding-error { position: absolute; top: calc(100% + 8px); left: 0; max-width: min(420px, calc(100vw - 48px)); margin: 0; }
  .onboarding-update-actions button {
    min-height: 38px;
    padding: 0 13px;
    border: 0;
    border-radius: 5px;
    background: #222b30;
    color: #f7f8f7;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
    transition: transform 130ms ease, background 130ms ease;
  }
  .onboarding-update-actions button:hover { transform: translateY(-1px); background: #11181c; }
  .onboarding-update-actions button:disabled { opacity: .55; cursor: wait; transform: none; }
  .onboarding-page--update { color: #1f272b; }
  .onboarding-update { width: min(100% - 48px, 480px); min-height: 100dvh; margin: 0 0 0 clamp(24px, 9vw, 136px); padding: 88px 0 56px; display: grid; align-content: center; gap: 24px; }
  .onboarding-update .onboarding-brand { color: #30393e; }
  .onboarding-update h1 { max-width: none; margin: 0 0 12px; color: #20272b; }
  .onboarding-update-copy > p { max-width: 60ch; margin: 0; color: #566168; font-size: 11.5px; line-height: 1.65; }
  .onboarding-update ul { max-width: 480px; margin: 20px 0 0; padding: 0; display: grid; gap: 14px; list-style: none; }
  .onboarding-update li { display: grid; gap: 5px; }
  .onboarding-update li strong { color: #303a3f; font-size: 11.5px; }
  .onboarding-update li span { color: #5d686e; font-size: 11px; line-height: 1.55; }
  .onboarding-update-actions { display: flex; align-items: center; gap: 16px; }
  .onboarding-update-actions a { min-height: 44px; display: inline-flex; align-items: center; color: #566168; font-size: 12px; text-underline-offset: 4px; }
  .onboarding-update .onboarding-error { color: #913f43; }
  @keyframes onboarding-session-ready {
    from { opacity: .62; }
    to { opacity: 1; }
  }
  @keyframes onboarding-step-in-forward {
    from { opacity: .12; clip-path: inset(0 12% 0 0); transform: translateX(16px); }
    to { opacity: 1; clip-path: inset(0); transform: translateX(0); }
  }
  @keyframes onboarding-step-out-forward {
    from { opacity: 1; clip-path: inset(0); transform: translateX(0); }
    to { opacity: 0; clip-path: inset(0 0 0 8%); transform: translateX(-8px); }
  }
  @keyframes onboarding-step-in-backward {
    from { opacity: .12; clip-path: inset(0 0 0 12%); transform: translateX(-16px); }
    to { opacity: 1; clip-path: inset(0); transform: translateX(0); }
  }
  @keyframes onboarding-step-out-backward {
    from { opacity: 1; clip-path: inset(0); transform: translateX(0); }
    to { opacity: 0; clip-path: inset(0 8% 0 0); transform: translateX(8px); }
  }
  @keyframes onboarding-control-ready {
    0% { opacity: 0; transform: scaleX(0); }
    42% { opacity: 1; }
    100% { opacity: 0; transform: scaleX(1); }
  }
  @keyframes onboarding-receipt-lock {
    from { opacity: .35; clip-path: inset(0 16% 0 0); }
    to { opacity: 1; clip-path: inset(0); }
  }
  @keyframes onboarding-receipt-confirm {
    from { opacity: .2; transform: scale(.4); }
    to { opacity: 1; transform: scale(1); }
  }
  @media (max-width: 760px) {
    .onboarding-topbar { min-height: 60px; padding-inline: 18px; }
    .onboarding-topbar-actions { gap: 8px; }
    .onboarding-topbar-actions a { font-size: 11px; }
    .onboarding-topbar button { padding-inline: 8px; }
    .onboarding-room { height: 100dvh; }
    .onboarding-flow { inset: clamp(116px, calc(61.8dvh - 112px), 430px) 20px 24px; width: auto; }
    .onboarding-flow-header { margin-bottom: 8px; }
    .onboarding-step h1 { font-size: 20px; }
    .onboarding-intro { margin-bottom: 16px; font-size: 11.5px; }
    .onboarding-answer { width: 100%; min-height: 48px; padding: 4px 10px; gap: 8px; font-size: 14px; }
    .onboarding-intent-trigger { min-height: 48px; }
    .onboarding-answer--plain { padding: 4px 0; }
    .onboarding-answer > span { padding-top: 8px; font-size: 9px; }
    .onboarding-answer textarea { min-height: 38px; padding-top: 7px; }
    .onboarding-echo { max-width: 100%; }
    .onboarding-runtime-choice > span { min-height: 38px; }
    .onboarding-review div { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    body[data-onboarding-tone="4"] .onboarding-flow { inset: 62px 14px 10px; width: auto; }
    .onboarding-step--runtime-embedded { grid-template-rows: auto minmax(0, 1fr) 38px; gap: 7px; }
    .onboarding-runtime-heading { grid-template-columns: minmax(0, 1fr); gap: 3px; }
    .onboarding-runtime-heading h1 { font-size: 17px; }
    .onboarding-runtime-heading .onboarding-intro { max-width: none; font-size: 9.5px; line-height: 1.45; }
    .onboarding-runtime-viewport { border-radius: 5px; }
    .onboarding-runtime-state p { font-size: 9px; }
    .onboarding-actions button { min-height: 44px; }
    .onboarding-update { width: calc(100% - 40px); margin: 0 20px; padding-block: 78px 40px; align-content: start; }
    .onboarding-update-actions { align-items: stretch; flex-direction: column; }
    .onboarding-update-actions button, .onboarding-update-actions a { justify-content: center; min-height: 48px; }
  }
  @media (max-width: 460px) {
    .onboarding-topbar-actions a { display: none; }
    .onboarding-flow-header { gap: 12px; }
    .onboarding-actions { gap: 10px; }
  }
  /* Native overlay controls occupy the leading 80px; align the content's
     optical center with the packaged macOS traffic lights, not the Web header. */
  body.onboarding-page[data-native-desktop="true"] .onboarding-topbar,
  html[data-native-desktop="true"] .onboarding-page .onboarding-topbar {
    height: 44px;
    min-height: 44px;
    padding: 0 24px 0 var(--desktop-window-safe-inline-start, 88px);
  }
  body.onboarding-page[data-native-desktop="true"] .onboarding-topbar > *,
  html[data-native-desktop="true"] .onboarding-page .onboarding-topbar > * {
    transform: translateY(-1px);
  }
  body[data-onboarding-tone="2"] .onboarding-flow { top: clamp(96px, calc(50dvh - 136px), 330px); }
  @media (max-height: 760px) {
    body[data-onboarding-tone="2"] .onboarding-flow { top: max(80px, calc(50dvh - 160px)); }
    body[data-onboarding-tone="3"] .onboarding-flow { top: max(108px, calc(50dvh - 86px)); }
    .onboarding-step--review .onboarding-intro { margin-bottom: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0ms !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
  }
  `;
