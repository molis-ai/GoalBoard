import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchGoalsMomentumRenderer, createWorkbenchUiHost } from "@adeptify/goalboard-app-workbench";
import { GOALS_MOMENTUM_UI_CONTRIBUTION_ID, type GoalsMomentumItem, type GoalsMomentumBoardView } from "@adeptify/goalboard-plugin-goals";
import type { GoalRelationRecord } from "@adeptify/goalboard-contracts/modules/goals";
import { icon } from "../src/web/icons.js";
import { L, currentLocale, runWithLocale } from "../src/web/i18n.js";

const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const renderer = createWorkbenchGoalsMomentumRenderer({ translate: L, escapeHtml, icon, currentLocale,
  renderVisibleGoalStatus: item => `<span>${item.display_status}</span>` });
const item = (id: string, title = id): GoalsMomentumItem => ({ goal: { goal_id: id, title, priority: 1, created_at: "2026-08-01", updated_at: "2026-09-05", fulfillment_state: "unmet", acceptance_criteria: [] },
  status: "execution_pending", work_state: "execution_pending", display_status: "continue", passed_criteria: [], relations: [], reasons: [], runs: [], evidence: [], reviews: [], risks: [], events: [] });
const relation = (id: string, type: GoalRelationRecord["type"], from: string, to: string): GoalRelationRecord => ({
  relation_id: id, board_id: "board", type, from_goal_id: from, to_goal_id: to, state: "active", reason: 'Provider "result" <safe>',
  created_by: "user", created_at: "2026-09-05", deactivated_at: null });
const view = (goals: GoalsMomentumItem[], relations: GoalRelationRecord[] = []): GoalsMomentumBoardView => ({ goals, archived_goals: [], trashed_goals: [], snapshot: { relations } });

test("momentum contribution owns lazy placeholder and renders provider-to-consumer topology with escaped Goal content", () => {
  assert.ok(createWorkbenchUiHost().list().some(entry => entry.contribution_id === GOALS_MOMENTUM_UI_CONTRIBUTION_ID));
  const placeholder = renderer.renderMomentumPlaceholder();
  assert.match(placeholder, /data-goal-momentum data-loaded="false" hidden/);
  assert.match(placeholder, /data-retry-goal-momentum hidden/);
  assert.doesNotMatch(placeholder, /data-momentum-node/);
  const consumer = item("APP", 'User "<title>'), provider = item("API");
  const dependency = relation("app-api", "depends_on", "APP", "API");
  consumer.relations = [dependency];
  const model = view([consumer, provider], [dependency]);
  const html = renderer.renderGoalMomentum(model, "APP", model.goals);
  assert.match(html, /data-edge-from="API" data-edge-to="APP" data-edge-type="depends_on"/);
  assert.match(html, /API → User &quot;&lt;title&gt; · Provider &quot;result&quot; &lt;safe&gt;/);
  assert.match(html, /data-momentum-detail="APP">/);
  assert.match(html, /data-momentum-detail="API" hidden/);
  assert.match(html, /data-momentum-period-panel="7">/);
  assert.match(html, /data-momentum-period-panel="30" hidden/);
  assert.match(html, /href="\/goals\/APP"/);
  assert.match(html, /历史不足，不能判断是否停滞/);
});

test("momentum retains completed nodes, blocker facts and dependency diagnostics without turning suggestions into execution", () => {
  const done = item("DONE"), blocked = item("BLOCKED"), missing = relation("missing", "depends_on", "BLOCKED", "MISSING");
  done.goal.fulfillment_state = "satisfied";
  done.display_status = "completed";
  blocked.status = "execution_blocked";
  blocked.display_status = "blocked";
  blocked.reasons = [{ code: "risk.blocked", severity: "blocker", message: 'Risk "<review>' }];
  blocked.relations = [missing];
  const model = view([done, blocked], [missing]);
  const html = renderer.renderGoalMomentum(model, "BLOCKED", model.goals);
  assert.match(html, /data-goal-id="DONE"[^>]*data-goal-completed="true"/);
  assert.match(html, /发现 1 处关系完整性问题/);
  assert.match(html, /Risk &quot;&lt;review&gt;/);
  assert.doesNotMatch(html, /data-momentum-select="DONE" data-momentum-action-kind/);
  assert.match(html, /data-momentum-select="BLOCKED" data-momentum-action-kind="waiting"/);
  assert.doesNotMatch(html, /<form|data-run-start|data-claim/);
});

test("momentum preserves no-data presentation and request-local translation without translating user titles", () => {
  const empty = view([]);
  assert.match(renderer.renderGoalMomentum(empty, "", []), /还没有可分析的 Goal/);
  const user = item("USER", "当前选择");
  const model = view([user]);
  const html = runWithLocale("en", () => renderer.renderGoalMomentum(model, "USER", model.goals));
  assert.match(html, /<h3>当前选择<\/h3>/);
  assert.doesNotMatch(html, /<h1>先看推进是否流动/);
  assert.match(renderer.renderGoalMomentum(model, "USER", model.goals), /<h1>先看推进是否流动/);
});
