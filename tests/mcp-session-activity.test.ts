import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openWorkSessionRegistry } from "@adeptify/goalboard-app-local-host";
import { mcpRuntimeSessionActivity } from "@adeptify/goalboard-app-mcp";
import { GoalBoardProjectCatalog } from "../src/projects/catalog.js";
import { createGoalBoardLocalHost, createGoalCapability, goalBoardHostProjectReference, snapshotBoardCapability } from "../src/local-host/composition.js";
import { GoalBoardServer } from "../src/mcp/server.js";
import type { ClaimRunDecision } from "@adeptify/goalboard-plugin-goals";

test("activity extraction preserves established priority, ignored operations and bounded result lookup", () => {
  assert.equal(mcpRuntimeSessionActivity("goalboard_v1_contract", {}, "{}"), null);
  assert.equal(mcpRuntimeSessionActivity("goalboard_v1_select_goal", { goal_id: "leaf" }, '{"allowed":false}'), null);
  assert.equal(mcpRuntimeSessionActivity("goalboard_v1_run_report", {}, "not-json"), null);
  const activity = mcpRuntimeSessionActivity("goalboard_v1_run_report", {
    goal_id: "top-goal", idempotency_key: "top-key", payload: { goal_id: "nested-goal", idempotency_key: "nested-key", state: "completed", run_id: "input-run" },
  }, JSON.stringify({ goal_id: "result-goal", run: { run_id: "result-run", state: "started" } }));
  assert.deepEqual(activity, {
    goal_id: "top-goal", actor_id: "goalboard:run-report",
    event: { source: "goalboard", kind: "status", source_id: "goalboard_v1_run_report:nested-key",
      content: "更新执行状态：top-goal · completed",
      metadata: { tool: "goalboard_v1_run_report", goal_id: "top-goal", run_id: "input-run", state: "completed" } },
  });
  const nested = mcpRuntimeSessionActivity("goalboard_v1_evidence_submit", {}, JSON.stringify({ items: [{ evidence: { goal_id: "leaf", evidence_id: "proof" } }] }));
  assert.equal(nested?.event.source_id, "goalboard_v1_evidence_submit:proof");
  assert.equal(mcpRuntimeSessionActivity("goalboard_v1_run_report", {}, JSON.stringify({ a: { b: { c: { d: { e: { goal_id: "too-deep" } } } } } })), null);
});

test("successful MCP writes update only their Session and survive a secondary Registry failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-mcp-activity-"));
  const homeDirectory = join(directory, "home");
  const catalog = await GoalBoardProjectCatalog.open({ homeDirectory });
  const host = createGoalBoardLocalHost();
  let mcp: GoalBoardServer | undefined;
  try {
    const project = await catalog.createProject({ display_name: "Session 活动", actor_id: "user" });
    const reference = goalBoardHostProjectReference({ databasePath: project.database_path, boardId: project.board_id, projectId: project.project_id });
    const client = host.client(reference);
    await client.invoke(createGoalCapability, {
      board_id: project.board_id, actor_id: "user", idempotency_key: "create",
      goal: { goal_id: "leaf", title: "记录执行活动", outcome: "主操作与次级索引边界明确", why: "保持重组前行为",
        business_logic: "记录 Goal 选择和执行状态。", promised_outputs: ["执行记录"], definition_state: "accepted", decomposition_state: "closed_leaf",
        acceptance_criteria: [{ criterion_id: "activity", statement: "活动可追踪", decision_method: "automated_check", pass_condition: "状态和记录一致", required_evidence: ["test"] }] },
    });
    const registry = await openWorkSessionRegistry({ homeDirectory });
    let sessionId: string;
    let unrelatedId: string;
    try {
      sessionId = registry.explicitlyLinkSession({ runtime_id: "codex", native_runtime_session_id: "thread-current", actor_id: "user", user_confirmed: true, project_id: project.project_id }).session_id;
      unrelatedId = registry.explicitlyLinkSession({ runtime_id: "codex", native_runtime_session_id: "thread-other", actor_id: "user", user_confirmed: true, project_id: "another-project" }).session_id;
    } finally { registry.close(); }
    mcp = new GoalBoardServer("runtime", { databasePath: project.database_path, boardId: project.board_id, projectId: project.project_id, webBaseUrl: "http://127.0.0.1:4173" }, {
      homeDirectory, runtimeContext: { runtime_id: "codex", stable_work_context_id: "thread-current", host_declares_stable: true },
    }, host);
    const projection = await host.withProject(reference, ({ coordinator }) => coordinator.executionValidation.query.getGoalActionProjection({ board_id: project.board_id, goal_id: "leaf" }));
    const select = { board_id: project.board_id, goal_id: "leaf", actor_id: "executor", action_id: projection.primary_action!.action_id, action_token: projection.action_token, idempotency_key: "select" };
    const selected = JSON.parse(await mcp.callTool("goalboard_v1_select_goal", select)) as ClaimRunDecision;
    assert.equal(selected.allowed, true);
    await mcp.callTool("goalboard_v1_select_goal", select);
    const inspect = await openWorkSessionRegistry({ homeDirectory });
    try {
      assert.equal(inspect.get(sessionId).current_goal_id, "leaf");
      assert.equal(inspect.events(sessionId).filter(event => event.source_id === "goalboard_v1_select_goal:select").length, 1);
      assert.equal(inspect.get(unrelatedId).current_goal_id, null);
      assert.equal(inspect.events(unrelatedId).filter(event => event.source === "goalboard").length, 0);
    } finally { inspect.close(); }
    const obstructedHome = join(directory, "not-a-directory");
    writeFileSync(obstructedHome, "Test the secondary Session storage failure, not the project database.");
    mcp.runtimeContextHost!.homeDirectory = obstructedHome;
    const reported = JSON.parse(await mcp.callTool("goalboard_v1_run_report", { board_id: project.board_id,
      payload: { run_id: selected.run!.run_id, actor_id: "executor", state: "completed", idempotency_key: "report" } }));
    assert.equal(reported.run.state, "completed");
    const persisted = await client.invoke(snapshotBoardCapability, { board_id: project.board_id });
    assert.equal(persisted.runs.find(run => run.run_id === selected.run!.run_id)!.state, "completed");
    mcp.runtimeContextHost!.homeDirectory = homeDirectory;
    const context = JSON.parse(await mcp.callTool("goalboard_v1_context_resolve", {}));
    assert.equal(context.session_registry.status, "unavailable");
    assert.match(context.session_registry.message, /ENOTDIR|EEXIST|not a directory/i);
    const afterFailure = await openWorkSessionRegistry({ homeDirectory });
    try {
      assert.equal(afterFailure.get(sessionId).current_goal_id, "leaf");
      assert.equal(afterFailure.events(sessionId).filter(event => event.source_id === "goalboard_v1_run_report:report").length, 0);
      assert.equal(afterFailure.events(sessionId).filter(event => event.source_id === "goalboard_v1_select_goal:select").length, 1);
    } finally { afterFailure.close(); }
  } finally {
    await mcp?.close();
    await host.close();
    catalog.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
