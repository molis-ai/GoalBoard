import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchGoalsStatusRenderer, createWorkbenchGoalsFactorsRenderer } from "@adeptify/goalboard-app-workbench";
import { createGoalStateExplainer, createGoalActionPresenter, goalPresentationState,
  type GoalPresentationSnapshot, type GoalAction, type GoalActionProjection,
  type GoalsFactorsPrimitives } from "@adeptify/goalboard-plugin-goals";
import { L, runWithLocale } from "@adeptify/goalboard-app-local-host";
import { icon } from "@adeptify/goalboard-design-system";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const draft = { goal_id: "draft", definition_state: "draft", decomposition_state: "abstract", fulfillment_state: "unmet" } as const;
const snapshot = (): GoalPresentationSnapshot => ({ goals: [], relations: [], contract_proposals: [], goal_tree_proposals: [], runs: [] });
const proposal = (overrides: Partial<GoalPresentationSnapshot["goal_tree_proposals"][number]> = {}): GoalPresentationSnapshot["goal_tree_proposals"][number] => ({
  origin: "native", state: "pending", root_goal_id: "draft", discovered_in_run_id: null, items: [{ state: "pending" }], ...overrides,
});

test("draft display recognizes only relevant unresolved decisions without changing facts", () => {
  const model = snapshot();
  model.contract_proposals = [{ goal_id: "draft", state: "pending" }];
  for (const state of ["clarification_pending", "clarifying", "clarification_blocked"] as const) {
    assert.equal(goalPresentationState(state, draft, model), "clarification_decision_pending");
  }
  assert.equal(goalPresentationState("executing", draft, model), "executing");
  assert.equal(goalPresentationState("clarifying", { ...draft, definition_state: "accepted" }, model), "clarifying");
  model.contract_proposals = [{ goal_id: "other", state: "pending" }, { goal_id: "draft", state: "rejected" }];
  assert.equal(goalPresentationState("clarifying", draft, model), "clarifying");
  model.goal_tree_proposals = [proposal({ state: "partially_applied", items: [{ state: "applied" }, { state: "conflict" }] })];
  assert.equal(goalPresentationState("clarifying", draft, model), "clarification_decision_pending");
  model.goal_tree_proposals = [proposal({ root_goal_id: "other", discovered_in_run_id: "run-draft" })];
  model.runs = [{ run_id: "run-draft", goal_id: "draft" }];
  const before = structuredClone(model);
  assert.equal(goalPresentationState("clarifying", draft, model), "clarification_decision_pending");
  assert.deepEqual(model, before);
  for (const invalid of [
    proposal({ origin: "legacy_rewire" }), proposal({ state: "rejected" }),
    proposal({ state: "approved" }), proposal({ items: [{ state: "applied" }] }),
    proposal({ root_goal_id: "other" }), proposal({ root_goal_id: "other", discovered_in_run_id: "unrelated-run" }),
  ]) {
    model.goal_tree_proposals = [invalid];
    assert.equal(goalPresentationState("clarifying", draft, model), "clarifying", JSON.stringify(invalid));
  }
});

test("open parent completion requires active children, correct direction and every child present and satisfied", () => {
  const parent = { ...draft, definition_state: "accepted" as const };
  const model = snapshot();
  model.goals = [{ goal_id: "child", fulfillment_state: "satisfied" }];
  const part = { type: "part_of", state: "active", from_goal_id: "child", to_goal_id: "draft" } as const;
  assert.equal(goalPresentationState("clarification_pending", parent, model), "clarification_pending");
  model.relations = [part];
  assert.equal(goalPresentationState("clarification_pending", parent, model), "compound_closure_pending");
  assert.equal(goalPresentationState("clarification_pending", { ...parent, decomposition_state: "frontier_open" }, model), "compound_closure_pending");
  assert.equal(goalPresentationState("clarification_pending", { ...parent, decomposition_state: "closed_compound" }, model), "clarification_pending");
  model.goals = [{ goal_id: "child", fulfillment_state: "unmet" }];
  assert.equal(goalPresentationState("clarification_pending", parent, model), "clarification_pending");
  model.goals = [];
  assert.equal(goalPresentationState("clarification_pending", parent, model), "clarification_pending");
  model.goals = [{ goal_id: "child", fulfillment_state: "satisfied" }];
  for (const relation of [{ ...part, state: "inactive" as const }, { ...part, type: "depends_on" as const }, { ...part, from_goal_id: "draft", to_goal_id: "child" }]) {
    model.relations = [relation];
    assert.equal(goalPresentationState("clarification_pending", parent, model), "clarification_pending");
  }
});

test("parent explanations do not turn partial Contract coverage into automatic completion", () => {
  const { explainParentCompletion } = createGoalStateExplainer(L);
  const parent: Parameters<typeof explainParentCompletion>[0] = { definition_state: "accepted", decomposition_state: "closed_compound", decomposition_review: null, fulfillment_state: "satisfied" };
  assert.equal(explainParentCompletion(parent, 2, 2).label, "父 Goal 已自动完成");
  parent.decomposition_review = { status: "complete", coverage: [], open_goal_ids: [], next_step: "",
    contract_coverage: { acceptance_criteria: [], promised_outputs: [{ parent_promised_output: "Whole product", status: "partial", child_outputs: [], reason: "Integration remains" }] } };
  assert.equal(explainParentCompletion(parent, 2, 2).label, "父级 Contract 仍有覆盖缺口");
  assert.equal(explainParentCompletion(parent, 2, 2).tone, "needs_confirmation");
  parent.decomposition_review = null;
  parent.fulfillment_state = "unmet";
  assert.match(explainParentCompletion(parent, 1, 3).meaning, /还剩 2 个/);
  assert.match(explainParentCompletion(parent, 4, 3).meaning, /还剩 0 个/);
  parent.decomposition_state = "frontier_open";
  assert.equal(explainParentCompletion(parent, 2, 2).label, "现有子 Goal 已完成，父目标待确认");
  assert.equal(explainParentCompletion(parent, 1, 2).label, "当前拆分尚未确认结束");
  parent.decomposition_state = "closed_leaf";
  assert.equal(explainParentCompletion(parent, 2, 2).tone, "conflict");
});

const action = (kind: GoalAction["kind"], overrides: Partial<GoalAction> = {}): GoalAction => ({ action_id: "a", actor: "runtime", kind, status: "ready", target_type: "goal", target_id: "draft", reasons: [], ...overrides });
const projection = (primary_action: GoalAction | null, display_status: GoalActionProjection["display_status"] = "continue"): GoalActionProjection => ({ goal_id: "draft", contract_revision: 1, progress: "not_started", primary_action, actions: primary_action ? [primary_action] : [], action_token: "t", display_status });

test("action copy preserves rework priority, user decisions and authoritative first-reason summaries", () => {
  const { presentGoalAction } = createGoalActionPresenter(L);
  const goal = { title: "Release" };
  const cases: [GoalAction | null, string][] = [
    [null, "查看结果"], [action("clarify"), "继续澄清"], [action("clarify", { target_type: "coverage" }), "重新核对目标覆盖"],
    [action("execute"), "开始推进"], [action("submit_evidence"), "补齐完成依据"],
    [action("revise"), "确认新要求"], [action("revise", { target_type: "coverage" }), "确认目标覆盖"],
    ...["goal_tree_proposal", "candidate", "rewire"].map(target_type => [action("revise", { target_type }), "处理待确认事项"] as [GoalAction, string]),
    [action("review"), "开始复核"], [action("review", { actor: "user" }), "完成验收"], [action("revalidate"), "重新验证"],
    [action("mitigate_risk"), "处理风险"], [action("accept_risk"), "接受或拒绝风险"], [action("release"), "修复工作交接"],
    [action("renew"), "续期当前工作"], [action("repair"), "修复状态"], [action("wait"), "查看等待条件"],
  ];
  for (const [primary, expected] of cases) assert.equal(presentGoalAction(goal, projection(primary)).action_label, expected);
  const reason = (code: string, message: string): GoalAction["reasons"][number] => ({ code, message, severity: "warning", subject_type: "goal", subject_id: "draft", facts: {}, remediation: "" });
  const changed = action("execute", { reasons: [reason("action.contract_rework_required", "Original server reason")] });
  assert.equal(presentGoalAction(goal, projection(changed)).action_label, "按新要求修改");
  changed.reasons.push(reason("action.rework_requested", "Second reason"));
  const result = presentGoalAction(goal, projection(changed));
  assert.equal(result.action_label, "继续修改");
  assert.equal(result.summary, "Original server reason");
  assert.equal(presentGoalAction(goal, projection(null, "completed")).summary, "Release 已满足当前要求");
  const english = runWithLocale("en", () => presentGoalAction(goal, projection(action("clarify", { target_type: "coverage" }))));
  assert.equal(english.action_label, "Recheck Goal coverage");
});

test("public status mounts prefer collection state, retain hooks and escape translated attributes", () => {
  const renderer = createWorkbenchGoalsStatusRenderer({ translate: L, escapeHtml, icon });
  for (const [status, expectedIcon] of [["archived", "archive"], ["trashed", "archive"], ["replaced", "refresh"]] as const) {
    const item = { status, display_status: "continue" as const };
    assert.match(renderer.renderVisibleGoalStatus(item), new RegExp("goal-status--" + status));
    assert.equal(renderer.visibleGoalStatusIcon(item), icon(expectedIcon));
  }
  const visible = renderer.renderVisibleGoalStatus({ status: "executing", display_status: "waiting_user" }, 'data-state="current"', 'data-label="current"');
  assert.match(visible, /goal-status--waiting_user/);
  assert.match(visible, /data-state="current"/);
  assert.match(visible, /data-label="current"/);
  assert.match(visible, /等你/);
  assert.equal(renderer.visibleGoalStatusIcon({ status: "executing", display_status: "waiting_user" }), icon("user"));
  const untrusted = createWorkbenchGoalsStatusRenderer({ translate: () => 'Text "<unsafe>', escapeHtml, icon });
  const html = untrusted.renderStatus("clarification_pending");
  assert.match(html, /title="Text &quot;&lt;unsafe&gt;"/);
  assert.doesNotMatch(html, /<unsafe>/);
  assert.match(runWithLocale("en", () => renderer.renderStatus("compound_closure_pending")), /current child Goals are complete/);
});

test("factors contribution keeps owner content, live counts and accessible tab relationships", () => {
  let captured: Parameters<GoalsFactorsPrimitives["renderFocusSectionDeck"]>[0] = [];
  const renderer = createWorkbenchGoalsFactorsRenderer({ translate: L, escapeHtml, icon,
    renderFocusSectionDeck: cards => { captured = cards; return cards.map(card => card.body).join(""); } });
  const html = renderer({ goal: { goal_id: 'goal"<x>' },
    risks: ["open", "triggered", "resolved", "accepted", "expired"].map(state => ({ state })),
    impacts: [{ state: "active" }, { state: "inactive" }], relations: [{ state: "active" }, { state: "inactive" }],
  }, { relationsHtml: "<article>Relations + Decision history</article>", risksHtml: "<article>Risk owner</article>", impactsHtml: "<article>Impact owner</article>", policyHtml: "<article>Policy owner</article>" });
  assert.deepEqual(captured.map(card => [card.key, card.count]), [["relations", 1], ["risks", 2], ["impacts", 1], ["rules", undefined]]);
  for (const card of captured) {
    assert.ok(card.triggerAttributes?.includes('aria-controls="goal-factor-panel-' + card.key + '-goal&quot;&lt;x&gt;"'));
    assert.ok(card.bodyAttributes?.includes('aria-labelledby="goal-factor-tab-' + card.key + '-goal&quot;&lt;x&gt;"'));
    assert.ok(card.triggerAttributes?.includes('aria-selected="' + (card.key === "relations" ? "true" : "false") + '"'));
  }
  assert.match(captured[0]!.body, /Relations \+ Decision history/);
  assert.match(captured[1]!.body, /Risk owner/);
  assert.match(captured[2]!.body, /Impact owner/);
  assert.match(captured[3]!.body, /Policy owner/);
  assert.match(html, /关联与约束/);
});
