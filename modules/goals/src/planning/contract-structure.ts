import type { CreateGoalInput, GoalRecord, GoalContractPlanningApi, GoalContractStructureConflict } from "@adeptify/goalboard-contracts/modules/goals";
import { canonicalize, type GoalsCommandContext } from "../command-support.js";
type Row = Record<string, unknown>;

/** Existing Goal contract rules, shared by preflight and confirmed application. */
export class GoalContractPlanning implements GoalContractPlanningApi {
  constructor(private readonly context: GoalsCommandContext) {}

  proposalGoalConflict(boardId: string, item: { kind: string; operation: string; payload: Record<string, unknown> },
    goal: CreateGoalInput, targetGoalId: string): Record<string, unknown> | null {
    const existing = this.context.repository.getGoal(targetGoalId);
    if (item.operation !== "create" && !existing) {
      return { code: "goal_tree_proposal.reference_unresolved", message: "要更新的 Goal 已不存在或尚未物化", objects: [{ object_type: "goal", object_id: targetGoalId }] };
    }
    if (item.operation === "create" && existing) {
      return { code: "goal_tree_proposal.reference_unresolved", message: "要创建的 Goal 已经存在，需要基于最新事实修订", objects: [{ object_type: "goal", object_id: targetGoalId }] };
    }
    const payload = item.payload;
    const criteriaPath = payload.goal && typeof payload.goal === "object" && !Array.isArray(payload.goal)
      ? "payload.goal.acceptance_criteria"
      : payload.proposed_goal && typeof payload.proposed_goal === "object" && !Array.isArray(payload.proposed_goal)
        ? "payload.proposed_goal.acceptance_criteria"
        : "payload.acceptance_criteria";
    const seenCriterionIds = new Map<string, number>();
    for (const [criterionIndex, criterion] of goal.acceptance_criteria.entries()) {
      const criterionId = criterion.criterion_id?.trim() ?? "";
      if (!criterionId) continue;
      const firstIndex = seenCriterionIds.get(criterionId);
      const conflictingGoalId = this.context.repository.criterionGoalId(criterionId) ?? "";
      if (firstIndex == null && (!conflictingGoalId || conflictingGoalId === targetGoalId)) {
        seenCriterionIds.set(criterionId, criterionIndex);
        continue;
      }
      return {
        code: "goal_tree_proposal.acceptance_criterion_id_conflict",
        message: firstIndex == null
          ? `验收条件 ID ${criterionId} 已属于 Goal ${conflictingGoalId}`
          : `同一个 Goal Contract 重复使用验收条件 ID ${criterionId}`,
        objects: [
          { object_type: "goal", object_id: targetGoalId },
          ...(conflictingGoalId && conflictingGoalId !== targetGoalId
            ? [{ object_type: "goal", object_id: conflictingGoalId }]
            : []),
        ],
        field: `${criteriaPath}[${criterionIndex}].criterion_id`,
        received_value: criterionId,
        ...(firstIndex == null ? {} : { conflicting_index: firstIndex }),
        ...(conflictingGoalId ? { conflicting_goal_id: conflictingGoalId } : {}),
        next_action: "use_unique_criterion_id",
        recovery: "为这个验收条件使用新的全局唯一 criterion_id，并同步 leaf_readiness.acceptance_criterion_ids 后重新运行 goal_tree_check；不要复用其他 Goal 的验收条件 ID。",
      };
    }
    if (item.operation !== "create" && existing?.definition_state === "accepted") {
      if (item.kind === "contract" && item.operation === "update") {
        if (this.isCompoundClosure(existing, goal)) {
          return this.compoundClosureConflict(boardId, item.operation, existing, goal, targetGoalId);
        }
        return this.revisionStructureConflict(boardId, existing, goal);
      }
      return this.compoundClosureConflict(boardId, item.operation, existing, goal, targetGoalId);
    }
    return null;
  }

  candidateGoalMatches(goalId: string, proposed: CreateGoalInput): boolean {
    const existing = this.context.repository.getGoal(goalId);
    return Boolean(existing && existing.definition_state === "accepted"
      && existing.decomposition_state === proposed.decomposition_state
      && this.businessContractMatches(existing, { ...proposed, priority: proposed.priority ?? existing.priority }));
  }

  compoundClosureConflict(
    boardId: string,
    operation: string,
    existing: GoalRecord,
    goal: CreateGoalInput,
    goalId: string,
  ): GoalContractStructureConflict | null {
    const objects = [{ object_type: "goal", object_id: goalId }];
    const sameGoalRevision = {
      objects,
      current_goal: {
        goal_id: existing.goal_id,
        title: existing.title,
        definition_state: existing.definition_state,
        decomposition_state: existing.decomposition_state,
        fulfillment_state: existing.fulfillment_state,
      },
      next_action: "revise_same_goal_contract",
      required_item: { kind: "contract", operation: "update", goal_id: goalId },
      recovery: "把修改改为同一 Goal ID 的 native contract-update 条目；Relation、Impact 和 Risk 变化必须作为独立 Proposal 条目列出。当前 Goal Tree 尚未改变。",
    };
    if (operation !== "update" || goal.definition_state !== "accepted") {
      return {
        code: "goal.accepted_compound_closure_invalid",
        message: "已接受 Goal 的受支持收口只能保留 accepted 状态并更新已有 Goal",
        ...sameGoalRevision,
      };
    }
    if (existing.decomposition_state === "closed_leaf") {
      return {
        code: "goal.accepted_contract_update_required",
        message: "已接受叶子 Goal 的需求变化必须使用同一 Goal 的 contract-update revision",
        ...sameGoalRevision,
      };
    }
    if (existing.decomposition_state === "closed_compound") {
      return {
        code: "goal.accepted_contract_update_required",
        message: "已接受复合 Goal 的需求变化必须使用同一 Goal 的 contract-update revision",
        ...sameGoalRevision,
      };
    }
    if (
      !["abstract", "frontier_open"].includes(existing.decomposition_state) ||
      goal.decomposition_state !== "closed_compound"
    ) {
      return {
        code: "goal.accepted_compound_closure_invalid",
        message: "已接受且尚未收口的复合 Goal 只能从 abstract 或 frontier_open 收口为 closed_compound",
        ...sameGoalRevision,
      };
    }
    if (!this.businessContractMatches(existing, goal)) {
      return {
        code: "goal.accepted_contract_immutable",
        message: "已接受的 Goal 收口时不能修改业务 Contract 或验收条件",
        ...sameGoalRevision,
      };
    }
    if (this.activePartOfChildren(boardId, goalId).length === 0) {
      return {
        code: "goal.accepted_compound_closure_children_required",
        message: "已接受父 Goal 收口前至少需要一个生效的 part_of 子 Goal",
        objects,
        next_action: "add_part_of_child",
        recovery: "先在同一提案中创建或关联至少一个生效的 part_of 子 Goal，再重新运行 goal_tree_check；不要创建无子节点的 closed_compound。",
      };
    }
    return null;
  }

  businessContractMatches(existing: GoalRecord, goal: CreateGoalInput): boolean {
    const existingCriteria = existing.acceptance_criteria.map(({ goal_id: _goalId, ...criterion }) => criterion);
    const existingContract = {
      title: existing.title,
      outcome: existing.outcome,
      why: existing.why,
      business_logic: existing.business_logic,
      in_scope: existing.in_scope,
      out_of_scope: existing.out_of_scope,
      constraints: existing.constraints,
      required_inputs: existing.required_inputs,
      promised_outputs: existing.promised_outputs,
      priority: existing.priority,
      acceptance_criteria: existingCriteria,
    };
    const proposedContract = {
      title: goal.title.trim(),
      outcome: goal.outcome.trim(),
      why: goal.why.trim(),
      business_logic: goal.business_logic.trim(),
      in_scope: goal.in_scope ?? [],
      out_of_scope: goal.out_of_scope ?? [],
      constraints: goal.constraints ?? [],
      required_inputs: goal.required_inputs ?? [],
      promised_outputs: goal.promised_outputs ?? [],
      priority: goal.priority,
      acceptance_criteria: goal.acceptance_criteria,
    };
    return JSON.stringify(canonicalize(existingContract)) === JSON.stringify(canonicalize(proposedContract));
  }

  isCompoundClosure(
    existing: GoalRecord,
    goal: CreateGoalInput,
  ): boolean {
    return ["abstract", "frontier_open"].includes(existing.decomposition_state)
      && goal.decomposition_state === "closed_compound"
      && this.businessContractMatches(existing, goal);
  }

  revisionStructureConflict(
    boardId: string,
    existing: GoalRecord,
    goal: CreateGoalInput,
  ): GoalContractStructureConflict | null {
    const nextDecomposition = goal.decomposition_state ?? existing.decomposition_state;
    const children = this.activePartOfChildren(boardId, existing.goal_id);
    if (nextDecomposition === "closed_leaf" && children.length > 0) {
      return {
        code: "contract.revision_structure_conflict",
        message: "这个 Goal 仍有生效的子 Goal，不能把新版本改成叶子 Goal",
        objects: [
          { object_type: "goal", object_id: existing.goal_id },
          ...children.map((child) => ({ object_type: "goal", object_id: String(child.goal_id) })),
        ],
        next_action: "revise_contract_or_update_relations",
        recovery: "保留 compound 结构，或在同一份 Proposal 中显式调整 part_of 关系后再确认；系统不会从 Contract 文本偷偷删除关系。",
      };
    }
    if (nextDecomposition === "closed_compound" && children.length === 0) {
      return {
        code: "goal.accepted_compound_closure_children_required",
        message: "复合 Goal 收口前至少需要一个生效的 part_of 子 Goal",
        objects: [{ object_type: "goal", object_id: existing.goal_id }],
        next_action: "add_part_of_child",
        recovery: "先在同一份 Proposal 中创建或关联至少一个子 Goal，再确认 Contract revision。",
      };
    }
    return null;
  }

  private activePartOfChildren(boardId: string, parentGoalId: string): Row[] {
    return this.context.repository.db
      .prepare(`
        SELECT g.goal_id, g.fulfillment_state, g.validity_state, g.trashed_at, g.archived_at
        FROM goal_relations r
        JOIN goals g ON g.goal_id = r.from_goal_id
        WHERE r.board_id = ? AND r.to_goal_id = ?
          AND g.board_id = ?
          AND r.type = 'part_of' AND r.state = 'active'
        ORDER BY g.goal_id
      `)
      .all(boardId, parentGoalId, boardId) as Row[];
  }
}
