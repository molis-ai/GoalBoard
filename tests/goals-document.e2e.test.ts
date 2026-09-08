import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GOALS_DOCUMENT_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { DEMO_BOARD_ID } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("Goal document tabs retry lazy loading, restore selection, and open the draft editor from the primary action", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, before, sessionId, command, evaluate, waitFor, click, reloadPage } = browser;
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.navigate", { url: origin + "/goals/V1" }, sessionId);
  await command("Page.bringToFront", {}, sessionId);
  const dom = (selector: string) => "document.querySelector(" + JSON.stringify(selector) + ")";
  await waitFor("document.readyState === 'complete' && " + dom("#goal-tab-overview-V1"));
  assert.equal(await evaluate(dom("#goal-panel-completion-V1") + ".dataset.loaded"), "false");
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/V1/panels/completion*"] }, sessionId);
  await click("#goal-tab-completion-V1");
  await waitFor(dom('[data-retry-goal-panel="completion"]') + " && !" + dom("#goal-panel-completion-V1") + ".hasAttribute('aria-busy')");
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click('[data-retry-goal-panel="completion"]');
  await waitFor(dom("#goal-panel-completion-V1") + ".dataset.loaded === 'true'");
  assert.equal(await evaluate(dom("#goal-tab-completion-V1") + ".getAttribute('aria-selected')"), "true");
  for (const panel of ["progress", "factors"]) {
    await click("#goal-tab-" + panel + "-V1");
    await waitFor(dom("#goal-panel-" + panel + "-V1") + ".dataset.loaded === 'true'");
    assert.equal(await evaluate(dom("#goal-panel-" + panel + "-V1") + ".hidden"), false);
    assert.equal(await evaluate(dom("#goal-panel-overview-V1") + ".hidden"), true);
  }
  await reloadPage();
  await waitFor(dom("#goal-panel-factors-V1") + "?.dataset.loaded === 'true'");
  assert.equal(await evaluate(dom("#goal-tab-factors-V1") + ".getAttribute('aria-selected')"), "true");
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/V1/records*"] }, sessionId);
  await click("#goal-tab-records-V1");
  await waitFor(dom('[data-goal-records-content] [role="alert"]'));
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click("#goal-tab-overview-V1");
  await click("#goal-tab-records-V1");
  await waitFor(dom("[data-goal-records-content]") + ".dataset.loaded === 'true'");
  assert.equal(await evaluate(dom("[data-goal-records-content]") + ".hasAttribute('aria-busy')"), false);
  await click('.tree-node[data-select-goal="RELEASE"]');
  await waitFor(dom("#goal-tab-overview-RELEASE"));
  await click("#goal-tab-overview-RELEASE");
  // This Goal's completion panel has not been opened yet.
  assert.equal(await evaluate(dom("#goal-panel-completion-RELEASE") + ".dataset.loaded"), "false");
  await click('[data-goal-view="RELEASE"] [data-open-goal-edit]');
  await waitFor(dom(".goal-edit-disclosure") + "?.open === true");
  assert.equal(await evaluate(dom("#goal-panel-completion-RELEASE") + ".hidden"), false);
  // Opening the disclosure schedules focus in the next animation frame; open alone is not its completion.
  await waitFor("document.activeElement.closest('[data-draft-form]')?.dataset.goalId === 'RELEASE'");
  assert.equal(await evaluate("document.activeElement.closest('[data-draft-form]')?.dataset.goalId"), "RELEASE");
  const screenshots = process.env.GOALBOARD_TEST_CAPTURE === "1" ? await mkdtemp(join(tmpdir(), "goalboard-gw5-document-")) : null;
  async function capture(name: string) {
    if (!screenshots) return;
    const { data } = await command<{ data: string }>("Page.captureScreenshot", { format: "png" }, sessionId);
    await writeFile(join(screenshots, name + ".png"), Buffer.from(data, "base64"));
    console.log("Document UI capture: " + join(screenshots, name + ".png"));
  }
  await capture("desktop");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await click('[data-mobile-target="document"]');
  await click('[data-draft-form] input[name="title"]');
  assert.equal(await evaluate("document.activeElement.name"), "title");
  assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth"), false);
  await capture("mobile");
  const after = store.snapshot(DEMO_BOARD_ID);
  assert.deepEqual(after.goals, before.goals);
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.runs, before.runs);
});

test("late completed document response never replaces the newer selected Goal", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate } = browser;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/V1" }, sessionId));
  await waitFor("document.querySelector('#goal-tab-overview-V1')");
  // Delay delivery of a real, fully read HTTP response. No invented document or server state.
  // Aborting after the body completed cannot undo a result already queued for delivery.
  await evaluate(`(() => {
    const original = fetch.bind(globalThis);
    globalThis.fetch = async (input, options) => {
      const response = await original(input, options);
      if (new URL(String(input), location.href).pathname === '/api/goals/RELEASE/document') {
        const body = await response.text();
        globalThis.__heldGoalResponse = true;
        await new Promise(resolve => { globalThis.__releaseGoalResponse = resolve; });
        globalThis.__lateGoalDelivered = true;
        return new Response(body, {status:response.status,headers:response.headers});
      }
      return response;
    };
    return true;
  })()`);
  await click('.tree-node[data-select-goal="RELEASE"]');
  await waitFor("globalThis.__heldGoalResponse === true");
  await click('.tree-node[data-select-goal="V1"]');
  await waitFor("document.querySelector('[data-document-pane]').getAttribute('aria-busy') !== 'true' && document.querySelector('[data-goal-view]').dataset.goalView === 'V1'");
  await evaluate("globalThis.__releaseGoalResponse(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("globalThis.__lateGoalDelivered"), true);
  assert.equal(await evaluate("document.querySelector('[data-goal-view]').dataset.goalView"), "V1");
  assert.equal(await evaluate("document.querySelector('.tree-node.is-selected').dataset.selectGoal"), "V1");
  assert.equal(await evaluate("location.pathname"), "/goals/V1");
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).relations, before.relations);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).runs, before.runs);
});

test("public document clients isolate requests and keep Host callbacks, failure recovery and both pane layouts", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, navigate, evaluate } = browser;
  await navigate(() => command("Page.navigate", { url: origin + "/goals/V1" }, sessionId));
  const result = await evaluate<{
    first: boolean | null; second: boolean | null; newer: boolean | null; failed: boolean | null; retry: boolean | null;
    aGoal: string; bGoal: string; failedGoal: string; aBusy: boolean; bBusy: boolean;
    heldBusy: boolean; aAborted: boolean; bAborted: boolean; headerKept: boolean; siblingKept: boolean;
    calls: string[]; errors: string[]; caches: string[];
  }>(`(async () => {
    const createClient = (${GOALS_DOCUMENT_CLIENT_FACTORY_SCRIPT});
    const aPane = document.createElement('section');
    aPane.innerHTML = '<aside>Host sibling</aside><div data-work-surface="goal"><article data-goal-view="initial-a"></article></div>';
    const bPane = document.createElement('section');
    bPane.innerHTML = '<header class="desktop-pane-header">Host header</header><article data-goal-view="initial-b"></article>';
    const header = bPane.firstElementChild;
    const sibling = aPane.firstElementChild;
    const calls = [], errors = [], caches = [];
    const ports = (name, documentPane) => ({
      documentPane, documentCollection: 'current', route: path => path, translate: text => text,
      isAbortError: error => error instanceof DOMException && error.name === 'AbortError',
      showError: message => errors.push(message),
      beforeReplace: () => calls.push(name + ':before:' + documentPane.querySelector('[data-goal-view]').dataset.goalView),
      afterReplace: () => calls.push(name + ':after:' + documentPane.querySelector('[data-goal-view]').dataset.goalView),
    });
    const a = createClient(ports('a', aPane)), b = createClient(ports('b', bPane));
    const originalFetch = globalThis.fetch;
    let releaseBody, bodyRead, aSignal, bSignal, held = false;
    const captured = new Promise(resolve => { bodyRead = resolve; });
    const gate = new Promise(resolve => { releaseBody = resolve; });
    globalThis.fetch = async (input, options) => {
      const path = new URL(String(input), location.href).pathname;
      caches.push(options.cache);
      if (path === '/api/goals/V1/document') bSignal = options.signal;
      const response = await originalFetch(input, options);
      if (path === '/api/goals/RELEASE/document' && !held) {
        held = true;
        aSignal = options.signal;
        const body = await response.text();
        bodyRead();
        await gate;
        return new Response(body, {status:response.status,headers:response.headers});
      }
      return response;
    };
    try {
      const pending = a.loadGoalDocument('RELEASE');
      await captured;
      const heldBusy = aPane.getAttribute('aria-busy') === 'true';
      const second = await b.loadGoalDocument('V1');
      const newer = await a.loadGoalDocument('CORE');
      releaseBody();
      const first = await pending;
      const failed = await a.loadGoalDocument('DOES-NOT-EXIST');
      const failedGoal = aPane.querySelector('[data-goal-view]').dataset.goalView;
      const retry = await a.loadGoalDocument('RELEASE');
      return {first,second,newer,failed,retry,failedGoal,heldBusy,
        aGoal:aPane.querySelector('[data-goal-view]').dataset.goalView,
        bGoal:bPane.querySelector('[data-goal-view]').dataset.goalView,
        aBusy:aPane.hasAttribute('aria-busy'),bBusy:bPane.hasAttribute('aria-busy'),
        aAborted:aSignal.aborted,bAborted:bSignal.aborted,
        headerKept:bPane.firstElementChild === header,siblingKept:aPane.firstElementChild === sibling,
        calls,errors,caches};
    } finally { releaseBody(); globalThis.fetch = originalFetch; }
  })()`);
  assert.equal(result.first, null);
  assert.equal(result.second, true);
  assert.equal(result.newer, true);
  assert.equal(result.failed, false);
  assert.equal(result.failedGoal, "CORE");
  assert.equal(result.retry, true);
  assert.equal(result.aGoal, "RELEASE");
  assert.equal(result.bGoal, "V1");
  assert.equal(result.aBusy, false);
  assert.equal(result.bBusy, false);
  assert.equal(result.heldBusy, true);
  assert.equal(result.aAborted, true);
  assert.equal(result.bAborted, false);
  assert.equal(result.headerKept, true);
  assert.equal(result.siblingKept, true);
  assert.deepEqual(result.calls, ["b:before:initial-b", "b:after:V1", "a:before:initial-a", "a:after:CORE", "a:before:CORE", "a:after:RELEASE"]);
  assert.deepEqual(result.errors, ["无法读取这条 Goal 正文"]);
  assert.deepEqual(result.caches, Array(5).fill("no-store"));
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const key of ["goals", "relations", "risks", "claims", "runs", "evidence"] as const) assert.deepEqual(after[key], before[key]);
});

test("switching away from a loading panel leaves it retryable after its old response arrives", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, navigate, evaluate, click, waitFor } = browser;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/V1" }, sessionId));
  await evaluate(`(() => {
    const originalFetch = globalThis.fetch;
    let held = false;
    globalThis.fetch = async (input, options) => {
      const response = await originalFetch(input, options);
      if (!held && new URL(String(input), location.href).pathname === '/api/goals/V1/panels/completion') {
        held = true;
        const body = await response.text();
        globalThis.__heldPanelResponse = true;
        await new Promise(resolve => { globalThis.__releasePanelResponse = resolve; });
        return new Response(body, {status:response.status,headers:response.headers});
      }
      return response;
    };
    return true;
  })()`);
  await click("#goal-tab-completion-V1");
  await waitFor("globalThis.__heldPanelResponse === true");
  await click("#goal-tab-progress-V1");
  await waitFor("document.querySelector('#goal-panel-progress-V1').dataset.loaded === 'true'");
  await evaluate("__releasePanelResponse(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("document.querySelector('#goal-panel-completion-V1').dataset.loaded"), "false");
  assert.equal(await evaluate("document.querySelector('#goal-panel-completion-V1').dataset.loading"), "false");
  assert.equal(await evaluate("document.querySelector('#goal-panel-completion-V1').hasAttribute('aria-busy')"), false);
  await click("#goal-tab-completion-V1");
  await waitFor("document.querySelector('#goal-panel-completion-V1').dataset.loaded === 'true'");
  assert.equal(await evaluate("document.querySelector('#goal-tab-completion-V1').getAttribute('aria-selected')"), "true");
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const key of ["goals", "relations", "risks", "claims", "runs", "evidence"] as const) assert.deepEqual(after[key], before[key]);
});
