import type { GoalTreeProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { PRODUCT_PATH_AREA_LABELS, type ProductPathArea, type GoalDecompositionValidationIssue } from "@adeptify/goalboard-module-goals";
import { goalTreeProposalItemValidationIssues } from "./proposal-item-validation.js";
import { createGoalsProposalPresentation } from "./proposal-presentation.js";
import type { GoalsProposalView, GoalsProposalUiPrimitives } from "./proposal-ui-model.js";

export function createGoalsProposalIssueCopy(L: GoalsProposalUiPrimitives["translate"]) {
const { proposedGoalName } = createGoalsProposalPresentation(L);
function goalTreeProposalIssueCopy(
  issue: ReturnType<typeof goalTreeProposalItemValidationIssues>[number],
): { message: string; recovery: string } {
  switch (issue.field) {
    case "goal_ids":
      return {
        message: L("这条风险没有关联任何 Goal。"),
        recovery: L("请退回方案，让 Runtime 补充关联 Goal 后重新提交。"),
      };
    case "risk_facts":
      return {
        message: L("这条风险缺少：{fields}。", { fields: (issue.missing_fields ?? []).map((field) => L(field)).join("、") }),
        recovery: L("请退回方案，让 Runtime 补全后重新提交。"),
      };
    case "treatment":
      return {
        message: L("“处理方式”必须选择“接受风险、降低风险、避开风险、延后处理”之一，不能填写一整段处理措施。"),
        recovery: L("请在下方选择处理方式；原来的整段文字已保留为具体措施。"),
      };
    case "blocking_mode":
      return {
        message: L("“对 Goal 的影响”不是 GoalBoard 支持的选项。"),
        recovery: L("请退回方案，让 Runtime 重新选择是否阻止开始、完成或在发生时让 Goal 失效。"),
      };
    case "state":
      return {
        message: L(issue.message),
        recovery: L(issue.recovery),
      };
    case "resolution_basis":
      return {
        message: L("这条风险要标记为已解决，但没有留下完整的解决依据。"),
        recovery: L("请补充解决摘要、至少一条证据引用，并明确是否还有剩余缺口。"),
      };
  }
}

function goalTreeDecompositionIssueCopy(
  issue: GoalDecompositionValidationIssue,
  view: GoalsProposalView,
  proposal: GoalTreeProposalRecord,
): { message: string; recovery: string } {
  const goal = proposedGoalName(issue.goal_id, view, proposal);
  switch (issue.code) {
    case "goal_tree_proposal.leaf_readiness_required":
      return {
        message: L("Goal「{goal}」还没有说明唯一要交付的结果，也没有检查哪些工作应该另拆。", { goal }),
        recovery: L("请退回方案，让 Runtime 补充叶子粒度判断后重新提交。"),
      };
    case "goal_tree_proposal.leaf_readiness_invalid":
      return {
        message: L("Goal「{goal}」没有说清它已经可以直接执行，还是仍需继续拆分。", { goal }),
        recovery: L("请让 Runtime 给出明确结论和判断理由。"),
      };
    case "goal_tree_proposal.leaf_scope_incomplete":
      return {
        message: L("Goal「{goal}」还缺少：{fields}。", {
          goal,
          fields: (issue.missing_fields ?? []).join("、"),
        }),
        recovery: L("请先把边界和输入输出写清楚，再判断它能否直接执行。"),
      };
    case "goal_tree_proposal.leaf_output_coverage_invalid":
      return {
        message: L("Goal「{goal}」没有逐项说明每个承诺结果是主要结果、配套产物，还是应当另拆。", { goal }),
        recovery: L("请让 Runtime 按现有承诺结果逐项补全，不能遗漏或重复。"),
      };
    case "goal_tree_proposal.leaf_primary_output_invalid":
      return {
        message: L("Goal「{goal}」没有确定唯一的主要交付结果。", { goal }),
        recovery: L("请只保留一个主要结果；其他结果只能是同一次验收的配套产物。"),
      };
    case "goal_tree_proposal.leaf_split_candidate_invalid":
      return {
        message: L("Goal「{goal}」有候选工作没有说明要留在当前 Goal，还是拆成独立 Goal。", { goal }),
        recovery: L("请让 Runtime 逐项写明判断和理由。"),
      };
    case "goal_tree_proposal.leaf_split_signal_ignored":
      return {
        message: L("Goal「{goal}」仍包含可单独交付、单独验收或独立返工的工作：{items}。", {
          goal,
          items: (issue.affected_work_items ?? []).join("、"),
        }),
        recovery: L("这些工作至少命中两项拆分信号，必须成为独立 Goal。"),
      };
    case "goal_tree_proposal.leaf_split_verdict_required":
      return {
        message: L("Goal「{goal}」已经指出有工作需要另拆，却仍把整条 Goal 判断为可以直接执行。", { goal }),
        recovery: L("请把结论改为仍需拆分，并提交对应的独立 Goal。"),
      };
    case "goal_tree_proposal.leaf_not_ready":
      return {
        message: L("Goal「{goal}」还有未解决的决定或应当拆出的独立结果，暂时不能直接执行。", { goal }),
        recovery: L("请继续澄清或拆分，处理完后再提交。"),
      };
    case "goal_tree_proposal.leaf_acceptance_evidence_required":
      return {
        message: L("Goal「{goal}」有完成条件没有写清需要什么依据。", { goal }),
        recovery: L("请为每条完成条件补充唯一标识和所需依据。"),
      };
    case "goal_tree_proposal.leaf_acceptance_coverage_invalid":
      return {
        message: L("Goal「{goal}」的叶子判断没有覆盖全部完成条件。", { goal }),
        recovery: L("请逐项引用当前 Goal 的全部完成条件，不能遗漏或引用其他 Goal。"),
      };
    case "goal_tree_proposal.decomposition_review_required":
      return {
        message: L("Goal「{goal}」还没有说明这项任务真正完成需要哪些结果和支撑。", { goal }),
        recovery: L("请退回方案，让 Runtime 补充每条路径由哪个 Goal 负责。"),
      };
    case "goal_tree_proposal.decomposition_review_invalid":
      return {
        message: L("Goal「{goal}」没有说清这棵树是已经拆完，还是这轮先暂停。", { goal }),
        recovery: L("请退回方案，让 Runtime 明确当前状态和下一步。"),
      };
    case "goal_tree_proposal.contract_coverage_required":
      return {
        message: L("Goal「{goal}」还没有逐项说明父级承诺由哪些子 Goal Contract 覆盖。", { goal }),
        recovery: L("请退回方案，让 Runtime 补充父级结果和完成条件到子 Contract 的明确映射。"),
      };
    case "goal_tree_proposal.contract_coverage_incomplete":
      return {
        message: L("Goal「{goal}」仍有父级承诺或完成条件只是部分覆盖、尚未覆盖，或仍需父级集成。", { goal }),
        recovery: L("请继续保持父 Goal 开放，直到每一项都由子 Contract 完整覆盖。"),
      };
    case "goal_tree_proposal.contract_coverage_reference_invalid":
      return {
        message: L("Goal「{goal}」的覆盖映射引用了不存在、不是后代或名称不匹配的子级结果。", { goal }),
        recovery: L("请引用当前子树中真实存在的 Goal ID、承诺结果和完成条件 ID。"),
      };
    case "goal_tree_proposal.product_path_incomplete":
      return {
        message: L("Goal「{goal}」还没有交代：{areas}。", {
          goal,
          areas: (issue.missing_areas ?? [])
            .map((area) => L(PRODUCT_PATH_AREA_LABELS[area as ProductPathArea] ?? area))
            .join("、"),
        }),
        recovery: L("请让 Runtime 指定负责的 Goal，或说明为什么不适用。"),
      };
    case "goal_tree_proposal.product_path_entry_invalid":
    case "goal_tree_proposal.product_path_owner_required":
      return {
        message: L("Goal「{goal}」有关键路径没有写清由谁负责。", { goal }),
        recovery: L("请让 Runtime 指定一个实际承担结果的子 Goal，或说明为什么不适用。"),
      };
    case "goal_tree_proposal.product_path_owner_unrelated":
      return {
        message: L("Goal「{goal}」把一条关键路径交给了不属于这棵子树的 Goal。", { goal }),
        recovery: L("请让 Runtime 补上正确的父子关系，或改为真正负责的子 Goal。"),
      };
    case "goal_tree_proposal.foundation_dependency_required":
      return {
        message: L("Goal「{goal}」的核心能力与基础能力之间缺少依赖：{owners}。", {
          goal,
          owners: (issue.affected_work_items ?? []).map((owner) => proposedGoalName(owner, view, proposal)).join("、"),
        }),
        recovery: L("请补上“核心能力 Goal 依赖基础能力 Goal”的关系，并说明依赖原因。"),
      };
    case "goal_tree_proposal.decomposition_pause_invalid":
      return {
        message: L("Goal「{goal}」说这轮先暂停，但没有留下继续拆解的 Goal 和下一步。", { goal }),
        recovery: L("请让 Runtime 写明接下来继续澄清哪条 Goal、要确认什么。"),
      };
    case "goal_tree_proposal.decomposition_not_complete":
      return {
        message: L("Goal「{goal}」还有未完成的拆解，不能标记为已经拆完。", { goal }),
        recovery: L("请继续拆解，或把这轮明确保存为阶段性暂停。"),
      };
    case "goal_tree_proposal.compound_children_required":
      return {
        message: L("Goal「{goal}」下面还没有实际子 Goal，不能称为复合目标。", { goal }),
        recovery: L("请先添加能独立推进的子 Goal。"),
      };
    case "goal_tree_proposal.open_descendants": {
      const openGoals = (issue.open_goal_ids ?? []).map((goalId) => proposedGoalName(goalId, view, proposal));
      return {
        message: L("Goal「{goal}」下面仍有 {count} 条目标没拆完：{openGoals}。", {
          goal,
          count: openGoals.length,
          openGoals: openGoals.join("、"),
        }),
        recovery: L("请继续拆这些目标，或把父 Goal 保持为“仍需拆分”。"),
      };
    }
    default:
      return { message: issue.message, recovery: issue.recovery };
  }
}
return { goalTreeProposalIssueCopy, goalTreeDecompositionIssueCopy };
}
