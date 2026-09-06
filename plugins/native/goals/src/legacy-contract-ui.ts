import type { RewireRecord, ContractFieldSource, ContractFieldName, ContractProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import { explainGoalDecision } from "./decision-copy.js";
import { createGoalsDecisionPresentation } from "./decision-common-ui.js";
import type { GoalsLegacyProposalView, GoalsLegacyProposalUiPrimitives } from "./legacy-proposal-ui-model.js";

export function createLegacyContractRenderer(primitives: GoalsLegacyProposalUiPrimitives) {
const { translate: L, escapeHtml, icon, renderReference, renderList } = primitives;
const explainDecision = (kind: Parameters<typeof explainGoalDecision>[0]) => explainGoalDecision(kind, L);
const { renderNewDecisionBadge, renderDecisionGuidance, renderDecisionScenario, proposedGoalNextStage } = createGoalsDecisionPresentation(primitives);
const CONTRACT_SOURCE_LABELS: Record<ContractFieldSource["source_kind"], string> = {
  user_answer: "用户回答",
  repository_fact: "代码事实",
  document_fact: "文档事实",
  runtime_inference: "Runtime 推断",
};

function proposalSource(
  proposal: ContractProposalRecord,
  field: ContractFieldName,
): ContractFieldSource | undefined {
  return proposal.field_sources.find((source) => source.field === field);
}

function renderProposalSource(source: ContractFieldSource | undefined): string {
  if (!source) return '<span class="proposal-source">来源待补</span>';
  const confidence = Math.round(source.confidence * 100);
  return `<div class="proposal-source"><span>${escapeHtml(L(CONTRACT_SOURCE_LABELS[source.source_kind]))} · 可信度 ${confidence}% · 待你确认</span><small>${escapeHtml(source.rationale)}</small>${
    source.source_refs.length
      ? `<div class="proposal-refs">${source.source_refs.map((ref) => renderReference(ref)).join("")}</div>`
      : ""
  }</div>`;
}

function contractValue(value: string | number | string[]): string {
  if (Array.isArray(value)) return value.length ? value.join("；") : L("未填写");
  if (typeof value === "number") return String(value);
  return value.trim() || L("未填写");
}

function renderContractDiffRow(
  proposal: ContractProposalRecord,
  field: ContractFieldName,
  label: string,
  current: string | number | string[],
  proposed: string | number | string[],
): string {
  return `<div class="contract-diff-row"><h4>${escapeHtml(L(label))}</h4><div class="contract-diff-copy"><small>${L("当前")}</small><p>${escapeHtml(contractValue(current))}</p><small>${L("提案")}</small><p>${escapeHtml(contractValue(proposed))}</p></div>${renderProposalSource(proposalSource(proposal, field))}</div>`;
}

function renderContractProposal(
  proposal: ContractProposalRecord,
  current: GoalRecord,
  view: GoalsLegacyProposalView,
): string {
  const copy = explainDecision("contract");
  const proposed = proposal.proposed_goal;
  const acceptance = proposed.acceptance_criteria.map((criterion) => criterion.statement);
  const currentAcceptance = current.acceptance_criteria.map((criterion) => criterion.statement);
  const policy = proposal.review_policy;
  const policyText = [
    `Goal Mode ${policy.goal_mode}`,
    policy.self_verification ? L("需要自检") : L("不要求自检"),
    `交叉验证 ${policy.cross_reviewers} 人`,
    `对抗验证 ${policy.adversarial_reviewers} 人`,
    policy.human_approval ? L("需要用户复核") : L("不要求用户复核"),
  ];
  const linkedRewires = proposal.dependency_rewire_ids
    .map((rewireId) => view.snapshot.rewires.find((rewire) => rewire.rewire_id === rewireId))
    .filter((rewire): rewire is RewireRecord => Boolean(rewire));
  const pendingLinkedRewires = linkedRewires.filter((rewire) => rewire.state === "pending");
  const approvalBlocked = pendingLinkedRewires.length > 0;
  const sourceFields: ContractFieldName[] = ["title", "outcome", "why", "business_logic", "acceptance_criteria"];
  const reliableSources = sourceFields.filter((field) => {
    const source = proposalSource(proposal, field);
    return source && source.confidence >= 0.7 && (source.source_kind === "user_answer" || source.source_refs.length > 0);
  });
  const hasCompleteProposal = Boolean(
    proposed.title.trim() && proposed.outcome.trim() && proposed.why.trim() && proposed.business_logic.trim() && acceptance.length,
  );
  const hasReliableRecommendation = hasCompleteProposal && reliableSources.length === sourceFields.length;
  const recommendation = approvalBlocked
    ? L("建议先完成关联的 Goal 关系决定")
    : hasReliableRecommendation
      ? L("建议确认这份目标说明")
      : null;
  const recommendationBasis = approvalBlocked
    ? L("这份说明依赖上方的关系调整；先决定关系，才能知道开始顺序是否正确。")
    : L("目标、原因、实际运转方式和完成标准都有来源，且可信度不低于 70%。");
  const sameTitle = proposed.title.trim() === current.title.trim();
  const confirmEffect = sameTitle
    ? L("不会新建另一条 Goal；现有 Goal「{title}」会采用这版范围和完成标准。{stage}", {
        title: proposed.title,
        stage: proposedGoalNextStage(proposed as unknown as Record<string, unknown>),
      })
    : L("不会新建另一条 Goal；现有 Goal「{current}」会更新为「{proposed}」，并采用这版范围和完成标准。{stage}", {
        current: current.title,
        proposed: proposed.title,
        stage: proposedGoalNextStage(proposed as unknown as Record<string, unknown>),
      });
  return `<form class="decision-record contract-proposal" data-contract-decision-form data-live-form="contract-${escapeHtml(proposal.proposal_id)}" data-contract-proposal-id="${escapeHtml(proposal.proposal_id)}" novalidate>
    <header class="decision-record-heading"><span class="decision-kind">${icon("clipboard")} ${L("确认目标说明")}${renderNewDecisionBadge(proposal.created_at, view, "contract", proposal.proposal_id)}</span><span>${L("由 {name} 提交", { name: proposal.submitted_by })}</span></header>
    <div class="decision-record-body"><h3>${escapeHtml(copy.question)}</h3><p>${escapeHtml(copy.purpose)}</p>${renderDecisionGuidance({
      whyNow: L("这条 Goal 还是草稿；你确认后，下面的目标、范围和完成标准才会成为正式依据。"),
      recommendation,
      recommendationBasis,
      insufficient: copy.insufficientEvidence,
      consequences: [
        { choice: L("确认并允许开始"), effect: L("这份说明会成为正式依据；满足其他前置条件后，工作可以被领取和推进。") },
        { choice: L("退回修改"), effect: L("草稿保持不变，你写下的修改意见会保留，等待提交新版本。") },
      ],
    })}${renderDecisionScenario({
      confirmLabel: L("如果确认"),
      confirmEffect,
      rejectLabel: L("如果退回"),
      rejectEffect: L("Goal「{title}」仍保持当前草稿；这版名称、范围和完成标准都不会写入 GoalBoard。", { title: current.title }),
    })}</div>
    <details class="decision-details"><summary>${L("查看修改前后和每项依据")}${icon("chevron-down")}</summary><div class="contract-diff-list">
      ${renderContractDiffRow(proposal, "title", "目标名称", current.title, proposed.title)}
      ${renderContractDiffRow(proposal, "outcome", "要得到的结果", current.outcome, proposed.outcome)}
      ${renderContractDiffRow(proposal, "why", "为什么现在做", current.why, proposed.why)}
      ${renderContractDiffRow(proposal, "business_logic", "它会怎样运转", current.business_logic, proposed.business_logic)}
      ${renderContractDiffRow(proposal, "in_scope", "这次会做", current.in_scope, proposed.in_scope ?? [])}
      ${renderContractDiffRow(proposal, "out_of_scope", "这次不做", current.out_of_scope, proposed.out_of_scope ?? [])}
      ${renderContractDiffRow(proposal, "promised_outputs", "完成后会交付", current.promised_outputs, proposed.promised_outputs ?? [])}
      ${renderContractDiffRow(proposal, "acceptance_criteria", "完成标准", currentAcceptance, acceptance)}
      ${renderContractDiffRow(proposal, "review_policy", "完成前需要的检查", "使用项目当前规则", policyText)}
    </div>
    ${proposal.proposed_impacts.length ? `<div class="proposal-appendix"><strong>${L("确认后会记录的影响范围")}</strong>${renderList(proposal.proposed_impacts.map((impact) => `${impact.surface} · ${impact.access} · ${impact.reason}`), "")}</div>` : ""}
    ${proposal.proposed_risks.length ? `<div class="proposal-appendix"><strong>${L("确认后会记录的风险")}</strong>${renderList(proposal.proposed_risks.map((risk) => `${risk.description}；${L("影响：")}${risk.impact}；${L("复查：")}${risk.revisit_condition}`), "")}</div>` : ""}
    ${linkedRewires.length ? `<div class="proposal-appendix proposal-prerequisite"><strong>${L("需要先决定的 Goal 关系")}</strong><div>${renderList(linkedRewires.map((rewire) => `${rewire.state === "pending" ? L("等待决定") : rewire.state === "applied" ? L("已确认") : L("已拒绝")} · ${rewire.rewire_id}`), "")}<p>${approvalBlocked ? L("请先处理上方的 Goal 关系调整；完成后才能确认这份目标说明。") : L("关联的 Goal 关系已经决定，现在可以确认目标说明。")}</p></div></div>` : ""}</details>
    <label class="decision-reason"><span>${L("决定理由或修改意见")}（${L("必填")}）</span><textarea name="reason" rows="2" required placeholder="${L("确认时说明判断依据；退回时写清需要修改的内容")}"></textarea></label>
    <p class="form-error" data-decision-error role="alert" hidden></p>
    <footer class="decision-actions"><button type="submit" name="decision" value="rejected">${L("退回修改")}</button><button class="button-primary" type="submit" name="decision" value="approved"${approvalBlocked ? ` disabled aria-disabled="true" title="${L("先处理上方的 Goal 关系调整")}"` : ""}>${approvalBlocked ? L("先处理 Goal 关系") : L("确认并允许开始")}</button></footer>
  </form>`;
}
return { renderContractProposal };
}
