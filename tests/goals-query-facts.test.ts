import assert from "node:assert/strict";
import test from "node:test";
import { GoalsModule } from "@adeptify/goalboard-module-goals";
import { GovernanceRecordStore } from "@adeptify/goalboard-module-governance-collaboration";
import { GoalBoardCoordinator } from "../src/v1/coordinator.js";
import { SqliteGoalBoardStore } from "../src/v1/store.js";
import { buildGoalBoardWebView } from "../src/web/server.js";

test("public Query preserves complete rule history, linked risks and Runtime dependency/replacement facts", () => {
  const store = new SqliteGoalBoardStore(":memory:");
  try {
    const coordinator = new GoalBoardCoordinator(store);
    const goals = new GoalsModule(store.db, {
      supersedePendingContractProposals: (...args) => new GovernanceRecordStore(store.db).supersedePendingContractProposals(...args),
      currentActionToken: (_board, goal) => `token:${goal}`,
      authorizeRiskUpdate: () => undefined, authorizeRiskState: () => undefined,
      transitionRevisionDependents: () => undefined, reconcileLifecycle: (_board, goal) => ({ goal_id: goal }),
    });
    for (const board of ["query-main", "query-other"]) coordinator.initializeBoard({
      board_id: board, title: board, actor_id: "user", idempotency_key: `init:${board}`,
    });
    for (const id of ["subject", "dep-a", "dep-z", "replacement-a", "replacement-z", "foreign"]) {
      goals.commands.createGoal(id === "foreign" ? "query-other" : "query-main", {
        goal_id: id, title: id, outcome: `${id} outcome`, why: "Query compatibility", business_logic: "Read unchanged Goal facts",
        definition_state: "accepted", decomposition_state: "closed_leaf",
        acceptance_criteria: [{ criterion_id: `${id}-result`, statement: "Result readable", decision_method: "inspection", pass_condition: "Read exact facts" }],
      }, { actor_id: "user", idempotency_key: `create:${id}` });
    }
    const at = "2026-09-01T01:00:00.000Z";
    // Historical rows deliberately include inactive rules and equal timestamps.
    const rule = store.db.prepare(`INSERT INTO policy_bindings
      (policy_binding_id, board_id, goal_id, scope, policy_json, state, created_by, reason, created_at)
      VALUES (?, ?, ?, 'goal', ?, ?, 'historical-user', ?, ?)`);
    for (const [id, state, count] of [["rule-z", "withdrawn", 3], ["rule-a", "replaced", 1], ["rule-m", "active", 2]] as const) {
      rule.run(id, "query-main", "subject", JSON.stringify({ cross_reviewers: count }), state, `reason:${id}`, at);
    }
    rule.run("rule-foreign", "query-other", "foreign", '{"cross_reviewers":9}', "active", "foreign", at);
    const expectedHistory = [["rule-a", "replaced", 1], ["rule-m", "active", 2], ["rule-z", "withdrawn", 3]].map(([id, state, count]) => ({
      policy_binding_id: id, goal_id: "subject", scope: "goal", policy: { cross_reviewers: count },
      state, created_by: "historical-user", reason: `reason:${id}`, created_at: at,
    }));
    assert.deepEqual(goals.query.listPolicyHistory("query-main"), expectedHistory);
    assert.equal(goals.query.resolvePolicy("query-main", "subject").cross_reviewers, 2, "Historical rules must not affect current policy");

    const relation = store.db.prepare(`INSERT INTO goal_relations
      (relation_id, board_id, from_goal_id, to_goal_id, type, state, reason, created_by, created_at)
      VALUES (?, 'query-main', ?, ?, ?, ?, 'historical relation', 'user', ?)`);
    relation.run("dependency-z", "subject", "dep-z", "depends_on", "active", at);
    relation.run("dependency-a", "subject", "dep-a", "depends_on", "active", at);
    relation.run("inactive-dependency", "subject", "replacement-a", "depends_on", "inactive", at);
    relation.run("replacement-a", "replacement-a", "subject", "replaces", "active", at);
    relation.run("replacement-z", "replacement-z", "subject", "replaces", "active", at);
    store.db.prepare("UPDATE goals SET archived_at = ? WHERE goal_id = 'dep-a'").run(at);
    store.db.prepare("UPDATE goals SET trashed_at = ? WHERE goal_id = 'dep-z'").run(at);
    assert.deepEqual(goals.query.listDependencies("query-main", "subject"), ["dep-a", "dep-z"].map(goal_id => ({
      goal_id, title: goal_id, fulfillment_state: "unmet", validity_state: "valid",
    })), "Existing dependency reads include archived/trashed facts; migration must not silently filter them");
    assert.deepEqual(goals.query.activeReplacement("query-main", "subject"), {
      relation_id: "replacement-z", replacement_goal_id: "replacement-z", replacement_goal_title: "replacement-z",
    });
    assert.deepEqual(goals.query.listDependencies("query-other", "subject"), []);
    assert.equal(goals.query.activeReplacement("query-other", "subject"), null);

    for (const [id, links, mode] of [["risk-z", ["subject", "dep-a"], "completion"], ["risk-a", ["subject"], "claim"], ["risk-closed", ["subject"], "none"], ["risk-foreign", ["foreign"], "claim"]] as const) {
      goals.commands.addRisk(id === "risk-foreign" ? "query-other" : "query-main", {
        risk_id: id, goal_ids: [...links], description: `description:${id}`, probability: "low", impact: "high",
        trigger: "fixture condition", treatment: "mitigate", treatment_plan: "Check actual read path", blocking_mode: mode,
        revisit_condition: `revisit:${id}`, owner: "user", affected_surfaces: ["goal-facts"],
      }, { actor_id: "user", idempotency_key: `risk:${id}` });
    }
    store.db.prepare("UPDATE risks SET state = 'resolved' WHERE risk_id = 'risk-closed'").run();
    assert.deepEqual(goals.query.listOpenGoalRisks("query-main", "subject").map(risk => [risk.risk_id, risk.blocking_mode, risk.affected_surfaces]),
      [["risk-a", "claim", ["goal-facts"]], ["risk-z", "completion", ["goal-facts"]]]);
    assert.deepEqual(goals.query.listOpenGoalRisks("query-other", "subject"), []);
    const before = store.snapshot("query-main");
    const view = buildGoalBoardWebView(store, coordinator, { boardId: "query-main" });
    assert.deepEqual(view.policy_bindings, expectedHistory, "The real Web view must carry inactive rules and original ordering");
    const webSubject = view.goals.find(item => item.goal.goal_id === "subject")!;
    assert.deepEqual(webSubject.risks.find(risk => risk.risk_id === "risk-z")?.goal_ids, ["dep-a", "subject"]);
    assert.ok(!webSubject.risks.some(risk => risk.risk_id === "risk-foreign"));
    const replaced = coordinator.explainGoal({ board_id: "query-main", goal_id: "subject", actor_id: "runtime", role: "executor", capabilities: [], goal_mode_attestation: true });
    assert.ok(replaced.reasons.some(reason => reason.code === "goal.replaced" && reason.message.includes("replacement-z")));
    store.db.prepare("UPDATE goal_relations SET state = 'inactive' WHERE type = 'replaces'").run();
    const blocked = coordinator.explainGoal({ board_id: "query-main", goal_id: "subject", actor_id: "runtime", role: "executor", capabilities: [], goal_mode_attestation: true });
    assert.deepEqual(blocked.reasons.filter(reason => reason.code === "dependency.unsatisfied").map(reason => reason.subject_id), ["dep-a", "dep-z"]);
    assert.deepEqual(blocked.reasons.filter(reason => reason.code === "risk.blocks_claim").map(reason => [reason.subject_id, reason.remediation]), [["risk-a", "revisit:risk-a"]]);
    const after = store.snapshot("query-main");
    assert.deepEqual(after.goals, before.goals);
    assert.deepEqual(after.risks, before.risks);
    assert.deepEqual(after.claims, before.claims, "Read paths must not create Runtime work");
  } finally { store.close(); }
});
