import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { BoardSnapshot, DraftDialogueView, GoalContractView, GoalTreeApplicationApi, ClaimRunDecision, SubmitEvidenceResult, SubmitReviewResult } from "@adeptify/goalboard-plugin-goals";
import type { ActionTransitionReceipt } from "@adeptify/goalboard-plugin-goals";
import type { GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
import { GoalBoardServer } from "../src/mcp/server.js";

test("Runtime public protocol carries one Draft through restart, user decision, execution and automatic completion", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-runtime-skill-"));
  const host = { homeDirectory: join(directory, "home"), runtimeContext: {
    runtime_id: "codex", stable_work_context_id: "skill-session", host_declares_stable: true,
    workspace: { canonical_path: realpathSync(directory), realpath_verified: true },
  } } satisfies GoalBoardRuntimeContextHost;
  const actor = "skill-runtime";
  const goalId = "skill-goal";
  let server = new GoalBoardServer("runtime", null, host);
  let requestId = 0;
  async function wire(name: string, args: object) {
    const response = await server.handleMessage({ jsonrpc: "2.0", id: ++requestId, method: "tools/call",
      params: { name: `goalboard_v1_${name}`, arguments: args, _meta: { threadId: "skill-session" } } });
    return response!.result as { isError: boolean; content: Array<{ text: string }> };
  }
  async function call<T>(name: string, args: object): Promise<T> {
    const result = await wire(name, args);
    assert.equal(result.isError, false, result.content[0]!.text);
    return JSON.parse(result.content[0]!.text) as T;
  }
  try {
    assert.equal((await call<{ status: string }>("context_resolve", {})).status, "unbound");
    const connected = await call<{ connection: { board_id: string }; status: string }>("context_create_and_bind", {
      display_name: "协议验证项目", actor_id: actor, user_confirmed: true, idempotency_key: "create-project",
    });
    assert.equal(connected.status, "bound");
    const board_id = connected.connection.board_id;
    const contract = () => call<GoalContractView>("contract", { board_id, goal_id: goalId });
    const snapshot = () => call<BoardSnapshot>("snapshot", { board_id });
    const started = await call<DraftDialogueView>("draft_dialogue_start", {
      board_id, actor_id: actor, goal_id: goalId, rough_idea: "交付一份可读取的结果说明", idempotency_key: "start",
    });
    const answer = { board_id, actor_id: actor, goal_id: goalId, run_id: started.run!.run_id,
      user_message: "只交付这份说明，不加其他功能", current_understanding: "一个文件、一个结果、用户确认后执行",
      next_question: "确认这份范围吗？", idempotency_key: "answer" };
    await call("draft_dialogue_turn", answer);
    await server.close();
    server = new GoalBoardServer("runtime", null, host);
    assert.equal((await call<{ status: string }>("context_resolve", {})).status, "bound");
    const resumed = await call<DraftDialogueView>("draft_dialogue_resume", {
      board_id, actor_id: actor, goal_id: goalId, include_history: true, idempotency_key: "resume",
    });
    assert.deepEqual(resumed.turns.map(turn => turn.user_message), ["交付一份可读取的结果说明", answer.user_message]);
    const beforeReplay = await snapshot();
    assert.equal((await call<{ replayed: boolean }>("draft_dialogue_turn", answer)).replayed, true);
    assert.deepEqual(await snapshot(), beforeReplay);

    const proposed = await call<ReturnType<GoalTreeApplicationApi["submitGoalTreeProposal"]>>("goal_tree_propose", {
      board_id, actor_id: actor, root_goal_id: goalId, discovered_in_run_id: resumed.run!.run_id,
      summary: "确认同一个目标的交付与验收", idempotency_key: "proposal", items: [{
        item_id: "accept-goal", kind: "contract", operation: "update",
        payload: { goal_id: goalId, title: "交付结果说明", outcome: "用户可以读取完整说明", why: "验证 Runtime 全流程",
          business_logic: "用户确认范围后执行，提交文件证据并复核。", in_scope: ["结果说明"], out_of_scope: ["其他功能"],
          constraints: [], required_inputs: ["用户确认范围"], promised_outputs: ["结果说明"],
          definition_state: "accepted", decomposition_state: "closed_leaf", priority: 50,
          acceptance_criteria: [{ criterion_id: "skill-result", statement: "说明可读取", decision_method: "inspection",
            pass_condition: "项目文件内容完整", required_evidence: ["file inspection"] }],
          leaf_readiness: { verdict: "ready", primary_deliverable: "结果说明",
            output_coverage: [{ promised_output: "结果说明", role: "primary", reason: "唯一结果" }],
            split_candidates: [], rationale: "仅一个可验收结果", unresolved_decisions: [], independent_deliverables: [],
            acceptance_criterion_ids: ["skill-result"] } },
        source_refs: ["conversation://skill-session"], reason: "用户已明确范围", confidence: 1,
        affected_objects: [{ object_type: "goal", object_id: goalId }],
      }],
    });
    const proposal_id = proposed.proposal.proposal_id;
    await call("goal_tree_read", { board_id, proposal_id });
    const checked = await call<ReturnType<GoalTreeApplicationApi["checkGoalTreeProposal"]>>("goal_tree_check", {
      board_id, proposal_id, actor_id: actor, idempotency_key: "check",
    });
    assert.deepEqual(checked.conflict_item_ids, []);
    const beforeDenied = await snapshot();
    const decision = { board_id, proposal_id, runtime_actor_id: actor, confirmation_summary: "确认这份结果说明的范围和验收",
      decisions: [{ item_id: "accept-goal", decision: "confirm" }], idempotency_key: "decide" };
    assert.equal((await wire("goal_tree_decide", decision)).isError, true);
    assert.deepEqual(await snapshot(), beforeDenied, "missing user confirmation cannot materialize the Contract");
    const decided = await call<ReturnType<GoalTreeApplicationApi["decideGoalTreeProposal"]>>("goal_tree_decide", {
      ...decision, user_confirmed: true,
    });
    assert.deepEqual(decided.applied_item_ids, ["accept-goal"]);
    const accepted = await contract();
    assert.equal(accepted.goal.definition_state, "accepted");
    assert.equal(accepted.goal.goal_id, goalId);
    const menu = await call<{ available: Array<{ goal: { goal_id: string }; action_id: string; action_token: string }> }>(
      "available", { board_id, actor_id: actor, goal_mode_attestation: true });
    const choice = menu.available.find(item => item.goal.goal_id === goalId)!;
    assert.equal(choice.action_id, accepted.action_projection.primary_action!.action_id);
    const selected = await call<ClaimRunDecision>("select_goal", { board_id, goal_id: goalId, actor_id: actor,
      action_id: choice.action_id, action_token: choice.action_token, goal_mode_attestation: true, idempotency_key: "execute" });
    assert.equal(selected.allowed, true);
    writeFileSync(join(directory, "result.md"), "已完成用户确认的结果说明。\n");
    const reported = await call<{ transition: ActionTransitionReceipt }>("run_report", { board_id, payload: {
      actor_id: actor, run_id: selected.run!.run_id, state: "completed", idempotency_key: "report",
    } });
    assert.equal(reported.transition.projection.primary_action!.kind, "submit_evidence");
    const evidenceInput = { board_id, payload: { goal_id: goalId, actor_id: actor, run_id: selected.run!.run_id,
      contract_revision: accepted.goal.current_contract_revision, action_token: reported.transition.projection.action_token,
      criterion_ids: ["skill-result"], kind: "inspection", locator: "project://result.md", result: "passed", idempotency_key: "evidence" } };
    const evidence = await call<SubmitEvidenceResult>("evidence_submit", evidenceInput);
    assert.equal(evidence.evidence.locator_status, "verified");
    assert.equal(evidence.transition.projection.primary_action!.kind, "review");
    assert.equal((await call<SubmitEvidenceResult>("evidence_submit", evidenceInput)).evidence.evidence_id, evidence.evidence.evidence_id);
    const reviewContract = await contract();
    assert.equal(reviewContract.work_state.active_claim, null, "complete report and Evidence auto-release the executor");
    const reviewAction = evidence.transition.projection.primary_action!;
    const reviewing = await call<ClaimRunDecision>("select_goal", { board_id, goal_id: goalId, actor_id: actor,
      action_id: reviewAction.action_id, action_token: evidence.transition.projection.action_token,
      role: "self_verifier", goal_mode_attestation: true, idempotency_key: "review-select" });
    assert.equal(reviewing.allowed, true);
    const reviewed = await call<SubmitReviewResult>("review_submit", { board_id, payload: {
      goal_id: goalId, actor_id: actor, actor_kind: "runtime", obligation_id: reviewAction.target_id,
      verdict: "pass", evidence_refs: [evidence.evidence.evidence_id], reasoning: "核对说明文件与已确认范围", idempotency_key: "review",
    } });
    assert.equal(reviewed.transition.projection.display_status, "completed");
    await server.close();
    server = new GoalBoardServer("runtime", null, host);
    await call("context_resolve", {});
    const final = await contract();
    assert.equal(final.goal.fulfillment_state, "satisfied");
    assert.equal(final.action_projection.primary_action, null);
    assert.equal(final.work_state.active_claim, null);
    assert.equal(final.evidence.length, 1);
    assert.equal(final.reviews.length, 1);
    assert.equal(final.runs.find(run => run.run_id === reviewing.run!.run_id)!.state, "completed");
  } finally { await server.close(); rmSync(directory, { recursive: true, force: true }); }
});
