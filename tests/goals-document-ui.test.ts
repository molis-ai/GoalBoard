import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchGoalsDocumentRenderer, createWorkbenchUiHost } from "@adeptify/goalboard-app-workbench";
import { GOALS_DOCUMENT_UI_CONTRIBUTION_ID, type GoalsDocumentItem, type GoalsDocumentContext } from "@adeptify/goalboard-plugin-goals";
import { icon } from "@adeptify/goalboard-design-system";
import { L, runWithLocale } from "@adeptify/goalboard-app-local-host";

const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const renderer = createWorkbenchGoalsDocumentRenderer({ translate: L, escapeHtml, icon,
  formatDate: value => value ?? "", renderStatus: status => status, renderVisibleGoalStatus: item => item.display_status,
  sectionHeading: (_icon, title, description = "") => "<header>" + escapeHtml(L(title)) + escapeHtml(L(description)) + "</header>" });
const context: GoalsDocumentContext = { activeGoalId: null, decisionCount: 0,
  draftGapsHtml: "<aside>Draft owner</aside>", companionRuntimeHtml: "<aside>Execution owner</aside>" };
const item = (): GoalsDocumentItem => ({
  goal: { goal_id: "goal-a", title: '保留用户标题 "<title>', priority: 7, created_at: "2026-09-05", updated_at: "2026-09-05",
    fulfillment_state: "unmet", definition_state: "accepted", outcome: 'Result "<safe>', why: "Why", business_logic: "Behavior",
    in_scope: ["Scope"], accepted_by: "user-confirmed-via:codex", archived_at: null, trashed_at: null, trashed_by: null,
    acceptance_criteria: Array.from({ length: 6 }, (_, index) => ({ criterion_id: "c" + index, statement: "Requirement " + index,
      pass_condition: "Result " + index, decision_method: "inspection", target: null, required_evidence: [] })) },
  status: "execution_pending", display_status: "continue", passed_criteria: ["c1", "c1", "unknown"], relations: [],
  active_claim_actor: null, action_projection: { primary_action: null }, main_action_label: 'Continue "<safe>', action_summary: "Next action",
  evidence: [], events: [],
});
const action = (kind: "clarify" | "execute" | "wait", actor: "runtime" | "user" = "runtime", status: "ready" | "blocked" = "ready") =>
  ({ action_id: "action-a", actor, kind, status, target_type: "goal", target_id: "goal-a", reasons: [] });
const render = (value: GoalsDocumentItem, overrides: Partial<GoalsDocumentContext> = {}) => renderer.renderGoalDocument(value, { ...context, ...overrides }, true);

test("initial Goal tabs escape user titles and collection placeholders preserve full versus refresh behavior", () => {
  const html = renderer.renderInitialGoalTab({ goal_id: 'id"<a>', title: 'Title " autofocus onfocus="alert(1)' });
  assert.match(html, /data-work-tab="id&quot;&lt;a&gt;"/);
  assert.match(html, /aria-label="关闭 Title &quot; autofocus onfocus=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /aria-label="关闭 Title "| onfocus="/);
  assert.match(html, /aria-controls="goal-document-pane"/);
  const compact = renderer.renderEmptyGoalCollection(true, false);
  assert.match(compact, /回收站是空的/);
  assert.doesNotMatch(compact, /<p>|<a /);
  const trash = renderer.renderEmptyGoalCollection(true, true);
  assert.match(trash, /移入回收站的 Goal 可以在这里恢复/);
  assert.match(trash, /href="\/"/);
  const archive = runWithLocale("en", () => renderer.renderEmptyGoalCollection(false, true));
  assert.match(archive, /No archived Goal yet/);
  assert.match(archive, /Historical facts are not deleted/);
  assert.doesNotMatch(archive, /Trash is empty/);
});

test("document contribution keeps Goal facts, progress, owner inserts, selected state and lazy panels", () => {
  assert.ok(createWorkbenchUiHost().list().some(entry => entry.contribution_id === GOALS_DOCUMENT_UI_CONTRIBUTION_ID));
  const value = item(), html = render(value);
  assert.match(html, /保留用户标题 &quot;&lt;title&gt;/);
  assert.match(html, /Result &quot;&lt;safe&gt;/);
  assert.match(html, /用户确认 · Codex/);
  assert.match(html, /<strong>1\/6<\/strong>/);
  assert.match(html, /查看全部 6 条要求/);
  assert.doesNotMatch(html, /<strong>Requirement 5<\/strong>/);
  assert.ok(html.indexOf("Draft owner") < html.indexOf('class="goal-focus-layout"'));
  assert.ok(html.indexOf("Execution owner") > html.indexOf('class="goal-focus-context"'));
  for (const panel of ["completion", "progress", "factors"]) {
    assert.ok(html.includes('data-goal-panel="' + panel + '" data-loaded="false" hidden'));
  }
  assert.match(html, /data-open-quick-record/);
  assert.match(html, /data-set-active-goal/);
  assert.doesNotMatch(render(value, { activeGoalId: "goal-a" }), /data-set-active-goal/);
  assert.match(renderer.renderGoalDocument(value, context, false), /data-goal-view="goal-a" hidden/);
  const completed = { ...value, display_status: "completed" as const };
  assert.match(render(completed), /<strong>6\/6<\/strong>/);
  assert.equal(completed.evidence.length, 0);
});

test("document next action follows the supplied projection without claiming or inventing permission", () => {
  const value = item();
  assert.doesNotMatch(render(value), /class="goal-primary-action"/);
  assert.match(render({ ...value, display_status: "completed" }), /data-goal-archive="true"/);
  const cases = [
    [action("clarify"), /data-open-goal-edit/],
    [action("execute"), /data-open-goal-tui/],
    [action("wait"), /href="#progress-goal-a"/],
    [action("execute", "runtime", "blocked"), /href="#progress-goal-a"/],
    [action("execute", "user"), /href="#acceptance-goal-a"/],
  ] as const;
  for (const [primary_action, expected] of cases) assert.match(render({ ...value, action_projection: { primary_action } }), expected);
  const user = { ...value, action_projection: { primary_action: action("execute", "user") } };
  assert.match(render(user, { decisionCount: 1 }), /href="\/decisions#decision-goal-goal-a"/);
  const blocked = { ...action("execute", "runtime", "blocked"), reasons: [{
    code: "blocked", severity: "blocker" as const, subject_type: "goal", subject_id: "goal-a",
    message: 'Blocked "<reason>', remediation: 'Fix "<remedy>', facts: {},
  }] };
  const html = render({ ...value, action_projection: { primary_action: blocked } });
  assert.match(html, /Blocked &quot;&lt;reason&gt;/);
  assert.match(html, /Fix &quot;&lt;remedy&gt;/);
  assert.doesNotMatch(html, /<form/);
});

test("archived and trashed documents keep restore/history behavior and localized empty copy", () => {
  const value = item();
  const archived = render({ ...value, goal: { ...value.goal, archived_at: "2026-09-05" }, display_status: "completed" });
  assert.match(archived, /data-goal-archive="false"/);
  assert.doesNotMatch(archived, /data-open-quick-record|data-set-active-goal|data-goal-archive="true"|class="goal-mode-switch"/);
  const trashed = renderer.renderTrashGoalDocument({ ...value, goal: { ...value.goal, trashed_at: "2026-09-05" },
    events: [{ type: "goal.trashed", actor_id: 'Actor "<x>', reason: 'Reason "<y>' }] }, true);
  assert.match(trashed, /data-open-goal-restore/);
  assert.match(trashed, /Actor &quot;&lt;x&gt;/);
  assert.match(trashed, /Reason &quot;&lt;y&gt;/);
  assert.doesNotMatch(trashed, /data-open-quick-record|data-open-goal-tui|data-set-active-goal/);
  const empty = { ...value, goal: { ...value.goal, acceptance_criteria: [] } };
  const english = runWithLocale("en", () => render(empty));
  assert.match(english, /保留用户标题 &quot;&lt;title&gt;/);
  assert.doesNotMatch(english, /补全完成标准后，执行和复核才有共同依据。/);
  assert.match(english, /0\/0/);
});
