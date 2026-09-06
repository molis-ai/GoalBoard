import type { GoalTreeProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import { PRODUCT_PATH_AREA_LABELS, readDecompositionReview, readLeafReadiness, TASK_CONTEXT_LABELS, type ProductPathArea } from "@adeptify/goalboard-module-goals";
import { goalTreeRiskDescription } from "./proposal-item-validation.js";
import { GOALS_RELATION_LABELS as RELATION_LABELS } from "./relation-presentation.js";
import { RISK_TREATMENT_LABELS } from "./risk-presentation.js";
import { findGoalView, type GoalsProposalView, type GoalsProposalUiPrimitives } from "./proposal-ui-model.js";

export function createGoalsProposalPresentation(L: GoalsProposalUiPrimitives["translate"]) {
function proposedGoalName(
  value: unknown,
  view: GoalsProposalView,
  proposal?: GoalTreeProposalRecord,
): string {
  const goalId = String(value ?? "");
  if (!goalId) return L("未指明 Goal");
  const proposed = proposal?.items
    .filter((item) => item.kind === "goal" || item.kind === "contract" || item.kind === "candidate")
    .map((item) => goalTreeGoalPayload(item.payload))
    .find((goal) => String(goal.goal_id ?? "") === goalId);
  if (proposed?.title) return String(proposed.title);
  return findGoalView(view, goalId)?.goal.title ?? goalId;
}

function goalTreeGoalPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.goal ?? payload.proposed_goal;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : payload;
}

function goalTreeRelationPayloads(payload: Record<string, unknown>): Record<string, unknown>[] {
  const nested = payload.relations ?? payload.relation ?? payload.proposed_relations;
  const values = Array.isArray(nested) ? nested : nested == null ? [payload] : [nested];
  const proposedGoal = goalTreeGoalPayload(payload);
  const goalId = String(proposedGoal.goal_id ?? "").trim();
  return values
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    .map((relation) => ({
      ...relation,
      from_goal_id: relation.from_goal_id === "$new_goal" ? goalId : relation.from_goal_id,
      to_goal_id: relation.to_goal_id === "$new_goal" ? goalId : relation.to_goal_id,
    }));
}

function goalTreeProposalItemCopy(
  item: GoalTreeProposalRecord["items"][number],
  view: GoalsProposalView,
  proposal: GoalTreeProposalRecord,
): { title: string; detail: string; facts: string[] } {
  const payload = item.payload;
  const operation = item.operation === "create" ? L("新增") : item.operation === "deactivate" ? L("停止使用") : L("更新");
  if (item.kind === "contract" || item.kind === "goal") {
    const goal = goalTreeGoalPayload(payload);
    const title = String(goal.title ?? proposedGoalName(goal.goal_id, view));
    const outcome = String(goal.outcome ?? "").trim();
    const review = readDecompositionReview(goal.decomposition_review);
    const readiness = readLeafReadiness(goal.leaf_readiness);
    const readinessFacts = readiness == null
      ? []
      : [
          readiness.verdict === "ready"
            ? L("为什么可以直接执行：只交付并验收「{deliverable}」。", {
                deliverable: readiness.primary_deliverable || L("尚未写明主要结果"),
              })
            : L("这条 Goal 仍需继续拆分，不能直接开始。"),
          ...readiness.output_coverage.map((entry) => entry.role === "primary"
            ? L("主要结果：{output}。{reason}", { output: entry.promised_output, reason: entry.reason })
            : entry.role === "supporting"
              ? L("配套产物：{output}。{reason}", { output: entry.promised_output, reason: entry.reason })
              : L("需要另拆：{output}。{reason}", { output: entry.promised_output, reason: entry.reason })),
          ...readiness.split_candidates
            .filter((candidate) => candidate.decision === "keep")
            .map((candidate) => L("保留在当前 Goal：{work}。{reason}", {
              work: candidate.work_item,
              reason: candidate.reason,
            })),
        ];
    const reviewFacts = review == null
      ? []
      : [
          ...((review.method_pack_ids ?? []).length
            ? [L("规划方法：{methods}", { methods: review.method_pack_ids!.join("、") })]
            : []),
          ...(review.task_context == null
            ? []
            : [L("任务类型：{context}", { context: L(TASK_CONTEXT_LABELS[review.task_context]) })]),
          review.status === "complete"
            ? L("拆解判断：通用结果链和当前任务的必要路径已交代完整")
            : L("拆解判断：这轮先暂停，后面还要继续拆"),
          ...review.coverage.map((entry) => {
            const area = L(PRODUCT_PATH_AREA_LABELS[entry.area as ProductPathArea] ?? entry.area);
            if (entry.disposition === "not_applicable") {
              return L("{area}：不适用。{reason}", { area, reason: entry.reason });
            }
            const owners = entry.goal_ids
              .map((goalId) => proposedGoalName(goalId, view, proposal))
              .map((name) => `「${name}」`)
              .join("、");
            return L("{area}：由 {owners} 负责。{reason}", {
              area,
              owners: owners || L("尚未指定 Goal"),
              reason: entry.reason,
            });
          }),
          ...(review.status === "paused"
            ? [L("下一步：{nextStep}", { nextStep: review.next_step || L("尚未写明") })]
            : []),
        ];
    return {
      title: L("{operation} Goal「{title}」", { operation, title }),
      detail: outcome || item.reason,
      facts: [...readinessFacts, ...reviewFacts],
    };
  }
  if (item.kind === "relation" || item.kind === "dependency") {
    const relations = goalTreeRelationPayloads(payload);
    const facts = relations.map((relation) => {
      const from = proposedGoalName(relation.from_goal_id, view, proposal);
      const to = proposedGoalName(relation.to_goal_id, view, proposal);
      const relationLabel = RELATION_LABELS[String(relation.type ?? (item.kind === "dependency" ? "depends_on" : ""))]?.out ?? L("建立关系");
      return L("{from} → {relation} → {to}", { from, relation: L(relationLabel), to });
    });
    return {
      title: L("{operation} {count} 条 Goal 关系", { operation, count: facts.length || 1 }),
      detail: item.reason,
      facts,
    };
  }
  if (item.kind === "risk") {
    const description = goalTreeRiskDescription(item);
    const treatmentKey = String(payload.treatment ?? "") as RiskRecord["treatment"];
    const treatment = RISK_TREATMENT_LABELS[treatmentKey] ?? L("处理方式需要修正");
    const submittedPlan = String(payload.treatment_plan ?? "").trim()
      || (RISK_TREATMENT_LABELS[treatmentKey] ? "" : String(payload.treatment ?? "").trim());
    return {
      title: L("{operation}风险「{description}」", { operation, description }),
      detail: L("发生概率：{probability} · 影响：{impact} · 计划：{treatment}", {
        probability: String(payload.probability ?? L("未说明")),
        impact: String(payload.impact ?? L("未说明")),
        treatment: L(treatment),
      }),
      facts: submittedPlan ? [L("具体措施：{plan}", { plan: submittedPlan })] : [],
    };
  }
  if (item.kind === "candidate") {
    const goal = goalTreeGoalPayload(payload);
    const title = String(goal.title ?? goal.goal_id ?? L("未命名 Goal"));
    const candidateId = String(payload.candidate_id ?? "").trim();
    const relations = goalTreeRelationPayloads(payload);
    const relationFacts = relations.map((relation) => {
      const from = proposedGoalName(relation.from_goal_id, view, proposal);
      const to = proposedGoalName(relation.to_goal_id, view, proposal);
      const relationLabel = RELATION_LABELS[String(relation.type ?? "")]?.out ?? L("建立关系");
      return L("{from} → {relation} → {to}", { from, relation: L(relationLabel), to });
    });
    const bootstrapProposalId = String(payload.materialized_by_proposal_id ?? "").trim();
    return {
      title: item.operation === "update"
        ? L("晋升已有 Candidate 为 Goal「{title}」", { title })
        : L("新增 Candidate Goal「{title}」", { title }),
      detail: String(goal.outcome ?? item.reason),
      facts: [
        ...(candidateId ? [L("原 Candidate：{candidateId}", { candidateId })] : []),
        ...(bootstrapProposalId
          ? [L("对账已有 Goal，来源提案：{proposalId}", { proposalId: bootstrapProposalId })]
          : []),
        ...relationFacts,
      ],
    };
  }
  const kindLabels: Record<string, string> = {
    policy: L("执行和检查规则"),
    candidate: L("新发现的工作"),
    rewire: L("Goal 关系"),
  };
  return {
    title: L("{operation}{kind}", { operation, kind: kindLabels[item.kind] ?? item.kind }),
    detail: String(payload.description ?? payload.reason ?? item.reason),
    facts: [],
  };
}
return { proposedGoalName, goalTreeGoalPayload, goalTreeRelationPayloads, goalTreeProposalItemCopy };
}
