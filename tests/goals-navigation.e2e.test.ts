import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";
import { insertHistoricalClaim, insertHistoricalEvidence, insertHistoricalRun } from "./historical-sql-fixture.js";

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

  await waitFor("document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'RELEASE'");
  const timelineItem = "document.querySelector('[data-timeline-item]')";
  if (await evaluate(timelineItem + " != null")) {
    await click("[data-timeline-item]");
    assert.equal(await evaluate("document.querySelector('[data-timeline-item][aria-current=\"true\"]') != null"), true);
  }

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
  insertHistoricalClaim(store.db, {
    claim_id: "core-history-claim",
    board_id: DEMO_BOARD_ID,
    goal_id: "CORE",
    actor_id: "history-runtime",
    release_reason: "historical CORE lifecycle record",
  });
  insertHistoricalRun(store.db, {
    run_id: "core-history-run",
    board_id: DEMO_BOARD_ID,
    goal_id: "CORE",
    claim_id: "core-history-claim",
    actor_id: "history-runtime",
    state: "completed",
    output_refs_json: JSON.stringify(["artifact://core-lifecycle-history"]),
    ended_at: "2026-09-02T00:02:00.000Z",
  });
  insertHistoricalEvidence(store.db, {
    evidence_id: "core-history-evidence",
    board_id: DEMO_BOARD_ID,
    goal_id: "CORE",
    producer_actor_id: "history-runtime",
    locator: "artifact://core-lifecycle-history",
    kind: "artifact",
    result: "passed",
    run_id: "core-history-run",
  });
  const seeded = store.snapshot(DEMO_BOARD_ID);
  const seededClaim = seeded.claims.find((item) => item.claim_id === "core-history-claim")!;
  const seededRun = seeded.runs.find((item) => item.run_id === "core-history-run")!;
  const seededEvidence = seeded.evidence.find((item) => item.evidence_id === "core-history-evidence")!;
  assert.equal(seededClaim.goal_id, "CORE");
  assert.equal(seededRun.goal_id, "CORE");
  assert.equal(seededEvidence.locator, "artifact://core-lifecycle-history");
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
  await waitFor("document.querySelector('[data-goal-view=" + JSON.stringify("CORE") + "]')");
  await click('.goal-more > summary');
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
  assert.deepEqual(after.runs, seeded.runs);
  assert.deepEqual(after.claims, seeded.claims);
  assert.deepEqual(after.evidence, seeded.evidence);
  assert.equal(after.claims.find((item) => item.claim_id === "core-history-claim")?.release_reason, "historical CORE lifecycle record");
  assert.deepEqual(after.runs.find((item) => item.run_id === "core-history-run")?.output_refs, ["artifact://core-lifecycle-history"]);
  assert.equal(after.evidence.find((item) => item.evidence_id === "core-history-evidence")?.locator, "artifact://core-lifecycle-history");
  assert.equal(after.board.active_goal_id, "WEB");
  const historyId = await evaluate(`document.querySelector('[data-source="legacy_evidence"]')?.dataset.timelineItem || ""`) as string;
  assert.ok(historyId, "CORE must keep the original Evidence timeline item after archive and restore");
  await click(`[data-timeline-item="${historyId}"]`);
  await waitFor("document.querySelector('[data-event-sheet] .event')");
  const body = await evaluate("document.querySelector('[data-event-sheet]')?.textContent || ''") as string;
  assert.match(body, /core-history-evidence/);
  assert.match(body, /artifact:\/\/core-lifecycle-history/);
});

test("Sources mutation and Feed reload preserve utility state while fresh Goal links still open Goals", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { origin, sessionId, command, evaluate, waitFor, click, navigate, reloadPage } = browser;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/V1?desktop=1#goal-records-V1" }, sessionId));
  await waitFor("document.body.dataset.desktopSurface === 'goal'");
  await click('[data-directory-panel="goals"] [data-directory-back]');
  await click('[data-work-surface-open="sources"]');
  await waitFor("document.body.dataset.desktopSurface === 'sources'");
  await click('[data-feed-sources-open]');
  await waitFor("document.querySelector('[data-feed-sources-dialog]')?.open");
  const sourceDefinition = await evaluate<string>("document.querySelector('[data-feed-rss-definition]').value");
  await navigate(() => click('[data-feed-source-register="rss"]'));
  await waitFor("document.body.dataset.desktopSurface === 'sources'");
  assert.equal(await evaluate("location.pathname"), "/goals/V1");
  const response = await fetch(origin + "/api/feed");
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.ok(snapshot.sources.some((source: { definition_id: string }) => source.definition_id === sourceDefinition));
  await click('[data-directory-panel="sources"] [data-directory-back]');
  await click('[data-work-surface-open="feed"][data-feed-preset="feed"]');
  await waitFor("document.body.dataset.desktopSurface === 'feed'");
  await reloadPage();
  await waitFor("document.body.dataset.desktopSurface === 'feed'");
  assert.equal(await evaluate("document.querySelector('[data-feed-directory]').dataset.feedPreset"), "feed");
  await navigate(() => command("Page.navigate", { url: origin + "/goals/RELEASE?desktop=1" }, sessionId));
  await waitFor("document.body.dataset.desktopSurface === 'goal' && Boolean(document.querySelector('[data-goal-view=RELEASE]'))");
});
