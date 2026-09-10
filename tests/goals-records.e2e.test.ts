import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("Goal description keeps risk links and hash targets usable through real navigation", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate, reloadPage } = browser;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  const riskVisible = "(() => { const e = document.getElementById('risk-RISK-FIRST-RESTART'); return Boolean(e && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 && !e.closest('[hidden]')); })()";
  await navigate(() => command("Page.navigate", { url: origin + "/goals/RELEASE#risk-RISK-FIRST-RESTART" }, sessionId));
  await waitFor(riskVisible);
  const risk = before.risks.find(item => item.risk_id === "RISK-FIRST-RESTART")!;
  assert.equal(await evaluate(`document.querySelector('[data-goal-factor-tab="risks"]').getAttribute("aria-selected")`), "true");
  assert.match(await evaluate<string>("document.querySelector('#risk-RISK-FIRST-RESTART')?.textContent || ''"), new RegExp(risk.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await reloadPage();
  await waitFor(riskVisible);
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const key of ["goals", "relations", "risks", "claims", "runs", "evidence"] as const) assert.deepEqual(after[key], before[key]);
  assert.equal(after.board.active_goal_id, before.board.active_goal_id);
});
