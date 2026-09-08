import type { RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsDocumentView as WebGoalView } from "./document-view.js";
import type { GoalsDecisionView } from "./decision-view.js";
import type { GoalsSafetyUiPrimitives } from "./safety-ui-model.js";
import { createGoalsDecisionPresentation } from "./decision-common-ui.js";
import { explainGoalDecision } from "./decision-copy.js";
import { allGoalViews } from "./proposal-ui-model.js";
import { goalRiskStateEffect, RISK_STATE_LABELS, RISK_TREATMENT_LABELS } from "./risk-presentation.js";
type RiskDecisionView = Pick<GoalsDecisionView<WebGoalView>, "goals" | "archived_goals" | "events">;

export function createRiskDecisionRenderer({ translate: L, escapeHtml, icon }: GoalsSafetyUiPrimitives) {
  const { renderDecisionGoalLink, renderNewDecisionBadge, renderDecisionGuidance } = createGoalsDecisionPresentation({ translate: L, escapeHtml });
  const explainDecision = (kind: Parameters<typeof explainGoalDecision>[0]) => explainGoalDecision(kind, L);
  const riskStateEffect = (blocking: RiskRecord["blocking_mode"], state: RiskRecord["state"]) => goalRiskStateEffect(L, blocking, state);
function riskDecisionCreatedAt(risk: RiskRecord, view: RiskDecisionView): string {
  return view.events.find(
    (event) => event.object_id === risk.risk_id && (event.type === "risk.open" || event.type === "risk.triggered"),
  )?.at ?? risk.created_at;
}

function renderRiskDecision(risk: RiskRecord, item: WebGoalView | null, view: RiskDecisionView): string {
  const copy = explainDecision("risk");
  const href = item ? `${item.goal.archived_at ? "/archive/goals/" : "/goals/"}${encodeURIComponent(item.goal.goal_id)}#risk-${encodeURIComponent(risk.risk_id)}` : "#";
  const affectedGoals = allGoalViews(view).filter((goalView) => goalView.risks.some((itemRisk) => itemRisk.risk_id === risk.risk_id));
  const riskOwner = affectedGoals.find((goalView) => goalView.action_projection.actions.some((action) =>
    action.actor === "user" && action.target_type === "risk" && action.target_id === risk.risk_id
  )) ?? item;
  const riskAction = riskOwner?.action_projection.actions.find((action) =>
    action.actor === "user" && action.target_type === "risk" && action.target_id === risk.risk_id
  );
  const stateOptions = `<option value="" selected disabled>${L("请选择处理结果")}</option><option value="accepted">${L("接受这项风险")}</option><option value="rejected">${L("不接受，改为继续处理")}</option>`;
  return `<form class="decision-record risk-decision" data-risk-state-form data-live-form="risk-decision-${escapeHtml(risk.risk_id)}" data-risk-id="${escapeHtml(risk.risk_id)}" data-risk-blocking="${escapeHtml(risk.blocking_mode)}" data-goal-id="${escapeHtml(riskOwner?.goal.goal_id ?? "")}" data-action-id="${escapeHtml(riskAction?.action_id ?? "")}" data-action-token="${escapeHtml(riskOwner?.action_projection.action_token ?? "")}" data-contract-revision="${riskOwner?.goal.current_contract_revision ?? 1}" novalidate>
    <header class="decision-record-heading"><span class="decision-kind decision-kind--risk">${icon("risk")} ${L("风险处理")}${renderNewDecisionBadge(riskDecisionCreatedAt(risk, view), view, "risk", risk.risk_id)}</span><span class="risk-state risk-state--${escapeHtml(risk.state)}">${escapeHtml(L(RISK_STATE_LABELS[risk.state]))}</span></header>
    <div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p><div class="risk-decision-fact"><strong>${escapeHtml(risk.description)}</strong><p>${L("发生概率：")}${escapeHtml(risk.probability)} · ${L("影响程度：")}${escapeHtml(risk.impact)}</p><small>${L("当前计划：")}${escapeHtml(L(RISK_TREATMENT_LABELS[risk.treatment]))}；${L("负责人：")}${escapeHtml(risk.owner)}</small></div>${renderDecisionGuidance({
      whyNow: riskStateEffect(risk.blocking_mode, risk.state),
      recommendation: null,
      insufficient: copy.insufficientEvidence,
      consequences: [
        { choice: L("继续跟踪"), effect: L("风险保持开放，并继续按照当前规则影响关联 Goal。") },
        { choice: L("标记为已处理或接受"), effect: L("风险不再阻止领取或完成；决定理由会保留在记录中。") },
        { choice: L("标记为已经发生"), effect: risk.blocking_mode === "invalidate_on_trigger" ? L("所有关联 Goal 会立即失效并需要重新确认。") : L("风险会进入已触发状态，并继续应用当前阻塞规则。") },
      ],
    })}<details class="decision-details"><summary>${L("查看触发条件和复查条件")}${icon("chevron-down")}</summary><dl class="risk-decision-details"><div><dt>${L("什么情况算已经发生")}</dt><dd>${escapeHtml(risk.trigger)}</dd></div><div><dt>${L("什么时候重新判断")}</dt><dd>${escapeHtml(risk.revisit_condition)}</dd></div></dl></details></div>
    <div class="risk-goal-links"><span>${L("关联 Goal")}</span><div>${affectedGoals.length ? affectedGoals.map((goalView) => renderDecisionGoalLink(goalView)).join("") : "未关联 Goal"}</div></div>
    <div class="risk-decision-choice"><label><span>${L("你决定怎么处理")}</span><select name="state" data-risk-state-select required>${stateOptions}</select></label><p class="risk-state-preview" data-risk-state-preview>${L("选择处理结果后，这里会说明会发生什么。")}</p></div>
    <div class="risk-resolution-fields" data-risk-resolution-basis hidden>
      <label><span>${L("解决摘要")}（${L("必填")}）</span><textarea name="resolution_summary" rows="2" placeholder="${L("说明什么事实证明这条风险已经按当前边界解决")}"></textarea></label>
      <label><span>${L("证据引用")}（${L("每行一条，至少一条")}）</span><textarea name="resolution_evidence_refs" rows="2" placeholder="evidence://...&#10;conversation://..."></textarea></label>
      <label><span>${L("剩余缺口")}（${L("每行一条；没有可留空")}）</span><textarea name="resolution_residual_gaps" rows="2" placeholder="${L("仍需观察或不在本次解决范围内的边界")}"></textarea></label>
    </div>
    <label class="decision-reason"><span>${L("决定理由")}（${L("必填")}）</span><textarea name="reason" rows="2" required placeholder="${L("说明为什么现在这样处理，以及你依据了什么")}"></textarea></label>
    <p class="form-error" data-risk-error role="alert" hidden></p>
    <footer class="decision-actions"><span>${item ? `<a href="${href}">${L("返回 Goal 查看完整风险记录")}</a>` : ""}</span><button class="button-primary" type="submit">${L("保存风险决定")}</button></footer>
  </form>`;
}

  return renderRiskDecision;
}
