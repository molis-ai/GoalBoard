import type { GoalsQueryApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceDecisionApi, GoalTreeProposalItemRecord, ProposalAffectedObject } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { GoalTreeFactMaterializer } from "./goal-tree-fact-materializer.js";
import { GoalTreeGovernanceMaterializer } from "./goal-tree-governance-materializer.js";
import { GoalTreeMaterializationConflicts } from "./goal-tree-materialization-conflicts.js";
import { goalTreeMaterializationGroups } from "./goal-tree-materialization-order.js";

interface MaterializationError extends Error { code: string; details?: Record<string, unknown> }

/** Preview and confirmation consume the same materializers; preview never commits their changes. */
export class GoalTreeMaterializationApplication {
  constructor(private readonly ports: {
    goals: Pick<GoalsQueryApi, "getGoal">;
    transactions: Pick<GovernanceDecisionApi, "previewMaterialization" | "previewMaterializationItem">;
    facts: GoalTreeFactMaterializer;
    governance: GoalTreeGovernanceMaterializer;
    conflicts: GoalTreeMaterializationConflicts;
    isDomainError: (error: unknown) => error is MaterializationError;
  }) {}

  preflight(boardId: string, items: GoalTreeProposalItemRecord[], actorId: string, at: string): Map<string, Record<string, unknown>> {
    const conflicts = new Map<string, Record<string, unknown>>();
    const groups = goalTreeMaterializationGroups(boardId, items, this.ports.goals);
    return this.ports.transactions.previewMaterialization(() => {
      for (const group of groups) {
        for (const item of group) {
          try {
            this.ports.transactions.previewMaterializationItem(() => {
              const conflict = this.ports.conflicts.read(boardId, item);
              if (conflict) {
                conflicts.set(item.item_id, { ...conflict, recovery: conflict.recovery ?? this.recovery(conflict) });
                return { keep: false, value: undefined };
              }
              this.materialize(boardId, item, actorId, "Goal Tree 提案只读预检", at);
              return { keep: true, value: undefined };
            });
          } catch (error) {
            if (!this.ports.isDomainError(error)) throw error;
            conflicts.set(item.item_id, { code: error.code, message: error.message, ...(error.details ?? {}),
              recovery: this.recovery({ code: error.code }) });
          }
        }
      }
      return conflicts;
    });
  }

  recovery(conflict: Record<string, unknown>): string {
    return String(conflict.code ?? "").startsWith("goal.accepted_")
      ? "已接受 Goal 的需求变化必须使用同一 Goal ID 的 native contract-update revision；关系、Impact 和 Risk 变化另列显式条目。当前 Goal Tree 尚未改变。"
      : "请先运行 goal_tree_check 并修订这个条目，再让用户决定整份提案。当前 Goal Tree 尚未改变。";
  }

  materialize(boardId: string, item: GoalTreeProposalItemRecord, actorId: string, reason: string, at: string): ProposalAffectedObject[] {
    switch (item.kind) {
      case "goal":
      case "contract": return [this.ports.facts.materializeGoalTreeGoal(boardId, item, actorId, reason, at)];
      case "relation":
      case "dependency": return this.ports.facts.materializeGoalTreeRelations(boardId, item, actorId, reason, at);
      case "policy": return [this.ports.facts.materializeGoalTreePolicy(boardId, item, actorId, reason, at)];
      case "risk": return [this.ports.facts.materializeGoalTreeRisk(boardId, item, actorId, reason, at)];
      case "candidate": return this.ports.governance.materializeCandidate(boardId, item, actorId, reason, at);
      case "rewire": return this.ports.governance.materializeRewire(boardId, item, actorId, reason, at);
    }
  }
}
