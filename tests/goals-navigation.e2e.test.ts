import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "../src/v1/demo.js";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("Goal navigation preserves history, keyboard focus, failed selection recovery and open-tab limits without executing work", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate, reloadPage } = browser;
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/V1?desktop=1" }, sessionId));
  const selected = (id: string) => `document.querySelector('[data-goal-view="${id}"]') && document.querySelector('[data-work-tab="${id}"]')?.getAttribute('aria-selected') === 'true'`;
  const tabs = () => evaluate<string[]>("[...document.querySelectorAll('[data-work-tab]')].map(tab => tab.dataset.workTab)");
  async function key(key: string, code: number) {
    await command("Input.dispatchKeyEvent", { type: "rawKeyDown", key, windowsVirtualKeyCode: code }, sessionId);
    await command("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: code }, sessionId);
  }
  await waitFor(selected("V1"));
  await click('.tree-node[data-select-goal="RELEASE"]');
  await waitFor(selected("RELEASE"));
  await evaluate("history.back()");
  await waitFor(selected("V1"));
  assert.equal(await evaluate("location.pathname"), "/goals/V1");
  await evaluate("history.forward()");
  await waitFor(selected("RELEASE"));
  assert.equal(await evaluate("location.pathname"), "/goals/RELEASE");
  await click('[data-work-tab="RELEASE"]');
  await waitFor("document.activeElement.dataset.workTab === 'RELEASE'");
  await key("Home", 36);
  await waitFor(selected("V1") + " && document.activeElement.dataset.workTab === 'V1'");
  await key("End", 35);
  await waitFor(selected("RELEASE") + " && document.activeElement.dataset.workTab === 'RELEASE'");
  assert.equal(await evaluate("document.querySelector('#goal-document-pane').getAttribute('aria-labelledby')"),
    await evaluate("document.querySelector('[data-work-tab=" + JSON.stringify("RELEASE") + "]').id"));

  await click("#goal-tab-overview-RELEASE");
  await key("End", 35);
  await waitFor("document.querySelector('[data-goal-records-content]')?.dataset.loaded === 'true'");
  assert.equal(await evaluate("document.activeElement.dataset.goalTab"), "records");
  await key("Home", 36);
  assert.equal(await evaluate("document.activeElement.dataset.goalTab"), "overview");
  await click("#goal-tab-factors-RELEASE");
  await waitFor("document.querySelector('#goal-panel-factors-RELEASE').dataset.loaded === 'true'");
  await click('[data-goal-factor-tab="relations"]');
  await key("End", 35);
  assert.equal(await evaluate("document.activeElement.dataset.goalFactorTab"), "rules");
  assert.equal(await evaluate("document.querySelector('[data-goal-factor-tab=" + JSON.stringify("rules") + "]').getAttribute('aria-selected')"), "true");

  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/CORE/document*"] }, sessionId);
  await click('.tree-node[data-select-goal="CORE"]');
  await waitFor(selected("RELEASE") + " && !document.querySelector('#goal-document-pane').hasAttribute('aria-busy') && document.querySelector('[data-toast]').textContent.includes('Failed to fetch')");
  assert.equal(await evaluate("location.pathname"), "/goals/RELEASE");
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click('.tree-node[data-select-goal="CORE"]');
  await waitFor(selected("CORE"));
  await click('[data-close-work-tab="RELEASE"]');
  assert.deepEqual(await tabs(), ["V1", "CORE"]);
  await click('[data-close-work-tab="CORE"]');
  await waitFor(selected("V1") + " && document.activeElement.dataset.workTab === 'V1'");
  await click('[data-close-work-tab="V1"]');
  assert.deepEqual(await tabs(), ["V1"]);
  assert.match(await evaluate<string>("document.querySelector('[data-toast]').textContent"), /至少保留一个/);

  const opened = ["PLATFORM", "WORKSPACE", "ADOPTION", "CORE", "INTERFACES", "WEB", "GRAPH", "DESKTOP"];
  for (const id of opened) {
    await click('.tree-node[data-select-goal="' + id + '"]');
    await waitFor(selected(id));
  }
  assert.deepEqual(await tabs(), opened, "Ninth Goal evicts the oldest tab, not the selected Goal");
  await reloadPage();
  await waitFor(selected("DESKTOP"));
  assert.deepEqual(await tabs(), opened, "Open Goals survive a real reload");
  const after = store.snapshot(DEMO_BOARD_ID);
  assert.deepEqual(after.goals, before.goals);
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.runs, before.runs);
  assert.deepEqual(after.claims, before.claims);
  assert.equal(after.board.active_goal_id, before.board.active_goal_id);
});

test("explicit current-Goal and archive actions recover from network failure, persist on reload and retain execution history", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate, reloadPage } = browser;
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/WEB" }, sessionId));
  await waitFor("document.querySelector('[data-set-active-goal]')");
  assert.equal(store.snapshot(DEMO_BOARD_ID).board.active_goal_id, before.board.active_goal_id);
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/WEB/active"] }, sessionId);
  await click('.goal-more > summary');
  await click('[data-set-active-goal]');
  await waitFor("!document.querySelector('[data-set-active-goal]').disabled && document.querySelector('[data-toast]').textContent.length > 0");
  assert.equal(store.snapshot(DEMO_BOARD_ID).board.active_goal_id, before.board.active_goal_id);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click('[data-set-active-goal]');
  await waitFor("document.querySelector('[data-toast]').textContent.includes('已设为当前 Goal')");
  assert.equal(store.snapshot(DEMO_BOARD_ID).board.active_goal_id, "WEB");
  await reloadPage();
  await waitFor("document.querySelector('[data-goal-view=" + JSON.stringify("WEB") + "]')");
  assert.equal(await evaluate("Boolean(document.querySelector('[data-set-active-goal]'))"), false);

  await click('.tree-node[data-select-goal="CORE"]');
  await waitFor("document.querySelector('[data-goal-archive=" + JSON.stringify("true") + "]')");
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/CORE/archive"] }, sessionId);
  await click('[data-goal-archive="true"]');
  await waitFor("!document.querySelector('[data-goal-archive]').disabled && document.querySelector('[data-toast]').textContent.length > 0");
  assert.equal(store.snapshot(DEMO_BOARD_ID).goals.find(g => g.goal_id === "CORE")!.archived_at, null);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await navigate(() => click('[data-goal-archive="true"]'));
  await waitFor("document.querySelector('[data-goal-archive=" + JSON.stringify("false") + "]')");
  assert.equal(await evaluate("location.pathname"), "/archive/goals/CORE");
  assert.ok(store.snapshot(DEMO_BOARD_ID).goals.find(g => g.goal_id === "CORE")!.archived_at);
  await reloadPage();
  await waitFor("document.querySelector('[data-goal-archive=" + JSON.stringify("false") + "]')");
  await click('.goal-more > summary');
  await navigate(() => click('[data-goal-archive="false"]'));
  await waitFor("document.querySelector('[data-goal-view=" + JSON.stringify("CORE") + "]')");
  assert.equal(await evaluate("location.pathname"), "/goals/CORE");
  const after = store.snapshot(DEMO_BOARD_ID);
  assert.equal(after.goals.find(g => g.goal_id === "CORE")!.archived_at, null);
  assert.equal(after.goals.find(g => g.goal_id === "CORE")!.created_at, before.goals.find(g => g.goal_id === "CORE")!.created_at);
  assert.deepEqual(after.goals.filter(g => g.goal_id !== "CORE"), before.goals.filter(g => g.goal_id !== "CORE"));
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.runs, before.runs);
  assert.deepEqual(after.claims, before.claims);
  assert.deepEqual(after.evidence, before.evidence);
  assert.equal(after.board.active_goal_id, "WEB");
});
