import { createHash, randomUUID } from "node:crypto";
import type { GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, CandidateGoalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { ExecutionQueryApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { LegacyProposalApplicationApi } from "./legacy-proposal-contract.js";
import type { GoalTreeInputReader } from "./goal-tree-inputs.js";

/** Historical Candidate approval still creates a Goal and a separately pending Rewire. */
export class LegacyCandidateDecisionApplication implements Pick<LegacyProposalApplicationApi, "decideCandidate"> {
  constructor(private readonly ports: {
    goals: Pick<GoalsApplicationApi, "lifecycle" | "commands" | "planning">;
    governance: Pick<GovernanceApplicationApi, "query" | "records">;
    execution: Pick<ExecutionQueryApi, "listNonterminalRuns">; inputs: GoalTreeInputReader; clock: () => Date;
    errorFactory: (code: string, message: string) => Error;
  }) {}
  decideCandidate(input: Parameters<LegacyProposalApplicationApi["decideCandidate"]>[0]): { candidate: CandidateGoalRecord; replayed: boolean; observed_event_cursor: number } {
    if (input.actor_kind !== "user") {
      throw this.ports.errorFactory(
        "candidate.user_decision_required",
        "Runtime 可以提出 Candidate Goal，但只有用户可以决定是否纳入 Goal Spine",
      );
    }
    const hash = requestHash(input);
    return this.ports.governance.records.executeCandidateDecision({
      board_id: input.board_id, actor_id: input.actor_id, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      const pendingCandidate = this.ports.governance.query.getCandidate(input.board_id, input.candidate_id);
      if (!pendingCandidate) throw this.ports.errorFactory("candidate.not_found", "Candidate Goal 不存在");
      if (pendingCandidate.state !== "pending") {
        throw this.ports.errorFactory("candidate.already_decided", "Candidate Goal 已经做过决定");
      }
      const now = this.ports.clock().toISOString();
      let decision: Record<string, unknown> = { reason: input.reason, decided_by: input.actor_id };
      if (input.decision === "approved") {
        const proposed = pendingCandidate.proposed_goal;
        const proposedRelations = this.ports.inputs.normalizeProposedRelations(
          pendingCandidate.proposed_relations,
          true,
        );
        this.ports.goals.planning.proposals.validateCandidateCoordination(
          input.board_id,
          proposed,
          proposedRelations,
          pendingCandidate.proposed_impacts,
          pendingCandidate.proposed_risks,
        );
        const created = this.ports.goals.commands.createGoal(
          input.board_id,
          { ...proposed, definition_state: "accepted" },
          {
            actor_id: input.actor_id,
            idempotency_key: `candidate-goal:${input.candidate_id}`,
            reason: `批准 Candidate Goal ${input.candidate_id}`,
          },
        );
        this.ports.goals.lifecycle.markCandidateAwaitingRewire(
          input.board_id,
          created.goal.goal_id,
          now,
        );
        const rewireId = `rewire-${randomUUID()}`;
        const proposal = {
          formal_goal_id: created.goal.goal_id,
          proposal_kind: "candidate" as const,
          relations: proposedRelations,
          impacts: pendingCandidate.proposed_impacts,
          risks: pendingCandidate.proposed_risks,
        };
        const activeRuns = this.ports.execution.listNonterminalRuns(input.board_id);
        const impact = {
          active_runs_protected: activeRuns.map((run) => ({
            run_id: run.run_id,
            goal_id: run.goal_id,
          })),
          new_goal_requires_rewire_confirmation: true,
        };
        this.ports.governance.records.insertRewire({
          rewire_id: rewireId,
          board_id: input.board_id,
          candidate_id: input.candidate_id,
          proposal,
          impact,
          state: "pending",
          created_at: now,
          decided_at: null,
        });
        decision = {
          ...decision,
          formal_goal_id: created.goal.goal_id,
          rewire_id: rewireId,
          next_action: "confirm_rewire",
        };
      }
      this.ports.governance.records.transitionCandidate(
        input.board_id,
        input.candidate_id,
        input.decision,
        decision,
        now,
      );
      const cursor = this.ports.governance.records.recordCandidateDecision({
        board_id: input.board_id, candidate_id: input.candidate_id, actor_id: input.actor_id,
        decision: input.decision, reason: input.reason, at: now,
      });
      const candidate = this.readCandidate(input.board_id, input.candidate_id);
      const outcome = { candidate, observed_event_cursor: cursor };
      return { value: outcome, at: now };
    });
  }

  private readCandidate(boardId: string, candidateId: string): CandidateGoalRecord {
    const candidate = this.ports.governance.query.getCandidate(boardId, candidateId);
    if (!candidate) throw new Error(`Candidate 写入后无法读取: ${candidateId}`);
    return candidate;
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
