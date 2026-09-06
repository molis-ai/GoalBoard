import assert from "node:assert/strict";
import test from "node:test";
import { buildMcpResumeView, type McpResumeFacts } from "@adeptify/goalboard-app-mcp";
import type { GoalActionProjection } from "@adeptify/goalboard-plugin-goals";

function factsFor(entries: Array<[string, GoalActionProjection["display_status"], GoalActionProjection["progress"]]>): McpResumeFacts {
  return {
    goals: entries.map(([id]) => ({ goal_id: id, title: `目标 ${id}`, priority: 50, updated_at: "2026-09-01T00:00:00Z", trashed_at: null })),
    projections: entries.map(([id, status, progress]) => ({
      goal_id: id, display_status: status, progress, contract_revision: 1,
      action_token: `existing-${id}`, primary_action: null, actions: [],
    })),
  };
}

test("MCP resume preserves host/session focus, original action facts and no automatic claim", () => {
  const facts = factsFor([
    ["active", "in_progress", "in_progress"], ["session", "continue", "not_started"],
    ["host", "waiting_user", "not_started"],
  ]);
  const before = structuredClone(facts);
  const hostFocus = buildMcpResumeView(facts, "host", "session");
  assert.equal(hostFocus.focus?.goal_id, "host");
  assert.equal(hostFocus.focus?.source, "host_focus");
  assert.equal(hostFocus.focus?.projection, facts.projections[2]);
  assert.equal(hostFocus.auto_claimed, false);
  const sessionFocus = buildMcpResumeView(facts, "missing-host-goal", "session");
  assert.equal(sessionFocus.focus?.goal_id, "session");
  assert.equal(sessionFocus.focus?.source, "session_focus");
  assert.equal(sessionFocus.auto_claimed, false);
  assert.deepEqual(facts, before, "display construction must not change input facts or projections");
});

test("MCP resume keeps recovery ordering and excludes trashed/completed suggestions", () => {
  const facts = factsFor([
    ["done", "completed", "verified"], ["blocked", "blocked", "not_started"],
    ["waiting", "waiting", "not_started"], ["ready-b", "continue", "not_started"],
    ["ready-a", "continue", "not_started"], ["recorded", "continue", "work_recorded"],
    ["attention", "waiting_user", "not_started"], ["active", "in_progress", "in_progress"],
    ["trashed", "in_progress", "in_progress"],
  ]);
  const removed = facts.goals.find((goal) => goal.goal_id === "trashed")!;
  removed.trashed_at = "2026-09-02T00:00:00Z";
  const view = buildMcpResumeView(facts, null, null);
  assert.equal(view.focus?.goal_id, "active");
  assert.equal(view.focus?.source, "project_recovery_order");
  assert.deepEqual(view.next_goals.map((goal) => goal.goal_id), ["attention", "recorded", "ready-a", "ready-b", "waiting"]);
  assert.equal(view.auto_claimed, false);
  assert.deepEqual(buildMcpResumeView({ goals: [], projections: [] }, null, null), {
    focus: null, next_goals: [], auto_claimed: false,
  });
});
