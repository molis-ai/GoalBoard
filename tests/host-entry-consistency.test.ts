import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LocalHost } from "@adeptify/goalboard-app-local-host";
import { createGoalEntryCompositionClient } from "@adeptify/goalboard-plugin-goals";
import { createGoalBoardLocalHost, createGoalCapability, goalBoardHostProjectReference, initializeBoardCapability, snapshotBoardCapability } from "@adeptify/goalboard-app-local-host";
import { GoalBoardServer } from "../apps/desktop/launchers/mcp/server.js";

test("MCP combined responses cannot be split by a queued competing Goal write", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-entry-consistency-"));
  const databasePath = join(directory, "project.db");
  const boardId = "combined-entry";
  const host = createGoalBoardLocalHost();
  const reference = goalBoardHostProjectReference({ databasePath, boardId });
  const client = host.client(reference);
  const composition = createGoalEntryCompositionClient(client);
  const mcp = new GoalBoardServer("runtime", { databasePath, boardId, webBaseUrl: "http://127.0.0.1:4173" }, null, host);
  const makeGoal = (goalId: string) => ({ board_id: boardId, actor_id: "user", idempotency_key: `create-${goalId}`,
    goal: { goal_id: goalId, title: goalId, outcome: "一致的入口结果", why: "验证组合操作", business_logic: "读取与写后状态不能被并发操作拆开",
      definition_state: "accepted" as const, decomposition_state: "closed_leaf" as const, promised_outputs: ["一致结果"],
      acceptance_criteria: [{ statement: "结果一致", decision_method: "inspection" as const, pass_condition: "两部分来自同一操作", required_evidence: ["test"] }] } });
  let competingWrite: Promise<unknown> | undefined;
  try {
    await client.invoke(initializeBoardCapability, { board_id: boardId, title: "组合入口", actor_id: "user", idempotency_key: "init" });
    await client.invoke(createGoalCapability, makeGoal("first"));
    await host.withProject(reference, ({ coordinator }) => {
      const original = coordinator.queryAvailable.bind(coordinator);
      let enqueue = true;
      coordinator.queryAvailable = input => {
        const result = original(input);
        if (enqueue) {
          enqueue = false;
          // A real competing write enters the same Host queue between the two owner reads.
          competingWrite = client.invoke(createGoalCapability, makeGoal("later"));
        }
        return result;
      };
    });
    const available = JSON.parse(await mcp.callTool("goalboard_v1_available", {
      board_id: boardId, actor_id: "runtime", detail_level: "full",
    }));
    await competingWrite;
    assert.deepEqual(available.available.map((item: { goal: { goal_id: string } }) => item.goal.goal_id), ["first"]);
    assert.deepEqual(available.action_projections.map((item: { goal_id: string }) => item.goal_id), ["first"],
      "a later write must not appear only in the second half of this response");
    const later = await composition.queryAvailableWithProjections({ board_id: boardId, actor_id: "runtime" });
    assert.deepEqual(later.available.available.map(item => item.goal.goal_id).sort(), ["first", "later"]);
    assert.deepEqual(later.action_projections.map(item => item.goal_id).sort(), ["first", "later"]);

    await host.withProject(reference, ({ coordinator }) => {
      const original = coordinator.goals.lifecycle.setTrashed.bind(coordinator.goals.lifecycle);
      coordinator.goals.lifecycle.setTrashed = (...input) => {
        const result = original(...input);
        if (input[1].trashed) {
          competingWrite = composition.setTrashedWithWorkState(boardId,
            { goal_id: "first", trashed: false, reason: "已排队的恢复" },
            { actor_id: "user", idempotency_key: "restore-after-trash" });
        }
        return result;
      };
    });
    const trashed = JSON.parse(await mcp.callTool("goalboard_v1_goal_trash", {
      board_id: boardId, payload: { goal_id: "first", actor_id: "runtime", user_confirmed: true,
        reason: "用户明确移入回收站", idempotency_key: "trash-before-restore" },
    }));
    await competingWrite;
    assert.equal(trashed.status, "trashed");
    assert.equal(trashed.work_state.work_state, "trashed", "queued restore cannot replace the state associated with this trash result");
    assert.equal(trashed.next_action.kind, "report_recoverable_trash");
    const final = await client.invoke(snapshotBoardCapability, { board_id: boardId });
    assert.equal(final.goals.find(goal => goal.goal_id === "first")!.trashed_at, null, "the competing restore must really have committed");
  } finally {
    await competingWrite;
    await mcp.close(); await host.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Host Client scope opens before adaptation and retains resources until response completion", async () => {
  const reference = { project_id: "scope", board_id: "scope", storage_key: "memory:scope" };
  const events: string[] = [];
  let finishResponse!: () => void;
  const responseGate = new Promise<void>(resolve => { finishResponse = resolve; });
  let enterResponse!: () => void;
  const entered = new Promise<void>(resolve => { enterResponse = resolve; });
  const host = new LocalHost({ runtimeFactory: {
    open: () => { events.push("open"); return {}; },
    close: () => { events.push("close"); },
  } });
  const client = host.client(reference);
  const response = client.withScope(async scopedClient => {
    assert.equal(scopedClient, client);
    events.push("adapt");
    enterResponse();
    await responseGate;
    events.push("response");
    return "serialized response";
  });
  await entered;
  const closing = host.close();
  try {
    await Promise.resolve();
    assert.deepEqual(events, ["open", "adapt"], "close must wait for pending response composition");
  } finally { finishResponse(); }
  assert.equal(await response, "serialized response");
  await closing;
  assert.deepEqual(events, ["open", "adapt", "response", "close"]);

  const openError = new Error("runtime cannot open");
  let adapted = false;
  const unavailable = new LocalHost({ runtimeFactory: { open: () => { throw openError; }, close: () => {} } });
  await assert.rejects(unavailable.client(reference).withScope(() => { adapted = true; }), error => error === openError);
  assert.equal(adapted, false);
  await unavailable.close();
});
