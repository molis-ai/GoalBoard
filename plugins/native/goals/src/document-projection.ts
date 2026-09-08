import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { GoalWorkStateView, GoalActionProjection } from "./execution-validation-contract.js";
import type { GoalsDocumentView } from "./document-view.js";
import { goalPresentationState } from "./goal-state-presentation.js";
import type { GoalPresentationState } from "./tree-order.js";
import type { createGoalActionPresenter } from "./action-presentation.js";
import type { GoalsDocumentReadPorts } from "./document-read-ports.js";
import type { createGoalDocumentIndex } from "./document-index.js";

const REVIEW_LABELS: Record<string, string> = {
  self_verifier: "自检",
  cross_reviewer: "交叉验证",
  adversarial_reviewer: "对抗性验证",
  human_approver: "用户确认",
};

export function projectGoalDocument(goal: GoalRecord, input: {
  boardId: string; snapshot: BoardSnapshot; ports: GoalsDocumentReadPorts;
  index: ReturnType<typeof createGoalDocumentIndex>;
  workStates: Map<string, GoalWorkStateView>; actionProjections: Map<string, GoalActionProjection>;
  presentGoalAction: ReturnType<typeof createGoalActionPresenter>["presentGoalAction"];
}): GoalsDocumentView {
  const { boardId, snapshot, ports, workStates, actionProjections, presentGoalAction } = input;
  const { goalRiskIds, webRisks, evidenceByGoal, evidenceCorrectionsByGoal, reviewObligationsByGoal, reviewsByGoal, impactsByGoal, contractProposalsByGoal, clarificationSessionsByGoal, clarificationTurnsByGoal, coverageByGoal, inputBindingsByGoal, policyBindingsByGoal, projectPolicyBindings, eventsByObject, relationsByGoal, candidatesByRun, goalTreeProposalsByGoal, rewiresByGoal, rewiresByCandidate } = input.index;
  const workState = workStates.get(goal.goal_id);
  if (!workState) throw new Error(`Goal 工作状态不存在: ${goal.goal_id}`);
  const activeClaim = workState.active_claim;
  const resolvedPolicy = ports.goals.getResolvedGoalPolicy({
    board_id: boardId,
    goal_id: goal.goal_id,
  });
  const status: GoalPresentationState = goalPresentationState(
    workState.work_state,
    goal,
    snapshot,
    workState.reasons,
  );
  const actionProjection = actionProjections.get(goal.goal_id);
  if (!actionProjection) throw new Error(`Goal 动作投影不存在: ${goal.goal_id}`);
  const actionPresentation = presentGoalAction(goal, actionProjection);
  const visibleStatusLabel = status === "replaced"
    ? "已替代"
    : status === "archived"
      ? "已归档"
      : status === "trashed"
        ? "回收站"
        : actionPresentation.status_label;
  const { claims, runs } = ports.projectGoalLifecycle(snapshot, goal.goal_id);
  const evidence = evidenceByGoal.get(goal.goal_id) ?? [];
  const reviewObligations = reviewObligationsByGoal.get(goal.goal_id) ?? [];
  const reviews = reviewsByGoal.get(goal.goal_id) ?? [];
  const impacts = impactsByGoal.get(goal.goal_id) ?? [];
  const relations = relationsByGoal.get(goal.goal_id) ?? [];
  const visiblePolicyBindings = [
    ...projectPolicyBindings,
    ...(policyBindingsByGoal.get(goal.goal_id) ?? []),
  ].sort((left, right) =>
    left.created_at.localeCompare(right.created_at) ||
    left.policy_binding_id.localeCompare(right.policy_binding_id)
  );
  const passedCriteria = new Set<string>();
  for (const goalEvidence of evidence) {
    if (goalEvidence.result !== "passed" || goalEvidence.lifecycle_state !== "effective") continue;
    for (const criterionId of goalEvidence.criterion_ids) passedCriteria.add(criterionId);
  }
  const pendingReviews = reviewObligations
    .filter((item) => item.state === "pending")
    .map((item) => REVIEW_LABELS[item.role] ?? item.role);
  const riskIds = new Set(goalRiskIds.get(goal.goal_id) ?? []);
  const evidenceCorrectionIds = (evidenceCorrectionsByGoal.get(goal.goal_id) ?? [])
    .map((item) => item.correction_id);
  const contractProposalIds = (contractProposalsByGoal.get(goal.goal_id) ?? [])
    .map((item) => item.proposal_id);
  const clarificationSessionIds = (clarificationSessionsByGoal.get(goal.goal_id) ?? [])
    .map((item) => item.session_id);
  const clarificationTurnIds = (clarificationTurnsByGoal.get(goal.goal_id) ?? [])
    .map((item) => item.turn_id);
  const goalTreeProposals = goalTreeProposalsByGoal.get(goal.goal_id) ?? [];
  const goalTreeProposalIds = goalTreeProposals.map((item) => item.proposal_id);
  const goalTreeProposalItemIds = goalTreeProposals.flatMap((item) => item.items.map((child) => child.item_id));
  const visiblePolicyBindingIds = visiblePolicyBindings.map((item) => item.policy_binding_id);
  const relatedObjectIds = new Set<string>([
    goal.goal_id,
    ...relations.map((item) => item.relation_id),
    ...impacts.map((item) => item.binding_id),
    ...riskIds,
    ...claims.map((item) => item.claim_id),
    ...runs.map((item) => item.run_id),
    ...evidence.map((item) => item.evidence_id),
    ...evidenceCorrectionIds,
    ...reviewObligations.map((item) => item.obligation_id),
    ...reviews.map((item) => item.review_id),
    ...contractProposalIds,
    ...clarificationSessionIds,
    ...clarificationTurnIds,
    ...goalTreeProposalIds,
    ...goalTreeProposalItemIds,
    ...visiblePolicyBindingIds,
  ]);
  const candidateIds = new Set(runs.flatMap((item) =>
    (candidatesByRun.get(item.run_id) ?? []).map((candidate) => candidate.candidate_id)
  ));
  candidateIds.forEach((id) => relatedObjectIds.add(id));
  const relatedRewireIds = new Set((rewiresByGoal.get(goal.goal_id) ?? []).map((item) => item.rewire_id));
  for (const candidateId of candidateIds) {
    for (const rewire of rewiresByCandidate.get(candidateId) ?? []) relatedRewireIds.add(rewire.rewire_id);
  }
  relatedRewireIds.forEach((id) => relatedObjectIds.add(id));
  const goalEvents = [...relatedObjectIds]
    .flatMap((objectId) => eventsByObject.get(objectId) ?? [])
    .sort((left, right) => right.seq - left.seq);
  return {
    goal,
    status,
    action_projection: actionProjection,
    display_status: actionPresentation.status,
    work_state: workState.work_state,
    status_label: visibleStatusLabel,
    main_action_label: actionPresentation.action_label,
    action_summary: actionPresentation.summary,
    reasons: workState.reasons,
    active_claim_actor: activeClaim?.actor_id ?? null,
    active_claim: activeClaim ?? null,
    active_claim_lease: workState.active_claim_lease,
    claims,
    runs,
    evidence,
    review_obligations: reviewObligations,
    reviews,
    risks: webRisks.filter((item) => riskIds.has(item.risk_id)),
    impacts,
    relations,
    coverage: coverageByGoal.get(goal.goal_id) ?? [],
    input_bindings: inputBindingsByGoal.get(goal.goal_id) ?? [],
    policy_bindings: visiblePolicyBindings,
    events: goalEvents,
    resolved_policy: resolvedPolicy,
    passed_criteria: [...passedCriteria],
    pending_reviews: pendingReviews,
  };
}
