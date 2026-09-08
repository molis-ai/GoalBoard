import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchGoalsContextRenderer, createWorkbenchUiHost } from "@adeptify/goalboard-app-workbench";
import { GOALS_CONTEXT_UI_CONTRIBUTION_ID, type GoalsContextItem, type GoalsContextView } from "@adeptify/goalboard-plugin-goals";
import type { GoalRelationRecord } from "@adeptify/goalboard-contracts/modules/goals";
import { L, currentLocale, listJoin, runWithLocale } from "@adeptify/goalboard-app-local-host";
import { createGoalStateExplainer } from "@adeptify/goalboard-plugin-goals";
import { icon } from "@adeptify/goalboard-design-system";
const { explainWorkState, explainParentCompletion } = createGoalStateExplainer(L);

const escapeHtml = (v: unknown) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const renderer = createWorkbenchGoalsContextRenderer({ translate: L, escapeHtml, icon, currentLocale, listJoin, explainWorkState, explainParentCompletion,
  formatDate: value => value ?? "",
  renderList: (values, empty) => values.length ? "<ul>" + values.map(v => "<li>" + escapeHtml(v) + "</li>").join("") + "</ul>" : escapeHtml(L(empty)),
  renderReference: (ref, label) => "<a href='" + escapeHtml(ref) + "'>" + escapeHtml(label) + "</a>",
  subsectionHeading: (_icon, title, description = "") => "<header>" + escapeHtml(L(title)) + escapeHtml(L(description)) + "</header>",
  renderFocusSectionDeck: cards => cards.map(card => '<section data-section="' + card.key + '">' + card.body + "</section>").join("") });
const item = (id: string): GoalsContextItem => ({
  goal: { goal_id: id, title: '用户 "<title>', priority: 1, created_at: "2026-09-05", fulfillment_state: "unmet",
    definition_state: "draft", decomposition_state: "abstract", decomposition_review: null,
    outcome: "", why: "", business_logic: "", in_scope: [], out_of_scope: [], constraints: [], required_inputs: [], promised_outputs: [],
    acceptance_criteria: [] },
  status: "clarification_pending", display_status: "continue", passed_criteria: [], relations: [], input_bindings: [], coverage: [],
});
const relation = (id: string, type: GoalRelationRecord["type"], from: string, to: string): GoalRelationRecord => ({
  relation_id: id, board_id: "board", type, from_goal_id: from, to_goal_id: to, state: "active", reason: 'Reason "<x>',
  created_by: "user", created_at: "2026-09-05", deactivated_at: null });
const view = (goals: GoalsContextItem[], relations: GoalRelationRecord[] = []): GoalsContextView =>
  ({ goals, archived_goals: [], trashed_goals: [], snapshot: { relations } });

test("read-only Goal records preserve metadata, owner precedence and owner-supplied relations without editing facts", () => {
  const value = { ...item('id"<safe>'), goal: { ...item("goal-a").goal, goal_id: 'id"<safe>',
    updated_at: "2026-09-06", accepted_by: 'Accepted "<owner>' },
    active_claim_actor: 'Active "<owner>', work_state: "execution_pending" as const };
  const before = structuredClone(value);
  const html = renderer.renderGoalRecordBasics(value);
  assert.match(html, /id&quot;&lt;safe&gt;/);
  assert.match(html, /2026-09-05/);
  assert.match(html, /2026-09-06/);
  assert.match(html, /Active &quot;&lt;owner&gt;/);
  assert.doesNotMatch(html, /Accepted &quot;/);
  assert.match(html, /technical-meta/);
  assert.match(html, /完整范围、资料和需求覆盖/);
  assert.doesNotMatch(html, /<form|data-draft-form|data-set-active-goal/);
  const fallback = renderer.renderGoalRecordBasics({ ...value, active_claim_actor: null });
  assert.match(fallback, /Accepted &quot;&lt;owner&gt;/);
  const missing = renderer.renderGoalRecordBasics({ ...value, active_claim_actor: null, goal: { ...value.goal, accepted_by: null } });
  assert.match(missing, /记录中的负责人<\/dt><dd>未指定/);
  assert.deepEqual(value, before);
  const relationships = renderer.renderGoalRecordRelations({ relationsHtml: '<aside id="relation-owner">relation</aside>',
    safetyHtml: '<aside id="safety-owner">safety</aside>', policyHtml: '<aside id="policy-owner">policy</aside>' });
  assert.match(relationships, /Goal 关系<\/h3><aside id="relation-owner">relation<\/aside>/);
  assert.match(relationships, /风险与影响范围<\/h3><aside id="safety-owner">safety<\/aside>/);
  assert.match(relationships, /工作规则<\/h3><aside id="policy-owner">policy<\/aside>/);
  assert.doesNotMatch(relationships, /<form/);
});

test("context contribution renders draft fields and gaps but never permits editing accepted facts", () => {
  assert.ok(createWorkbenchUiHost().list().some(x => x.contribution_id === GOALS_CONTEXT_UI_CONTRIBUTION_ID));
  const draft = item("draft"), html = renderer.renderDraftEditor(draft);
  assert.match(html, /用户 &quot;&lt;title&gt;/);
  for (const name of ["title", "outcome", "why", "business_logic", "priority", "in_scope", "out_of_scope", "constraints", "required_inputs", "promised_outputs", "reason"]) assert.ok(html.includes('name="' + name + '"'));
  assert.equal((html.match(/type="radio" name="decomposition_state"/g) ?? []).length, 4);
  assert.match(html, /name="reason" rows="2" required/);
  assert.match(html, /data-criterion-field="target"/);
  assert.match(html, /data-criterion-template/);
  assert.match(renderer.renderDraftGaps(draft), /还需要补全/);
  assert.equal(renderer.renderDraftEditor({ ...draft, goal: { ...draft.goal, definition_state: "accepted" } }), "");
  assert.match(renderer.renderDraftGaps({ ...draft, status: "clarification_decision_pending" }), /查看方案并决定/);
  const panel = renderer.renderGoalCompletionPanel(draft, view([draft]), "<article>Artifact owner</article>");
  assert.ok(panel.indexOf('data-section="artifacts"') > panel.indexOf('data-section="completion"'));
  assert.match(panel, /<article>Artifact owner<\/article>/);
});

test("criterion values retain scalar/object targets, required evidence and honest empty states", () => {
  const value = item("criteria");
  value.goal.acceptance_criteria = [
    { goal_id: "criteria", criterion_id: "c1", statement: 'Measured "<x>', decision_method: "measurement", pass_condition: "At least 90", target: { value: 90 }, required_evidence: ["report", "check"] },
    { goal_id: "criteria", criterion_id: "c2", statement: "Object target", decision_method: "inspection", pass_condition: "Verified", target: { min: 1, max: 3 }, required_evidence: [] },
  ];
  value.passed_criteria = ["c1"];
  const html = renderer.renderDraftEditor(value);
  assert.match(html, /data-criterion-field="target" value="90"/);
  assert.match(html, /data-criterion-field="target" value="{&quot;min&quot;:1,&quot;max&quot;:3}"/);
  assert.match(html, /Measured &quot;&lt;x&gt;/);
  const acceptance = renderer.renderAcceptance(value);
  assert.equal((acceptance.match(/check-box is-checked/g) ?? []).length, 1);
  assert.match(acceptance, /report、check/);
  const english = runWithLocale("en", () => renderer.renderAcceptance(value));
  assert.match(english, /report, check/);
  assert.match(renderer.renderAcceptanceSummary(item("empty")), /还没有写清怎样才算完成/);
});

test("context distinguishes local satisfaction, incomplete parent coverage, child direction and missing dependencies", () => {
  const parent = item("parent"), child = item("child");
  parent.goal.definition_state = "accepted"; parent.goal.decomposition_state = "closed_compound";
  child.goal.fulfillment_state = "satisfied"; child.display_status = "completed";
  parent.goal.decomposition_review = { status: "complete", coverage: [], open_goal_ids: [], next_step: "",
    contract_coverage: { promised_outputs: [{ parent_promised_output: "Full product", status: "partial", child_outputs: [{ goal_id: "child", promised_output: "One slice" }], reason: "Integration remains" }], acceptance_criteria: [] } };
  const relations = [relation("part", "part_of", "child", "parent"), relation("dep", "depends_on", "parent", "missing")];
  parent.relations = relations; child.relations = relations;
  const model = view([parent, child], relations);
  const html = renderer.renderGoalCompletionPanel(parent, model);
  assert.match(html, /父级 Contract 仍有覆盖缺口/);
  assert.match(html, /部分覆盖/);
  assert.match(html, /href="\/goals\/child"/);
  assert.match(html, /href="\/goals\/missing"/);
  assert.match(html, /Reason &quot;&lt;x&gt;/);
  const childHtml = renderer.renderGoalCompletionPanel(child, model);
  assert.match(childHtml, /不自动等于父 Goal 的完整能力已经实现/);
  assert.match(childHtml, /Full product · 尚有缺口/);
  parent.goal.decomposition_review = null;
  assert.match(renderer.renderGoalCompletionPanel(parent, model), /未记录父子 Contract 覆盖（历史数据）/);
});

test("record scope preserves bound references, coverage and missing-section disclosure without writes", () => {
  const value = item("scope");
  assert.match(renderer.renderScope(value), /范围、输入与输出尚未填写/);
  value.goal.in_scope = ['Scope "<x>'];
  value.input_bindings = [{ input_name: "Design", source_ref: "project://design.md", state: "confirmed", reason: 'Reason "<y>', snapshot_digest: null }];
  value.coverage = [{ requirement_id: "R1", statement: 'Requirement "<z>', disposition: "owned", blocking: true, reason: "Owned here", revisit_condition: "After integration" }];
  const html = renderer.renderScope(value);
  assert.match(html, /Scope &quot;&lt;x&gt;/);
  assert.match(html, /project:\/\/design.md/);
  assert.match(html, /Requirement &quot;&lt;z&gt;/);
  assert.match(html, /After integration/);
  assert.match(html, /data-persist-open="scope-gaps-scope"/);
  assert.doesNotMatch(html, /<form/);
});
