import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "../src/v1/demo.js";
import { GoalBoardCoordinator } from "../src/v1/coordinator.js";
import { buildGoalBoardWebView } from "../src/web/server.js";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("Draft editor adds/removes criteria, preserves failed input and saves one still-unaccepted Goal through real UI", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, before, sessionId, command, evaluate, waitFor, click, reloadPage } = browser;
  const coordinator = new GoalBoardCoordinator(store);
  const updates = () => buildGoalBoardWebView(store, coordinator, { boardId: DEMO_BOARD_ID }).goals
    .find(item => item.goal.goal_id === "RELEASE")!.events.filter(event => event.type === "goal.draft_updated");
  const beforeUpdates = updates();
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.navigate", { url: origin + "/goals/RELEASE" }, sessionId);
  await command("Page.bringToFront", {}, sessionId);
  const dom = (selector: string) => "document.querySelector(" + JSON.stringify(selector) + ")";
  await waitFor("document.readyState === 'complete' && " + dom('[data-open-goal-edit]'));
  await click("[data-open-goal-edit]");
  await waitFor(dom(".goal-edit-disclosure") + "?.open === true");
  const form = '[data-draft-form][data-goal-id="RELEASE"]';
  const row = form + " [data-criteria-list] > [data-criterion-row]";
  const initialCount = await evaluate<number>("document.querySelectorAll(" + JSON.stringify(row) + ").length");
  assert.ok(initialCount >= 1);
  await click("[data-add-criterion]");
  assert.equal(await evaluate("document.querySelectorAll(" + JSON.stringify(row) + ").length"), initialCount + 1);
  assert.equal(await evaluate("document.activeElement.dataset.criterionField"), "statement");
  await click(row + ":last-child [data-remove-criterion]");
  assert.equal(await evaluate("document.querySelectorAll(" + JSON.stringify(row) + ").length"), initialCount);
  for (let index = initialCount; index > 1; index--) await click(row + ":last-child [data-remove-criterion]");
  // Removing the last row clears it but retains one editable criterion.
  await click(row + " [data-remove-criterion]");
  assert.equal(await evaluate("document.querySelectorAll(" + JSON.stringify(row) + ").length"), 1);
  assert.equal(await evaluate(dom(row + ' [data-criterion-field="statement"]') + ".value"), "");
  await click("[data-add-criterion]");
  const values = { title: '浏览器草稿 "<safe>', outcome: "A saved, reopenable draft", why: "Preserve the user's changes",
    business_logic: "Edit, inspect and confirm later", priority: "68", in_scope: "Draft fields\nCriteria\nDraft fields",
    out_of_scope: "Automatic acceptance", constraints: "Keep Goal identity", required_inputs: "User facts",
    promised_outputs: "Saved draft", reason: "Browser verified package migration" };
  const criteria = [
    { criterion_id: "browser-c1", statement: 'Measured "<safe>', decision_method: "measurement", pass_condition: "At least 90", target: "90", required_evidence: "test, inspection，test" },
    { criterion_id: "browser-c2", statement: "Retained object target", decision_method: "inspection", pass_condition: "Fields remain", target: '{"min":1,"max":3}', required_evidence: "report" },
  ];
  await evaluate("(() => { const form = " + dom(form) + "; for (const [name, value] of Object.entries(" + JSON.stringify(values) +
    ")) { const field = form.elements.namedItem(name); field.value = value; field.dispatchEvent(new Event('input', {bubbles:true})); }" +
    "form.querySelector('[name=decomposition_state][value=closed_leaf]').checked = true;" +
    "const rows = form.querySelectorAll('[data-criteria-list] > [data-criterion-row]');" +
    JSON.stringify(criteria) + ".forEach((values, index) => { for (const [name, value] of Object.entries(values)) { const field = rows[index].querySelector('[data-criterion-field=' + name + ']'); field.value = value; field.dispatchEvent(new Event('input', {bubbles:true})); field.dispatchEvent(new Event('change', {bubbles:true})); } }); return true; })()");
  const submit = form + ' button[type="submit"]';
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/RELEASE/draft"] }, sessionId);
  await click(submit);
  await waitFor("!" + dom(form + " [data-draft-error]") + ".hidden && !" + dom(submit) + ".disabled");
  assert.equal(await evaluate(dom(form + " [name=title]") + ".value"), values.title);
  assert.equal(await evaluate(dom(row + ':last-child [data-criterion-field="target"]') + ".value"), criteria[1].target);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click(submit);
  await waitFor(dom("[data-toast]") + "?.textContent.includes('草稿修改已保存')");
  const after = store.snapshot(DEMO_BOARD_ID);
  const saved = after.goals.find(goal => goal.goal_id === "RELEASE")!;
  assert.equal(saved.title, values.title);
  assert.equal(saved.outcome, values.outcome);
  assert.equal(saved.why, values.why);
  assert.equal(saved.business_logic, values.business_logic);
  assert.equal(saved.priority, 68);
  assert.deepEqual(saved.in_scope, ["Draft fields", "Criteria"]);
  assert.deepEqual(saved.out_of_scope, ["Automatic acceptance"]);
  assert.deepEqual(saved.constraints, ["Keep Goal identity"]);
  assert.deepEqual(saved.required_inputs, ["User facts"]);
  assert.deepEqual(saved.promised_outputs, ["Saved draft"]);
  assert.equal(saved.decomposition_state, "closed_leaf");
  assert.equal(saved.definition_state, "draft");
  assert.equal(saved.accepted_at, null);
  assert.equal(saved.fulfillment_state, "unmet");
  assert.deepEqual(saved.acceptance_criteria.map(({ criterion_id, statement, decision_method, pass_condition, target, required_evidence }) =>
    ({ criterion_id, statement, decision_method, pass_condition, target, required_evidence })), [
    { ...criteria[0], target: { value: 90 }, required_evidence: ["test", "inspection"] },
    { ...criteria[1], target: { min: 1, max: 3 }, required_evidence: ["report"] },
  ]);
  const savedUpdates = updates();
  assert.equal(savedUpdates.length, beforeUpdates.length + 1);
  assert.equal(savedUpdates[0]?.reason, values.reason);
  assert.deepEqual(after.goals.filter(goal => goal.goal_id !== "RELEASE"), before.goals.filter(goal => goal.goal_id !== "RELEASE"));
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.runs, before.runs);
  await reloadPage();
  await waitFor(dom("#goal-tab-overview-RELEASE"));
  await click("#goal-tab-overview-RELEASE");
  await click("[data-open-goal-edit]");
  await waitFor(dom(".goal-edit-disclosure") + "?.open === true");
  assert.equal(await evaluate(dom(form + " [name=title]") + ".value"), values.title);
  assert.equal(await evaluate("document.querySelectorAll(" + JSON.stringify(row) + ").length"), 2);
  assert.equal(await evaluate(dom(row + ':last-child [data-criterion-field="target"]') + ".value"), criteria[1].target);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, after.goals);
});
