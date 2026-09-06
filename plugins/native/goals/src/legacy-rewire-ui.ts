import type { RewireRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { DependencyProposal } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { resolvedProposalGoalId } from "./legacy-proposal-ui-model.js";
import { explainGoalDecision } from "./decision-copy.js";
import { createGoalsDecisionPresentation } from "./decision-common-ui.js";
import type { GoalsLegacyProposalView, GoalsLegacyProposalUiPrimitives } from "./legacy-proposal-ui-model.js";

export function createLegacyRewireRenderer(primitives: GoalsLegacyProposalUiPrimitives) {
const { translate: L, escapeHtml, icon, renderReference } = primitives;
const explainDecision = (kind: Parameters<typeof explainGoalDecision>[0]) => explainGoalDecision(kind, L);
const { renderNewDecisionBadge, renderDecisionGuidance } = createGoalsDecisionPresentation(primitives);
const DEPENDENCY_BASIS_LABELS: Record<string, string> = {
  contract_output: "Contract 输出",
  code_reference: "代码引用",
  test_dependency: "测试依赖",
  business_sequence: "业务顺序",
  impact_conflict: "影响面冲突",
  risk_policy: "风险策略",
};

function renderProposalGoal(goalId: string, view: GoalsLegacyProposalView): string {
  const goal = view.goals.find((item) => item.goal.goal_id === goalId)?.goal;
  if (!goal) return `<span class="dependency-goal"><strong>${escapeHtml(goalId)}</strong></span>`;
  return `<button class="dependency-goal" type="button" data-select-goal="${escapeHtml(goalId)}"><strong>${escapeHtml(goal.title)}</strong><small>${escapeHtml(goalId)}</small></button>`;
}

function dependencyRelations(
  rewire: RewireRecord,
): Array<Record<string, unknown>> {
  return (rewire.proposal.relations ?? []).filter(
    (relation) => String(relation.type ?? "") === "depends_on",
  );
}

function renderDependencyProposalList(
  rewire: RewireRecord,
  view: GoalsLegacyProposalView,
): string {
  const dependencies = dependencyRelations(rewire);
  if (!dependencies.length) return "";
  return `<div class="dependency-proposal-list">${dependencies.map((relation) => {
    const proposal = relation as unknown as Partial<DependencyProposal>;
    const fromGoalId = resolvedProposalGoalId(proposal.from_goal_id, rewire);
    const toGoalId = resolvedProposalGoalId(proposal.to_goal_id, rewire);
    const evidenceRefs = Array.isArray(proposal.evidence_refs) ? proposal.evidence_refs : [];
    const confidence = typeof proposal.confidence === "number"
      ? `${Math.round(Math.max(0, Math.min(1, proposal.confidence)) * 100)}%`
      : "未记录";
    const stateLabel = rewire.state === "pending"
      ? "等待决定"
      : rewire.state === "applied"
        ? "已应用"
        : rewire.state === "rejected"
          ? "已拒绝"
          : "已确认";
    return `<article class="dependency-proposal">
      <header><span class="dependency-action dependency-action--${escapeHtml(proposal.action ?? "add")}">${proposal.action === "deactivate" ? L("解除依赖") : L("新增依赖")}</span><span class="dependency-state dependency-state--${escapeHtml(rewire.state)}">${escapeHtml(stateLabel)}</span></header>
      <div class="dependency-direction">${renderProposalGoal(fromGoalId, view)}<span>${icon("chevron-right")}<small>依赖</small></span>${renderProposalGoal(toGoalId, view)}</div>
      <dl class="dependency-rationale"><div><dt>为什么需要</dt><dd>${escapeHtml(proposal.reason ?? L("未说明"))}</dd></div><div><dt>为什么是这个方向</dt><dd>${escapeHtml(proposal.direction_reason ?? L("未说明"))}</dd></div><div><dt>如果拒绝</dt><dd>${escapeHtml(proposal.impact_if_rejected ?? L("未说明"))}</dd></div><div><dt>判断依据</dt><dd>${escapeHtml(DEPENDENCY_BASIS_LABELS[proposal.basis ?? ""] ?? proposal.basis ?? L("未记录"))} · 可信度 ${escapeHtml(confidence)}</dd></div></dl>
      <div class="dependency-evidence"><strong>证据</strong>${evidenceRefs.length ? evidenceRefs.map((ref) => renderReference(ref)).join("") : '<span class="empty-row">未提供证据</span>'}</div>
    </article>`;
  }).join("")}</div>`;
}

function renderRewireSummary(
  rewire: RewireRecord,
  view: GoalsLegacyProposalView,
): string {
  if (dependencyRelations(rewire).length) return renderDependencyProposalList(rewire, view);
  const relations = rewire.proposal.relations ?? [];
  const impacts = rewire.proposal.impacts ?? [];
  const risks = rewire.proposal.risks ?? [];
  const activeRuns = Array.isArray(rewire.impact.active_runs_protected)
    ? rewire.impact.active_runs_protected.length
    : 0;
  const changeSummary =
    relations.length + impacts.length + risks.length === 0
      ? L("这次提案不新增关系、影响面或风险，只决定新 Goal 是否独立进入后续流程。")
      : `这次提案包含 ${relations.length} 条 Goal 关系、${impacts.length} 个影响面和 ${risks.length} 项风险。`;
  const runSummary = activeRuns
    ? `${activeRuns} 个正在执行的 Run 会保持原目标，不会被改绑。`
    : L("当前没有需要保护的运行中 Run。");
  return `<p>${changeSummary} ${runSummary}</p>`;
}

function renderResolvedDependencyHistory(item: { goal: { goal_id: string } }, view: GoalsLegacyProposalView): string {
  const rewires = view.snapshot.rewires.filter(
    (rewire) =>
      rewire.state !== "pending" &&
      dependencyRelations(rewire).some((relation) => {
        const fromGoalId = resolvedProposalGoalId(relation.from_goal_id, rewire);
        const toGoalId = resolvedProposalGoalId(relation.to_goal_id, rewire);
        return fromGoalId === item.goal.goal_id || toGoalId === item.goal.goal_id;
      }),
  );
  if (!rewires.length) return "";
  return `<div class="dependency-history"><h3>${L("依赖提案记录 ")}<span>${rewires.length}</span></h3><p>${L("保留 Runtime 的依据和用户决定，后续事实变化时可以重新检查。")}</p>${rewires.map((rewire) => renderDependencyProposalList(rewire, view)).join("")}</div>`;
}

function renderRewireDecision(
  rewire: RewireRecord,
  view: GoalsLegacyProposalView,
): string {
  const copy = explainDecision("rewire");
  const hasDependencies = dependencyRelations(rewire).length > 0;
  const note = rewire.candidate_id
    ? L("拒绝关系调整不会删除已经纳入的 Goal。")
    : L("拒绝后现有依赖保持不变；确认后才会新增或解除依赖。");
  const dependencies = dependencyRelations(rewire);
  const evidenceCount = dependencies.reduce((count, relation) => count + (Array.isArray(relation.evidence_refs) ? relation.evidence_refs.length : 0), 0);
  const hasReliableRecommendation = dependencies.length > 0 && dependencies.every((relation) =>
    Boolean(relation.reason) && Boolean(relation.direction_reason) && Boolean(relation.impact_if_rejected) &&
    typeof relation.confidence === "number" && relation.confidence >= 0.7 &&
    Array.isArray(relation.evidence_refs) && relation.evidence_refs.length > 0,
  );
  return `<form class="decision-record rewire-decision" data-rewire-decision-form data-live-form="rewire-${escapeHtml(rewire.rewire_id)}" data-rewire-id="${escapeHtml(rewire.rewire_id)}" novalidate>
    <header class="decision-record-heading"><span class="decision-kind decision-kind--rewire">${icon("tree")} ${L("Goal 关系调整")}${renderNewDecisionBadge(rewire.created_at, view, "rewire", rewire.rewire_id)}</span><details class="decision-record-tech"><summary>${L("记录信息")}</summary><small>Rewire · ${escapeHtml(rewire.rewire_id)}</small></details></header>
    <div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p>${renderDecisionGuidance({
      whyNow: L("这项关系变化会改变哪些 Goal 必须先完成，以及它们在 Goal Tree 中的归属。"),
      recommendation: hasReliableRecommendation ? L("建议应用这次关系调整") : null,
      recommendationBasis: L("提案写清了关系方向、拒绝后的影响，并提供了 {count} 条可查看依据。", { count: evidenceCount }),
      insufficient: copy.insufficientEvidence,
      consequences: [
        { choice: L("应用调整"), effect: L("按提案增加或解除关系；已经在运行的终端和工作不会被改到别的 Goal。") },
        { choice: L("不调整"), effect: note },
      ],
    })}${renderRewireSummary(rewire, view)}</div>
    <label class="decision-reason"><span>${L("决定理由或修改意见")}（${L("必填")}）</span><textarea name="reason" rows="2" required placeholder="${L("说明为什么确认或拒绝这次关系变化")}"></textarea></label>
    <p class="form-error" data-decision-error role="alert" hidden></p>
    <footer class="decision-actions"><button type="submit" name="decision" value="rejected">${L("保持现有关系")}</button><button class="button-primary" type="submit" name="decision" value="confirmed">${hasDependencies ? L("应用这次依赖调整") : L("应用这次关系调整")}</button></footer>
  </form>`;
}
return { renderRewireDecision, renderResolvedDependencyHistory };
}
