import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGoalBoardLocalHost, createGoalCapability, goalBoardHostProjectReference,
  initializeBoardCapability, snapshotBoardCapability } from "../src/local-host/composition.js";
import { GoalBoardServer } from "../src/mcp/server.js";
import { runV1Cli } from "../src/v1/cli.js";
import type { ClaimRunDecision, SubmitEvidenceResult, SubmitReviewResult } from "@adeptify/goalboard-plugin-goals";

test("actual CLI and MCP command handlers finish one Goal with isolated authority and idempotent Evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-command-chain-"));
  const databasePath = join(directory, "project.db");
  const boardId = "command-chain";
  const host = createGoalBoardLocalHost();
  const reference = goalBoardHostProjectReference({ databasePath, boardId });
  const client = host.client(reference);
  const mcp = new GoalBoardServer("runtime", { databasePath, boardId, webBaseUrl: "http://127.0.0.1:4173" }, null, host);
  async function cli<T>(operation: string, input: Record<string, unknown>): Promise<T> {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...values: unknown[]) => { lines.push(values.map(String).join(" ")); };
    try {
      assert.equal(await runV1Cli([operation, "--db", databasePath, "--json", JSON.stringify(input)], { localHost: host }), 0);
      return JSON.parse(lines.at(-1)!) as T;
    } finally {
      console.log = original;
    }
  }
  const snapshot = () => client.invoke(snapshotBoardCapability, { board_id: boardId });
  const projection = () => host.withProject(reference, ({ coordinator }) =>
    coordinator.executionValidation.query.getGoalActionProjection({ board_id: boardId, goal_id: "leaf" }));
  try {
    await client.invoke(initializeBoardCapability, {
      board_id: boardId, title: "真实命令链", actor_id: "user", idempotency_key: "init",
    });
    await client.invoke(createGoalCapability, {
      board_id: boardId, actor_id: "user", idempotency_key: "create",
      goal: {
        goal_id: "leaf", title: "跨入口验收", outcome: "命令迁移后仍可完成同一 Goal", why: "证明真实入口一致",
        business_logic: "CLI 领取，MCP 提交完成报告与证据，CLI 完成复核。", promised_outputs: ["可复核结果"],
        definition_state: "accepted", decomposition_state: "closed_leaf",
        acceptance_criteria: [{ criterion_id: "result", statement: "完成跨入口链", decision_method: "automated_check",
          pass_condition: "最终 Goal 满足且无重复 Evidence", required_evidence: ["test"] }],
      },
    });
    const ready = await projection();
    const selected = await cli<ClaimRunDecision>("select-goal", {
      board_id: boardId, goal_id: "leaf", actor_id: "executor", action_id: ready.primary_action!.action_id,
      action_token: ready.action_token, idempotency_key: "select",
    });
    assert.equal(selected.allowed, true);
    assert.ok(selected.run);
    const beforeDenied = await snapshot();
    await assert.rejects(mcp.callTool("goalboard_v1_run_report", {
      board_id: boardId, payload: { board_id: "model-other-board", run_id: selected.run.run_id,
        actor_id: "not-owner", state: "completed", idempotency_key: "denied" },
    }), (error: unknown) => error instanceof Error && "code" in error && error.code === "run.not_owner");
    assert.deepEqual(await snapshot(), beforeDenied, "denied reporting must not mutate runs or history");

    await mcp.callTool("goalboard_v1_run_report", {
      board_id: boardId, payload: { board_id: "model-other-board", run_id: selected.run.run_id,
        actor_id: "executor", state: "completed", idempotency_key: "report" },
    });
    const evidenceInput = {
      board_id: boardId, payload: { board_id: "model-other-board", goal_id: "leaf", run_id: selected.run.run_id,
        actor_id: "executor", criterion_ids: ["result"], kind: "test", result: "passed",
        locator: "test://command-chain", locator_context: { project_root: "/untrusted-model-root", workspace_id: "model-workspace" },
        idempotency_key: "evidence" },
    };
    const evidence = JSON.parse(await mcp.callTool("goalboard_v1_evidence_submit", evidenceInput)) as SubmitEvidenceResult;
    assert.equal(evidence.evidence.board_id, boardId);
    assert.equal(evidence.evidence.locator_workspace_id, null, "model-supplied locator context cannot override the host");
    const replay = JSON.parse(await mcp.callTool("goalboard_v1_evidence_submit", evidenceInput)) as SubmitEvidenceResult;
    assert.equal(replay.replayed, true);
    assert.equal(replay.evidence.evidence_id, evidence.evidence.evidence_id);
    assert.equal(replay.observed_event_cursor, evidence.observed_event_cursor);

    const awaitingReview = await snapshot();
    const obligation = awaitingReview.review_obligations.find((item) => item.goal_id === "leaf" && item.role === "self_verifier")!;
    const reviewProjection = await projection();
    const reviewAction = reviewProjection.actions.find((item) => item.kind === "review" && item.target_id === obligation.obligation_id)!;
    const reviewSelection = await cli<ClaimRunDecision>("select-goal", {
      board_id: boardId, goal_id: "leaf", actor_id: "reviewer", role: "self_verifier",
      action_id: reviewAction.action_id, action_token: reviewProjection.action_token, idempotency_key: "select-review",
    });
    assert.equal(reviewSelection.allowed, true);
    const reviewed = await cli<SubmitReviewResult>("review-submit", {
      board_id: boardId, goal_id: "leaf", obligation_id: obligation.obligation_id,
      actor_id: "reviewer", actor_kind: "runtime", verdict: "pass", evidence_refs: [evidence.evidence.evidence_id],
      reasoning: "同一 Goal 的执行和证据已核对", idempotency_key: "review",
    });
    assert.equal(reviewed.transition.projection.display_status, "completed");
    const final = await snapshot();
    assert.equal(final.goals.find((goal) => goal.goal_id === "leaf")!.fulfillment_state, "satisfied");
    assert.equal(final.evidence.filter((item) => item.goal_id === "leaf").length, 1);
    assert.equal(final.reviews.filter((item) => item.goal_id === "leaf").length, 1);
    assert.ok(final.claims.filter((item) => item.goal_id === "leaf").every((item) => item.state === "released"));
    assert.ok(final.runs.filter((item) => item.goal_id === "leaf").every((item) => item.state === "completed"));
    assert.deepEqual(await cli("snapshot", { board_id: boardId }), final);
  } finally {
    await mcp.close();
    await host.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
