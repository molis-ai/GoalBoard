import type { GoalsQueryApi, GoalsPlanningApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceQueryApi, GoalTreeProposalItemRecord, ProposalAffectedObject } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GoalTreeInputReader } from "./goal-tree-inputs.js";

/** Proposal reference checks combine owner queries; they do not write or simulate changes. */
export class GoalTreeMaterializationConflicts {
  constructor(private readonly goals: {
    query: Pick<GoalsQueryApi, "hasGoalIdentity" | "policyBindingState" | "getRisk" | "listRelations">;
    planning: Pick<GoalsPlanningApi, "contracts" | "wouldCreatePartOfCycle">;
  }, private readonly governance: { query: Pick<GovernanceQueryApi, "getCandidate" | "getRewire" | "hasCandidateBootstrap"> },
    private readonly inputs: GoalTreeInputReader) {}

  read(
    boardId: string,
    item: GoalTreeProposalItemRecord,
  ): Record<string, unknown> | null {
    const missingGoalIds = new Set<string>();
    const missingObject = (objectType: ProposalAffectedObject["object_type"], objectId: string, message: string) => ({
      code: "goal_tree_proposal.reference_unresolved",
      message,
      objects: [{ object_type: objectType, object_id: objectId }],
    });
    const goalExists = (goalId: string) => this.goals.query.hasGoalIdentity(goalId);
    if (item.kind === "goal" || item.kind === "contract") {
      const goal = this.inputs.goalTreeGoalInput(item);
      const targetGoalId = this.inputs.goalTreeTargetGoalId(item, goal);
      return this.goals.planning.contracts.proposalGoalConflict(boardId, item, goal, targetGoalId);
    }
    if (item.kind === "policy") {
      const payload = this.inputs.goalTreePayloadRecord(item.payload, "Policy 条目");
      const goalId = String(payload.goal_id ?? "").trim();
      if (goalId && !goalExists(goalId)) return missingObject("goal", goalId, "Policy 关联的 Goal 尚未物化");
      if (item.operation === "deactivate") {
        const bindingId = String(payload.policy_binding_id ?? "").trim();
        const current = bindingId && this.goals.query.policyBindingState(boardId, bindingId) === "active";
        return current
          ? null
          : missingObject("policy", bindingId || "policy_binding_id", "要停用的 Policy 已不存在或不再生效");
      }
      return null;
    }
    if (item.kind === "risk") {
      const payload = this.inputs.goalTreePayloadRecord(item.payload, "Risk 条目");
      const riskId = String(payload.risk_id ?? "").trim();
      const existing = riskId
        ? this.goals.query.getRisk(boardId, riskId)
        : null;
      if (item.operation === "create" && existing) {
        return {
          code: "goal_tree_proposal.risk_exists",
          message: "要创建的 Risk 已存在，需要基于最新事实修订",
          objects: [{ object_type: "risk", object_id: riskId }],
        };
      }
      if (item.operation !== "create" && (!riskId || !existing)) {
        return missingObject("risk", riskId || "risk_id", "要更新或停用的 Risk 不存在");
      }
      for (const goalId of this.inputs.goalTreeStringArray(payload.goal_ids)) {
        if (!goalExists(goalId)) missingGoalIds.add(goalId);
      }
      return missingGoalIds.size > 0
        ? {
            code: "goal_tree_proposal.reference_unresolved",
            message: "Risk 关联的 Goal 尚未物化",
            objects: [...missingGoalIds].sort().map((goalId) => ({ object_type: "goal", object_id: goalId })),
          }
        : null;
    }
    if (item.kind === "candidate") {
      const payload = this.inputs.goalTreePayloadRecord(item.payload, "Candidate 条目");
      const candidateId = String(payload.candidate_id ?? "").trim();
      const candidateRow = candidateId
        ? this.governance.query.getCandidate(boardId, candidateId)
        : null;
      if (item.operation === "create") {
        if (candidateRow) {
          return {
            code: "goal_tree_proposal.candidate_exists",
            message: "要确认的 Candidate 已存在，需要重新决定",
            objects: [{ object_type: "candidate", object_id: candidateId }],
          };
        }
        const goal = this.inputs.goalTreeGoalInput({ ...item, kind: "goal", payload: { goal: payload.proposed_goal ?? payload.goal ?? payload } });
        const goalId = this.inputs.goalTreeTargetGoalId(item, goal);
        return goalExists(goalId)
          ? {
              code: "goal_tree_proposal.goal_exists",
              message: "Candidate 对应的 Goal 已存在，需要先修订提案",
              objects: [{ object_type: "goal", object_id: goalId }],
            }
          : null;
      }
      if (item.operation !== "update") {
        return {
          code: "goal_tree_proposal.candidate_operation_invalid",
          message: "已有 Candidate 只能通过 update 晋升，不能停用",
          objects: [{ object_type: "candidate", object_id: candidateId || "candidate_id" }],
        };
      }
      if (!candidateId || !candidateRow) {
        return missingObject("candidate", candidateId || "candidate_id", "要晋升的 Candidate 不存在");
      }
      if (candidateRow.state !== "pending") {
        return {
          code: "goal_tree_proposal.candidate_not_pending",
          message: "只有仍待用户决定的 Candidate 可以通过统一提案晋升",
          objects: [{ object_type: "candidate", object_id: candidateId }],
        };
      }
      if (
        !payload.proposed_goal ||
        typeof payload.proposed_goal !== "object" ||
        Array.isArray(payload.proposed_goal) ||
        !Array.isArray(payload.proposed_relations) ||
        (payload.proposed_impacts != null && !Array.isArray(payload.proposed_impacts)) ||
        (payload.proposed_risks != null && !Array.isArray(payload.proposed_risks))
      ) {
        return {
          code: "goal_tree_proposal.candidate_final_revision_required",
          message: "Candidate 晋升提案必须明确提供最终 proposed_goal 和 proposed_relations（可以是空列表）",
          objects: [{ object_type: "candidate", object_id: candidateId }],
        };
      }
      const goal = this.inputs.goalTreeGoalInput({ ...item, kind: "goal", payload: { goal: payload.proposed_goal ?? payload.goal ?? payload } });
      const goalId = this.inputs.goalTreeTargetGoalId(item, goal);
      const requestedFormalGoalId = String(payload.formal_goal_id ?? "").trim();
      if (requestedFormalGoalId && requestedFormalGoalId !== goalId) {
        return {
          code: "goal_tree_proposal.candidate_formal_goal_mismatch",
          message: "Candidate 对账引用的 formal_goal_id 必须与最终 Contract 的稳定 goal_id 一致",
          objects: [
            { object_type: "candidate", object_id: candidateId },
            { object_type: "goal", object_id: requestedFormalGoalId },
          ],
        };
      }
      const originalGoal = candidateRow.proposed_goal;
      const originalGoalId = originalGoal.goal_id?.trim() ?? "";
      if (originalGoalId && originalGoalId !== goalId) {
        return {
          code: "goal_tree_proposal.candidate_goal_id_changed",
          message: "修订 Candidate Contract 时不能改成另一条稳定 Goal ID",
          objects: [
            { object_type: "candidate", object_id: candidateId },
            { object_type: "goal", object_id: goalId },
          ],
        };
      }
      if (goal.definition_state !== "accepted") {
        return {
          code: "goal_tree_proposal.candidate_goal_not_accepted",
          message: "Candidate 晋升后的正式 Goal 必须是 accepted",
          objects: [{ object_type: "goal", object_id: goalId }],
        };
      }
      const candidateBaseline = item.baseline_versions.find(
        (baseline) => baseline.object_type === "candidate" && baseline.object_id === candidateId && baseline.exists,
      );
      const goalBaseline = item.baseline_versions.find(
        (baseline) => baseline.object_type === "goal" && baseline.object_id === goalId,
      );
      if (!candidateBaseline || !goalBaseline) {
        return {
          code: "goal_tree_proposal.candidate_baseline_required",
          message: "Candidate 晋升提案必须同时记录原 Candidate 和目标 Goal 的基准，才能安全处理并发变化",
          objects: [
            { object_type: "candidate", object_id: candidateId },
            { object_type: "goal", object_id: goalId },
          ],
        };
      }
      const existingGoal = this.goals.query.hasGoalIdentity(goalId);
      if (existingGoal) {
        const materializedByProposalId = String(payload.materialized_by_proposal_id ?? "").trim();
        if (
          requestedFormalGoalId !== goalId ||
          !materializedByProposalId ||
          !this.governance.query.hasCandidateBootstrap(boardId, candidateId, goalId, materializedByProposalId) ||
          !this.goals.planning.contracts.candidateGoalMatches(goalId, goal)
        ) {
          return {
            code: "goal_tree_proposal.candidate_bootstrap_unproven",
            message: "已有正式 Goal 不能自动收编；需要同一 Board 上可追溯的原统一提案和完全一致的最终 Contract",
            objects: [
              { object_type: "candidate", object_id: candidateId },
              { object_type: "goal", object_id: goalId },
            ],
          };
        }
      }
      const relations = this.inputs.goalTreeCandidatePromotionRelations(payload, goalId);
      for (const rawRelation of relations) {
        const relation = this.inputs.normalizeGoalTreeRelation(
          { ...item, kind: "relation", payload: { relations } },
          rawRelation,
        );
        if (relation.action === "deactivate") {
          const current = relation.relation_id
            ? this.goals.query.listRelations(boardId).find(
                (candidate) => candidate.relation_id === relation.relation_id && candidate.state === "active",
              )
            : this.goals.query.listRelations(boardId).find(
                (candidate) =>
                  candidate.from_goal_id === relation.from_goal_id &&
                  candidate.to_goal_id === relation.to_goal_id &&
                  candidate.type === relation.type &&
                  candidate.state === "active",
              );
          if (!current) {
            return missingObject(
              "relation",
              relation.relation_id ?? `${relation.from_goal_id}:${relation.to_goal_id}:${relation.type}`,
              "Candidate 要停用的关系已不存在或不再生效",
            );
          }
          continue;
        }
        if (relation.from_goal_id !== goalId && !goalExists(relation.from_goal_id)) {
          missingGoalIds.add(relation.from_goal_id);
        }
        if (relation.to_goal_id !== goalId && !goalExists(relation.to_goal_id)) {
          missingGoalIds.add(relation.to_goal_id);
        }
        const duplicate = this.goals.query.listRelations(boardId).find(
          (candidate) =>
            candidate.from_goal_id === relation.from_goal_id &&
            candidate.to_goal_id === relation.to_goal_id &&
            candidate.type === relation.type &&
            candidate.state === "active",
        );
        if (duplicate) {
          return {
            code: "goal_tree_proposal.relation_already_active",
            message: "Candidate 提案中的这条关系已经生效，需要基于最新事实修订",
            objects: [{ object_type: "relation", object_id: duplicate.relation_id }],
          };
        }
      }
      return missingGoalIds.size > 0
        ? {
            code: "goal_tree_proposal.reference_unresolved",
            message: "Candidate 关系引用了不存在的 Goal",
            objects: [...missingGoalIds].sort().map((missingGoalId) => ({
              object_type: "goal" as const,
              object_id: missingGoalId,
            })),
          }
        : null;
    }
    if (item.kind === "rewire") {
      const payload = this.inputs.goalTreePayloadRecord(item.payload, "Rewire 条目");
      const nested = payload.rewire && typeof payload.rewire === "object" && !Array.isArray(payload.rewire)
        ? payload.rewire as Record<string, unknown>
        : payload.proposal && typeof payload.proposal === "object" && !Array.isArray(payload.proposal)
          ? payload.proposal as Record<string, unknown>
          : payload;
      const rewireId = String(payload.rewire_id ?? nested.rewire_id ?? "").trim();
      const existing = rewireId
        ? this.governance.query.getRewire(boardId, rewireId)
        : null;
      if (item.operation === "create" && existing) {
        return {
          code: "goal_tree_proposal.rewire_exists",
          message: "要创建的 Rewire 已存在，需要基于最新事实修订",
          objects: [{ object_type: "rewire", object_id: rewireId }],
        };
      }
      if (item.operation !== "create" && (!rewireId || !existing)) {
        return missingObject("rewire", rewireId || "rewire_id", "要更新或停用的 Rewire 不存在");
      }
    }
    if (item.kind === "relation" || item.kind === "dependency" || item.kind === "rewire") {
      for (const rawRelation of this.inputs.goalTreeRelationEntries(item)) {
        const relation = this.inputs.normalizeGoalTreeRelation(item, rawRelation);
        if (relation.action === "deactivate") {
          const current = relation.relation_id
            ? this.goals.query.listRelations(boardId).find(
                (candidate) => candidate.relation_id === relation.relation_id && candidate.state === "active",
              )
            : this.goals.query.listRelations(boardId).find(
                (candidate) =>
                  candidate.from_goal_id === relation.from_goal_id &&
                  candidate.to_goal_id === relation.to_goal_id &&
                  candidate.type === relation.type &&
                  candidate.state === "active",
              );
          if (!current) {
            return missingObject(
              "relation",
              relation.relation_id ?? `${relation.from_goal_id}:${relation.to_goal_id}:${relation.type}`,
              "要停用的关系已不存在或不再生效",
            );
          }
          continue;
        }
        if (!goalExists(relation.from_goal_id)) missingGoalIds.add(relation.from_goal_id);
        if (!goalExists(relation.to_goal_id)) missingGoalIds.add(relation.to_goal_id);
        if (relation.type === "part_of" && this.goals.planning.wouldCreatePartOfCycle(boardId, relation.from_goal_id, relation.to_goal_id)) {
          return {
            code: "goal_tree_proposal.part_of_cycle",
            message: "这条父子关系会形成循环，需先修改拆分方向",
            objects: [
              { object_type: "goal", object_id: relation.from_goal_id },
              { object_type: "goal", object_id: relation.to_goal_id },
            ],
          };
        }
        const duplicate = this.goals.query.listRelations(boardId).find(
          (candidate) =>
            candidate.from_goal_id === relation.from_goal_id &&
            candidate.to_goal_id === relation.to_goal_id &&
            candidate.type === relation.type &&
            candidate.state === "active",
        );
        if (duplicate) {
          return {
            code: "goal_tree_proposal.relation_already_active",
            message: "这条关系已经生效，需要基于最新事实修订",
            objects: [{ object_type: "relation", object_id: duplicate.relation_id }],
          };
        }
      }
      return missingGoalIds.size > 0
        ? {
            code: "goal_tree_proposal.reference_unresolved",
            message: "关系引用了未确认、已拒绝或不存在的 Goal",
            objects: [...missingGoalIds].sort().map((goalId) => ({ object_type: "goal", object_id: goalId })),
          }
        : null;
    }
    return null;
  }
}
