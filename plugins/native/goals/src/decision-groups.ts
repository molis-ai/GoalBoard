import type { GoalTreeProposalRecord, RewireRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { allGoalViews, findGoalView } from "./proposal-ui-model.js";
import { candidateOwnerGoalId, resolvedProposalGoalId } from "./legacy-proposal-ui-model.js";
import { goalRiskHasUserAction as riskHasUserAction } from "./risk-presentation.js";
import type { GoalsSafetyItem } from "./safety-ui-model.js";
import type { GoalsDecisionView, GoalsDecisionGroup } from "./decision-view.js";
export function rewireOwnerGoalId<T extends GoalsSafetyItem>(rewire: RewireRecord, view: GoalsDecisionView<T>): string | null {
  if (rewire.candidate_id) {
    const candidate = view.snapshot.candidates.find((item) => item.candidate_id === rewire.candidate_id);
    const owner = candidate ? candidateOwnerGoalId(candidate, view) : null;
    if (owner) return owner;
  }
  if (rewire.proposal.discovered_in_run_id) {
    const run = view.snapshot.runs.find((item) => item.run_id === rewire.proposal.discovered_in_run_id);
    if (run) return run.goal_id;
  }
  if (typeof rewire.proposal.formal_goal_id === "string") return rewire.proposal.formal_goal_id;
  for (const relation of rewire.proposal.relations ?? []) {
    const fromGoalId = resolvedProposalGoalId(relation.from_goal_id, rewire);
    const toGoalId = resolvedProposalGoalId(relation.to_goal_id, rewire);
    if (findGoalView(view, fromGoalId)) return fromGoalId;
    if (findGoalView(view, toGoalId)) return toGoalId;
  }
  return null;
}

export function goalTreeProposalNeedsDecision(proposal: GoalTreeProposalRecord): boolean {
  return (proposal.state === "pending" || proposal.state === "partially_applied") &&
    proposal.items.some((item) => item.state === "pending" || item.state === "conflict");
}

export function goalTreeProposalOwnerGoalId<T extends GoalsSafetyItem>(proposal: GoalTreeProposalRecord, view: GoalsDecisionView<T>): string | null {
  if (findGoalView(view, proposal.root_goal_id)) return proposal.root_goal_id;
  if (proposal.discovered_in_run_id) {
    const run = view.snapshot.runs.find((item) => item.run_id === proposal.discovered_in_run_id);
    if (run && findGoalView(view, run.goal_id)) return run.goal_id;
  }
  for (const proposalItem of proposal.items) {
    const payloadGoalIds = [
      proposalItem.payload.goal_id,
      proposalItem.payload.from_goal_id,
      proposalItem.payload.to_goal_id,
    ];
    const owner = payloadGoalIds.find((goalId) => findGoalView(view, String(goalId ?? "")));
    if (owner) return String(owner);
  }
  return null;
}

export function buildDecisionGroups<T extends GoalsSafetyItem>(view: GoalsDecisionView<T>): GoalsDecisionGroup<T>[] {
  const groups = new Map<string, GoalsDecisionGroup<T>>();
  const ensure = (goalId: string | null): GoalsDecisionGroup<T> => {
    const key = goalId ?? "$board";
    const existing = groups.get(key);
    if (existing) return existing;
    const created: GoalsDecisionGroup<T> = {
      ownerGoalId: goalId,
      item: findGoalView(view, goalId),
      goalTreeProposals: [],
      contractProposals: [],
      candidates: [],
      rewires: [],
      humanReview: false,
      risks: [],
    };
    groups.set(key, created);
    return created;
  };
  view.snapshot.goal_tree_proposals
    .filter((proposal) => proposal.origin === "native" && goalTreeProposalNeedsDecision(proposal))
    .forEach((proposal) => ensure(goalTreeProposalOwnerGoalId(proposal, view)).goalTreeProposals.push(proposal));
  view.snapshot.contract_proposals
    .filter((proposal) => proposal.state === "pending")
    .forEach((proposal) => ensure(proposal.goal_id).contractProposals.push(proposal));
  view.snapshot.candidates
    .filter((candidate) => candidate.state === "pending")
    .forEach((candidate) => ensure(candidateOwnerGoalId(candidate, view)).candidates.push(candidate));
  view.snapshot.rewires
    .filter((rewire) => rewire.state === "pending")
    .forEach((rewire) => ensure(rewireOwnerGoalId(rewire, view)).rewires.push(rewire));
  for (const item of allGoalViews(view)) {
    if (item.action_projection.actions.some((action) =>
      action.actor === "user" && action.kind === "review" && action.target_type === "review_obligation"
    )) {
      ensure(item.goal.goal_id).humanReview = true;
    }
  }
  for (const risk of view.snapshot.risks.filter((risk) => riskHasUserAction(risk, view))) {
    const owners = allGoalViews(view).filter((item) => item.risks.some((itemRisk) => itemRisk.risk_id === risk.risk_id));
    ensure(owners.length === 1 ? owners[0]!.goal.goal_id : null).risks.push(risk);
  }
  const impactScore = (group: GoalsDecisionGroup<T>): number =>
    group.risks.reduce((score, risk) => score + (risk.state === "triggered" ? 4 : risk.blocking_mode === "none" ? 1 : 3), 0) +
    group.rewires.length * 3 + group.goalTreeProposals.length * 3 + (group.humanReview ? 2 : 0) + group.contractProposals.length * 2 + group.candidates.length;
  return [...groups.values()]
    .filter((group) => group.goalTreeProposals.length || group.contractProposals.length || group.candidates.length || group.rewires.length || group.humanReview || group.risks.length)
    .sort((left, right) => impactScore(right) - impactScore(left));
}

export function pendingDecisionCount<T extends GoalsSafetyItem>(view: GoalsDecisionView<T>): number {
  const riskIds = new Set(
    allGoalViews(view).flatMap((item) => item.risks.filter((risk) => riskHasUserAction(risk, view)).map((risk) => risk.risk_id)),
  );
  return view.snapshot.goal_tree_proposals.filter((item) => item.origin === "native" && goalTreeProposalNeedsDecision(item)).length +
    view.snapshot.contract_proposals.filter((item) => item.state === "pending").length +
    view.snapshot.candidates.filter((item) => item.state === "pending").length +
    view.snapshot.rewires.filter((item) => item.state === "pending").length +
    allGoalViews(view).filter((item) => item.action_projection.actions.some((action) =>
      action.actor === "user" && action.kind === "review" && action.target_type === "review_obligation"
    )).length +
    riskIds.size;
}

export function decisionGroupCount<T extends GoalsSafetyItem>(group: GoalsDecisionGroup<T>): number {
  return group.goalTreeProposals.length + group.contractProposals.length + group.candidates.length +
    group.rewires.length + group.risks.length + (group.humanReview ? 1 : 0);
}

export function decisionTypeCounts<T extends GoalsSafetyItem>(view: GoalsDecisionView<T>) {
  const nativeGoalTreeProposals = view.snapshot.goal_tree_proposals.filter(
    (item) => item.origin === "native" && goalTreeProposalNeedsDecision(item),
  );
  return {
    proposals: nativeGoalTreeProposals.length + view.snapshot.contract_proposals.filter((item) => item.state === "pending").length,
    candidates: view.snapshot.candidates.filter((item) => item.state === "pending").length,
    rewires: view.snapshot.rewires.filter((item) => item.state === "pending").length,
    reviews: view.snapshot.review_obligations.filter((item) => item.role === "human_approver" && item.state === "pending").length,
    risks: view.snapshot.risks.filter((risk) => riskHasUserAction(risk, view)).length,
  };
}
