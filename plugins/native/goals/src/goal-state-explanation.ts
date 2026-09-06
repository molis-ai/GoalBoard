import type { GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalPresentationState } from "./tree-order.js";
import { WORK_STATE_COPY, type WorkStateExplanation } from "./goal-state-copy.js";
export type GoalStatusTranslate = (text: string, values?: Record<string, string | number>) => string;
export interface ParentCompletionExplanation {
    label: string;
    meaning: string;
    tone: "automatic" | "needs_confirmation" | "conflict";
}
export function createGoalStateExplainer(L: GoalStatusTranslate) {
    function explainWorkState(state: GoalPresentationState): WorkStateExplanation {
        const copy = WORK_STATE_COPY[state];
        return {
            label: L(copy.label),
            meaning: L(copy.meaning),
            nextAction: L(copy.nextAction),
            howToContinue: L(copy.howToContinue),
            actionKind: copy.actionKind,
        };
    }
    function explainParentCompletion(goal: Pick<GoalRecord, "definition_state" | "decomposition_state" | "decomposition_review" | "fulfillment_state">, completedChildren: number, totalChildren: number): ParentCompletionExplanation {
        if (goal.definition_state === "accepted" && goal.decomposition_state === "closed_compound") {
            const contractCoverage = goal.decomposition_review?.contract_coverage;
            const incompleteContractCoverage = contractCoverage != null && [
                ...contractCoverage.promised_outputs,
                ...contractCoverage.acceptance_criteria,
            ].some((entry) => entry.status !== "complete");
            if (incompleteContractCoverage) {
                return {
                    label: L("父级 Contract 仍有覆盖缺口"),
                    meaning: L("现有子 Goal 的完成数量不足以证明父级承诺已经实现；部分覆盖或仍需父级集成时，这条父 Goal 不会自动完成。"),
                    tone: "needs_confirmation",
                };
            }
            return goal.fulfillment_state === "satisfied"
                ? {
                    label: L("父 Goal 已自动完成"),
                    meaning: L("所有子 Goal 都已完成，这条父 Goal 也已自动完成。"),
                    tone: "automatic",
                }
                : {
                    label: L("子 Goal 完成后自动完成"),
                    meaning: L("还剩 {count} 个子 Goal；全部完成后，这条父 Goal 会自动完成。", {
                        count: Math.max(0, totalChildren - completedChildren),
                    }),
                    tone: "automatic",
                };
        }
        if (goal.decomposition_state === "abstract" || goal.decomposition_state === "frontier_open") {
            return completedChildren === totalChildren
                ? {
                    label: L("现有子 Goal 已完成，父目标待确认"),
                    meaning: L("当前列出的子 Goal 都完成了，但拆分还没有确认结束。先确认它们是否已经覆盖整个父目标。"),
                    tone: "needs_confirmation",
                }
                : {
                    label: L("当前拆分尚未确认结束"),
                    meaning: L("先推进现有子 Goal；完成后仍要确认是否还有遗漏，父 Goal 不会自动完成。"),
                    tone: "needs_confirmation",
                };
        }
        return {
            label: L("父子结构需要确认"),
            meaning: L("这条 Goal 被标记为可以独立完成，却同时包含子 Goal。先确认它应作为叶子，还是改为由子 Goal 共同完成。"),
            tone: "conflict",
        };
    }
    return { explainWorkState, explainParentCompletion };
}
