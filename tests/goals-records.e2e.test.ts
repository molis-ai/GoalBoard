import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("progress and read-only records keep Goal facts, risk links and owner sections usable through real navigation", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate, reloadPage } = browser;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/RELEASE" }, sessionId));
  await waitFor("document.querySelector('#goal-tab-progress-RELEASE')");
  await click("#goal-tab-progress-RELEASE");
  await waitFor("document.querySelector('#goal-panel-progress-RELEASE').dataset.loaded === 'true'");
  const progress = '#goal-panel-progress-RELEASE';
  await click(progress + ' [data-focus-section-trigger="risks"]');
  assert.equal(await evaluate("document.querySelector(" + JSON.stringify(progress + ' [data-focus-section-body="risks"]') + ").getAttribute('aria-hidden')"), "false");
  const risk = before.risks.find(r => r.risk_id === "RISK-FIRST-RESTART")!;
  assert.equal(await evaluate("document.querySelector('.risk-summary a strong').textContent"), risk.description);
  assert.equal(await evaluate("document.querySelector('.risk-summary header > strong').textContent"), "1");
  await click('.risk-summary a[href="#risk-RISK-FIRST-RESTART"]');
  await waitFor("document.querySelector('#goal-panel-factors-RELEASE').dataset.loaded === 'true' && document.querySelector('[data-goal-factor-tab=" + JSON.stringify("risks") + "]').getAttribute('aria-selected') === 'true'");
  assert.equal(await evaluate("location.hash"), "#risk-RISK-FIRST-RESTART");
  assert.equal(await evaluate("document.querySelector('#risk-RISK-FIRST-RESTART h4').textContent"), risk.description);
  await reloadPage();
  await waitFor("document.querySelector('#risk-RISK-FIRST-RESTART') && document.querySelector('#goal-panel-factors-RELEASE').hidden === false");

  await click("#goal-tab-progress-RELEASE");
  await waitFor("document.querySelector('#goal-panel-progress-RELEASE').dataset.loaded === 'true'");
  await click(progress + ' [data-focus-section-trigger="checks"]');
  const checks = await evaluate<string>("document.querySelector('.rule-summary').textContent");
  assert.match(checks, /完成前还需要哪些检查/);
  assert.match(checks, /推进者需要先检查自己的结果/);

  await click("#goal-tab-records-RELEASE");
  await waitFor("document.querySelector('[data-goal-records-content]').dataset.loaded === 'true'");
  const records = '[data-goal-section="technical"]';
  const metadata = await evaluate<Array<[string, string]>>("[...document.querySelectorAll('.technical-meta > div')].map(row => [row.querySelector('dt').textContent,row.querySelector('dd').textContent])");
  assert.equal(metadata.find(([key]) => key === "Goal ID")?.[1], "RELEASE");
  assert.equal(metadata.find(([key]) => key === "优先级")?.[1], String(before.goals.find(g => g.goal_id === "RELEASE")!.priority));
  assert.equal(await evaluate("document.querySelectorAll(" + JSON.stringify(records + ' form') + ").length"), 0);
  await click(records + ' [data-focus-section-trigger="basics"]');
  await command("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "End", windowsVirtualKeyCode: 35 }, sessionId);
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "End", windowsVirtualKeyCode: 35 }, sessionId);
  assert.equal(await evaluate("document.activeElement.dataset.focusSectionTrigger"), "rules");
  assert.equal(await evaluate("document.querySelector(" + JSON.stringify(records + ' [data-focus-section-body="rules"]') + ").getAttribute('aria-hidden')"), "false");
  assert.equal(await evaluate("document.querySelector('#record-risk-RISK-FIRST-RESTART h4').textContent"), risk.description);
  assert.equal(await evaluate("document.querySelectorAll(" + JSON.stringify(records + ' [data-risk-edit-form], ' + records + ' [data-policy-form], ' + records + ' [data-relation-form]') + ").length"), 0);
  await click(records + ' [data-focus-section-trigger="execution"]');
  assert.match(await evaluate<string>("document.querySelector('#execution-RELEASE').textContent"), /领取记录[\s\S]*推进记录[\s\S]*完成依据[\s\S]*检查记录/);
  await click(records + ' [data-focus-section-trigger="history"]');
  assert.equal(await evaluate("document.querySelector(" + JSON.stringify(records + ' [data-focus-section-body="history"]') + ").hasAttribute('inert')"), false);
  await reloadPage();
  await waitFor("document.querySelector('[data-goal-records-content]')?.dataset.loaded === 'true'");
  assert.equal(await evaluate("document.querySelector('#goal-tab-records-RELEASE').getAttribute('aria-selected')"), "true");
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const key of ["goals", "relations", "risks", "claims", "runs", "evidence"] as const) assert.deepEqual(after[key], before[key]);
  assert.equal(after.board.active_goal_id, before.board.active_goal_id);
});

test("record pagination cancels cleanly, ignores a late page and retries without duplicate history", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, navigate, evaluate, click, waitFor } = browser;
  const goal = before.goals.find(g => g.goal_id === "RELEASE")!;
  // More than the 40-event first page, using real Draft writes rather than fabricated event rows.
  const reasons = Array.from({ length: 45 }, (_, i) => "Pagination fixture revision " + (i + 1));
  for (const reason of reasons) {
    const response = await fetch(origin + "/api/goals/RELEASE/draft", {
      method: "POST", headers: { "content-type": "application/json", origin,
        "x-goalboard-control-token": "goals-risk-test-control-token-0123456789",
        "x-goalboard-idempotency-key": reason },
      body: JSON.stringify({ ...goal, title: goal.title + " " + reason, reason }),
    });
    assert.equal(response.status, 200, await response.text());
  }
  const baseline = store.snapshot(DEMO_BOARD_ID);
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/RELEASE" }, sessionId));
  await click("#goal-tab-records-RELEASE");
  await waitFor("document.querySelector('[data-goal-records-content]').dataset.loaded === 'true'");
  await click('[data-goal-section="technical"] [data-focus-section-trigger="history"]');
  await evaluate("Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))");
  await click(".full-records > summary");
  assert.equal(await evaluate("document.querySelectorAll('[data-goal-event-seq]').length"), 40);
  await evaluate(`(() => {
    const originalFetch = globalThis.fetch;
    let held = false;
    globalThis.fetch = async (input, options) => {
      const response = await originalFetch(input, options);
      if (!held && new URL(String(input), location.href).pathname === '/api/goals/RELEASE/record-events') {
        held = true;
        const body = await response.text();
        globalThis.__heldEvents = true;
        await new Promise(resolve => { globalThis.__releaseEvents = resolve; });
        return new Response(body, {status:response.status,headers:response.headers});
      }
      return response;
    };
    return true;
  })()`);
  await click("[data-load-more-goal-events]");
  await waitFor("globalThis.__heldEvents === true");
  await click("#goal-tab-overview-RELEASE");
  assert.equal(await evaluate("document.querySelector('[data-load-more-goal-events]').disabled"), false);
  await evaluate("__releaseEvents(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("document.querySelectorAll('[data-goal-event-seq]').length"), 40);
  await click("#goal-tab-records-RELEASE");
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/RELEASE/record-events*"] }, sessionId);
  await click("[data-load-more-goal-events]");
  await waitFor("document.querySelector('[data-goal-event-error]').hidden === false && !document.querySelector('[data-load-more-goal-events]').disabled");
  assert.equal(await evaluate("document.querySelectorAll('[data-goal-event-seq]').length"), 40);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click("[data-load-more-goal-events]");
  await waitFor("!document.querySelector('[data-load-more-goal-events]')");
  const sequences = await evaluate<string[]>("[...document.querySelectorAll('[data-goal-event-seq]')].map(row => row.dataset.goalEventSeq)");
  assert.equal(new Set(sequences).size, sequences.length);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-goal-event-seq] dd')].map(node => node.textContent).filter(text => text.startsWith('Pagination fixture revision '))"), reasons.slice().reverse());
  assert.equal(await evaluate("document.querySelector('[data-goal-event-progress]').textContent"), `已显示 ${sequences.length}/${sequences.length} 条事件`);
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const key of ["goals", "relations", "risks", "claims", "runs", "evidence"] as const) assert.deepEqual(after[key], baseline[key]);
  assert.equal(after.board.active_goal_id, baseline.board.active_goal_id);
});

test("cancelled full records can reopen before the old body resolves without replacing the newer DOM", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, navigate, evaluate, click, waitFor } = browser;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/RELEASE" }, sessionId));
  await evaluate(`(() => {
    const originalFetch = globalThis.fetch;
    let held = false;
    globalThis.fetch = async (input, options) => {
      const response = await originalFetch(input, options);
      if (!held && new URL(String(input), location.href).pathname === '/api/goals/RELEASE/records') {
        held = true;
        const body = await response.text();
        globalThis.__heldRecords = true;
        await new Promise(resolve => { globalThis.__releaseRecords = resolve; });
        return new Response(body, {status:response.status,headers:response.headers});
      }
      return response;
    };
    return true;
  })()`);
  await click("#goal-tab-records-RELEASE");
  await waitFor("globalThis.__heldRecords === true");
  await click("#goal-tab-overview-RELEASE");
  assert.equal(await evaluate("document.querySelector('[data-goal-records-content]').dataset.loading"), "false");
  assert.equal(await evaluate("document.querySelector('[data-goal-records-content]').hasAttribute('aria-busy')"), false);
  await click("#goal-tab-records-RELEASE");
  await waitFor("document.querySelector('[data-goal-records-content]').dataset.loaded === 'true'");
  await evaluate("globalThis.__newRecordsDom = document.querySelector('[data-goal-section=technical]'); true");
  await evaluate("__releaseRecords(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("document.querySelector('[data-goal-section=technical]') === globalThis.__newRecordsDom"), true);
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const key of ["goals", "relations", "risks", "claims", "runs", "evidence"] as const) assert.deepEqual(after[key], before[key]);
});
