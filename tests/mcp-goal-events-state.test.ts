import { openGoalBoardProjectCatalog } from "@adeptify/goalboard-app-desktop";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGoalBoardLocalHost, snapshotBoardCapability, goalBoardHostProjectReference } from "@adeptify/goalboard-app-local-host";
import { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";
import { GoalBoardServer } from "../apps/desktop/launchers/mcp/server.js";
import type { GoalEventClosureResult, GoalEventStateView } from "@adeptify/goalboard-contracts/modules/goals";

function localType() {
  return {
    type_id: "story-delivery",
    version: 1,
    name: "故事片段交付",
    purpose: "说明可以体验的片段。",
    semantic_family: "delivery",
    source: { kind: "runtime", label: "当前 Goal 局部定义" },
    fields: [
      { field_id: "piece", name: "交付了什么片段", purpose: "可体验内容", format: "text", required: true },
    ],
  };
}

test("Runtime state tools record progress and close without applying user identity; management decides", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-mcp-goal-events-state-"));
  const homeDirectory = join(directory, "home");
  const catalog = await openGoalBoardProjectCatalog({ homeDirectory });
  const host = createGoalBoardLocalHost();
  let runtime: GoalBoardServer | undefined;
  let management: GoalBoardServer | undefined;
  try {
    const project = await catalog.createProject({ display_name: "状态闭环", actor_id: "user" });
    const runtimeHost = {
      homeDirectory,
      runtimeContext: {
        runtime_id: "codex",
        stable_work_context_id: "thread-state",
        host_declares_stable: true,
      },
    };
    const connection = {
      databasePath: project.database_path,
      boardId: project.board_id,
      projectId: project.project_id,
      webBaseUrl: "http://127.0.0.1:4173",
    };
    runtime = new GoalBoardServer("runtime", connection, runtimeHost, host);
    const board_id = project.board_id;
    const created = JSON.parse(await runtime.callTool("goalboard_v1_goal_intent_create", {
      board_id, title: "内部试用故事", outcome: "玩家能走完开场", idempotency_key: "intent-state",
    }));
    const goal_id = created.goal.goal_id as string;
    await runtime.callTool("goalboard_v1_event_configure", {
      board_id, goal_id, expected_version: 0, idempotency_key: "cfg-state",
      types: [localType()],
      new_requirements: [{ requirement_id: "playable", statement: "有一段能走完的开场" }],
    });
    const reported = JSON.parse(await runtime.callTool("goalboard_v1_event_report", {
      board_id, goal_id, idempotency_key: "report-state",
      events: [{
        type_id: "story-delivery", type_version: 1, title: "做出了开场",
        fields: { piece: "洞穴开场" },
        judgments: [{ requirement_id: "playable", verdict: "supports" }],
      }],
    }));
    const progress = JSON.parse(await runtime.callTool("goalboard_v1_event_progress", {
      board_id, goal_id, idempotency_key: "progress-1",
      based_on_cursor: reported.events[0].journal_seq,
      summary: "开场可玩", next_step: "等用户确认",
    }));
    assert.equal(progress.progress_summary.stale, false);
    const asked = JSON.parse(await runtime.callTool("goalboard_v1_event_decision_request", {
      board_id, goal_id, idempotency_key: "ask-1",
      question: "开场是否可以内部试用？",
      options: [
        { option_id: "yes", label: "可以", impact: "进入收尾" },
        { option_id: "no", label: "还不行", impact: "继续补" },
      ],
      scope: { requirement_ids: ["playable"] },
    }));
    await assert.rejects(
      () => runtime!.callTool("goalboard_v1_event_decide", {
        board_id, goal_id, idempotency_key: "runtime-decide", conclusion: "伪造批准",
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && (
        error.code === "mcp.authority_denied" || error.code === "mcp.user_impersonation_denied"
      ),
    );
    await assert.rejects(
      () => runtime!.callTool("goalboard_v1_event_progress", {
        board_id, goal_id, idempotency_key: "fake-user", actor_kind: "user",
        based_on_cursor: reported.events[0].journal_seq, summary: "伪造用户",
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "mcp.user_impersonation_denied",
    );

    management = new GoalBoardServer("management", connection, null, host);
    const decided = JSON.parse(await management.callTool("goalboard_v1_event_decide", {
      database_path: project.database_path,
      board_id, goal_id, actor_id: "manager", idempotency_key: "mgmt-decide",
      request_id: asked.decision_request.request_id,
      selected_option_id: "yes",
      conclusion: "管理入口确认可以试用",
      accepts_requirements: true,
      scope: { requirement_ids: ["playable"] },
    }));
    assert.equal(decided.decision.authority_source, "management");
    assert.equal(decided.decision.actor_id, "manager");

    const closed = JSON.parse(await runtime.callTool("goalboard_v1_event_close", {
      board_id, goal_id, idempotency_key: "close-1", kind: "complete",
      reason: "开场已支持且用户已确认", result: "可内部试用", expected_config_version: 1,
    })) as GoalEventClosureResult;
    assert.equal(closed.recorded, true);
    assert.equal(closed.completion_applied, true);

    await runtime.close();
    runtime = new GoalBoardServer("runtime", connection, runtimeHost, host);
    const reopened = JSON.parse(await runtime.callTool("goalboard_v1_goal_state", { board_id, goal_id })) as GoalEventStateView;
    assert.equal(reopened.owner?.kind, "event_work");
    assert.equal(reopened.completion_effect, true);
    assert.equal(reopened.work_status, "completed");
    assert.equal(reopened.applied_decisions[0]?.authority_source, "management");

    const snapshot = JSON.parse(await runtime.callTool("goalboard_v1_snapshot", { board_id }));
    assert.equal((snapshot.claims ?? []).length, 0);
    const persisted = await host.client(goalBoardHostProjectReference({
      databasePath: project.database_path, boardId: project.board_id, projectId: project.project_id,
    })).invoke(snapshotBoardCapability, { board_id });
    assert.equal(persisted.claims.length, 0);

    const progressEvent = JSON.parse(await runtime.callTool("goalboard_v1_event_read", {
      board_id, goal_id, event_id: progress.event_id,
    }));
    assert.equal(progressEvent.payload.operation, "progress_summary");
    assert.equal(progressEvent.payload.summary, "开场可玩");

    const beforeClose = JSON.parse(await runtime.callTool("goalboard_v1_event_list", { board_id, goal_id, limit: 100 }));
    await assert.rejects(
      () => runtime!.callTool("goalboard_v1_event_close", {
        board_id, goal_id, idempotency_key: "close-invalid", kind: "not-a-valid-kind",
        reason: "非法枚举必须拒绝", expected_config_version: 1,
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "event_closure.invalid_kind",
    );
    const afterInvalid = JSON.parse(await runtime.callTool("goalboard_v1_event_list", { board_id, goal_id, limit: 100 }));
    assert.equal(afterInvalid.events.length, beforeClose.events.length);
  } finally {
    await runtime?.close();
    await management?.close();
    await host.close();
    catalog.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
