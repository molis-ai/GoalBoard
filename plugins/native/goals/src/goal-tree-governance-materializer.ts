import type { GoalsQueryApi, GoalsPlanningApi } from "@adeptify/goalboard-contracts/modules/goals";
import { randomUUID } from "node:crypto";
import type { CandidateGoalRecord, GovernanceApplicationApi, GoalTreeProposalItemRecord, ProposalAffectedObject } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GoalTreeInputReader } from "./goal-tree-inputs.js";
import { GoalTreeFactMaterializer } from "./goal-tree-fact-materializer.js";

/** Governance records and Goal relations retain their distinct owners in one decision transaction. */
export class GoalTreeGovernanceMaterializer {
  constructor(private readonly governance: Pick<GovernanceApplicationApi, "query" | "records">,
    private readonly goals: { query: Pick<GoalsQueryApi, "hasGoalIdentity">; planning: Pick<GoalsPlanningApi, "proposals"> },
    private readonly inputs: GoalTreeInputReader, private readonly facts: GoalTreeFactMaterializer,
    private readonly errorFactory: (code: string, message: string) => Error) {}

  materializeRewire(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject[] {
    const payload = this.inputs.goalTreePayloadRecord(item.payload, "Rewire 条目");
    const nested = payload.rewire && typeof payload.rewire === "object" && !Array.isArray(payload.rewire)
      ? payload.rewire as Record<string, unknown>
      : payload.proposal && typeof payload.proposal === "object" && !Array.isArray(payload.proposal)
        ? payload.proposal as Record<string, unknown>
        : payload;
    const rewireId = String(payload.rewire_id ?? nested.rewire_id ?? "").trim() || `rewire-${randomUUID()}`;
    if (item.operation === "deactivate") {
      const current = this.governance.query.getRewire(boardId, rewireId);
      const changed = current?.state === "pending" && this.governance.records.transitionRewire(
        boardId,
        rewireId,
        "rejected",
        {},
        at,
      );
      if (!changed) {
        throw this.errorFactory("goal_tree_proposal.rewire_not_pending", "要停用的 Rewire 不存在或已经处理");
      }
      this.governance.records.recordTreeRewireDecision({
        board_id: boardId, rewire_id: rewireId, actor_id: actorId, reason: reasonText,
        source_item_id: item.item_id, at, state: "rejected",
      });
      return [{ object_type: "rewire", object_id: rewireId }];
    }
    if (item.operation !== "create" && item.operation !== "update") {
      throw this.errorFactory("goal_tree_proposal.rewire_operation_invalid", "Rewire 操作无效");
    }
    const exists = this.governance.query.getRewire(boardId, rewireId);
    if (exists && item.operation === "create") {
      throw this.errorFactory("goal_tree_proposal.rewire_exists", "要创建的 Rewire 已存在");
    }
    const proposal = {
      ...nested,
      relations: this.inputs.goalTreeRelationEntries(item),
    };
    if (item.operation === "create") {
      this.governance.records.insertRewire({
        rewire_id: rewireId,
        board_id: boardId,
        candidate_id: null,
        proposal,
        impact: { proposed_changes_applied: true, decided_by: actorId },
        state: "applied",
        created_at: at,
        decided_at: at,
      });
    } else {
      const changed = this.governance.records.transitionRewire(
        boardId,
        rewireId,
        "applied",
        { proposal },
        at,
      );
      if (!changed) throw this.errorFactory("goal_tree_proposal.rewire_not_found", "要更新的 Rewire 不存在");
    }
    const relations = this.facts.materializeGoalTreeRelations(boardId, item, actorId, reasonText, at);
    this.governance.records.recordTreeRewireDecision({
      board_id: boardId, rewire_id: rewireId, actor_id: actorId, reason: reasonText,
      source_item_id: item.item_id, at, state: "applied", relation_ids: relations.map(relation => relation.object_id),
    });
    return [{ object_type: "rewire", object_id: rewireId }, ...relations];
  }

  materializeCandidate(
    boardId: string,
    item: GoalTreeProposalItemRecord,
    actorId: string,
    reasonText: string,
    at: string,
  ): ProposalAffectedObject[] {
    const payload = this.inputs.goalTreePayloadRecord(item.payload, "Candidate 条目");
    if (item.operation === "update") {
      const candidateId = String(payload.candidate_id ?? "").trim();
      const finalProposedGoal = this.inputs.goalTreePayloadRecord(
        payload.proposed_goal ?? payload.goal ?? payload,
        "Candidate 最终 Goal Contract",
      );
      const proposedGoal = this.inputs.goalTreeGoalInput({
        ...item,
        kind: "goal",
        payload: { goal: finalProposedGoal },
      });
      const goalId = this.inputs.goalTreeTargetGoalId(item, proposedGoal);
      if (!candidateId) {
        throw this.errorFactory("goal_tree_proposal.candidate_id_required", "晋升已有 Candidate 需要 candidate_id");
      }
      const existingCandidate = this.governance.query.getCandidate(boardId, candidateId);
      if (!existingCandidate) throw new Error(`Candidate 写入后无法读取: ${candidateId}`);
      const proposedRelations = this.inputs.goalTreeCandidatePromotionRelations(payload, goalId);
      const proposedImpacts = Array.isArray(payload.proposed_impacts)
        ? payload.proposed_impacts.map((value) => this.inputs.goalTreePayloadRecord(value, "Candidate Impact"))
        : existingCandidate.proposed_impacts;
      const proposedRisks = Array.isArray(payload.proposed_risks)
        ? payload.proposed_risks.map((value) => this.inputs.goalTreePayloadRecord(value, "Candidate Risk"))
        : existingCandidate.proposed_risks;
      const blockingMode = String(payload.blocking_mode ?? existingCandidate.blocking_mode);
      if (!["none", "current_run", "dependent_claims"].includes(blockingMode)) {
        throw this.errorFactory("goal_tree_proposal.candidate_blocking_mode_invalid", "Candidate blocking_mode 无效");
      }
      const existingGoal = this.goals.query.hasGoalIdentity(goalId);
      this.goals.planning.proposals.validateCandidateCoordination(
        boardId,
        proposedGoal,
        proposedRelations,
        proposedImpacts,
        proposedRisks,
        existingGoal ? goalId : undefined,
      );
      const goalObject = existingGoal
        ? { object_type: "goal" as const, object_id: goalId }
        : this.facts.materializeGoalTreeGoal(
            boardId,
            {
              ...item,
              kind: "goal",
              operation: "create",
              payload: { goal: proposedGoal },
            },
            actorId,
            reasonText,
            at,
          );
      const relationObjects = proposedRelations.length === 0
        ? []
        : this.facts.materializeGoalTreeRelations(
            boardId,
            {
              ...item,
              kind: "relation",
              operation: "update",
              payload: { relations: proposedRelations },
            },
            actorId,
            reasonText,
            at,
          );
      const materializedByProposalId = String(payload.materialized_by_proposal_id ?? "").trim() || null;
      const decision = {
        decided_by: actorId,
        reason: reasonText,
        formal_goal_id: goalId,
        proposal_id: item.proposal_id,
        proposal_item_id: item.item_id,
        final_proposed_goal: finalProposedGoal,
        final_proposed_relations: payload.proposed_relations,
        materialized_relations: proposedRelations,
        final_proposed_impacts: proposedImpacts,
        final_proposed_risks: proposedRisks,
        blocking_mode: blockingMode,
        promotion_mode: existingGoal ? "bootstrap_reconciliation" : "goal_tree_proposal",
        ...(materializedByProposalId == null ? {} : { materialized_by_proposal_id: materializedByProposalId }),
      };
      const updated = this.governance.records.transitionCandidate(
        boardId,
        candidateId,
        "approved",
        decision,
        at,
      );
      if (!updated) {
        throw this.errorFactory(
          "goal_tree_proposal.candidate_not_pending",
          "Candidate 已不存在或不再待确认，统一晋升未写入",
        );
      }
      this.governance.records.recordTreeCandidateApproval({
        board_id: boardId, candidate_id: candidateId, actor_id: actorId, reason: reasonText,
        source_item_id: item.item_id, formal_goal_id: goalId, at, mode: "promote",
        proposal_id: item.proposal_id, materialized_by_proposal_id: materializedByProposalId,
        relation_ids: relationObjects.map(relation => relation.object_id),
      });
      return [goalObject, ...relationObjects, { object_type: "candidate", object_id: candidateId }];
    }
    if (item.operation !== "create") {
      throw this.errorFactory(
        "goal_tree_proposal.candidate_operation_invalid",
        "统一 Goal Tree 中的 Candidate 只支持 create 或晋升已有 Candidate 的 update",
      );
    }
    const candidateId = String(payload.candidate_id ?? "").trim() || `candidate-${randomUUID()}`;
    const existingCandidate = this.governance.query.getCandidate(boardId, candidateId);
    if (existingCandidate) {
      throw this.errorFactory("goal_tree_proposal.candidate_exists", "要确认的 Candidate 已存在，需要重新决定");
    }
    const goalObject = this.facts.materializeGoalTreeGoal(
      boardId,
      {
        ...item,
        kind: "goal",
        payload: { goal: payload.proposed_goal ?? payload.goal ?? payload },
      },
      actorId,
      reasonText,
      at,
    );
    const proposedGoal = this.inputs.goalTreeGoalInput({
      ...item,
      kind: "goal",
      payload: { goal: payload.proposed_goal ?? payload.goal ?? payload },
    });
    const proposedRelations = Array.isArray(payload.proposed_relations)
      ? payload.proposed_relations.map((value) => this.inputs.goalTreePayloadRecord(value, "Candidate 关系"))
      : [];
    const proposedImpacts = Array.isArray(payload.proposed_impacts)
      ? payload.proposed_impacts.map((value) => this.inputs.goalTreePayloadRecord(value, "Candidate Impact"))
      : [];
    const proposedRisks = Array.isArray(payload.proposed_risks)
      ? payload.proposed_risks.map((value) => this.inputs.goalTreePayloadRecord(value, "Candidate Risk"))
      : [];
    const blockingMode = String(payload.blocking_mode ?? "none");
    if (!["none", "current_run", "dependent_claims"].includes(blockingMode)) {
      throw this.errorFactory("goal_tree_proposal.candidate_blocking_mode_invalid", "Candidate blocking_mode 无效");
    }
    this.governance.records.insertCandidate({
      candidate_id: candidateId,
      board_id: boardId,
      submitted_by: actorId,
      discovered_in_run_id: null,
      proposed_goal: proposedGoal,
      proposed_relations: proposedRelations,
      proposed_impacts: proposedImpacts,
      proposed_risks: proposedRisks,
      blocking_mode: blockingMode as CandidateGoalRecord["blocking_mode"],
      state: "approved",
      decision: { decided_by: actorId, reason: reasonText, formal_goal_id: goalObject.object_id },
      created_at: at,
      decided_at: at,
    });
    this.governance.records.recordTreeCandidateApproval({
      board_id: boardId, candidate_id: candidateId, actor_id: actorId, reason: reasonText,
      source_item_id: item.item_id, formal_goal_id: goalObject.object_id, at, mode: "create",
    });
    return [goalObject, { object_type: "candidate", object_id: candidateId }];
  }
}
