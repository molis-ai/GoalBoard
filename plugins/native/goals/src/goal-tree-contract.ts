import type { GoalTreeProposalDecisionResult as StoredGoalTreeDecisionResult } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
export type { GoalTreeSemanticReview } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalTreeProposalCheckResult } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
export type { GoalTreeProposalCheckResult } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalTreeProposalRecord, GoalTreeProposalSubmitInput, GoalTreeProposalCheckInput, GoalTreeProposalDecideInput } from "@adeptify/goalboard-contracts/modules/governance-collaboration";

export interface GoalTreeProposalListQuery {
  board_id: string;
  proposal_id?: string;
  root_goal_id?: string;
  include_legacy?: boolean;
}

export interface GoalTreeProposalListResult {
  observed_event_cursor: number;
  proposals: GoalTreeProposalRecord[];
}

export type GoalTreeProposalDecisionResult = StoredGoalTreeDecisionResult<never>;

export interface GoalTreeApplicationApi {
  submitGoalTreeProposal(input: GoalTreeProposalSubmitInput): { proposal: GoalTreeProposalRecord; replayed: boolean; observed_event_cursor: number };
  listGoalTreeProposals(input: GoalTreeProposalListQuery): GoalTreeProposalListResult;
  checkGoalTreeProposal(input: GoalTreeProposalCheckInput): GoalTreeProposalCheckResult;
  decideGoalTreeProposal(input: GoalTreeProposalDecideInput): GoalTreeProposalDecisionResult;
}
