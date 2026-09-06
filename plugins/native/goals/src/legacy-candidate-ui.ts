import type { CandidateGoalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalPolicy } from "@adeptify/goalboard-contracts/modules/goals";
import { mergeGoalPolicyFormValues as mergePolicy } from "./policy-ui-model.js";
import { findGoalView } from "./proposal-ui-model.js";
import { candidateOwnerGoalId } from "./legacy-proposal-ui-model.js";
import { explainGoalDecision } from "./decision-copy.js";
import { createGoalsDecisionPresentation } from "./decision-common-ui.js";
import type { GoalsLegacyProposalView, GoalsLegacyProposalUiPrimitives } from "./legacy-proposal-ui-model.js";

export function createLegacyCandidateRenderer(primitives: GoalsLegacyProposalUiPrimitives) {
const { translate: L, escapeHtml, icon, renderList, defaultPolicy: DEFAULT_GOAL_POLICY } = primitives;
const explainDecision = (kind: Parameters<typeof explainGoalDecision>[0]) => explainGoalDecision(kind, L);
const { renderNewDecisionBadge, renderDecisionGuidance, renderDecisionScenario } = createGoalsDecisionPresentation(primitives);
function renderCandidateList(values: string[] | undefined, empty: string): string {
  return values?.length ? renderList(values, "") : `<p class="empty-row">${escapeHtml(L(empty))}</p>`;
}

function projectDefaultPolicy(view: GoalsLegacyProposalView): GoalPolicy {
  const binding = view.policy_bindings
    .filter((item) => item.scope === "project_default" && item.goal_id == null && item.state === "active")
    .at(-1);
  return mergePolicy(DEFAULT_GOAL_POLICY, binding);
}

function recordSummary(value: Record<string, unknown>, kind: "impact" | "risk"): string {
  if (kind === "impact") {
    return `${String(value.surface ?? "未命名影响面")} · ${String(value.access ?? "access 未记录")} · ${String(value.reason ?? "未说明原因")}`;
  }
  return `${String(value.description ?? "未命名风险")} · 影响 ${String(value.impact ?? "未记录")} · ${String(value.blocking_mode ?? "不阻塞")}`;
}

function renderCandidateDecision(candidate: CandidateGoalRecord, view: GoalsLegacyProposalView): string {
  const copy = explainDecision("candidate");
  const proposed = candidate.proposed_goal;
  const owner = findGoalView(view, candidateOwnerGoalId(candidate, view));
  const policy = projectDefaultPolicy(view);
  const acceptance = proposed.acceptance_criteria ?? [];
  const separation = owner
    ? L("来源 Goal 当前要做的是「{source}」；这项新工作要独立交付「{output}」。请判断它是否确实不该放在原 Goal 里。", {
        source: owner.goal.in_scope.join("；") || owner.goal.outcome || L("未记录"),
        output: proposed.promised_outputs?.join("；") || proposed.outcome,
      })
    : L("这项新工作没有关联到发现它的推进记录。请先确认来源和独立交付结果，再决定是否加入。");
  const blockingCopy = candidate.blocking_mode === "none"
    ? L("不影响当前工作")
    : candidate.blocking_mode === "current_run"
      ? L("当前工作会等待你的决定")
      : L("后续相关工作会等待你的决定");
  const confirmEffect = owner
    ? L("会新建独立 Goal「{title}」；它不会自动成为「{owner}」的子 Goal，也不会自动开始执行。需要调整归属或依赖时，会作为另一项决定出现。", {
        title: proposed.title,
        owner: owner.goal.title,
      })
    : L("会新建独立 Goal「{title}」；它不会自动和现有 Goal 建立归属或依赖，也不会自动开始执行。", {
        title: proposed.title,
      });
  return `<form class="decision-record candidate-decision" data-candidate-decision-form data-live-form="candidate-${escapeHtml(candidate.candidate_id)}" data-candidate-id="${escapeHtml(candidate.candidate_id)}" novalidate>
    <header class="decision-record-heading"><span class="decision-kind decision-kind--candidate">${icon("plus")} ${L("新发现的工作")}${renderNewDecisionBadge(candidate.created_at, view, "candidate", candidate.candidate_id)}</span><details class="decision-record-tech"><summary>${L("记录信息")}</summary><small>Candidate · ${escapeHtml(candidate.candidate_id)}</small></details></header>
    <div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p><div class="candidate-title"><div><small>${L("准备加入的新 Goal")}</small><h3>${escapeHtml(proposed.title)}</h3><p>${escapeHtml(proposed.outcome)}</p></div><span>${escapeHtml(blockingCopy)}</span></div><p class="decision-key-fact"><strong>${L("为什么要单独拆出来：")}</strong>${escapeHtml(separation)}</p>${renderDecisionGuidance({
      whyNow: L("推进过程中发现了一项可能超出原 Goal 的工作，需要你决定是否把它单独管理。"),
      recommendation: null,
      insufficient: copy.insufficientEvidence,
      consequences: [
        { choice: L("加入 Goal Tree"), effect: L("创建一条独立 Goal；如果还要调整归属或依赖，会作为下一项决定单独出现。") },
        { choice: L("暂不加入"), effect: L("不会创建新 Goal；你的理由会保留，提交者可以补充后再提。") },
      ],
    })}${renderDecisionScenario({
      confirmLabel: L("如果加入"),
      confirmEffect,
      rejectLabel: L("如果暂不加入"),
      rejectEffect: L("不会创建 Goal「{title}」；当前 Goal Tree 保持不变，你的理由会保留。", { title: proposed.title }),
    })}</div>
    <details class="decision-details"><summary>${L("查看完整范围、完成标准和影响")}${icon("chevron-down")}</summary><dl class="candidate-contract">
      <div><dt>${L("为什么现在做")}</dt><dd>${escapeHtml(proposed.why)}</dd></div>
      <div><dt>${L("它会怎样运转")}</dt><dd>${escapeHtml(proposed.business_logic)}</dd></div>
      <div><dt>${L("这次会做")}</dt><dd>${renderCandidateList(proposed.in_scope, "未记录")}</dd></div>
      <div><dt>${L("这次不做")}</dt><dd>${renderCandidateList(proposed.out_of_scope, "未记录")}</dd></div>
      <div class="candidate-wide"><dt>${L("完成标准")}</dt><dd>${acceptance.length ? `<ol class="candidate-acceptance">${acceptance.map((criterion) => `<li><strong>${escapeHtml(criterion.statement)}</strong><small>${escapeHtml(criterion.pass_condition)}</small></li>`).join("")}</ol>` : `<p class="empty-row">${L("未记录验收条件")}</p>`}</dd></div>
      <div><dt>${L("影响范围")}</dt><dd>${candidate.proposed_impacts.length ? renderList(candidate.proposed_impacts.map((impact) => recordSummary(impact, "impact")), "") : `<p class="empty-row">${L("没有提议影响范围")}</p>`}</dd></div>
      <div><dt>${L("风险")}</dt><dd>${candidate.proposed_risks.length ? renderList(candidate.proposed_risks.map((risk) => recordSummary(risk, "risk")), "") : `<p class="empty-row">${L("没有提议风险")}</p>`}</dd></div>
      <div class="candidate-wide"><dt>${L("完成前需要的检查")}</dt><dd>${L("沿用项目当前规则：推进者自检 {self}；独立检查 {reviews} 次；用户最终确认 {human}。", { self: policy.self_verification ? L("需要") : L("不需要"), reviews: policy.cross_reviewers + policy.adversarial_reviewers, human: policy.human_approval ? L("需要") : L("不需要") })}</dd></div>
    </dl></details>
    <label class="decision-reason"><span>${L("决定理由或修改意见")}（${L("必填")}）</span><textarea name="reason" rows="3" required placeholder="${L("说明为什么纳入；或写清退回后需要怎样调整")}"></textarea></label>
    <p class="form-error" data-decision-error role="alert" hidden></p>
    <footer class="decision-actions"><button type="submit" name="decision" value="rejected">${L("暂不加入")}</button><button class="button-primary" type="submit" name="decision" value="approved">${L("加入 Goal Tree")}</button></footer>
  </form>`;
}
return { renderCandidateDecision };
}
