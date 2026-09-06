import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoalBoardCoordinator, GoalBoardV1Error } from "../src/v1/coordinator.js";
import { SqliteGoalBoardStore } from "../src/v1/store.js";

test("confirmed Policy writes preserve resolution, replacement audit and atomic failure through the Goals owner", () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dd2-policy-"));
  const store = new SqliteGoalBoardStore(join(directory, "project.db"));
  const coordinator = new GoalBoardCoordinator(store);
  try {
    coordinator.initializeBoard({ board_id: "board", title: "Policy", actor_id: "user", idempotency_key: "init" });
    coordinator.goals.commands.createGoal("board", { goal_id: "draft", title: "草稿", outcome: "", why: "", business_logic: "", acceptance_criteria: [] },
      { actor_id: "user", idempotency_key: "create" });
    const original = coordinator.goals.commands.setPolicy("board", { goal_id: "draft", policy: { max_lease_seconds: 900 }, reason: "原规则" },
      { actor_id: "user", idempotency_key: "initial-policy" });
    const context = { board_id: "board", actor_id: "user", reason: "确认提案中的新规则", at: "2026-09-06T02:00:00.000Z", source_item_id: "policy-item" };
    const replacement = coordinator.goals.commands.applyConfirmedPolicy({ ...context, operation: "replace", goal_id: "draft",
      policy_binding_id: "replacement", policy: { goal_mode: "required", required_capabilities: [" z ", "a", "a", 7], max_lease_seconds: 600 } });
    assert.equal(replacement.policy_binding_id, "replacement");
    const policy = coordinator.getResolvedGoalPolicy({ board_id: "board", goal_id: "draft" });
    assert.equal(policy.goal_mode, "required");
    assert.deepEqual(policy.required_capabilities, ["7", "a", "z"]);
    assert.equal(policy.max_lease_seconds, 600);
    const rows = () => store.db.prepare("SELECT * FROM policy_bindings ORDER BY policy_binding_id").all();
    const savedRows = rows();
    assert.equal((savedRows as { policy_binding_id: string; state: string }[]).find(row => row.policy_binding_id === original.policy_binding_id)?.state, "replaced");
    const events = () => store.db.prepare("SELECT * FROM events ORDER BY seq").all();
    const added = store.db.prepare("SELECT payload_json FROM events WHERE type = 'policy.added_from_tree_proposal'").get() as { payload_json: string };
    assert.deepEqual(JSON.parse(added.payload_json), { proposal_item_id: "policy-item", goal_id: "draft", scope: "goal", replaced_binding_ids: [original.policy_binding_id] });
    const beforeFailure = events();
    assert.throws(() => coordinator.goals.commands.applyConfirmedPolicy({ ...context, operation: "replace", goal_id: "draft",
      policy_binding_id: "replacement", policy: { max_lease_seconds: 300 } }), /UNIQUE/);
    assert.deepEqual(rows(), savedRows, "insert failure restores the previously active rule");
    assert.deepEqual(events(), beforeFailure);
    assert.throws(() => coordinator.goals.commands.applyConfirmedPolicy({ ...context, operation: "replace", goal_id: "draft", policy: { self_verification: "false" } }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "goal_tree_proposal.policy_boolean_invalid");
    assert.deepEqual(rows(), savedRows);
    assert.throws(() => coordinator.goals.commands.applyConfirmedPolicy({ ...context, board_id: "another-board", operation: "deactivate", policy_binding_id: "replacement" }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "goal_tree_proposal.policy_not_active");
    assert.deepEqual(rows(), savedRows);
    coordinator.goals.commands.applyConfirmedPolicy({ ...context, operation: "deactivate", policy_binding_id: "replacement" });
    assert.equal(coordinator.getResolvedGoalPolicy({ board_id: "board", goal_id: "draft" }).goal_mode, "preferred");
    const afterDeactivation = events();
    assert.throws(() => coordinator.goals.commands.applyConfirmedPolicy({ ...context, operation: "deactivate", policy_binding_id: "replacement" }), /不再生效/);
    assert.deepEqual(events(), afterDeactivation, "a failed repeated deactivation does not append another event");
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
