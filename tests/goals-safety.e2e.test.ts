import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

// Real browser controls, production HTTP handlers and an isolated persisted project.
test("Goals risk form validates, retries a failed request, saves, and survives browser reload", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, before, sessionId, command, evaluate, waitFor, click, reloadPage } = browser;
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.navigate", { url: origin + "/goals/V1" }, sessionId);
  await command("Page.bringToFront", {}, sessionId);
  await waitFor("document.readyState === 'complete' && document.querySelector('[data-goal-event-document]')");
  await click('[data-event-reader="description"]');
  await waitFor("document.querySelector('[data-event-panel=\"description\"]') && document.querySelector('[data-event-panel=\"description\"]').hidden === false");
  await waitFor("document.querySelector('#goal-factor-tab-risks-V1')");
  await click("#goal-factor-tab-risks-V1");
  await click("#goal-factor-panel-risks-V1 .risk-create > summary");
  const formSelector = '#goal-factor-panel-risks-V1 [data-risk-create-form]';
  const submitSelector = formSelector + ' button[type="submit"]';
  const dom = (selector: string) => "document.querySelector(" + JSON.stringify(selector) + ")";
  await click(submitSelector);
  await waitFor("document.querySelector('#goal-factor-panel-risks-V1 [name=description]')?.getAttribute('aria-invalid') === 'true'");
  assert.equal(store.snapshot(DEMO_BOARD_ID).risks.length, before.risks.length);
  const description = 'Browser risk "quoted" <unsafe> ';
  const values = { description, impact: "Release install can fail", trigger: "First-run failure", revisit_condition: "After packaged rehearsal",
    probability: "medium", owner: "release-owner", treatment: "mitigate", blocking_mode: "none", treatment_plan: "Rehearse isolated first run",
    affected_surfaces: "installer\nlauncher", reason: "Real UI migration regression" };
  await evaluate("(() => { const form = " + dom(formSelector) + "; for (const [name, value] of Object.entries(" + JSON.stringify(values) +
    ")) { const field = form.elements.namedItem(name); field.value = value; field.dispatchEvent(new Event('input', {bubbles:true}));" +
    "field.dispatchEvent(new Event('change', {bubbles:true})); } return true; })()");
  // Fail the actual browser request, retain the form, then retry without duplicate writes.
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/V1/risks"] }, sessionId);
  await click(submitSelector);
  await waitFor("!" + dom(submitSelector) + "?.disabled && !" + dom(formSelector + " [data-risk-error]") + "?.hidden");
  assert.equal(store.snapshot(DEMO_BOARD_ID).risks.length, before.risks.length);
  assert.equal(await evaluate(dom(formSelector) + ".elements.description.value"), description);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click(submitSelector);
  await waitFor("document.querySelector('[data-factor-write-receipt]')?.textContent.includes('风险已记录')");
  const saved = store.snapshot(DEMO_BOARD_ID);
  assert.equal(saved.risks.length, before.risks.length + 1);
  const risk = saved.risks.find(risk => risk.description === description.trim());
  assert.ok(risk);
  assert.equal(risk.state, "open");
  assert.equal(risk.owner, values.owner);
  assert.equal(risk.treatment, "mitigate");
  assert.equal(risk.blocking_mode, "none");
  assert.equal(risk.treatment_plan, values.treatment_plan);
  assert.deepEqual(risk.affected_surfaces, ["installer", "launcher"]);
  assert.equal(risk.impact, values.impact);
  assert.equal(risk.trigger, values.trigger);
  assert.equal(risk.revisit_condition, values.revisit_condition);
  assert.equal(risk.probability, values.probability);
  await reloadPage();
  await waitFor("document.readyState === 'complete' && document.querySelector('[data-goal-event-document]')");
  await click('[data-event-reader="description"]');
  await waitFor("document.querySelector('[data-event-panel=\"description\"]') && document.querySelector('[data-event-panel=\"description\"]').hidden === false");
  await waitFor("document.querySelector('#goal-factor-tab-risks-V1')");
  await click("#goal-factor-tab-risks-V1");
  const record = "#risk-" + risk.risk_id;
  await waitFor(dom(record));
  const rendered = await evaluate<{ title: string; aria: string; link: string }>("(() => { const record = " + dom(record) +
    "; return { title: record.querySelector('h4').textContent, aria: record.querySelector('[data-risk-goal-filter]').getAttribute('aria-label')," +
    "link: record.querySelector('.risk-linked-goals a').getAttribute('href') }; })()");
  assert.equal(rendered.title, description.trim());
  assert.equal(rendered.aria, "筛选" + description.trim() + "的受影响 Goal");
  assert.equal(rendered.link, "/goals/V1");
  assert.equal(store.snapshot(DEMO_BOARD_ID).risks.filter(risk => risk.description === description.trim()).length, 1);
});
