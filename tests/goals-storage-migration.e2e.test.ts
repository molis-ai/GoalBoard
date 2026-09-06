import assert from "node:assert/strict";
import test from "node:test";
import { GoalsQueryService, GoalsRepository } from "@adeptify/goalboard-module-goals";
import { DEMO_BOARD_ID } from "../src/v1/demo.js";
import { SqliteGoalBoardStore } from "../src/v1/store.js";
import { GoalBoardCoordinator } from "../src/v1/coordinator.js";
import { importV3Board } from "../src/v1/migration.js";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("V3 imported coverage remains visible and its Goal editable after Host reopen and browser refresh", { timeout: 60_000 }, async t => {
  let path = "";
  const browser = await openGoalBrowser(t, false, databasePath => {
    path = databasePath;
    const store = new SqliteGoalBoardStore(path);
    try {
      importV3Board(store, new GoalBoardCoordinator(store), {
        schema_version: "3.0", goal_id: "old", meta: { title: "历史项目" }, root_goal: { constraints: ["无损"] },
        goals: [{ id: "child", parent: null, one_liner: "历史目标", covers: ["keep"], inputs: ["历史输入"], outputs: ["历史输出"] }],
        coverage_ledger: [{ id: "keep", requirement: "迁移后保留需求覆盖", status: "now", owner_goal: "child", reason: "历史确认理由" }],
      }, { target_board_id: DEMO_BOARD_ID, actor_id: "original-user", idempotency_key: "browser-v3-import" });
    } finally { store.close(); }
  });
  if (!browser) return;
  const { store, before, origin, sessionId, command, navigate, evaluate, click, waitFor, reloadPage } = browser;
  const goalId = before.goals.find(goal => goal.title === "历史目标")!.goal_id;
  const query = new GoalsQueryService(new GoalsRepository(store.db));
  const coverage = query.listLegacyCoverage(DEMO_BOARD_ID);
  const dom = (selector: string) => `document.querySelector(${JSON.stringify(selector)})`;
  const tab = (name: string) => `[id="goal-tab-${name}-${goalId}"]`;
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/" + encodeURIComponent(goalId) }, sessionId));
  await click(tab("records"));
  await waitFor(dom("[data-goal-records-content]") + "?.dataset.loaded === 'true'");
  assert.match(await evaluate<string>(dom("[data-goal-records-content]") + ".textContent"), /迁移后保留需求覆盖[\s\S]*历史确认理由/);
  await reloadPage();
  await waitFor(dom("[data-goal-records-content]") + "?.dataset.loaded === 'true'");
  assert.match(await evaluate<string>(dom("[data-goal-records-content]") + ".textContent"), /迁移后保留需求覆盖/);
  await click(tab("overview"));
  await click("[data-open-goal-edit]");
  await waitFor(dom(".goal-edit-disclosure") + "?.open === true");
  const form = `[data-draft-form][data-goal-id="${goalId}"]`;
  await evaluate(`(() => { const form = ${dom(form)};
    for (const [name, value] of Object.entries({title:'迁移后继续编辑', reason:'验证原目标可继续使用'})) {
      const field = form.elements.namedItem(name); field.value = value; field.dispatchEvent(new Event('input', {bubbles:true}));
    } return true; })()`);
  await click(form + ' button[type="submit"]');
  await waitFor(dom("[data-toast]") + "?.textContent.includes('草稿修改已保存')");
  assert.equal(query.getGoal(DEMO_BOARD_ID, goalId)!.title, "迁移后继续编辑");
  assert.equal(query.getGoal(DEMO_BOARD_ID, goalId)!.definition_state, "draft");
  assert.deepEqual(query.listLegacyCoverage(DEMO_BOARD_ID), coverage);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).relations, before.relations);
  await reloadPage();
  await click(tab("overview"));
  await click("[data-open-goal-edit]");
  await waitFor(dom(".goal-edit-disclosure") + "?.open === true");
  assert.equal(await evaluate(dom(form + ' [name="title"]') + ".value"), "迁移后继续编辑");
  const reopened = new SqliteGoalBoardStore(path);
  try {
    const persisted = new GoalsQueryService(new GoalsRepository(reopened.db));
    assert.equal(persisted.getGoal(DEMO_BOARD_ID, goalId)!.title, "迁移后继续编辑");
    assert.deepEqual(persisted.listLegacyCoverage(DEMO_BOARD_ID), coverage);
  } finally { reopened.close(); }
});
