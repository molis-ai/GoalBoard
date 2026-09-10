import { openGoalBoardProjectCatalog } from "@adeptify/goalboard-app-desktop";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openWorkSessionRegistry } from "@adeptify/goalboard-app-local-host";
import { snapshotBoardCapability, goalBoardHostProjectReference, createGoalBoardLocalHost } from "@adeptify/goalboard-app-local-host";
import { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";
import { GoalBoardServer } from "../apps/desktop/launchers/mcp/server.js";
import type { GoalEventStateView, ReportGoalEventsResult } from "@adeptify/goalboard-contracts/modules/goals";

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
      { field_id: "limits", name: "已知缺口", purpose: "尚未完成的部分", format: "longtext", required: false },
    ],
  };
}

test("Runtime event tools create, configure, report and reopen without Claim or Run", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-mcp-goal-events-"));
  const homeDirectory = join(directory, "home");
  const catalog = await openGoalBoardProjectCatalog({ homeDirectory });
  const host = createGoalBoardLocalHost();
  let mcp: GoalBoardServer | undefined;
  try {
    const project = await catalog.createProject({ display_name: "事件闭环", actor_id: "user" });
    const runtimeHost = {
      homeDirectory,
      runtimeContext: {
        runtime_id: "codex",
        stable_work_context_id: "thread-events",
        host_declares_stable: true,
      },
    };
    mcp = new GoalBoardServer("runtime", {
      databasePath: project.database_path,
      boardId: project.board_id,
      projectId: project.project_id,
      webBaseUrl: "http://127.0.0.1:4173",
    }, runtimeHost, host);
    const board_id = project.board_id;
    const created = JSON.parse(await mcp.callTool("goalboard_v1_goal_intent_create", {
      board_id, title: "互动故事开场", outcome: "玩家能走进洞穴并做一次选择", idempotency_key: "intent-1",
    }));
    assert.equal(created.completion_effect, false);
    assert.equal(created.goal.definition_state, "draft");
    assert.equal(created.goal.title, "互动故事开场");
    assert.equal(created.goal.why, undefined);
    const goal_id = created.goal.goal_id as string;
    const replayed = JSON.parse(await mcp.callTool("goalboard_v1_goal_intent_create", {
      board_id, title: "互动故事开场", outcome: "玩家能走进洞穴并做一次选择", idempotency_key: "intent-1",
    }));
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.goal.goal_id, goal_id);

    const configured = JSON.parse(await mcp.callTool("goalboard_v1_event_configure", {
      board_id, goal_id, expected_version: 0, idempotency_key: "cfg-1", types: [localType()],
    }));
    assert.equal(configured.replayed, false);
    assert.equal(configured.config.version, 1);
    assert.equal(configured.config.types[0]?.type_id, "story-delivery");
    assert.deepEqual(configured.config.adopted_planning, []);

    const reported = JSON.parse(await mcp.callTool("goalboard_v1_event_report", {
      board_id, goal_id, idempotency_key: "report-1",
      events: [{
        type_id: "story-delivery", type_version: 1, title: "做出了开场片段",
        fields: { piece: "开场洞穴", limits: "还没有第二幕" },
      }],
    })) as ReportGoalEventsResult;
    assert.equal(reported.replayed, false);
    assert.equal(reported.events.length, 1);
    assert.equal(reported.events[0]?.kind, "report");
    assert.equal(reported.events[0]?.payload.piece, "开场洞穴");
    assert.equal(reported.events[0]?.actor_kind, "runtime");
    assert.match(reported.events[0]?.actor_id ?? "", /^runtime:codex:thread-events$/);

    const retry = JSON.parse(await mcp.callTool("goalboard_v1_event_report", {
      board_id, goal_id, idempotency_key: "report-1",
      events: [{
        type_id: "story-delivery", type_version: 1, title: "做出了开场片段",
        fields: { piece: "开场洞穴", limits: "还没有第二幕" },
      }],
    })) as ReportGoalEventsResult;
    assert.equal(retry.replayed, true);
    assert.equal(retry.events[0]?.event_id, reported.events[0]?.event_id);

    const state = JSON.parse(await mcp.callTool("goalboard_v1_goal_state", { board_id, goal_id })) as GoalEventStateView;
    assert.equal(state.protocol.kind, "event_work");
    assert.equal(state.protocol.claim_or_run_required, false);
    assert.equal(state.completion_effect, false);
    assert.equal(state.recorded_not_completed, true);
    assert.equal(state.latest_reports[0]?.event_id, reported.events[0]?.event_id);
    assert.equal(state.config.types.length, 1);

    const listed = JSON.parse(await mcp.callTool("goalboard_v1_event_list", { board_id, goal_id }));
    assert.deepEqual(listed.events.map((item: { kind: string }) => item.kind), ["configuration", "report"]);
    assert.equal(listed.events[0]?.kind, "configuration");
    assert.equal(listed.events[0]?.payload.config_version, 1);
    assert.ok(Array.isArray(listed.events[0]?.payload.types));
    const read = JSON.parse(await mcp.callTool("goalboard_v1_event_read", {
      board_id, goal_id, event_id: reported.events[0]!.event_id,
    }));
    assert.equal(read.kind, "report");
    assert.equal(read.payload.piece, "开场洞穴");

    const snapshot = JSON.parse(await mcp.callTool("goalboard_v1_snapshot", { board_id }));
    assert.equal((snapshot.claims ?? []).length, 0);
    assert.equal((snapshot.runs ?? []).length, 0);

    await mcp.close();
    mcp = new GoalBoardServer("runtime", {
      databasePath: project.database_path,
      boardId: project.board_id,
      projectId: project.project_id,
      webBaseUrl: "http://127.0.0.1:4173",
    }, runtimeHost, host);
    const reopened = JSON.parse(await mcp.callTool("goalboard_v1_goal_state", { board_id, goal_id })) as GoalEventStateView;
    assert.equal(reopened.config.version, 1);
    assert.equal(reopened.latest_reports[0]?.title, "做出了开场片段");
    const oldBody = JSON.parse(await mcp.callTool("goalboard_v1_event_read", {
      board_id, goal_id, event_id: reported.events[0]!.event_id,
    }));
    assert.equal(oldBody.payload.piece, "开场洞穴");
    assert.equal(oldBody.type.version, 1);

    const v2 = structuredClone(localType());
    v2.version = 2;
    v2.fields.push({
      field_id: "entry", name: "怎样体验", purpose: "从哪里开始", format: "text", required: false,
    });
    await mcp.callTool("goalboard_v1_event_configure", {
      board_id, goal_id, expected_version: 1, idempotency_key: "cfg-2", types: [v2],
    });
    const stillOld = JSON.parse(await mcp.callTool("goalboard_v1_event_read", {
      board_id, goal_id, event_id: reported.events[0]!.event_id,
    }));
    assert.equal(stillOld.type.version, 1);
    assert.equal(stillOld.payload.entry, undefined);

    const beforeInvalid = JSON.parse(await mcp.callTool("goalboard_v1_event_list", { board_id, goal_id }));
    await assert.rejects(
      () => mcp!.callTool("goalboard_v1_event_report", {
        board_id, goal_id, idempotency_key: "bad-batch",
        events: [
          { type_id: "story-delivery", type_version: 1, title: "合法", fields: { piece: "仍应回滚" } },
          { type_id: "story-delivery", type_version: 1, title: "缺字段", fields: {} },
        ],
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "event_report.missing_required_field",
    );
    const afterInvalid = JSON.parse(await mcp.callTool("goalboard_v1_event_list", { board_id, goal_id }));
    assert.equal(afterInvalid.events.length, beforeInvalid.events.length);

    const beforeReject = afterInvalid.events.length;
    await assert.rejects(
      () => mcp!.callTool("goalboard_v1_event_report", {
        board_id: "other-board", goal_id, idempotency_key: "cross-board",
        events: [{ type_id: "story-delivery", type_version: 1, title: "跨 board", fields: { piece: "不应写入" } }],
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "mcp.board_mismatch",
    );
    await assert.rejects(
      () => mcp!.callTool("goalboard_v1_event_report", {
        board_id, goal_id, idempotency_key: "override-db", database_path: "/tmp/not-this.db",
        events: [{ type_id: "story-delivery", type_version: 1, title: "覆盖路径", fields: { piece: "不应写入" } }],
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "mcp.connection_override_denied",
    );
    await assert.rejects(
      () => mcp!.callTool("goalboard_v1_event_report", {
        board_id, goal_id, idempotency_key: "fake-user", actor_kind: "user",
        events: [{ type_id: "story-delivery", type_version: 1, title: "伪造用户", fields: { piece: "不应写入" } }],
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "mcp.user_impersonation_denied",
    );
    await assert.rejects(
      () => mcp!.callTool("goalboard_v1_goal_intent_create", {
        board_id, title: "伪造身份", idempotency_key: "fake-actor", actor_id: "user-admin",
      }),
      (error: unknown) => error instanceof GoalBoardV1Error && error.code === "mcp.user_impersonation_denied",
    );
    const afterReject = JSON.parse(await mcp.callTool("goalboard_v1_event_list", { board_id, goal_id }));
    assert.equal(afterReject.events.length, beforeReject);

    const persisted = await host.client(goalBoardHostProjectReference({
      databasePath: project.database_path, boardId: project.board_id, projectId: project.project_id,
    })).invoke(snapshotBoardCapability, { board_id });
    assert.equal(persisted.claims.length, 0);
    assert.equal(persisted.runs.length, 0);
  } finally {
    await mcp?.close();
    await host.close();
    catalog.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("event report stays persisted when secondary Session indexing fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-mcp-event-activity-"));
  const homeDirectory = join(directory, "home");
  const catalog = await openGoalBoardProjectCatalog({ homeDirectory });
  const host = createGoalBoardLocalHost();
  let mcp: GoalBoardServer | undefined;
  try {
    const project = await catalog.createProject({ display_name: "事件活动", actor_id: "user" });
    const registry = await openWorkSessionRegistry({ homeDirectory });
    let sessionId: string;
    try {
      sessionId = registry.explicitlyLinkSession({
        runtime_id: "codex", native_runtime_session_id: "thread-events-activity",
        actor_id: "user", user_confirmed: true, project_id: project.project_id,
      }).session_id;
    } finally { registry.close(); }
    mcp = new GoalBoardServer("runtime", {
      databasePath: project.database_path, boardId: project.board_id,
      projectId: project.project_id, webBaseUrl: "http://127.0.0.1:4173",
    }, {
      homeDirectory,
      runtimeContext: { runtime_id: "codex", stable_work_context_id: "thread-events-activity", host_declares_stable: true },
    }, host);
    const board_id = project.board_id;
    const created = JSON.parse(await mcp.callTool("goalboard_v1_goal_intent_create", {
      board_id, title: "记录事件活动", idempotency_key: "intent-activity",
    }));
    const goal_id = created.goal.goal_id as string;
    await mcp.callTool("goalboard_v1_event_configure", {
      board_id, goal_id, expected_version: 0, idempotency_key: "cfg-activity", types: [localType()],
    });
    const obstructedHome = join(directory, "not-a-directory");
    writeFileSync(obstructedHome, "secondary registry failure");
    mcp.runtimeContextHost!.homeDirectory = obstructedHome;
    const reported = JSON.parse(await mcp.callTool("goalboard_v1_event_report", {
      board_id, goal_id, idempotency_key: "report-activity",
      events: [{ type_id: "story-delivery", type_version: 1, title: "已记录", fields: { piece: "洞穴" } }],
    })) as ReportGoalEventsResult;
    assert.equal(reported.events[0]?.payload.piece, "洞穴");
    const listed = JSON.parse(await mcp.callTool("goalboard_v1_event_list", { board_id, goal_id }));
    assert.equal(listed.events.filter((item: { kind: string }) => item.kind === "report").length, 1);
    mcp.runtimeContextHost!.homeDirectory = homeDirectory;
    const inspect = await openWorkSessionRegistry({ homeDirectory });
    try {
      assert.equal(inspect.events(sessionId).filter((event) => event.source_id === "goalboard_v1_event_report:report-activity").length, 0);
    } finally { inspect.close(); }
  } finally {
    await mcp?.close();
    await host.close();
    catalog.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing stable Session identity rejects event writes with no Goal or event side effects", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-mcp-event-identity-"));
  const homeDirectory = join(directory, "home");
  const catalog = await openGoalBoardProjectCatalog({ homeDirectory });
  const host = createGoalBoardLocalHost();
  let mcp: GoalBoardServer | undefined;
  try {
    const project = await catalog.createProject({ display_name: "身份拒绝", actor_id: "user" });
    const reference = goalBoardHostProjectReference({
      databasePath: project.database_path, boardId: project.board_id, projectId: project.project_id,
    });
    const before = await host.client(reference).invoke(snapshotBoardCapability, { board_id: project.board_id });
    mcp = new GoalBoardServer("runtime", {
      databasePath: project.database_path, boardId: project.board_id,
      projectId: project.project_id, webBaseUrl: "http://127.0.0.1:4173",
    }, {
      homeDirectory,
      runtimeContext: { runtime_id: "codex", stable_work_context_id: null, host_declares_stable: false },
    }, host);
    await assert.rejects(
      () => mcp!.callTool("goalboard_v1_goal_intent_create", {
        board_id: project.board_id, title: "不应写入", idempotency_key: "missing-session",
      }),
      (error: unknown) => error instanceof GoalBoardV1Error
        && error.code === "mcp.runtime_identity_missing"
        && /稳定 Session/.test(error.message),
    );
    const after = await host.client(reference).invoke(snapshotBoardCapability, { board_id: project.board_id });
    assert.equal(after.goals.length, before.goals.length);
    assert.deepEqual(after.goals.map((goal) => goal.goal_id), before.goals.map((goal) => goal.goal_id));

    await mcp.close();
    mcp = new GoalBoardServer("runtime", {
      databasePath: project.database_path, boardId: project.board_id,
      projectId: project.project_id, webBaseUrl: "http://127.0.0.1:4173",
    }, {
      homeDirectory,
      nativeRuntimeSessionId: "native-session",
      runtimeContext: { runtime_id: "codex", stable_work_context_id: null, host_declares_stable: false },
    }, host);
    const created = JSON.parse(await mcp.callTool("goalboard_v1_goal_intent_create", {
      board_id: project.board_id, title: "稳定 native Session", idempotency_key: "native-session-intent",
    }));
    assert.equal(created.goal.title, "稳定 native Session");
    assert.match(JSON.parse(await mcp.callTool("goalboard_v1_event_configure", {
      board_id: project.board_id, goal_id: created.goal.goal_id, expected_version: 0, idempotency_key: "native-cfg",
      types: [localType()],
    })).config.updated_by, /^runtime:codex:native-session$/);
  } finally {
    await mcp?.close();
    await host.close();
    catalog.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
