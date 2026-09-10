import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AddressInfo } from "node:net";

import { GoalProjectApplication, LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";
import { createGoalBoardWebServer } from "../apps/desktop/launchers/web/server.js";
import { hostEventDecisionAuthority } from "@adeptify/goalboard-plugin-goals";

const BOARD = "board-http-events";
const TOKEN = "goalboard-event-http-token-0123456789abcdef";

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
    server.once("error", reject);
  });
}

test("HTTP event APIs persist intent, blank planning, typed reports, decisions and closure through SQLite restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-event-http-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const app = new GoalProjectApplication(store);
  app.initializeBoard({ board_id: BOARD, title: "HTTP 事件", actor_id: "user-1", idempotency_key: "init" });
  const created = app.goalEvents.createIntent({
    board_id: BOARD, title: "空白互动故事", outcome: "一段可玩片段", actor_id: "web-user",
    actor_kind: "user", idempotency_key: "intent-1",
  });
  const goalId = created.goal.goal_id;
  const blank = app.goalEvents.readState(BOARD, goalId);
  assert.equal(blank.config.adopted_planning.length, 0);
  assert.equal(blank.config.types.length, 0);
  app.goalEvents.configure({
    board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user",
    expected_version: 0, idempotency_key: "cfg-1",
    types: [{
      type_id: "scene", version: 1, name: "故事交付", purpose: "可体验片段", semantic_family: "delivery",
      fields: [{ field_id: "piece", name: "片段", purpose: "发生了什么", format: "longtext", required: true }],
    }],
    new_requirements: [{ requirement_id: "playable", statement: "能从开始走到结束", bound_type_id: "scene" }],
  });
  app.goalEvents.report({
    board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user", idempotency_key: "rep-1",
    events: [{
      type_id: "scene", type_version: 1, title: "开场已经能走进去",
      fields: { piece: "玩家可以从门口走进第一段。" },
      judgments: [{ requirement_id: "playable", verdict: "supports" }],
    }],
  });
  const opened = app.goalEvents.applyConcern({
    board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user", idempotency_key: "concern-1",
    action: "open", title: "重启还没验", statement: "退出后再进会丢进度", blocks_closure: true,
    scope: { requirement_ids: ["playable"] },
  });
  const requested = app.goalEvents.requestDecision({
    board_id: BOARD, goal_id: goalId, actor_id: "runtime-1", actor_kind: "runtime", idempotency_key: "ask-1",
    question: "是否接受当前可玩范围？",
    options: [
      { option_id: "yes", label: "接受", impact: "可以继续收尾" },
      { option_id: "no", label: "再补", impact: "先补重启" },
    ],
    scope: { requirement_ids: ["playable"], concern_ids: [opened.concern.concern_id] },
  });
  const decided = app.goalEvents.recordTrustedDecision({
    board_id: BOARD, goal_id: goalId, idempotency_key: "dec-1",
    authority: hostEventDecisionAuthority("web", BOARD, "web-user", "dec-1"),
    request_id: requested.decision_request.request_id,
    selected_option_id: "yes",
    conclusion: "先按当前范围试用",
    effects: [{ kind: "accept_requirements" }, { kind: "accept_concerns" }],
    scope: { requirement_ids: ["playable"], concern_ids: [opened.concern.concern_id] },
  });
  app.goalEvents.applyConcern({
    board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user", idempotency_key: "concern-2",
    action: "accept", concern_id: opened.concern.concern_id, reason: "本轮接受重启缺口",
    cited_decision_id: decided.decision.decision_id,
  });
  const closed = app.goalEvents.submitClosure({
    board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user", idempotency_key: "close-1",
    kind: "complete", result: "开场可玩", reason: "当前范围已试用",
    expected_config_version: 1, expected_agreement_version: app.goalEvents.readState(BOARD, goalId).agreement.version,
  });
  assert.equal(closed.recorded, true);

  const server = createGoalBoardWebServer({ databasePath, boardId: BOARD, homeDirectory: directory, controlToken: TOKEN });
  const origin = await listen(server);
  try {
    const stateRes = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-state`);
    assert.equal(stateRes.status, 200);
    const state = await stateRes.json() as { owner: { kind: string }; latest_reports: Array<{ title: string }>; current_decisions: unknown[] };
    assert.equal(state.owner.kind, "event_work");
    assert.equal(state.latest_reports[0]?.title, "开场已经能走进去");
    const timelineRes = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-timeline?limit=20`);
    const timeline = await timelineRes.json() as { items: Array<{ event_id: string; title: string }>; next_cursor: number | null };
    assert.ok(timeline.items.length >= 4);
    const ids = timeline.items.map((item) => item.event_id);
    assert.equal(new Set(ids).size, ids.length);
    const bodyRes = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/events/${encodeURIComponent(timeline.items[0]!.event_id)}`);
    const body = await bodyRes.json() as { title: string; payload?: { piece?: string } };
    assert.ok(body.title);
    const conflict = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-close`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "x-goalboard-idempotency-key": "close-stale",
        "x-goalboard-control-token": TOKEN,
      },
      body: JSON.stringify({
        kind: "complete", reason: "旧版本", expected_config_version: 0, expected_agreement_version: 0,
      }),
    });
    assert.equal(conflict.status, 409);
    const conflictBody = await conflict.json() as { code: string };
    assert.match(conflictBody.code, /stale_version|version_conflict/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
  }

  const reopened = new LocalProjectDatabase(databasePath);
  const again = new GoalProjectApplication(reopened);
  const restored = again.goalEvents.readState(BOARD, goalId);
  assert.equal(restored.latest_reports[0]?.title, "开场已经能走进去");
  assert.equal(restored.owner?.kind, "event_work");
  reopened.close();
  rmSync(directory, { recursive: true, force: true });
});

test("HTTP event-close rejects unknown kind without recording an event", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-event-http-kind-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const app = new GoalProjectApplication(store);
  app.initializeBoard({ board_id: BOARD, title: "kind", actor_id: "user-1", idempotency_key: "init-kind" });
  const created = app.goalEvents.createIntent({
    board_id: BOARD, title: "无效收尾", outcome: "不能默认为完成",
    actor_id: "web-user", actor_kind: "user", idempotency_key: "intent-kind",
  });
  const server = createGoalBoardWebServer({ databasePath, boardId: BOARD, homeDirectory: directory, controlToken: TOKEN });
  const origin = await listen(server);
  try {
    const before = app.goalEvents.readState(BOARD, created.goal.goal_id);
    const response = await fetch(`${origin}/api/goals/${encodeURIComponent(created.goal.goal_id)}/event-close`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-goalboard-control-token": TOKEN, "x-goalboard-idempotency-key": "bogus-kind" },
      body: JSON.stringify({
        kind: "bogus", reason: "检查无效动作不能提交完成",
        expected_config_version: before.config.version, expected_agreement_version: before.agreement.version,
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { code?: string };
    assert.match(String(body.code), /invalid_kind/);
    const after = app.goalEvents.readState(BOARD, created.goal.goal_id);
    assert.equal(after.work_status, before.work_status);
    assert.equal(after.observed_event_cursor, before.observed_event_cursor);
    const missing = await fetch(`${origin}/api/goals/${encodeURIComponent(created.goal.goal_id)}/event-close`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-goalboard-control-token": TOKEN, "x-goalboard-idempotency-key": "missing-kind" },
      body: JSON.stringify({
        reason: "缺 kind 也不能默认完成",
        expected_config_version: before.config.version, expected_agreement_version: before.agreement.version,
      }),
    });
    assert.equal(missing.status, 400);
    const missingBody = await missing.json() as { code?: string };
    assert.match(String(missingBody.code), /invalid_kind/);
    const afterMissing = app.goalEvents.readState(BOARD, created.goal.goal_id);
    assert.equal(afterMissing.observed_event_cursor, before.observed_event_cursor);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("HTTP writes persist typed reports, scoped concerns and closure through the public event routes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-event-http-write-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const app = new GoalProjectApplication(store);
  app.initializeBoard({ board_id: BOARD, title: "HTTP 写入", actor_id: "user-1", idempotency_key: "init-write" });
  const created = app.goalEvents.createIntent({
    board_id: BOARD, title: "HTTP 写入目标", outcome: "经 HTTP 保存后再读回",
    actor_id: "web-user", actor_kind: "user", idempotency_key: "intent-write",
  });
  const goalId = created.goal.goal_id;
  const server = createGoalBoardWebServer({ databasePath, boardId: BOARD, homeDirectory: directory, controlToken: TOKEN });
  const origin = await listen(server);
  const headers = {
    "content-type": "application/json",
    origin,
    "x-goalboard-control-token": TOKEN,
  };
  try {
    const configure = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-configure`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-cfg" },
      body: JSON.stringify({
        expected_version: 0,
        types: [{
          type_id: "note", version: 1, name: "进展记录", purpose: "记下事实", semantic_family: "progress",
          fields: [{ field_id: "body", name: "内容", purpose: "原文", format: "longtext", required: true }],
        }],
        new_requirements: [{ requirement_id: "need", statement: "能读回刚才写入的事实", bound_type_id: "note" }],
      }),
    });
    assert.equal(configure.status, 200, await configure.clone().text());
    const report = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-report`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-rep" },
      body: JSON.stringify({
        events: [{ type_id: "note", type_version: 1, title: "HTTP 已经写下报告", fields: { body: "这条经公开路由写入。" } }],
      }),
    });
    assert.equal(report.status, 200, await report.clone().text());
    const concern = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-concern`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-concern" },
      body: JSON.stringify({
        action: "open", title: "还要核对范围", statement: "范围必须明确",
        blocks_closure: true, scope: { requirement_ids: ["need"] },
      }),
    });
    assert.equal(concern.status, 200, await concern.clone().text());
    const concernBody = await concern.json() as { concern: { concern_id: string } };
    const decision = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-decision`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-dec" },
      body: JSON.stringify({
        conclusion: "接受当前范围",
        effects: [{ kind: "accept_requirements" }, { kind: "accept_concerns" }],
        scope: { requirement_ids: ["need"], concern_ids: [concernBody.concern.concern_id] },
      }),
    });
    assert.equal(decision.status, 200, await decision.clone().text());
    const decided = await decision.json() as { decision: { decision_id: string } };
    const accept = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-concern`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-accept" },
      body: JSON.stringify({
        action: "accept", concern_id: concernBody.concern.concern_id, reason: "决定已覆盖",
        cited_decision_id: decided.decision.decision_id,
      }),
    });
    assert.equal(accept.status, 200, await accept.clone().text());
    const state = await (await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-state`)).json() as {
      agreement: { version: number }; config: { version: number }; latest_reports: Array<{ title: string }>;
    };
    const closed = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-close`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-close" },
      body: JSON.stringify({
        kind: "complete", reason: "HTTP 写入已核对",
        expected_config_version: state.config.version,
        expected_agreement_version: state.agreement.version,
      }),
    });
    assert.equal(closed.status, 200, await closed.clone().text());
    const timeline = await (await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-timeline?limit=20`)).json() as {
      items: Array<{ event_id: string; source?: string; title: string }>;
    };
    const ids = timeline.items.map((item) => item.event_id || item.title);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(timeline.items.some((item) => item.title.includes("HTTP 已经写下报告") || item.source === "event_work"));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("HTTP progress uses the Goal cursor and legal field ids stay content", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-event-http-cursor-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const app = new GoalProjectApplication(store);
  app.initializeBoard({ board_id: BOARD, title: "cursor", actor_id: "user-1", idempotency_key: "init-cursor" });
  const created = app.goalEvents.createIntent({
    board_id: BOARD, title: "空白进展", outcome: "第一次摘要",
    actor_id: "web-user", actor_kind: "user", idempotency_key: "intent-cursor",
  });
  const goalId = created.goal.goal_id;
  const server = createGoalBoardWebServer({ databasePath, boardId: BOARD, homeDirectory: directory, controlToken: TOKEN });
  const origin = await listen(server);
  const headers = { "content-type": "application/json", origin, "x-goalboard-control-token": TOKEN };
  try {
    const state = await (await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-state`)).json() as { goal_event_cursor: number };
    assert.equal(state.goal_event_cursor, 0);
    const progress = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-progress`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "blank-progress" },
      body: JSON.stringify({ summary: "空白目标第一次记录进展", based_on_cursor: 0 }),
    });
    assert.equal(progress.status, 200, await progress.clone().text());
    assert.equal(app.goalEvents.readState(BOARD, goalId).progress_summary?.summary, "空白目标第一次记录进展");
    app.goalEvents.configure({
      board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user",
      expected_version: 0, idempotency_key: "special-fields",
      types: [{
        type_id: "special", version: 1, name: "合法字段", purpose: "原文",
        fields: ["requirement_id", "verdict", "title"].map((field_id) => ({
          field_id, name: field_id, purpose: "原文", format: "text" as const, required: true,
        })),
      }],
    });
    const report = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-report`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "special-report" },
      body: JSON.stringify({
        events: [{
          type_id: "special", type_version: 1, title: "字段内容不能构成判断",
          fields: { requirement_id: "原文 requirement_id", verdict: "原文 verdict", title: "原文 title" },
        }],
      }),
    });
    assert.equal(report.status, 200, await report.clone().text());
    const saved = app.goalEvents.listEvents(BOARD, goalId, { limit: 20 }).events.find((event) => event.kind === "report");
    assert.equal(saved?.judgments.length, 0);
    assert.equal((saved?.payload as { verdict?: string }).verdict, "原文 verdict");
    app.goalEvents.configure({
      board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user",
      expected_version: app.goalEvents.readState(BOARD, goalId).config.version, idempotency_key: "need-for-close",
      new_requirements: [{ requirement_id: "closed-result", statement: "结果已交付", bound_type_id: "special" }],
    });
    app.goalEvents.report({
      board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user", idempotency_key: "support-close",
      events: [{
        type_id: "special", type_version: 1, title: "交付完成",
        fields: { requirement_id: "a", verdict: "b", title: "c" },
        judgments: [{ requirement_id: "closed-result", verdict: "supports" }],
      }],
    });
    const ready = app.goalEvents.readState(BOARD, goalId);
    const closed = app.goalEvents.submitClosure({
      board_id: BOARD, goal_id: goalId, actor_id: "web-user", actor_kind: "user", idempotency_key: "do-complete",
      kind: "complete", result: "明确结果已交付", reason: "测试显式重开",
      expected_config_version: ready.config.version, expected_agreement_version: ready.agreement.version,
    });
    assert.equal(closed.completion_applied, true);
    const firstResume = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-resume`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "resume-replay" },
      body: JSON.stringify({ reason: "明确开启下一轮", idempotency_key: "resume-replay" }),
    });
    assert.equal(firstResume.status, 200, await firstResume.clone().text());
    const firstBody = await firstResume.json() as { event_id: string };
    const secondResume = await fetch(`${origin}/api/goals/${encodeURIComponent(goalId)}/event-resume`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "resume-replay" },
      body: JSON.stringify({ reason: "明确开启下一轮", idempotency_key: "resume-replay" }),
    });
    assert.equal(secondResume.status, 200, await secondResume.clone().text());
    const secondBody = await secondResume.json() as { event_id: string };
    assert.equal(secondBody.event_id, firstBody.event_id);
    const oldCreate = (goalIdValue: string) => fetch(`${origin}/api/goals`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "old-create-one-time" },
      body: JSON.stringify({
        goal_id: goalIdValue, title: "旧创建入口的一次性保护", outcome: "", why: "", business_logic: "",
      }),
    });
    const firstCreate = await oldCreate("old-guard-first");
    assert.equal(firstCreate.status, 201, await firstCreate.clone().text());
    const secondCreate = await oldCreate("old-guard-second");
    assert.equal(secondCreate.status, 409, await secondCreate.clone().text());
    assert.equal(store.snapshot(BOARD).goals.some((goal) => goal.goal_id === "old-guard-second"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("HTTP draft update rejects event owners and still saves untransferred drafts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-event-http-draft-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const app = new GoalProjectApplication(store);
  app.initializeBoard({ board_id: BOARD, title: "draft-owner", actor_id: "user-1", idempotency_key: "init-draft-http" });
  const created = app.goalEvents.createIntent({
    board_id: BOARD, title: "事件目标", outcome: "原事件约定",
    actor_id: "web-user", actor_kind: "user", idempotency_key: "intent-draft-http",
  });
  app.goals.commands.createGoal(BOARD, {
    goal_id: "legacy-http-draft", title: "未转交草稿", outcome: "旧结果", why: "旧原因",
    business_logic: "旧编辑", definition_state: "draft", decomposition_state: "abstract",
    acceptance_criteria: [],
  }, { actor_id: "web-user", idempotency_key: "legacy-http-create" });
  const server = createGoalBoardWebServer({ databasePath, boardId: BOARD, homeDirectory: directory, controlToken: TOKEN });
  const origin = await listen(server);
  const headers = { "content-type": "application/json", origin, "x-goalboard-control-token": TOKEN };
  try {
    const page = await (await fetch(`${origin}/goals/${encodeURIComponent(created.goal.goal_id)}`)).text();
    assert.match(page, /data-goal-event-document/);
    assert.doesNotMatch(page, /data-open-goal-edit/);
    const before = store.snapshot(BOARD).goals.find((goal) => goal.goal_id === created.goal.goal_id)!;
    const beforeState = app.goalEvents.readState(BOARD, created.goal.goal_id);
    const rejected = await fetch(`${origin}/api/goals/${encodeURIComponent(created.goal.goal_id)}/draft`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-draft-hijack" },
      body: JSON.stringify({
        title: "旧草稿表单的新标题", outcome: "旧草稿表单的新结果", why: "不应写入",
        business_logic: "第二份约定", definition_state: "draft", reason: "通过旧草稿入口修改当前约定",
        acceptance_criteria: [],
      }),
    });
    assert.equal(rejected.status, 409, await rejected.clone().text());
    const rejectedBody = await rejected.json() as { code?: string };
    assert.equal(rejectedBody.code, "goal.event_state_owner");
    const after = store.snapshot(BOARD).goals.find((goal) => goal.goal_id === created.goal.goal_id)!;
    const afterState = app.goalEvents.readState(BOARD, created.goal.goal_id);
    assert.equal(after.outcome, before.outcome);
    assert.equal(after.title, before.title);
    assert.deepEqual(after.acceptance_criteria, before.acceptance_criteria);
    assert.equal(afterState.agreement.outcome, beforeState.agreement.outcome);
    assert.equal(afterState.agreement.version, beforeState.agreement.version);
    const legacyPage = await (await fetch(`${origin}/goals/legacy-http-draft`)).text();
    assert.match(legacyPage, /data-open-goal-edit/);
    assert.match(legacyPage, /data-draft-editor data-goal-id="legacy-http-draft"/);
    const saved = await fetch(`${origin}/api/goals/legacy-http-draft/draft`, {
      method: "POST",
      headers: { ...headers, "x-goalboard-idempotency-key": "http-legacy-draft" },
      body: JSON.stringify({
        title: "未转交草稿已补全", outcome: "可继续的旧结果", why: "旧原因",
        business_logic: "旧编辑", definition_state: "draft", reason: "补全未转交草稿",
        acceptance_criteria: [],
      }),
    });
    assert.equal(saved.status, 200, await saved.clone().text());
    assert.equal(store.snapshot(BOARD).goals.find((goal) => goal.goal_id === "legacy-http-draft")?.outcome, "可继续的旧结果");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("HTTP Goal page keeps accepted legacy constraints, inputs and outputs readable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-event-http-definition-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const app = new GoalProjectApplication(store);
  app.initializeBoard({ board_id: BOARD, title: "definition-read", actor_id: "user-1", idempotency_key: "init-definition-http" });
  const goal = {
    goal_id: "legacy-definition-http",
    title: "保留原目标的输入输出",
    outcome: "迁入正文后仍能读到完整约定",
    why: "历史资料不能在更换界面时消失",
    business_logic: "从目标说明直接读取原字段",
    definition_state: "accepted" as const,
    decomposition_state: "closed_leaf" as const,
    in_scope: ["原范围内事项"],
    out_of_scope: ["原范围外事项"],
    constraints: ["原约束：只修改已确认的文案"],
    required_inputs: ["原输入：用户已确认的发布说明"],
    promised_outputs: ["原输出：可读的最终说明文档"],
    acceptance_criteria: [{
      criterion_id: "legacy-read-criterion",
      statement: "能够查看原字段",
      decision_method: "inspection" as const,
      target: { value: 90, unit: "分", baseline: "release-gate" },
      pass_condition: "原约束、输入和输出逐项显示",
      required_evidence: ["inspection", "original-report"],
    }],
  };
  app.goals.commands.createGoal(BOARD, goal, { actor_id: "definition-fixture", idempotency_key: "legacy-definition-http-create", reason: "隔离验收原字段读取" });
  const before = store.snapshot(BOARD);
  const server = createGoalBoardWebServer({ databasePath, boardId: BOARD, homeDirectory: directory, controlToken: TOKEN });
  const origin = await listen(server);
  try {
    const page = await (await fetch(`${origin}/goals/${encodeURIComponent(goal.goal_id)}`)).text();
    const start = page.indexOf('data-event-panel="description"');
    const end = page.indexOf('data-event-panel="requirements"');
    assert.ok(start >= 0 && end > start, "description panel must be in the Goal document");
    const description = page.slice(start, end);
    for (const value of [...goal.constraints, ...goal.required_inputs, ...goal.promised_outputs]) {
      assert.match(description, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(page, /data-draft-form/);
    assert.match(page, /data-event-work="false"/);
    const requirements = page.slice(end);
    const detailsStart = requirements.indexOf("<details");
    const detailsEnd = requirements.indexOf("</details>");
    assert.ok(detailsStart >= 0 && detailsEnd > detailsStart, "original criteria must be inside an expandable details");
    const details = requirements.slice(detailsStart, detailsEnd + "</details>".length);
    assert.match(details, /<summary>原 Goal 标准<\/summary>/);
    assert.match(details, /legacy-read-criterion/);
    assert.match(details, /inspection/);
    assert.match(details, /\{&quot;value&quot;:90,&quot;unit&quot;:&quot;分&quot;,&quot;baseline&quot;:&quot;release-gate&quot;\}/);
    assert.doesNotMatch(details, /90 分/);
    assert.match(details, /original-report/);
    assert.doesNotMatch(details, /当前满足|尚未满足/);
    const fragment = await (await fetch(`${origin}/api/goals/${encodeURIComponent(goal.goal_id)}/document`)).text();
    for (const value of [...goal.constraints, ...goal.required_inputs, ...goal.promised_outputs]) {
      assert.match(fragment, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.deepEqual(store.snapshot(BOARD).goals, before.goals);
    assert.equal(app.goalEvents.isEventStateOwner(BOARD, goal.goal_id), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
