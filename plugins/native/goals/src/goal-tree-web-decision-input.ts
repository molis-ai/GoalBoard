import { randomUUID } from "node:crypto";
import type { GoalsQueryApi, RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalTreeProposalItemInput, GoalTreeProposalItemDecisionInput, GoalTreeProposalDecideInput } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { goalTreeProposalDecompositionIssues } from "@adeptify/goalboard-module-goals";
import { goalTreeProposalItemValidationIssues } from "./proposal-item-validation.js";
import type { GoalTreeQueryApplication } from "./goal-tree-query.js";

/** Prepare existing Web choices without authorizing or persisting a decision. */
export class GoalTreeWebDecisionInput {
  constructor(private readonly ports: { query: GoalTreeQueryApplication; goals: Pick<GoalsQueryApi, "snapshot"> }) {}

  prepareRiskRepair(boardId: string, proposalId: string, body: {
    risk_repairs: unknown[]; reason?: unknown;
  }): { error: string } | { decisions: GoalTreeProposalItemDecisionInput[]; reason: string } {
    const proposal = this.ports.query.listGoalTreeProposals({
      board_id: boardId,
      proposal_id: proposalId,
      include_legacy: false,
    }).proposals[0];
    if (!proposal || (proposal.state !== "pending" && proposal.state !== "partially_applied")) {
      return { error: "这份方案已经变化，请刷新后重新处理" };
    }
    if (proposal.items.some((item) => item.state === "conflict")) {
      return { error: "这份方案和当前 GoalBoard 状态有冲突，请先让 Runtime 更新方案" };
    }
    const pendingItems = proposal.items.filter((item) => item.state === "pending");
    const allowedTreatments = new Set<RiskRecord["treatment"]>(["accept", "mitigate", "avoid", "defer"]);
    const repairMap = new Map<string, { treatment: RiskRecord["treatment"]; treatment_plan?: string }>();
    for (const raw of body.risk_repairs) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { error: "风险处理选择格式无效" };
      }
      const value = raw as Record<string, unknown>;
      const itemId = String(value.item_id ?? "").trim();
      const treatment = String(value.treatment ?? "") as RiskRecord["treatment"];
      if (!itemId || !allowedTreatments.has(treatment) || repairMap.has(itemId)) {
        return { error: "每条风险都必须且只能选择一种处理方式" };
      }
      repairMap.set(itemId, {
        treatment,
        ...(Object.prototype.hasOwnProperty.call(value, "treatment_plan")
          ? { treatment_plan: String(value.treatment_plan ?? "").trim() }
          : {}),
      });
    }
    if (!repairMap.size) {
      return { error: "请至少选择一条风险的处理方式" };
    }
    for (const [itemId] of repairMap) {
      const item = pendingItems.find((candidate) => candidate.item_id === itemId);
      if (!item || item.kind !== "risk") {
        return { error: "要修订的风险已经变化，请刷新后重试" };
      }
    }
    const invalidTreatmentItems = pendingItems.filter((item) =>
      item.kind === "risk" && !allowedTreatments.has(String(item.payload.treatment ?? "") as RiskRecord["treatment"]));
    if (invalidTreatmentItems.some((item) => !repairMap.has(item.item_id))) {
      return { error: "请为页面列出的每条风险选择处理方式" };
    }
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "用户在决定中心为方案中的风险选择处理方式，并确认保留或修改具体措施。";
    const revisionDecisions = pendingItems.map((item) => {
      const repair = repairMap.get(item.item_id);
      const previousTreatment = String(item.payload.treatment ?? "").trim();
      const previousPlan = String(item.payload.treatment_plan ?? "").trim()
        || (allowedTreatments.has(previousTreatment as RiskRecord["treatment"]) ? "" : previousTreatment);
      const payload = repair
        ? {
            ...item.payload,
            treatment: repair.treatment,
            treatment_plan: repair.treatment_plan ?? previousPlan,
          }
        : { ...item.payload };
      const revisedItem: GoalTreeProposalItemInput = {
        item_id: `${item.item_id}-web-v${proposal.version + 1}-${randomUUID().slice(0, 8)}`,
        kind: item.kind,
        operation: item.operation,
        payload,
        source_refs: [...item.source_refs, `web-risk-repair:${proposal.proposal_id}`],
        reason: item.reason,
        confidence: item.confidence,
        affected_objects: item.affected_objects,
        requires_user_confirmation: true,
        supersedes_item_id: item.item_id,
      };
      return {
        item_id: item.item_id,
        decision: "revise" as const,
        reason,
        revised_item: revisedItem,
      };
    });
    return { decisions: revisionDecisions, reason };
  }

  prepareDecision(boardId: string, proposalId: string, body: Record<string, unknown>) {
    let decisions = body.decisions as GoalTreeProposalDecideInput["decisions"];
    let decisionReason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (Array.isArray(decisions) && decisions.length > 0 && decisions.every((decision) => decision.decision === "reject")) {
      const proposal = this.ports.query.listGoalTreeProposals({
        board_id: boardId,
        proposal_id: proposalId,
        include_legacy: false,
      }).proposals[0];
      const undecidedItems = proposal?.items.filter((item) => item.state === "pending" || item.state === "conflict") ?? [];
      const submittedIds = new Set(decisions.map((decision) => decision.item_id));
      const rejectsWholeOpenProposal = undecidedItems.length > 0 &&
        submittedIds.size === undecidedItems.length &&
        undecidedItems.every((item) => submittedIds.has(item.item_id));
      if (proposal && rejectsWholeOpenProposal) {
        const systemProblems = [
          ...undecidedItems.flatMap((item) => goalTreeProposalItemValidationIssues(item).map((issue) => issue.message)),
          ...goalTreeProposalDecompositionIssues(undecidedItems, this.ports.goals.snapshot(boardId)).map((issue) => issue.message),
          ...(undecidedItems.some((item) => item.state === "conflict")
            ? [`这份方案有 ${undecidedItems.filter((item) => item.state === "conflict").length} 项已和当前 GoalBoard 状态不一致。`]
            : []),
        ];
        const uniqueProblems = [...new Set(systemProblems)];
        if (uniqueProblems.length > 0) {
          const automaticReason = `GoalBoard 自动退回修正：${uniqueProblems.join("；")}`;
          decisionReason = decisionReason
            ? `${automaticReason}；用户补充：${decisionReason}`
            : automaticReason;
          decisions = decisions.map((decision) => ({ ...decision, reason: decisionReason }));
        }
      }
    }
    return { decisions, decisionReason };
  }
}
