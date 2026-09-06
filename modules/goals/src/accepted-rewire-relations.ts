import { randomUUID } from "node:crypto";
import type { GoalRelationType, GoalsCommandApi } from "@adeptify/goalboard-contracts/modules/goals";
import { goalRelationTypes } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalsCommandContext } from "./command-support.js";
import type { GoalLifecycleCommands } from "./lifecycle-commands.js";
import type { GoalsPlanningEngine } from "./planning/engine.js";

/** Legacy Rewire graph rules and writes; preserves the application's aggregate event. */
export class AcceptedRewireRelations {
  constructor(private readonly context: GoalsCommandContext,
    private readonly lifecycle: Pick<GoalLifecycleCommands<unknown>, "reopenSatisfiedCompoundParent" | "reconcileCompoundAncestors">,
    private readonly planning: Pick<GoalsPlanningEngine, "validateGraph" | "projectRelations" | "wouldCreatePartOfCycle">) {}

  apply(input: Parameters<GoalsCommandApi["applyAcceptedRewireRelations"]>[0]): ReturnType<GoalsCommandApi["applyAcceptedRewireRelations"]> {
    return this.context.repository.immediate(() => {
      const repository = this.context.repository;
      const added: string[] = [], deactivated: string[] = [];
      const addedPartOf: Array<{ from_goal_id: string; to_goal_id: string }> = [];
      const revalidated = new Set<string>();
      const validTypes = new Set<string>(goalRelationTypes);
      const goals = repository.listGoals(input.board_id), relations = repository.listRelations(input.board_id);
      const projected = input.relations.flatMap((relation, index) => {
        if (!relation.from_goal_id || !relation.to_goal_id || !validTypes.has(relation.type)) return [];
        const action = relation.action === "deactivate" ? "deactivate" as const : "add" as const;
        return [{ ...relation, action, type: relation.type as GoalRelationType,
          relation_id: action === "add" ? `rewire:${input.rewire_id}:${index}` : null }];
      });
      const baselineIssues = new Set(this.planning.validateGraph(goals, relations).map(issue => `${issue.code}:${issue.path.join("\u0000")}`));
      const projectedIssue = this.planning.validateGraph(goals, this.planning.projectRelations(relations, projected))
        .find(issue => !baselineIssues.has(`${issue.code}:${issue.path.join("\u0000")}`));
      if (projectedIssue) throw this.context.error(projectedIssue.code, projectedIssue.message);
      for (const relation of input.relations) {
        const { from_goal_id: fromGoalId, to_goal_id: toGoalId, type, action } = relation;
        if (!toGoalId || !validTypes.has(type)) throw this.context.error("rewire.relation_invalid", "Rewire 中的 Goal 关系不完整");
        this.context.requireGoal(input.board_id, fromGoalId);
        this.context.requireGoal(input.board_id, toGoalId);
        if (fromGoalId === toGoalId) throw this.context.error("rewire.relation_invalid", "Rewire 不能让 Goal 依赖或归属于自身");
        if (action === "deactivate") {
          if (type !== "depends_on") throw this.context.error("rewire.action_invalid", "当前只支持通过 Rewire 停用 depends_on 关系");
          const rows = repository.db.prepare(`SELECT relation_id FROM goal_relations
            WHERE board_id = ? AND from_goal_id = ? AND to_goal_id = ? AND type = 'depends_on' AND state = 'active'
            ORDER BY relation_id`).all(input.board_id, fromGoalId, toGoalId) as Array<{ relation_id: string }>;
          if (!rows.length) throw this.context.error("rewire.dependency_not_active", "要停用的依赖已经不再生效，请重新检查后提交 Proposal");
          for (const row of rows) {
            repository.db.prepare("UPDATE goal_relations SET state = 'inactive', deactivated_at = ? WHERE relation_id = ?").run(input.at, row.relation_id);
            deactivated.push(row.relation_id);
          }
        } else if (action === "add") {
          this.context.requireNonTrashedGoal(input.board_id, fromGoalId);
          this.context.requireNonTrashedGoal(input.board_id, toGoalId);
          if (type === "part_of" && this.planning.wouldCreatePartOfCycle(input.board_id, fromGoalId, toGoalId)) {
            throw this.context.error("rewire.part_of_cycle", "Rewire 会形成循环父子关系，请先调整拆分方向");
          }
          const existing = repository.db.prepare(`SELECT relation_id FROM goal_relations
            WHERE board_id = ? AND from_goal_id = ? AND to_goal_id = ? AND type = ? AND state = 'active' LIMIT 1`)
            .get(input.board_id, fromGoalId, toGoalId, type);
          if (existing) throw this.context.error("rewire.relation_already_active", "这条关系已经生效，请重新检查后提交 Proposal");
          const id = `relation-${randomUUID()}`;
          repository.db.prepare(`INSERT INTO goal_relations (
            relation_id, board_id, from_goal_id, to_goal_id, type, state, reason, created_by, created_at, deactivated_at
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL)`).run(id, input.board_id, fromGoalId, toGoalId, type, relation.reason, input.actor_id, input.at);
          added.push(id);
          if (type === "part_of") addedPartOf.push(relation);
        } else throw this.context.error("rewire.action_invalid", "Rewire action 必须是 add 或 deactivate");
        if (fromGoalId !== input.formal_goal_id) revalidated.add(fromGoalId);
      }
      for (const relation of addedPartOf) {
        if (!this.lifecycle.reopenSatisfiedCompoundParent(input.board_id, relation.to_goal_id, input.actor_id, input.at)) {
          this.lifecycle.reconcileCompoundAncestors(input.board_id, relation.from_goal_id, input.actor_id, input.at);
        }
      }
      return { added_relation_ids: added, deactivated_relation_ids: deactivated, revalidated_goal_ids: [...revalidated] };
    });
  }
}
