import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGoalBoardLocalHost, goalBoardHostProjectReference, initializeBoardCapability, snapshotBoardCapability } from "@adeptify/goalboard-app-local-host";
import { GoalBoardServer } from "../apps/desktop/launchers/mcp/server.js";
import { runV1Cli } from "@adeptify/goalboard-app-local-host";
import type { DraftDialogueView, GoalTreeProposalDecisionResult, GoalTreeProposalListResult, GoalTreeApplicationApi, LegacyProposalApplicationApi } from "@adeptify/goalboard-plugin-goals";

test("CLI and MCP share Draft history, proposal decisions and legacy replay across Host restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-proposal-chain-"));
  const databasePath = join(directory, "project.db");
  const boardId = "proposal-chain";
  const actorId = "runtime-dialogue";
  const host = createGoalBoardLocalHost();
  const reference = goalBoardHostProjectReference({ databasePath, boardId });
  const client = host.client(reference);
  const runtime = new GoalBoardServer("runtime", { databasePath, boardId, webBaseUrl: "http://127.0.0.1:4173" }, null, host);
  async function cli<T>(operation: string, input: object): Promise<T> {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...values: unknown[]) => { lines.push(values.map(String).join(" ")); };
    try {
      assert.equal(await runV1Cli([operation, "--db", databasePath, "--json", JSON.stringify(input)], { localHost: host }), 0);
      return JSON.parse(lines.at(-1)!) as T;
    } finally { console.log = original; }
  }
  const snapshot = () => client.invoke(snapshotBoardCapability, { board_id: boardId });
  try {
    await client.invoke(initializeBoardCapability, { board_id: boardId, title: "Proposal chain", actor_id: "user", idempotency_key: "init" });
    const started = await cli<DraftDialogueView>("draft-dialogue-start", {
      board_id: boardId, actor_id: actorId, rough_idea: "整理开发入口", goal_id: "draft", idempotency_key: "start",
    });
    const answer = {
      board_id: boardId, goal_id: "draft", run_id: started.run!.run_id, actor_id: actorId,
      user_message: "用户确认以后才能创建子目标", current_understanding: "提案先保存，用户决定后生效",
      next_question: "子目标叫什么？", idempotency_key: "answer",
    };
    const beforeInvalid = await snapshot();
    await assert.rejects(runtime.callTool("goalboard_v1_draft_dialogue_turn", { ...answer, include_history: true, history_limit: 0 }), /history_limit/);
    assert.deepEqual(await snapshot(), beforeInvalid, "presentation rejection must happen before persistence");
    const compact = JSON.parse(await runtime.callTool("goalboard_v1_draft_dialogue_turn", answer));
    assert.equal(compact.turns, undefined);
    assert.equal(compact.latest_turn.user_message, answer.user_message);
    const afterAnswer = await snapshot();
    const replay = await cli<DraftDialogueView & { replayed: boolean }>("draft-dialogue-turn", answer);
    assert.equal(replay.replayed, true);
    assert.deepEqual(await snapshot(), afterAnswer);
    const concurrentAnswer = { ...answer, user_message: "重试不能重复记录同一个回答", idempotency_key: "concurrent-answer" };
    const simultaneous = await Promise.all([
      runtime.callTool("goalboard_v1_draft_dialogue_turn", concurrentAnswer),
      runtime.callTool("goalboard_v1_draft_dialogue_turn", concurrentAnswer),
    ]);
    const turnResults = simultaneous.map(result => JSON.parse(result));
    assert.deepEqual(turnResults.map(result => result.replayed).sort(), [false, true]);
    assert.equal(turnResults[0].latest_turn.turn_id, turnResults[1].latest_turn.turn_id);
    const afterConcurrentAnswer = await snapshot();
    assert.equal(afterConcurrentAnswer.clarification_turns.filter(turn => turn.user_message === concurrentAnswer.user_message).length, 1);
    const resumed = await cli<DraftDialogueView>("draft-dialogue-resume", {
      board_id: boardId, goal_id: "draft", actor_id: actorId, idempotency_key: "resume",
    });
    assert.deepEqual(resumed.turns.map(turn => turn.user_message), ["整理开发入口", answer.user_message, concurrentAnswer.user_message]);
    assert.equal(resumed.run!.run_id, started.run!.run_id);
    const proposed = await cli<ReturnType<GoalTreeApplicationApi["submitGoalTreeProposal"]>>("goal-tree-propose", {
      board_id: boardId, actor_id: actorId, root_goal_id: "draft", discovered_in_run_id: resumed.run!.run_id,
      summary: "新增一个仍需补全要求的子目标", idempotency_key: "propose",
      items: [{ item_id: "child", kind: "goal", operation: "create",
        payload: { goal_id: "child", title: "整理 CLI 入口" },
        source_refs: ["conversation://proposal-chain"], reason: "记录用户希望整理的入口", confidence: 1,
        affected_objects: [{ object_type: "goal", object_id: "child" }] },
        { item_id: "child-parent", kind: "relation", operation: "create",
          payload: { from_goal_id: "child", to_goal_id: "draft", type: "part_of", reason: "子目标属于本次整理" },
          source_refs: ["conversation://proposal-chain"], reason: "明确父子关系", confidence: 1,
          affected_objects: [{ object_type: "goal", object_id: "child" }, { object_type: "goal", object_id: "draft" }] }],
    });
    assert.equal((await snapshot()).goals.some(goal => goal.goal_id === "child"), false);
    const listed = JSON.parse((await runtime.callTool("goalboard_v1_goal_tree_read", {
      board_id: boardId, proposal_id: proposed.proposal.proposal_id,
    }))) as GoalTreeProposalListResult;
    assert.equal(listed.proposals[0]!.proposal_id, proposed.proposal.proposal_id);
    const checkInput = { board_id: boardId, proposal_id: proposed.proposal.proposal_id,
      actor_id: actorId, idempotency_key: "check-proposal" };
    const checked = await cli<ReturnType<GoalTreeApplicationApi["checkGoalTreeProposal"]>>("goal-tree-check", checkInput);
    assert.deepEqual(checked.conflict_item_ids, []);
    const checkedSnapshot = await snapshot();
    assert.deepEqual(JSON.parse(await runtime.callTool("goalboard_v1_goal_tree_check", checkInput)), checked);
    assert.deepEqual(await snapshot(), checkedSnapshot, "a repeated check preserves the stored item checks and history");
    const beforeDenied = await snapshot();
    await assert.rejects(runtime.callTool("goalboard_v1_goal_tree_decide", {
      board_id: boardId, proposal_id: proposed.proposal.proposal_id,
      authority: { actor_id: "forged-user", actor_kind: "user" }, idempotency_key: "forged-decision",
    }), /确认|user_impersonation/);
    assert.deepEqual(await snapshot(), beforeDenied);
    const decided = await cli<GoalTreeProposalDecisionResult>("goal-tree-decide", {
      board_id: boardId, proposal_id: proposed.proposal.proposal_id,
      authority: { actor_id: "user", actor_kind: "user", authority_source: "management", conversation_ref: "conversation://proposal-chain", message_ref: "message://confirm-child" },
      decisions: [{ item_id: "child", decision: "confirm" }, { item_id: "child-parent", decision: "confirm" }], reason: "确认创建这个子目标及父子关系", idempotency_key: "decide",
    });
    assert.deepEqual(decided.applied_item_ids, ["child", "child-parent"]);
    const afterDecision = await snapshot();
    assert.equal(afterDecision.goals.find(goal => goal.goal_id === "child")!.definition_state, "draft");
    assert.ok(afterDecision.relations.some(relation => relation.from_goal_id === "child" && relation.to_goal_id === "draft" && relation.type === "part_of"));
    const candidateInput = {
      board_id: boardId, payload: { board_id: "unselected-board", actor_id: actorId,
        proposed_goal: { goal_id: "later", title: "以后整理帮助文档", outcome: "", why: "", business_logic: "",
          in_scope: [], out_of_scope: [], acceptance_criteria: [], definition_state: "draft", decomposition_state: "abstract" }, idempotency_key: "candidate" },
    };
    const candidate = JSON.parse(await runtime.callTool("goalboard_v1_candidate_submit", candidateInput)) as ReturnType<LegacyProposalApplicationApi["submitCandidate"]>;
    assert.equal(candidate.candidate.board_id, boardId);
    await cli("candidate-decide", { board_id: boardId, candidate_id: candidate.candidate.candidate_id, actor_id: "user", actor_kind: "user", decision: "rejected", reason: "当前不做", idempotency_key: "reject-candidate" });
    const beforeReplay = await snapshot();
    const replayedCandidate = JSON.parse(await runtime.callTool("goalboard_v1_candidate_submit", candidateInput)) as ReturnType<LegacyProposalApplicationApi["submitCandidate"]>;
    assert.equal(replayedCandidate.replayed, true);
    assert.equal(replayedCandidate.candidate.candidate_id, candidate.candidate.candidate_id);
    assert.deepEqual(await snapshot(), beforeReplay);
    assert.equal(beforeReplay.candidates.find(item => item.candidate_id === candidate.candidate.candidate_id)!.state, "rejected");
    assert.equal(beforeReplay.goals.some(goal => goal.goal_id === "later"), false);
    await runtime.close();
    await host.close();
    const restarted = createGoalBoardLocalHost();
    try { assert.deepEqual(await restarted.client(reference).invoke(snapshotBoardCapability, { board_id: boardId }), beforeReplay); }
    finally { await restarted.close(); }
  } finally {
    await runtime.close();
    await host.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
