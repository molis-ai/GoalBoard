import type {
  GoalsQueryApi,
  ProjectGuidanceView,
} from "@adeptify/goalboard-contracts/modules/goals";

import type { BoardSnapshot, GoalContractView } from "./goal-entry-contract.js";
import type { GoalActionProjection, GoalWorkStateView } from "./execution-validation-contract.js";
import type { GoalPolicy, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalTreeProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { ExecutionClaimRecord as ClaimRecord, ExecutionRunRecord as RunRecord } from "@adeptify/goalboard-contracts/modules/execution";

export interface GoalReadApplicationPorts {
  now(): Date;
  snapshot(boardId: string): BoardSnapshot;

  workState(
    boardId: string,
    goal: GoalRecord,
    snapshot: BoardSnapshot,
    now: string,
  ): GoalWorkStateView;
  actionProjection(goal: GoalRecord, snapshot: BoardSnapshot, now: string): GoalActionProjection;
  goalTreeProposals(boardId: string, rootGoalId: string): GoalTreeProposalRecord[];
}

/** Compose a Goal Contract from the public Module facts and current workflow projection. */
export class GoalReadApplication {
  constructor(
    private readonly goals: GoalsQueryApi,
    private readonly ports: GoalReadApplicationPorts,
  ) {}

  readProjectGuidance(boardId: string): ProjectGuidanceView {
    return this.goals.readProjectGuidance(boardId);
  }

  listTrashedGoals(boardId: string): GoalRecord[] {
    return this.goals.listTrashedGoals(boardId);
  }

  listPolicyHistory(boardId: string) { return this.goals.listPolicyHistory(boardId); }
  listLegacyCoverage(boardId: string) { return this.goals.listLegacyCoverage(boardId); }
  listGoalRiskLinks(boardId: string) { return this.goals.listGoalRiskLinks(boardId); }

  getResolvedGoalPolicy(input: { board_id: string; goal_id: string }): GoalPolicy {
    return this.goals.resolvePolicy(input.board_id, input.goal_id);
  }

  readGoalContract(boardId: string, goalId: string): GoalContractView {
    const goalFacts = this.goals.readGoal(boardId, goalId);
    const snapshot = this.ports.snapshot(boardId);
    const goal = goalFacts.goal;
    const now = this.ports.now().toISOString();
    const { claims, runs } = projectGoalLifecycle(snapshot, goalId, now);
    const runIds = new Set(runs.map((item) => item.run_id));
    const candidates = snapshot.candidates.filter(
      (item) => item.discovered_in_run_id != null && runIds.has(item.discovered_in_run_id),
    );
    const candidateIds = new Set(candidates.map((item) => item.candidate_id));
    const clarificationSessions = snapshot.clarification_sessions.filter((item) => item.goal_id === goalId);
    const clarificationSessionIds = new Set(clarificationSessions.map((item) => item.session_id));
    return {
      board: goalFacts.board,
      observed_event_cursor: goalFacts.observed_event_cursor,
      goal_path: goalFacts.goal_path,
      goal,
      parent_contract_coverage: goalFacts.parent_contract_coverage,
      work_state: this.ports.workState(boardId, goal, snapshot, now),
      action_projection: this.ports.actionProjection(goal, snapshot, now),
      relations: goalFacts.relations,
      impacts: snapshot.impacts.filter((item) => item.goal_id === goalId),
      risks: goalFacts.risks,
      resolved_policy: goalFacts.resolved_policy,
      claims,
      runs,
      evidence: snapshot.evidence.filter((item) => item.goal_id === goalId),
      evidence_corrections: snapshot.evidence_corrections.filter((item) => item.goal_id === goalId),
      review_obligations: snapshot.review_obligations.filter((item) => item.goal_id === goalId),
      reviews: snapshot.reviews.filter((item) => item.goal_id === goalId),
      candidates,
      contract_proposals: snapshot.contract_proposals.filter((item) => item.goal_id === goalId),
      rewires: snapshot.rewires.filter((item) => {
        if (item.candidate_id != null && candidateIds.has(item.candidate_id)) return true;
        return (item.proposal.relations ?? []).some((relation) => {
          const fromGoalId = String(relation.from_goal_id ?? "");
          const toGoalId = String(relation.to_goal_id ?? "");
          return fromGoalId === goalId || toGoalId === goalId;
        });
      }),
      clarification_sessions: clarificationSessions,
      clarification_turns: snapshot.clarification_turns.filter((item) =>
        clarificationSessionIds.has(item.session_id),
      ),
      goal_tree_proposals: this.ports.goalTreeProposals(boardId, goalId),
      project_guidance: goalFacts.project_guidance,
    };
  }
}

export function projectGoalLifecycle(
  snapshot: Pick<BoardSnapshot, "claims" | "runs">,
  goalId: string,
  now: string,
): { claims: ClaimRecord[]; runs: RunRecord[] } {
  const expiredClaims = new Map(
    snapshot.claims
      .filter((item) => item.goal_id === goalId && item.state === "active" && item.expires_at <= now)
      .map((item) => [item.claim_id, item]),
  );
  const claims = snapshot.claims
    .filter((item) => item.goal_id === goalId)
    .map((item) => expiredClaims.has(item.claim_id)
      ? {
          ...item,
          state: "expired" as const,
          released_at: item.expires_at,
          release_reason: "领取租约已到期",
        }
      : item);
  const runs = snapshot.runs
    .filter((item) => item.goal_id === goalId)
    .map((item) => {
      const expiredClaim = expiredClaims.get(item.claim_id);
      if (!expiredClaim || !["started", "blocked"].includes(item.state)) return item;
      return {
        ...item,
        state: "abandoned" as const,
        block_reason: "领取租约已到期，当前 Run 自动中断",
        ended_at: expiredClaim.expires_at,
      };
    });
  return { claims, runs };
}
