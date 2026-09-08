import { createGoalsDecisionPresentation, explainGoalDecision, type GoalsDocumentView, type GoalsDecisionView } from "@adeptify/goalboard-plugin-goals";
import type { EvidenceRecord } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type { ReviewObligationRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { EXECUTION_EVIDENCE_KIND_LABELS as EVIDENCE_KIND_LABELS, EXECUTION_EVIDENCE_RESULT_LABELS as EVIDENCE_RESULT_LABELS } from "./execution-validation-ui.js";

export interface HumanReviewPrimitives {
  translate(text: string, values?: Record<string, string | number>): string;
  escapeHtml(value: unknown): string;
  icon(name: "user" | "chevron-right" | "chevron-down"): string;
  renderAcceptanceSummary(item: GoalsDocumentView): string;
}
export function createWorkbenchHumanReviewRenderer(primitives: HumanReviewPrimitives) {
  const { translate: L, escapeHtml, icon, renderAcceptanceSummary } = primitives;
  const { renderNewDecisionBadge, renderDecisionGuidance, renderDecisionScenario } = createGoalsDecisionPresentation(primitives);
  const explainDecision = (kind: Parameters<typeof explainGoalDecision>[0]) => explainGoalDecision(kind, L);
function renderHumanReviewScenario(item: GoalsDocumentView): string {
  const criteria = item.goal.acceptance_criteria;
  const pendingHumanCriterionIds = new Set(
    item.review_obligations
      .filter((obligation) => obligation.role === "human_approver" && obligation.state === "pending")
      .flatMap((obligation) => obligation.criterion_scope),
  );
  const criterion = criteria.find(
    (entry) =>
      entry.decision_method === "human_decision" &&
      pendingHumanCriterionIds.has(entry.criterion_id) &&
      !item.passed_criteria.includes(entry.criterion_id),
  ) ?? criteria.find((entry) => !item.passed_criteria.includes(entry.criterion_id)) ?? criteria[0];
  const linkedEvidence = criterion
    ? item.evidence.filter((evidence) => evidence.lifecycle_state === "effective" && evidence.criterion_ids.includes(criterion.criterion_id)).slice().reverse()
    : [];
  const evidence = linkedEvidence.find((entry) => entry.result === "passed") ?? linkedEvidence[0];
  let contextLabel = L("目前还缺");
  let contextEffect = L("这条 Goal 还没有完成标准，暂时无法判断结果是否完成。");
  if (criterion?.decision_method === "human_decision") {
    contextLabel = L("需要你判断");
    contextEffect = L("完成标准「{criterion}」只能由你根据实际体验判断。选择“通过”并说明理由后，GoalBoard 会把这次确认同时记录为该标准的人工结论依据。", {
      criterion: criterion.statement,
    });
  } else if (criterion && evidence?.result === "passed") {
    const evidenceSummary = evidence.digest?.trim() || evidence.locator;
    contextLabel = L("当前依据");
    contextEffect = L("完成标准「{criterion}」已有一条通过依据「{evidence}」。这份记录支持该标准，但不等于你已经确认通过。", {
      criterion: criterion.statement,
      evidence: evidenceSummary,
    });
  } else if (criterion && evidence) {
    contextEffect = L("完成标准「{criterion}」现有依据「{evidence}」，记录结果是“{result}”，还不能证明已经达到标准。", {
      criterion: criterion.statement,
      evidence: evidence.digest?.trim() || evidence.locator,
      result: L(EVIDENCE_RESULT_LABELS[evidence.result]),
    });
  } else if (criterion) {
    contextEffect = L("完成标准「{criterion}」还没有对应的通过依据，现在不应选择“通过”。", {
      criterion: criterion.statement,
    });
  }
  const unpassedNonHumanCriterionCount = criteria.filter(
    (entry) => entry.decision_method !== "human_decision" && !item.passed_criteria.includes(entry.criterion_id),
  ).length;
  const hasHumanDecisionCriterion = criteria.some(
    (entry) => entry.decision_method === "human_decision" && pendingHumanCriterionIds.has(entry.criterion_id),
  );
  const otherPendingReviewCount = item.review_obligations.filter(
    (obligation) => obligation.state === "pending" && obligation.role !== "human_approver",
  ).length;
  const blockingRiskCount = item.risks.filter(
    (risk) => (risk.state === "open" || risk.state === "triggered") && risk.blocking_mode !== "none",
  ).length;
  const remainingGateCount = otherPendingReviewCount + blockingRiskCount;
  const confirmEffect = unpassedNonHumanCriterionCount > 0
    ? L("即使选择“通过”，Goal「{title}」仍有 {count} 条由测试或检查判断的完成标准缺少通过依据，不会完成。请先补齐依据。", {
        title: item.goal.title,
        count: unpassedNonHumanCriterionCount,
      })
    : remainingGateCount > 0
      ? L("选择“通过”会记录这次用户检查{humanEvidence}；Goal「{title}」还会等待 {count} 项其他检查或风险处理，不会马上完成。", {
          humanEvidence: hasHumanDecisionCriterion ? L("和对应的人工结论依据") : "",
          title: item.goal.title,
          count: remainingGateCount,
        })
      : L("选择“通过”会记录这次用户检查{humanEvidence}；GoalBoard 会立即再核对全部门槛，都满足后 Goal「{title}」才会完成。", {
          humanEvidence: hasHumanDecisionCriterion ? L("和对应的人工结论依据") : "",
          title: item.goal.title,
        });
  return renderDecisionScenario({
    title: L("拿当前完成标准和依据来说"),
    contextLabel,
    contextEffect,
    confirmLabel: L("如果选择通过"),
    confirmEffect,
    rejectLabel: L("如果需要修改或依据不足"),
    rejectEffect: L("选择“需要修改”会把结果退回补充；选择“证据不足”会让 Goal 继续等待依据。两种情况都不会完成这条 Goal。"),
  });
}

function humanVerdictPrefill(
  item: GoalsDocumentView,
  obligation: ReviewObligationRecord,
): EvidenceRecord | null {
  if (!obligation.criterion_scope.length) return null;
  const obligationCreatedAt = Date.parse(obligation.created_at);
  return item.evidence
    .filter((evidence) =>
      evidence.lifecycle_state === "effective" &&
      evidence.kind === "human_verdict" &&
      evidence.result === "passed" &&
      evidence.locator.startsWith("conversation://") &&
      Boolean(evidence.digest?.trim()) &&
      Number.isFinite(obligationCreatedAt) &&
      Date.parse(evidence.captured_at) >= obligationCreatedAt &&
      obligation.criterion_scope.every((criterionId) => evidence.criterion_ids.includes(criterionId))
    )
    .sort((left, right) => right.captured_at.localeCompare(left.captured_at))[0] ?? null;
}

function renderHumanVerdictPrefill(evidence: EvidenceRecord): string {
  return `<aside class="human-verdict-prefill" data-human-verdict-prefill>
    <span>${icon("user")}</span><div><strong>${L("已找到当前对话中的明确验收")}</strong>
    <p>${L("GoalBoard 已把结论、原话和对话来源预填到下方，但尚未记录为用户验收；请核对后只提交一次。")}</p>
    <dl><div><dt>${L("对话原话")}</dt><dd>${escapeHtml(evidence.digest ?? "")}</dd></div><div><dt>${L("对话来源")}</dt><dd>${escapeHtml(evidence.locator)}</dd></div></dl></div>
  </aside>`;
}

function renderHumanReview(item: GoalsDocumentView, view: Pick<GoalsDecisionView, "events">): string {
  const pending = item.review_obligations.filter(
    (obligation) => obligation.role === "human_approver" && obligation.state === "pending",
  );
  if (!pending.length) return "";
  const copy = explainDecision("review");
  const allCriteriaPassed = item.goal.acceptance_criteria.length > 0 && item.passed_criteria.length === item.goal.acceptance_criteria.length;
  const hasPendingHumanDecision = pending.some((obligation) => obligation.criterion_scope.some((criterionId) =>
    item.goal.acceptance_criteria.some(
      (criterion) => criterion.criterion_id === criterionId && criterion.decision_method === "human_decision",
    ),
  ));
  const hasReliableRecommendation = !hasPendingHumanDecision && allCriteriaPassed && item.goal.acceptance_criteria.every((criterion) =>
    item.evidence.some((evidence) => evidence.lifecycle_state === "effective" && evidence.result === "passed" && evidence.criterion_ids.includes(criterion.criterion_id)),
  );
  const effectiveEvidence = item.evidence.filter((evidence) => evidence.lifecycle_state === "effective");
  const renderEvidenceChoices = (selectedEvidenceIds = new Set<string>()) => effectiveEvidence.length
    ? effectiveEvidence
        .slice()
        .reverse()
        .map(
          (evidence) =>
            `<label class="evidence-choice"><input type="checkbox" name="evidence_refs" value="${escapeHtml(evidence.evidence_id)}"${selectedEvidenceIds.has(evidence.evidence_id) ? " checked" : ""}><span><strong>${escapeHtml(L(EVIDENCE_KIND_LABELS[evidence.kind]))} · ${escapeHtml(L(EVIDENCE_RESULT_LABELS[evidence.result]))} · ${escapeHtml(evidence.locator_status === "verified" ? L("已验证") : "UNVERIFIED")}</strong><small>${escapeHtml(evidence.locator)}</small></span></label>`,
        )
        .join("")
    : `<p class="empty-row">${L("当前还没有已提交的完成依据。你可以在下方补充外部引用。")}</p>`;
  const evidenceChoices = renderEvidenceChoices();
  return `<div class="decision-record human-review-list"><header class="decision-record-heading"><span class="decision-kind">${icon("user")} ${L("确认工作结果")}${renderNewDecisionBadge(pending[0]!.created_at, view, "review", pending[0]!.obligation_id)}</span></header><div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p><button class="human-review-jump" type="button" data-human-review-jump><span><strong>${L("填写确认结论")}</strong><small>${L("选择结论并写明判断理由")}</small></span>${icon("chevron-right")}</button>${renderDecisionGuidance({
    whyNow: L("工作结果已经提交，其他必要检查也已走到需要你确认的阶段。"),
    recommendation: hasReliableRecommendation ? L("建议确认通过") : null,
    recommendationBasis: L("{passed}/{total} 条完成标准已有通过依据，共 {evidence} 条当前有效记录。", { passed: item.passed_criteria.length, total: item.goal.acceptance_criteria.length, evidence: effectiveEvidence.length }),
    insufficient: copy.insufficientEvidence,
    consequences: [
      { choice: L("通过"), effect: L("这项用户检查会完成；其他门槛也满足后，Goal 才会完成。") },
      { choice: L("需要修改或不通过"), effect: L("结果不会完成，并会带着你的理由回到后续修改。") },
      { choice: L("证据不足"), effect: L("暂不判断结果，等待补充与完成标准对应的依据。") },
    ],
  })}${renderHumanReviewScenario(item)}<details class="decision-details"><summary>${L("查看完成标准和已有依据")}${icon("chevron-down")}</summary><div class="review-context"><section><h4>${L("完成标准")}</h4>${renderAcceptanceSummary(item)}</section><section><h4>${L("已有依据")}</h4><div class="evidence-choice-list">${evidenceChoices}</div></section></div></details></div>${pending
    .map(
      (obligation) => {
        const prefill = humanVerdictPrefill(item, obligation);
        const preselectedEvidence = prefill ? new Set([prefill.evidence_id]) : new Set<string>();
        const attentionToken = item.action_projection.actions
          .find((action) => action.actor === "user" && action.target_id === obligation.obligation_id)
          ?.reasons[0]?.facts?.attention_token ?? "";
        return `<form class="human-review-form" data-human-review-form data-live-form="human-review-${escapeHtml(obligation.obligation_id)}" data-goal-id="${escapeHtml(item.goal.goal_id)}" data-obligation-id="${escapeHtml(obligation.obligation_id)}" data-attention-token="${escapeHtml(attentionToken)}" data-contract-revision="${item.goal.current_contract_revision}" novalidate>
        ${prefill ? renderHumanVerdictPrefill(prefill) : ""}
        <label class="review-verdict"><span>${L("你的结论")}</span><select name="verdict"><option value=""${prefill ? "" : " selected"} disabled>${L("请选择结论")}</option><option value="pass"${prefill ? " selected" : ""}>${L("通过")}</option><option value="needs_changes">${L("需要修改")}</option></select></label>
        <fieldset><legend>${L("选择支持结论的已有依据")}</legend><div class="evidence-choice-list">${renderEvidenceChoices(preselectedEvidence)}</div></fieldset>
        <label><span>${L("补充依据链接")} <small>${L("可选，每行一条")}</small></span><textarea name="evidence_refs_extra" rows="2" placeholder="${L("https://… 或项目内文件引用")}"></textarea></label>
        <label><span>${L("判断理由")}（${L("必填")}）</span><textarea name="reasoning" rows="3" required placeholder="${L("说明为什么给出这个结论，以及哪些依据支撑判断")}">${escapeHtml(prefill?.digest ?? "")}</textarea></label>
        <p class="form-error" data-review-error role="alert" hidden></p>
        <footer><details class="decision-record-tech"><summary>${L("记录信息")}</summary><small>${escapeHtml(obligation.independence_rule)} · ${escapeHtml(obligation.obligation_id)}</small></details><button class="button-primary" type="submit">${L("提交结果确认")}</button></footer>
      </form>`;
      },
    )
    .join("")}</div>`;
}


  return renderHumanReview;
}
