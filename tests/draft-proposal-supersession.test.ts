import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ContractProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GoalBoardCoordinator } from "../src/v1/coordinator.js";
import { SqliteGoalBoardStore } from "../src/v1/store.js";

test("editing Draft supersedes only its pending proposals atomically, preserves audit order and survives retry/reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dd2-supersession-"));
  const path = join(directory, "project.db");
  let store = new SqliteGoalBoardStore(path);
  const now = () => new Date("2026-09-06T00:10:00.000Z");
  let coordinator = new GoalBoardCoordinator(store, now);
  try {
    for (const board of ["board", "other-board"]) coordinator.initializeBoard({
      board_id: board, title: board, actor_id: "user", idempotency_key: `init-${board}`,
    });
    const starts = ["draft", "other-goal", "other-board-goal"].map(goalId => coordinator.draftDialogue.startDraftDialogue({
      board_id: goalId === "other-board-goal" ? "other-board" : "board", goal_id: goalId,
      actor_id: `runtime-${goalId}`, rough_idea: "整理已有方案，保留确认历史", idempotency_key: `start-${goalId}`,
    }));
    const insert = (proposalId: string, index: number, state: ContractProposalRecord["state"], createdAt: string) => {
      const dialogue = starts[index]!;
      coordinator.governance.records.insertContractProposal({
        proposal_id: proposalId, board_id: dialogue.goal.board_id, goal_id: dialogue.goal.goal_id,
        submitted_by: `runtime-${dialogue.goal.goal_id}`, discovered_in_run_id: dialogue.run!.run_id,
        proposed_goal: { title: "整理方案", outcome: "方案可复查", why: "保留决定", business_logic: "用户决定后落地",
          acceptance_criteria: [], definition_state: "draft", decomposition_state: "abstract" },
        field_sources: [], review_policy: coordinator.getResolvedGoalPolicy({ board_id: dialogue.goal.board_id, goal_id: dialogue.goal.goal_id }),
        proposed_impacts: [], proposed_risks: [], dependency_rewire_ids: [], state,
        decision: state === "rejected" ? { decided_by: "user", reason: "保留原拒绝" } : null,
        created_at: createdAt, decided_at: state === "rejected" ? createdAt : null,
      });
    };
    insert("late", 0, "pending", "2026-09-06T00:02:00.000Z");
    insert("early", 0, "pending", "2026-09-06T00:01:00.000Z");
    insert("rejected", 0, "rejected", "2026-09-06T00:00:00.000Z");
    insert("other-goal-pending", 1, "pending", "2026-09-06T00:00:00.000Z");
    insert("other-board-pending", 2, "pending", "2026-09-06T00:00:00.000Z");
    const before = store.snapshot("board"), otherBefore = store.snapshot("other-board");
    const original = coordinator.governance.records.supersedePendingContractProposals.bind(coordinator.governance.records);
    coordinator.governance.records.supersedePendingContractProposals = (...args) => {
      const ids = original(...args);
      assert.deepEqual(ids, ["early", "late"]);
      assert.equal(coordinator.governance.query.getContractProposal("board", "early")?.state, "superseded");
      throw new Error("fail after actual Governance supersession");
    };
    const goal = { title: "更新后的草稿", outcome: "采用新的讨论内容", why: "原方案需要重新决定", business_logic: "仍需用户确认",
      acceptance_criteria: [], definition_state: "draft" as const, decomposition_state: "abstract" as const };
    const write = { actor_id: "user", reason: "补充范围", idempotency_key: "edit" };
    assert.throws(() => coordinator.goals.commands.updateDraftGoal("board", "draft", goal, write), /actual Governance supersession/);
    assert.deepEqual(store.snapshot("board"), before, "failed edit restores Goal, proposals, execution and events together");
    assert.deepEqual(store.snapshot("other-board"), otherBefore);
    coordinator.governance.records.supersedePendingContractProposals = original;
    const saved = coordinator.goals.commands.updateDraftGoal("board", "draft", goal, write);
    assert.equal(saved.replayed, false);
    assert.equal(saved.goal.title, goal.title);
    for (const id of ["early", "late"]) {
      const proposal = coordinator.governance.query.getContractProposal("board", id)!;
      assert.equal(proposal.state, "superseded");
      assert.deepEqual(proposal.decision, { reason: "用户直接更新了 Draft，需要基于新事实重新提交 Contract Proposal", superseded_by: "user" });
      assert.equal(proposal.decided_at, now().toISOString());
    }
    for (const id of ["rejected", "other-goal-pending"]) assert.deepEqual(
      coordinator.governance.query.getContractProposal("board", id), before.contract_proposals.find(proposal => proposal.proposal_id === id));
    assert.deepEqual(store.snapshot("other-board"), otherBefore);
    const events = store.db.prepare("SELECT payload_json FROM events WHERE type = 'goal.draft_updated' AND object_id = 'draft'").all() as Array<{ payload_json: string }>;
    assert.equal(events.length, 1);
    assert.deepEqual(JSON.parse(events[0]!.payload_json).superseded_contract_proposal_ids, ["early", "late"]);
    const after = store.snapshot("board");
    store.close();
    store = new SqliteGoalBoardStore(path);
    coordinator = new GoalBoardCoordinator(store, now);
    assert.equal(coordinator.goals.commands.updateDraftGoal("board", "draft", goal, write).replayed, true);
    assert.deepEqual(store.snapshot("board"), after, "reopened retry cannot repeat writes or lose proposal history");
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
