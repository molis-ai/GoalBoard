import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCliGoalCommandHandlers } from "@adeptify/goalboard-app-cli";
import { createMcpGoalToolHandlers } from "@adeptify/goalboard-app-mcp";
import { GoalBoardCoordinator } from "../src/v1/coordinator.js";
import { SqliteGoalBoardStore } from "../src/v1/store.js";

test("Goal wire handlers preserve Board/actor conversion, persistent facts and Runtime risk authority", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-goal-wire-"));
  const store = new SqliteGoalBoardStore(join(directory, "project.db"));
  try {
    const coordinator = new GoalBoardCoordinator(store);
    for (const boardId of ["selected", "nested"]) {
      coordinator.initializeBoard({ board_id: boardId, title: boardId, actor_id: "user", idempotency_key: `init-${boardId}` });
    }
    for (const goalId of ["parent", "child"]) {
      coordinator.goals.commands.createGoal("selected", {
        goal_id: goalId, title: goalId, outcome: "保留原事实", why: "验证命令转换",
        business_logic: "入口不改写领域语义。", definition_state: "draft", decomposition_state: "abstract", acceptance_criteria: [],
      }, { actor_id: "user", idempotency_key: `create-${goalId}` });
    }
    const cli = createCliGoalCommandHandlers(coordinator.goals);
    const runtime = createMcpGoalToolHandlers(coordinator.goals, "runtime");
    const management = createMcpGoalToolHandlers(coordinator.goals, "management");
    const untouched = store.snapshot("nested");
    await cli["relation-add"]({ board_id: "selected", actor_id: 7, idempotency_key: "relation",
      relation: { from_goal_id: "child", to_goal_id: "parent", type: "part_of", reason: "子目标结果" } });
    const relation = store.snapshot("selected").relations.find((item) => item.from_goal_id === "child")!;
    assert.equal(relation.to_goal_id, "parent");
    assert.equal(relation.created_by, "7");

    const impactInput = { board_id: "selected", payload: { board_id: "nested", actor_id: "runtime",
      idempotency_key: "impact", impact: { goal_id: "child", surface: "module:inputs", access: "read", reason: "读取输入" } } };
    const impact = await runtime.goalboard_v1_impact_add(impactInput);
    assert.equal(impact.impact.board_id, "selected");
    assert.equal(impact.impact.surface, "module:inputs");
    const repeated = await runtime.goalboard_v1_impact_add(impactInput);
    assert.equal(repeated.replayed, true);
    assert.equal(repeated.impact.binding_id, impact.impact.binding_id);
    assert.equal(store.snapshot("selected").impacts.length, 1);
    assert.deepEqual(store.snapshot("nested"), untouched);

    const risk = await cli["risk-add"]({ board_id: "selected", actor_id: "user", idempotency_key: "risk",
      risk: { goal_ids: ["child"], description: "残余风险", probability: "low", impact: "low", trigger: "实际发生",
        treatment: "accept", blocking_mode: "none", revisit_condition: "输入变化", owner: "user" } });
    const beforeDenied = store.snapshot("selected");
    const update = { board_id: "selected", payload: { board_id: "nested", actor_id: "runtime", actor_kind: "user",
      idempotency_key: "deny-risk", risk: { risk_id: risk.risk.risk_id, state: "accepted", reason: "确认接受" } } };
    await assert.rejects(() => runtime.goalboard_v1_risk_state(update),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "risk.user_acceptance_required");
    assert.deepEqual(store.snapshot("selected"), beforeDenied);
    const accepted = await management.goalboard_v1_risk_state({ ...update,
      payload: { ...update.payload, actor_id: "user", actor_kind: "runtime", idempotency_key: "user-accept-risk" } });
    assert.equal(accepted.risk.state, "accepted", "the management audience retains user authority irrespective of a model field");
    assert.equal(store.snapshot("selected").risks.find((item) => item.risk_id === risk.risk.risk_id)!.state, "accepted");
    assert.deepEqual(store.snapshot("nested"), untouched);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
