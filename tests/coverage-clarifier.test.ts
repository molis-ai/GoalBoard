import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoalBoardCoordinator, SqliteGoalBoardStore, type DecompositionReview } from "../apps/local-host/sdk/index.js";

const board_id = "coverage-board";
const actor_id = "runtime";
const at = "2026-09-06T12:00:00.000Z";
const parentQuery = { board_id, goal_id: "parent" };

function contract(goal_id: string) {
  return { goal_id, title: `验证 ${goal_id}`, outcome: "恢复已有数据并验证结果", why: "保证已有功能无损",
    business_logic: "用恢复结果证明数据没有丢失", in_scope: ["已有数据恢复"], out_of_scope: ["新增同步功能"],
    constraints: ["保留历史"], required_inputs: ["离线备份"], promised_outputs: ["恢复结果"],
    definition_state: "accepted" as const, decomposition_state: "closed_leaf" as const,
    acceptance_criteria: [{ criterion_id: `${goal_id}-check`, statement: "数据恢复完整",
      decision_method: "automated_check" as const, pass_condition: "前后数据一致", target: null, required_evidence: ["test"] }] };
}

function coverage(): DecompositionReview {
  return { status: "complete", product_context: "other",
    coverage: ["user_outcome", "operating_flow", "supporting_foundation", "quality_and_delivery"].map(area =>
      ({ area, disposition: "owned", goal_ids: ["child"], reason: "子目标负责恢复并检查结果" })),
    open_goal_ids: [], next_step: "等待子目标完成",
    contract_coverage: {
      promised_outputs: [{ parent_promised_output: "恢复结果", status: "complete",
        child_outputs: [{ goal_id: "child", promised_output: "恢复结果" }], reason: "子目标交付完整结果" }],
      acceptance_criteria: [{ parent_criterion_id: "parent-check", status: "complete",
        child_criteria: [{ goal_id: "child", criterion_id: "child-check" }], reason: "子目标证明恢复完整" }],
    } };
}

function fixture(t: test.TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-coverage-clarifier-"));
  const store = new SqliteGoalBoardStore(join(directory, "project.db"));
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const coordinator = new GoalBoardCoordinator(store, () => new Date(at));
  coordinator.initializeBoard({ board_id, actor_id: "user", title: "恢复验收", idempotency_key: "init" });
  coordinator.goals.commands.createGoal(board_id, contract("child"), { actor_id: "user", idempotency_key: "child" });
  const parent = { ...contract("parent"), decomposition_state: "closed_compound" as const, decomposition_review: coverage() };
  coordinator.goals.commands.createGoal(board_id, parent, { actor_id: "user", idempotency_key: "parent" });
  coordinator.goals.commands.addRelation(board_id, { from_goal_id: "child", to_goal_id: "parent", type: "part_of", reason: "恢复结果由子目标承担" },
    { actor_id: "user", idempotency_key: "relation" });
  // The public revision lifecycle records the explicitly accepted coverage, not a raw DB fixture.
  coordinator.goals.lifecycle.applyAcceptedContractRevision({ ...parentQuery, proposed_goal: parent, actor_id: "user",
    source_proposal_id: "fixture-parent-confirmation", reason: "确认已有父子覆盖", applied_at: at });
  function reviseChild() {
    return coordinator.goals.lifecycle.applyAcceptedContractRevision({ board_id, goal_id: "child", actor_id: "user",
      proposed_goal: { ...contract("child"), outcome: "恢复已有数据，并增加重启后的检查" },
      source_proposal_id: "fixture-child-confirmation", reason: "用户增加已有数据的重启检查", applied_at: at });
  }
  return { coordinator, store, parent, reviseChild };
}

test("stale compound coverage can be explained, claimed and discussed without duplicating work", t => {
  const { coordinator, store, reviseChild } = fixture(t);
  const valid = coordinator.explainGoal({ ...parentQuery, actor_id, role: "clarifier" });
  assert.equal(valid.ready, false);
  reviseChild();
  const before = store.snapshot(board_id);
  const projection = coordinator.executionValidation.query.getGoalActionProjection(parentQuery);
  const action = projection.actions.find(item => item.kind === "clarify" && item.target_type === "coverage");
  assert.equal(action?.status, "ready", JSON.stringify(projection));
  const explain = coordinator.explainGoal({ ...parentQuery, actor_id, role: "clarifier" });
  assert.equal(explain.ready, true, JSON.stringify(explain.reasons));
  assert.ok(coordinator.queryAvailable({ board_id, actor_id }).available.some(item =>
    item.goal.goal_id === "parent" && item.action_id === action!.action_id && item.role === "clarifier"));
  assert.equal(coordinator.executionValidation.query.getGoalWorkState(parentQuery).work_state, "clarification_pending");
  const request = { ...parentQuery, actor_id, role: "clarifier" as const,
    action_id: action!.action_id, action_token: projection.action_token, idempotency_key: "claim" };
  const selected = coordinator.executionValidation.commands.selectGoalAndStart(request);
  assert.equal(selected.allowed, true, JSON.stringify(selected.reasons));
  const replay = coordinator.executionValidation.commands.selectGoalAndStart(request);
  assert.equal(replay.run?.run_id, selected.run?.run_id);
  const dialogue = coordinator.draftDialogue.startDraftDialogue({ ...parentQuery, actor_id,
    rough_idea: "核对更新后的子目标是否仍覆盖父目标", idempotency_key: "dialogue" });
  assert.equal(dialogue.run?.run_id, selected.run?.run_id);
  const after = store.snapshot(board_id);
  assert.equal(after.claims.length, before.claims.length + 1);
  assert.equal(after.runs.length, before.runs.length + 1);
  assert.deepEqual(after.goals, before.goals, "claiming and discussing do not edit accepted Contracts");
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.coverage_contract_revisions, before.coverage_contract_revisions);
  const competing = coordinator.executionValidation.commands.selectGoalAndStart({ ...parentQuery,
    actor_id: "another-runtime", role: "clarifier", idempotency_key: "competing" });
  assert.equal(competing.allowed, false);
  assert.ok(competing.reasons.some(reason => reason.code === "claim.already_active"));
  assert.deepEqual(store.snapshot(board_id).claims, after.claims);
  assert.deepEqual(store.snapshot(board_id).runs, after.runs);
  coordinator.executionValidation.commands.reportRun({ board_id, actor_id, run_id: selected.run!.run_id,
    state: "abandoned", idempotency_key: "pause" });
  const resumed = coordinator.draftDialogue.resumeDraftDialogue({ ...parentQuery, actor_id, idempotency_key: "resume" });
  assert.equal(resumed.dialogue.session_id, dialogue.dialogue.session_id);
  assert.deepEqual(resumed.turns, dialogue.turns);
  assert.notEqual(resumed.run?.run_id, selected.run?.run_id);
  assert.equal(store.snapshot(board_id).claims.filter(claim => claim.state === "active").length, 1);
});

test("coverage revision requires a user decision and preserves child results and history", t => {
  const { coordinator, store, parent, reviseChild } = fixture(t);
  // Existing completed work must remain readable after the child's Contract changes.
  const execution = coordinator.executionValidation.commands.selectGoalAndStart({ board_id, goal_id: "child", actor_id,
    role: "executor", idempotency_key: "execute" });
  assert.equal(execution.allowed, true);
  coordinator.executionValidation.commands.reportRun({ board_id, actor_id, run_id: execution.run!.run_id,
    state: "completed", output_refs: ["test://restored-data"], idempotency_key: "report" });
  const evidence = coordinator.executionValidation.commands.submitEvidence({ board_id, goal_id: "child", actor_id,
    run_id: execution.run!.run_id, criterion_ids: ["child-check"], kind: "test", result: "passed",
    locator: "test://restored-data", idempotency_key: "evidence" }).evidence;
  reviseChild();
  const before = store.snapshot(board_id);
  const dialogue = coordinator.draftDialogue.startDraftDialogue({ ...parentQuery, actor_id,
    rough_idea: "原来的子目标恢复结果保留，只核对它更新后的要求", idempotency_key: "dialogue" });
  const proposal = coordinator.goalTreeSubmission.submitGoalTreeProposal({ board_id, actor_id,
    root_goal_id: "parent", discovered_in_run_id: dialogue.run!.run_id, summary: "重新确认现有父子覆盖关系",
    items: [{ item_id: "refresh-coverage", kind: "contract", operation: "update", payload: parent,
      source_refs: ["conversation://coverage-test"], reason: "已核对子目标新要求仍覆盖父目标",
      explanation: { problem: "子要求更新，旧映射过期", expected_effect: "保存对当前版本的覆盖确认", non_goals: ["修改业务范围"], depends_on_item_ids: [] },
      confidence: 1, affected_objects: [{ object_type: "goal", object_id: "parent" }] }], idempotency_key: "propose" }).proposal;
  const submitted = store.snapshot(board_id);
  assert.deepEqual(submitted.goals, before.goals, "submission is not user approval");
  assert.deepEqual(submitted.coverage_contract_revisions, before.coverage_contract_revisions);
  assert.equal(submitted.runs.find(run => run.run_id === dialogue.run!.run_id)?.state, "completed");
  assert.equal(submitted.claims.find(claim => claim.claim_id === dialogue.run!.claim_id)?.state, "released");
  assert.equal(coordinator.explainGoal({ ...parentQuery, actor_id, role: "clarifier" }).ready, false,
    "a pending user decision cannot be advertised as claimable clarification");
  assert.equal(coordinator.queryAvailable({ board_id, actor_id }).available.some(item => item.goal.goal_id === "parent" && item.role === "clarifier"), false);
  const denied = coordinator.executionValidation.commands.selectGoalAndStart({ ...parentQuery, actor_id: "other",
    role: "clarifier", idempotency_key: "pending-claim" });
  assert.equal(denied.allowed, false);
  assert.deepEqual(store.snapshot(board_id).claims, submitted.claims);
  const checked = coordinator.goalTreeCheck.checkGoalTreeProposal({ board_id, actor_id, proposal_id: proposal.proposal_id,
    idempotency_key: "check" });
  assert.deepEqual(checked.conflict_item_ids, []);
  const decision = { board_id, proposal_id: proposal.proposal_id, runtime_actor_id: actor_id,
    authority: { actor_id: "user", actor_kind: "user" as const, authority_source: "runtime_dialogue" as const,
      conversation_ref: "conversation://coverage-test", message_ref: "message://confirm-coverage" },
    decisions: [{ item_id: "refresh-coverage", decision: "confirm" as const, reason: "确认当前版本的覆盖，不改变业务范围" }],
    idempotency_key: "confirm" };
  assert.deepEqual(coordinator.goalTreeDecision.decideGoalTreeProposal(decision).applied_item_ids, ["refresh-coverage"]);
  const after = store.snapshot(board_id);
  assert.deepEqual(after.goals.find(goal => goal.goal_id === "child"), before.goals.find(goal => goal.goal_id === "child"));
  assert.deepEqual(after.evidence.find(item => item.evidence_id === evidence.evidence_id), before.evidence.find(item => item.evidence_id === evidence.evidence_id));
  assert.deepEqual(after.runs.filter(run => run.goal_id === "child"), before.runs.filter(run => run.goal_id === "child"));
  assert.deepEqual(after.relations, before.relations);
  const revised = after.goals.find(goal => goal.goal_id === "parent")!;
  assert.equal(revised.current_contract_revision, 3);
  for (const field of ["title", "outcome", "why", "business_logic", "in_scope", "out_of_scope", "constraints", "required_inputs", "promised_outputs", "acceptance_criteria"] as const) {
    assert.deepEqual(revised[field], before.goals.find(goal => goal.goal_id === "parent")![field], field);
  }
  assert.ok(after.coverage_contract_revisions.some(row => row.parent_contract_revision === 3 && row.child_contract_revision === 2));
  assert.equal(coordinator.executionValidation.query.getGoalActionProjection(parentQuery).actions.some(action => action.target_type === "coverage"), false);
  assert.equal(coordinator.explainGoal({ ...parentQuery, actor_id, role: "clarifier" }).ready, false);
  assert.equal(coordinator.goalTreeDecision.decideGoalTreeProposal(decision).replayed, true);
  assert.deepEqual(store.snapshot(board_id), after, "replayed confirmation does not create another revision or alter history");
});

for (const stale of [false, true]) {
  for (const satisfied of [false, true]) {
    test(`compound clarification only permits stale coverage (stale=${stale}, satisfied=${satisfied})`, t => {
      const { coordinator, store, reviseChild } = fixture(t);
      if (stale) reviseChild();
      if (satisfied) {
        // Reproduce a persisted historical completion fact; normal reconciliation reopens stale parents.
        coordinator.goals.lifecycle.satisfyForLifecycleFacts(board_id, "parent", "user", at);
        assert.equal(store.getGoal("parent")!.fulfillment_state, "satisfied");
      }
      const before = store.snapshot(board_id);
      const projection = coordinator.executionValidation.query.getGoalActionProjection(parentQuery);
      assert.equal(projection.actions.some(action => action.kind === "clarify" && action.target_type === "coverage"), stale);
      const explanation = coordinator.explainGoal({ ...parentQuery, actor_id, role: "clarifier" });
      assert.equal(explanation.ready, stale, JSON.stringify(explanation.reasons));
      const selected = coordinator.executionValidation.commands.selectGoalAndStart({ ...parentQuery, actor_id,
        role: "clarifier", idempotency_key: "select" });
      assert.equal(selected.allowed, stale, JSON.stringify(selected.reasons));
      if (!stale) {
        assert.deepEqual(store.snapshot(board_id).claims, before.claims);
        assert.deepEqual(store.snapshot(board_id).runs, before.runs);
      }
    });
  }
}

for (const guard of ["archived", "trashed", "replaced", "capability", "stale-token"] as const) {
  test(`coverage clarification keeps the ${guard} guard without creating work`, t => {
    const { coordinator, store, reviseChild } = fixture(t);
    const previousToken = coordinator.executionValidation.query.getGoalActionProjection(parentQuery).action_token;
    reviseChild();
    const projection = coordinator.executionValidation.query.getGoalActionProjection(parentQuery);
    const action = projection.actions.find(item => item.target_type === "coverage")!;
    if (guard === "archived") {
      coordinator.goals.lifecycle.satisfyForLifecycleFacts(board_id, "parent", "user", at);
      coordinator.goals.lifecycle.setArchived(board_id,
        { goal_id: "parent", archived: true, reason: "用户归档" }, { actor_id: "user", idempotency_key: "archive" });
    }
    if (guard === "trashed") coordinator.goals.lifecycle.setTrashed(board_id,
      { goal_id: "parent", trashed: true, reason: "用户回收" }, { actor_id: "user", idempotency_key: "trash" });
    if (guard === "replaced") {
      coordinator.goals.commands.createGoal(board_id, contract("replacement"), { actor_id: "user", idempotency_key: "replacement" });
      coordinator.goals.commands.addRelation(board_id, { from_goal_id: "replacement", to_goal_id: "parent", type: "replaces", reason: "用户决定替换" },
        { actor_id: "user", idempotency_key: "replace" });
    }
    const before = store.snapshot(board_id);
    const request = { ...parentQuery, actor_id, role: "clarifier" as const, idempotency_key: "denied" };
    if (guard === "stale-token") {
      assert.throws(() => coordinator.executionValidation.commands.selectGoalAndStart({ ...request,
        action_id: action.action_id, action_token: previousToken }), (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "action.token_stale");
    } else {
      const result = coordinator.executionValidation.commands.selectGoalAndStart({ ...request,
        ...(guard === "capability" ? { strengthen_policy: { required_capabilities: ["restore-verification"] } } : {}) });
      assert.equal(result.allowed, false);
      assert.ok(result.reasons.some(reason => reason.code === (guard === "capability" ? "policy.capability_missing" : `goal.${guard}`)), JSON.stringify(result.reasons));
    }
    const after = store.snapshot(board_id);
    assert.deepEqual(after.claims, before.claims);
    assert.deepEqual(after.runs, before.runs);
    assert.deepEqual(after.goals, before.goals);
    assert.deepEqual(after.coverage_contract_revisions, before.coverage_contract_revisions);
  });
}

test("a compound with missing child coverage is not made claimable by the revision fix", t => {
  const { coordinator, store } = fixture(t);
  const input = { board_id, goal_id: "missing" };
  coordinator.goals.commands.createGoal(board_id, { ...contract("missing"), decomposition_state: "closed_compound" },
    { actor_id: "user", idempotency_key: "missing" });
  const before = store.snapshot(board_id);
  assert.equal(coordinator.executionValidation.query.getGoalActionProjection(input).actions.some(action => action.kind === "clarify" && action.status === "ready"), false);
  assert.equal(coordinator.explainGoal({ ...input, actor_id, role: "clarifier" }).ready, false);
  assert.equal(coordinator.executionValidation.commands.selectGoalAndStart({ ...input, actor_id, role: "clarifier", idempotency_key: "select-missing" }).allowed, false);
  assert.deepEqual(store.snapshot(board_id).claims, before.claims);
  assert.deepEqual(store.snapshot(board_id).runs, before.runs);
});

test("incomplete Contract mappings keep their blocked reason even when child revisions are stale", t => {
  const { coordinator, store, parent, reviseChild } = fixture(t);
  const incomplete = coverage();
  incomplete.contract_coverage!.promised_outputs[0]!.status = "partial";
  coordinator.goals.lifecycle.applyAcceptedContractRevision({ ...parentQuery,
    proposed_goal: { ...parent, decomposition_review: incomplete }, actor_id: "user",
    source_proposal_id: "fixture-incomplete-mapping", reason: "记录尚未覆盖完整的历史映射", applied_at: at });
  reviseChild();
  const before = store.snapshot(board_id);
  const projection = coordinator.executionValidation.query.getGoalActionProjection(parentQuery);
  assert.ok(projection.actions.some(action => action.status === "blocked" && action.reasons.some(reason => reason.code === "action.compound_coverage_missing")));
  assert.equal(coordinator.executionValidation.query.getGoalWorkState(parentQuery).work_state, "clarification_blocked");
  assert.equal(coordinator.explainGoal({ ...parentQuery, actor_id, role: "clarifier" }).ready, false);
  assert.equal(coordinator.executionValidation.commands.selectGoalAndStart({ ...parentQuery, actor_id, role: "clarifier", idempotency_key: "incomplete" }).allowed, false);
  assert.deepEqual(store.snapshot(board_id).claims, before.claims);
  assert.deepEqual(store.snapshot(board_id).runs, before.runs);
});
