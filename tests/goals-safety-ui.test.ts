import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchGoalsSafetyRenderer, createWorkbenchUiHost } from "@adeptify/goalboard-app-workbench";
import { GOALS_SAFETY_UI_CONTRIBUTION_ID, type GoalsSafetyItem, type GoalsSafetyRisk } from "@adeptify/goalboard-plugin-goals";
import { icon } from "@adeptify/goalboard-design-system";
import { L, currentLocale, runWithLocale } from "@adeptify/goalboard-app-local-host";

const escapeHtml = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const renderer = createWorkbenchGoalsSafetyRenderer({ translate: L, currentLocale, icon, escapeHtml,
  formatDate: value => value ?? "", renderReference: value => `<code>${escapeHtml(value)}</code>`,
  renderList: (values, empty) => values.length ? values.map(value => `<li>${escapeHtml(value)}</li>`).join("") : empty });
function fixture() {
  const risk: GoalsSafetyRisk = { risk_id: "risk-one", board_id: "board", goal_ids: ["goal-one", "archived"],
    description: '<script>alert("risk")</script>', probability: "medium", impact: "Missing release",
    affected_surfaces: ["installer"], trigger: "Installation fails", treatment: "mitigate", treatment_plan: "Rehearse installation",
    blocking_mode: "completion", revisit_condition: "After rehearsal", owner: "release-owner", state: "open",
    resolution_basis: null, created_at: "2026-09-05", updated_at: "2026-09-05" };
  const item: GoalsSafetyItem = { goal: { goal_id: "goal-one", title: "Release", archived_at: null, priority: 10, created_at: "2026-09-05" },
    status: "execution_pending", display_status: "continue", action_projection: { actions: [] }, risks: [risk], impacts: [] };
  const archived: GoalsSafetyItem = { ...item, goal: { ...item.goal, goal_id: "archived", title: 'Old <release>', archived_at: "2026-09-05" },
    display_status: "completed", risks: [], impacts: [] };
  return { risk, item, archived, view: { goals: [item], archived_goals: [archived] } };
}

test("progress risk summary lists only open or triggered risks with encoded links and escaped descriptions", () => {
  const risks = [
    { risk_id: 'open/id', description: 'Open "<risk>', state: "open" as const, blocking_mode: "claim" as const },
    { risk_id: 'triggered#id', description: "Triggered risk", state: "triggered" as const, blocking_mode: "completion" as const },
    ...(["resolved", "accepted", "expired"] as const).map(state => ({ risk_id: state, description: "Hidden " + state, state, blocking_mode: "completion" as const })),
  ];
  const before = structuredClone(risks), html = renderer.renderProgressRiskSummary(risks);
  assert.match(html, /<strong>2<\/strong>/);
  assert.match(html, /href="#risk-open%2Fid"/);
  assert.match(html, /href="#risk-triggered%23id"/);
  assert.match(html, /Open &quot;&lt;risk&gt;/);
  assert.doesNotMatch(html, /Hidden resolved|Hidden accepted|Hidden expired|<form/);
  assert.deepEqual(risks, before);
  const empty = runWithLocale("en", () => renderer.renderProgressRiskSummary(risks.slice(2)));
  assert.match(empty, /There are no open risks that need action now/);
  assert.doesNotMatch(empty, /<ul>/);
});

test("Goals safety contribution preserves editable facts, linked archived Goals and escaped content", () => {
  assert.ok(createWorkbenchUiHost().list().some(entry => entry.contribution_id === GOALS_SAFETY_UI_CONTRIBUTION_ID));
  const { item, view } = fixture();
  const html = renderer.renderRiskWorkbench(item, view);
  assert.match(html, /data-risk-edit-form/);
  assert.match(html, /data-risk-create-form/);
  assert.match(html, /name="description" rows="2" required/);
  assert.match(html, /name="treatment" required/);
  assert.match(html, /value="mitigate" selected/);
  assert.match(html, /value="completion" selected/);
  assert.match(html, /name="goal_ids" value="archived" checked/);
  assert.match(html, /href="\/archive\/goals\/archived"/);
  assert.match(html, /Old &lt;release&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&quot;risk&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|risk-decision-link/);
  assert.match(html, /当前会阻止所有关联 Goal 被标记为完成/);
  assert.match(renderer.renderQuickRiskForm(item, view), /data-live-form="risk-quick-goal-one"/);
  assert.match(renderer.renderQuickRiskForm(item, view), /name="reason" rows="2" required/);
  assert.match(renderer.renderQuickImpactForm(item), /data-live-form="impact-quick-goal-one"/);
  assert.match(renderer.renderQuickImpactForm(item), /name="goal_id" value="goal-one"/);
});

test("risk decision links consume explicit user actions, while archive and record views stay read-only", () => {
  const { item, risk, view } = fixture();
  const action = { action_id: "decision", actor: "runtime" as const, kind: "accept_risk" as const,
    status: "ready" as const, target_type: "risk", target_id: risk.risk_id, reasons: [] };
  item.action_projection.actions = [action];
  assert.doesNotMatch(renderer.renderRiskWorkbench(item, view), /risk-decision-link/);
  item.action_projection.actions = [{ ...action, actor: "user" }];
  assert.match(renderer.renderRiskWorkbench(item, view), /href="\/decisions#decision-goal-goal-one"/);
  const records = renderer.renderRiskWorkbench(item, view, false);
  assert.match(records, /id="record-risk-risk-one"/);
  assert.doesNotMatch(records, /<form|risk-decision-link/);
  item.goal.archived_at = "2026-09-05";
  assert.doesNotMatch(renderer.renderSafety(item, view), /<form|<input|<textarea/);
  assert.equal(renderer.renderQuickRiskForm(item, view), "");
  assert.equal(renderer.renderQuickImpactForm(item), "");
  item.goal.archived_at = null;
  item.goal.trashed_at = "2026-09-05";
  assert.equal(renderer.renderQuickRiskForm(item, view), "");
  assert.equal(renderer.renderQuickImpactForm(item), "");
});

test("resolved risk evidence and missing historical basis are displayed without rewriting state", () => {
  const { item, risk, view } = fixture();
  risk.state = "resolved";
  assert.match(renderer.renderRiskWorkbench(item, view), /未记录解决依据（历史数据）/);
  assert.equal(risk.resolution_basis, null);
  risk.resolution_basis = { summary: "Rehearsal passed", evidence_refs: ["project://checks.md"], residual_gaps: ["Intel pending"] };
  const html = renderer.renderRiskWorkbench(item, view);
  assert.match(html, /Rehearsal passed/);
  assert.match(html, /<code>project:\/\/checks.md<\/code>/);
  assert.match(html, /<li>Intel pending<\/li>/);
  assert.doesNotMatch(html, /risk-resolution--unrecorded/);
  assert.match(html, /当前状态不再施加领取或完成门禁/);
});

test("impact edit and deactivation history preserve state-specific controls and request locale", () => {
  const { item, view } = fixture();
  const impact = { binding_id: "impact-one", board_id: "board", goal_id: item.goal.goal_id, surface: 'release <files>',
    access: "read" as const, input_snapshot: "commit://release", state: "confirmed" as const, reason: "Review release",
    created_by: "user", created_at: "2026-09-05", updated_at: "2026-09-05", deactivated_at: null, deactivation_reason: null };
  item.impacts = [impact, { ...impact, binding_id: "old-impact", state: "inactive", deactivated_at: "2026-09-05", deactivation_reason: "Replaced scope" }];
  const html = renderer.renderImpactWorkbench(item);
  assert.match(html, /data-impact-edit-form/);
  assert.match(html, /data-impact-deactivate-form/);
  assert.match(html, /data-impact-create-form/);
  assert.match(html, /release &lt;files&gt;/);
  assert.match(html, /Replaced scope/);
  const history = html.slice(html.indexOf('id="impact-old-impact"'));
  assert.doesNotMatch(history, /<form/);
  assert.match(html, /name="input_snapshot" value="commit:\/\/release"/);
  const english = runWithLocale("en", () => renderer.renderSafety(item, view));
  assert.match(english, /Replaced scope/);
  assert.doesNotMatch(english, /当前会阻止所有关联 Goal 被标记为完成/);
  assert.match(runWithLocale("zh", () => renderer.renderSafety(item, view)), /当前会阻止所有关联 Goal 被标记为完成/);
  item.risks = [];
  assert.match(renderer.renderRiskWorkbench(item, view, false), /当前没有已记录的风险/);
});
