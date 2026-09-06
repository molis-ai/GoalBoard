import { goalRelationTypes, type CreateGoalInput, type GoalDependencyReference, type GoalsProposalCoordinationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsCommandContext } from "../command-support.js";

/** One owner for native and legacy proposal coordination checks; never materializes their changes. */
export class GoalProposalCoordination implements GoalsProposalCoordinationApi {
  constructor(private readonly context: GoalsCommandContext) {}

  validateStandaloneDependencies(
    boardId: string,
    dependencies: GoalDependencyReference[],
  ): void {
    for (const dependency of dependencies) {
      this.context.requireNonTrashedGoal(boardId, dependency.from_goal_id);
      this.context.requireNonTrashedGoal(boardId, dependency.to_goal_id);
      if (dependency.from_goal_id === dependency.to_goal_id) {
        throw this.context.error(
          "dependency_proposal.self_reference",
          "Goal 不能依赖自身",
        );
      }
      const active = this.context.repository.db
        .prepare(`
          SELECT relation_id FROM goal_relations
          WHERE board_id = ? AND from_goal_id = ? AND to_goal_id = ?
            AND type = 'depends_on' AND state = 'active'
          ORDER BY relation_id
        `)
        .all(boardId, dependency.from_goal_id, dependency.to_goal_id);
      if (dependency.action === "add" && active.length > 0) {
        throw this.context.error(
          "dependency_proposal.already_active",
          "这条依赖已经生效，不需要重复提案",
        );
      }
      if (dependency.action === "deactivate" && active.length === 0) {
        throw this.context.error(
          "dependency_proposal.not_active",
          "要停用的依赖当前并未生效",
        );
      }
    }
  }

  validateCandidateCoordination(
    boardId: string,
    proposedGoal: CreateGoalInput,
    relations: Array<Record<string, unknown>>,
    impacts: Array<Record<string, unknown>>,
    risks: Array<Record<string, unknown>>,
    allowExistingGoalId?: string,
  ): void {
    this.context.requireBoard(boardId);
    const proposedGoalId = proposedGoal.goal_id?.trim() ?? "";
    if (
      proposedGoalId &&
      this.context.repository.getGoal(proposedGoalId) &&
      proposedGoalId !== allowExistingGoalId
    ) {
      throw this.context.error(
        "candidate.goal_exists",
        `Candidate 使用了已经存在的 Goal ID: ${proposedGoalId}`,
      );
    }
    const isNewGoal = (goalId: string) =>
      goalId === "$new_goal" || (proposedGoalId.length > 0 && goalId === proposedGoalId);
    const requireKnownGoal = (goalId: string, subject: string) => {
      if (!goalId) {
        throw this.context.error(`candidate.${subject}_invalid`, `${subject} 缺少 Goal ID`);
      }
      if (!isNewGoal(goalId)) this.context.requireNonTrashedGoal(boardId, goalId);
    };
    const validRelationTypes = new Set<string>(goalRelationTypes);
    for (const relation of relations) {
      const fromGoalId = String(relation.from_goal_id ?? "$new_goal").trim();
      const toGoalId = String(relation.to_goal_id ?? "").trim();
      const type = String(relation.type ?? "");
      if (!validRelationTypes.has(type) || !String(relation.reason ?? "").trim()) {
        throw this.context.error(
          "candidate.relation_invalid",
          "Candidate 中的关系必须包含有效类型和原因",
        );
      }
      requireKnownGoal(fromGoalId, "relation");
      requireKnownGoal(toGoalId, "relation");
      const canonicalFrom = isNewGoal(fromGoalId) ? "$new_goal" : fromGoalId;
      const canonicalTo = isNewGoal(toGoalId) ? "$new_goal" : toGoalId;
      if (canonicalFrom === canonicalTo) {
        throw this.context.error(
          "candidate.relation_invalid",
          "Candidate 不能让新 Goal 依赖或归属于自身",
        );
      }
      if (type === "depends_on") {
        const action = String(relation.action ?? "add");
        if (action === "deactivate" && (isNewGoal(fromGoalId) || isNewGoal(toGoalId))) {
          throw this.context.error(
            "dependency_proposal.not_active",
            "尚未创建的新 Goal 不存在可停用的 active dependency",
          );
        }
        if (!isNewGoal(fromGoalId) && !isNewGoal(toGoalId)) {
          this.validateStandaloneDependencies(boardId, [{
            from_goal_id: relation.from_goal_id as string,
            to_goal_id: relation.to_goal_id as string,
            action: relation.action,
          }]);
        }
      }
    }
    for (const impact of impacts) {
      const goalId = String(impact.goal_id ?? "$new_goal").trim();
      const surface = String(impact.surface ?? "").trim();
      const access = String(impact.access ?? "");
      if (!surface || !["read", "write", "decide", "exclusive"].includes(access)) {
        throw this.context.error(
          "candidate.impact_invalid",
          "Candidate 中的 Impact 必须包含影响面和有效访问方式",
        );
      }
      requireKnownGoal(goalId, "impact");
    }
    const validTreatments = new Set(["accept", "mitigate", "avoid", "defer"]);
    const validBlockingModes = new Set(["none", "claim", "completion", "invalidate_on_trigger"]);
    const proposedRiskIds = new Set<string>();
    for (const risk of risks) {
      const description = String(risk.description ?? "").trim();
      const probability = String(risk.probability ?? "").trim();
      const impact = String(risk.impact ?? "").trim();
      const trigger = String(risk.trigger ?? "").trim();
      const treatment = String(risk.treatment ?? "");
      const blockingMode = String(risk.blocking_mode ?? "none");
      const revisitCondition = String(risk.revisit_condition ?? "").trim();
      const owner = String(risk.owner ?? "").trim();
      if (
        !description ||
        !probability ||
        !impact ||
        !trigger ||
        !revisitCondition ||
        !owner ||
        !validTreatments.has(treatment) ||
        !validBlockingModes.has(blockingMode)
      ) {
        throw this.context.error(
          "candidate.risk_invalid",
          "Candidate 中的 Risk 字段不完整或取值无效",
        );
      }
      const goalIdsValue = risk.goal_ids;
      const goalIds = goalIdsValue == null
        ? ["$new_goal"]
        : Array.isArray(goalIdsValue)
          ? goalIdsValue.map(String)
          : [];
      if (goalIds.length === 0) {
        throw this.context.error(
          "candidate.risk_invalid",
          "Candidate 中的 Risk 必须关联至少一个 Goal",
        );
      }
      for (const goalId of goalIds) requireKnownGoal(goalId, "risk");
      const riskId = risk.risk_id == null ? "" : String(risk.risk_id).trim();
      if (riskId) {
        if (proposedRiskIds.has(riskId) || this.context.repository.db.prepare("SELECT risk_id FROM risks WHERE risk_id = ?").get(riskId)) {
          throw this.context.error(
            "candidate.risk_exists",
            `Candidate 使用了重复或已存在的 Risk ID: ${riskId}`,
          );
        }
        proposedRiskIds.add(riskId);
      }
    }
  }
}
