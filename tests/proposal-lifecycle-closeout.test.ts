import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";

test("proposal close-out rolls back real Run and Claim writes and replays once after reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dd2-closeout-"));
  const path = join(directory, "project.db");
  let store = new LocalProjectDatabase(path);
  const now = () => new Date("2026-09-06T00:10:00.000Z");
  let coordinator = new GoalProjectApplication(store, now);
  try {
    coordinator.initializeBoard({ board_id: "board", title: "整理方案", actor_id: "user", idempotency_key: "init" });
    const start = coordinator.draftDialogue.startDraftDialogue({
      board_id: "board", goal_id: "draft", actor_id: "runtime", rough_idea: "整理已有方案",
      idempotency_key: "start",
    });
    const input = {
      board_id: "board", actor_id: "runtime", root_goal_id: "draft", discovered_in_run_id: start.run!.run_id,
      summary: "新增待讨论的子目标", idempotency_key: "propose",
      items: [{ item_id: "child", kind: "goal" as const, operation: "create" as const,
        payload: { goal_id: "child", title: "整理入口" }, source_refs: ["conversation://closeout"],
        reason: "保存待确认的建议", confidence: 1,
        affected_objects: [{ object_type: "goal" as const, object_id: "child" }] }],
    };
    const before = store.snapshot("board");
    const release = coordinator.execution.commands.releaseClaimForLifecycleFacts.bind(coordinator.execution.commands);
    coordinator.execution.commands.releaseClaimForLifecycleFacts = (...args) => {
      release(...args);
      const changed = store.snapshot("board");
      assert.equal(changed.runs.find(run => run.run_id === start.run!.run_id)?.state, "completed");
      assert.equal(changed.claims.find(claim => claim.claim_id === start.run!.claim_id)?.state, "released");
      assert.equal(changed.goal_tree_proposals.length, 1);
      throw new Error("fail after actual Claim close-out");
    };
    assert.throws(() => coordinator.goalTreeSubmission.submitGoalTreeProposal(input), /actual Claim close-out/);
    assert.deepEqual(store.snapshot("board"), before, "outer proposal transaction restores all owners and event cursor");
    coordinator.execution.commands.releaseClaimForLifecycleFacts = release;
    const result = coordinator.goalTreeSubmission.submitGoalTreeProposal(input);
    const after = store.snapshot("board");
    assert.equal(after.goals.some(goal => goal.goal_id === "child"), false, "submission does not apply the proposed Goal");
    assert.equal(after.runs.find(run => run.run_id === start.run!.run_id)?.state, "completed");
    assert.equal(after.claims.find(claim => claim.claim_id === start.run!.claim_id)?.state, "released");
    const events = store.db.prepare("SELECT type, reason, payload_json FROM events WHERE board_id = ? ORDER BY seq").all("board") as Array<{ type: string; reason: string; payload_json: string }>;
    const completed = events.filter(event => event.type === "run.completed");
    assert.equal(completed.length, 1);
    assert.equal(completed[0]!.reason, "完整 Proposal 已提交，Clarifier Run 自动结束");
    assert.deepEqual(JSON.parse(completed[0]!.payload_json), { goal_id: "draft", proposal_id: result.proposal.proposal_id });
    const released = events.filter(event => event.type === "claim.auto_released");
    assert.equal(released.length, 1);
    assert.deepEqual(JSON.parse(released[0]!.payload_json), {
      goal_id: "draft", contract_revision: 1, action_kind: "clarify", action_target_id: "draft",
    });
    store.close();
    store = new LocalProjectDatabase(path);
    coordinator = new GoalProjectApplication(store, now);
    const replay = coordinator.goalTreeSubmission.submitGoalTreeProposal(input);
    assert.equal(replay.replayed, true);
    assert.equal(replay.proposal.proposal_id, result.proposal.proposal_id);
    assert.deepEqual(store.snapshot("board"), after);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
