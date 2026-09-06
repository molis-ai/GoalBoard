import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { GoalsQueryApi, ImpactBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionClaimRole as ClaimRole } from "@adeptify/goalboard-contracts/modules/execution";

import type { PlanningMetric, GoalsApplicationApi } from "@adeptify/goalboard-contracts/modules/goals";
import type {
  ReadyGoal,
  AvailableGoal,
  BlockedAvailableGoal,
  BlockedAvailableOverview,
  ParallelExecutionSuggestion,
  ReadyQuery,
  ReadyQueryResult,
  AvailableQuery,
  AvailableQueryResult,
  ExplainGoalResult,
} from "./availability-contract.js";
import type { GoalAction, GoalWorkAction, GoalWorkStateView } from "./execution-validation-contract.js";
import { executionImpactPolicy } from "@adeptify/goalboard-module-execution";
import { deriveGoalActionProjection } from "./action-projection.js";
import { requiresParentCompletionConfirmation } from "./parent-completion.js";
import { snapshotEvaluationIndex, type SnapshotEvaluationIndex } from "./eligibility-index.js";
import type { GoalEligibility } from "./goal-eligibility.js";
import type { GoalWorkStateQueries } from "./work-state-queries.js";
import { compareExecutionValidationReasons as compareReasons } from "./execution-validation-support.js";
const CLAIMABLE_GOAL_ACTION_KINDS = new Set<GoalAction["kind"]>([
  "clarify",
  "execute",
  "submit_evidence",
  "review",
  "revalidate",
  "mitigate_risk",
]);

export interface GoalAvailabilityPorts {
 goals: GoalsQueryApi;
 planning: GoalsApplicationApi<unknown>["planning"];
 eligibility: GoalEligibility;
 workState: GoalWorkStateQueries;
 snapshot(boardId: string): BoardSnapshot;
 eventCursor(boardId: string): number;
 clock(): Date;
 requireBoard(boardId: string): void;
 getGoalWorkState(input: { board_id: string; goal_id: string }): GoalWorkStateView;
}
/** Runtime menu and explanations derived from the shared qualification rules. */
export class GoalAvailability {
  constructor(private readonly ports: GoalAvailabilityPorts) {}
  queryReady(input: ReadyQuery): ReadyQueryResult {
    this.ports.requireBoard(input.board_id);
    const now = this.ports.clock().toISOString();
    const role = input.role ?? "executor";
    const ready: ReadyGoal[] = [];
    for (const goal of this.ports.goals.listGoals(input.board_id)) {
      const evaluation = this.ports.eligibility.evaluate({
        boardId: input.board_id,
        goalId: goal.goal_id,
        actorId: input.actor_id,
        role,
        capabilities: input.capabilities ?? [],
        goalModeAttestation: input.goal_mode_attestation ?? false,
        now,
      });
      if (evaluation.reasons.length > 0 || !evaluation.goal) continue;
      ready.push({
        goal: evaluation.goal,
        role,
        why_now:
          role === "clarifier"
            ? "Goal 仍需要补齐定义、拆分或验收，现在可以开始澄清"
            : role === "revalidator"
              ? "Goal 的前提发生过变化，需要重新核对 Contract、依赖和风险后恢复可信状态"
            : "Goal 已定义清楚，依赖、风险、影响面和领取策略当前都允许开始",
        priority_hint: evaluation.goal.priority,
        dependency_summary: this.dependencySummary(input.board_id, goal.goal_id),
        risk_summary: this.riskSummary(goal.board_id, goal.goal_id),
        resolved_policy: evaluation.policy,
        relevant_surfaces: evaluation.surfaces,
      });
    }
    ready.sort(
      (left, right) =>
        right.priority_hint - left.priority_hint || left.goal.goal_id.localeCompare(right.goal.goal_id),
    );
    return { observed_event_cursor: this.ports.eventCursor(input.board_id), ready };
  }

  queryAvailable(input: AvailableQuery): AvailableQueryResult {
    this.ports.requireBoard(input.board_id);
    const now = this.ports.clock().toISOString();
    const snapshot = this.ports.snapshot(input.board_id);
    const snapshotIndex = snapshotEvaluationIndex(snapshot);
    const policyRows = this.ports.goals.listActivePolicyBindings(input.board_id);
    const metrics = this.ports.planning.metrics(snapshot.goals, snapshot.relations);
    const available: AvailableGoal[] = [];
    const blocked: BlockedAvailableGoal[] = [];
    const blockedOverview: BlockedAvailableOverview[] = [];
    for (const goal of snapshot.goals) {
      const actionProjection = deriveGoalActionProjection(goal, snapshot, now);
      const workState = this.ports.workState.deriveGoalWorkState(input.board_id, goal, snapshot, now);
      const runtimeReadyActions = actionProjection.actions.filter((candidate) =>
        candidate.actor === "runtime" &&
        candidate.status === "ready" &&
        CLAIMABLE_GOAL_ACTION_KINDS.has(candidate.kind)
      );
      if (
        (workState.work_state === "completion_blocked" && runtimeReadyActions.length === 0) ||
        workState.work_state === "waiting_for_human" ||
        workState.work_state === "replaced"
      ) {
        blocked.push({
          goal,
          work_state: workState.work_state,
          next_action: null,
          reasons: workState.work_state === "completion_blocked"
            ? this.ports.workState.executorHandoffReasons(workState)
            : workState.reasons,
          priority_hint: goal.priority,
          risk_summary: this.riskSummary(goal.board_id, goal.goal_id, snapshotIndex),
        });
      }
      if (
        workState.work_state === "clarification_blocked" ||
        workState.work_state === "waiting_children" ||
        workState.work_state === "execution_blocked" ||
        workState.work_state === "review_blocked" ||
        workState.work_state === "revalidation_blocked" ||
        workState.work_state === "invalidated"
      ) {
        blockedOverview.push({
          goal,
          work_state: workState.work_state,
          next_action: "explain",
          reasons: workState.reasons.map(({ code, message }) => ({ code, message })),
          priority_hint: goal.priority,
        });
      }
      const requiresParentConfirmation =
        workState.work_state === "clarification_pending" &&
        requiresParentCompletionConfirmation(goal, snapshot);
      for (const projectedAction of runtimeReadyActions) {
        const role = this.claimRoleForAction(projectedAction, snapshot);
        const legacyNextAction: GoalWorkAction = projectedAction.kind === "clarify"
          ? "clarify"
          : projectedAction.kind === "review"
            ? "review"
            : projectedAction.kind === "revalidate"
              ? "revalidate"
              : "execute";
        const evaluation = this.ports.eligibility.evaluate({
          boardId: input.board_id,
          goalId: goal.goal_id,
          actorId: input.actor_id,
          role,
          capabilities: input.capabilities ?? [],
          goalModeAttestation: input.goal_mode_attestation ?? false,
          now,
          snapshot,
          snapshot_index: snapshotIndex,
          policy_rows: policyRows,
        });
        if (projectedAction.kind === "mitigate_risk") {
          evaluation.reasons = evaluation.reasons.filter((item) =>
            !(item.subject_type === "risk" && item.subject_id === projectedAction.target_id)
          );
        }
        if (evaluation.reasons.length > 0 || !evaluation.goal) continue;
        available.push({
          goal: evaluation.goal,
          action_id: projectedAction.action_id,
          action_token: actionProjection.action_token,
          action_kind: projectedAction.kind,
          action_target_type: projectedAction.target_type,
          action_target_id: projectedAction.target_id,
          role,
          work_state: workState.work_state,
          next_action: legacyNextAction,
          review_obligation_id: projectedAction.kind === "review" ? projectedAction.target_id : null,
          requires_parent_confirmation: requiresParentConfirmation,
          why_now: requiresParentConfirmation
            ? "现有子 Goal 都已完成，但父 Goal 的拆分还没有确认结束；先和用户确认是否已经覆盖整个父目标，再决定收口或继续补充子 Goal"
            : projectedAction.reasons[0]?.message ?? (
              projectedAction.kind === "submit_evidence"
                ? "执行已经完成，当前 Runtime 可以补齐完成依据"
                : projectedAction.kind === "mitigate_risk"
                  ? "这项风险可以由当前 Runtime 按既定方案处理"
                  : this.workActionMessage(legacyNextAction)
            ),
          priority_hint: evaluation.goal.priority,
          dependency_summary: this.dependencySummary(input.board_id, goal.goal_id, snapshotIndex),
          risk_summary: this.riskSummary(goal.board_id, goal.goal_id, snapshotIndex),
          resolved_policy: evaluation.policy,
          relevant_surfaces: evaluation.surfaces,
          planning: {
            topological_level: metrics.get(goal.goal_id)?.topological_level ?? 0,
            unlock_count: metrics.get(goal.goal_id)?.unlock_count ?? 0,
            longest_downstream_chain: metrics.get(goal.goal_id)?.longest_downstream_chain ?? 0,
            rationale: this.planningRationale(metrics.get(goal.goal_id)),
          },
        });
      }
    }
    available.sort(
      (left, right) =>
        Number(right.requires_parent_confirmation) - Number(left.requires_parent_confirmation) ||
        right.planning.unlock_count - left.planning.unlock_count ||
        right.planning.longest_downstream_chain - left.planning.longest_downstream_chain ||
        left.planning.topological_level - right.planning.topological_level ||
        right.priority_hint - left.priority_hint ||
        left.goal.goal_id.localeCompare(right.goal.goal_id) ||
        (left.role ?? "").localeCompare(right.role ?? ""),
    );
    blocked.sort(
      (left, right) =>
        right.priority_hint - left.priority_hint || left.goal.goal_id.localeCompare(right.goal.goal_id),
    );
    blockedOverview.sort(
      (left, right) =>
        right.priority_hint - left.priority_hint || left.goal.goal_id.localeCompare(right.goal.goal_id),
    );
    return {
      observed_event_cursor: snapshot.cursor,
      available,
      blocked,
      blocked_overview: blockedOverview,
      parallel_suggestion: this.parallelExecutionSuggestion(available),
    };
  }

  explainGoal(input: ReadyQuery & { goal_id: string }): ExplainGoalResult {
    this.ports.requireBoard(input.board_id);
    const role = input.role ?? "executor";
    const evaluation = this.ports.eligibility.evaluate({
      boardId: input.board_id,
      goalId: input.goal_id,
      actorId: input.actor_id,
      role,
      capabilities: input.capabilities ?? [],
      goalModeAttestation: input.goal_mode_attestation ?? false,
      now: this.ports.clock().toISOString(),
    });
    const workState = this.ports.getGoalWorkState({ board_id: input.board_id, goal_id: input.goal_id });
    const completionReasons = role === "executor"
      ? this.ports.workState.executorHandoffReasons(workState)
      : workState.work_state === "waiting_for_human" &&
          (role === "self_verifier" || role === "cross_reviewer" || role === "adversarial_reviewer")
        ? workState.reasons
        : [];
    const reasons = [...evaluation.reasons, ...completionReasons]
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) =>
              candidate.code === item.code &&
              candidate.subject_type === item.subject_type &&
              candidate.subject_id === item.subject_id,
          ) === index,
      )
      .sort(compareReasons);
    return {
      goal: evaluation.goal,
      role,
      ready: reasons.length === 0 && evaluation.goal !== null,
      observed_event_cursor: this.ports.eventCursor(input.board_id),
      reasons,
      resolved_policy: evaluation.policy,
      relevant_surfaces: evaluation.surfaces,
    };
  }

  private workActionMessage(action: GoalWorkAction): string {
    switch (action) {
      case "clarify":
        return "这条 Goal 仍有会影响范围、拆分或验收的未知项，当前 Runtime 可以继续对话澄清";
      case "revalidate":
        return "前提发生变化，当前 Runtime 可以重新核对 Contract、依赖和风险";
      case "review":
        return "执行结果正在等待所需 Review，当前 Runtime 可以按其角色复核";
      case "execute":
        return "Goal 已澄清为最小闭环，当前 Runtime 可以选择并开始执行";
      case "complete":
        return "执行、证据和复核已经完成；现在应直接重试完成判定，不要开始新的执行";
    }
  }

  claimRoleForAction(candidate: GoalAction, snapshot: BoardSnapshot): ClaimRole {
    if (candidate.kind === "clarify") return "clarifier";
    if (candidate.kind === "revalidate") return "revalidator";
    if (candidate.kind === "review") {
      const obligation = snapshot.review_obligations.find(
        (item) => item.obligation_id === candidate.target_id,
      );
      if (obligation && obligation.role !== "human_approver") return obligation.role;
    }
    return "executor";
  }

  private planningRationale(metric: PlanningMetric | undefined): string {
    const unlocks = metric?.unlock_count ?? 0;
    const chain = metric?.longest_downstream_chain ?? 0;
    if (unlocks > 0) {
      return `完成后可解锁 ${unlocks} 个尚未完成的下游 Goal；最长后续链路 ${chain} 层`;
    }
    if ((metric?.topological_level ?? 0) === 0) {
      return "当前没有未完成的前置产出阻挡，可以独立推进";
    }
    return `当前位于依赖图第 ${metric?.topological_level ?? 0} 层，前置产出已经满足`;
  }

  private parallelExecutionSuggestion(
    available: AvailableGoal[],
  ): ParallelExecutionSuggestion | null {
    const selected: Array<{ item: AvailableGoal; surfaces: ImpactBindingRecord[] }> = [];
    for (const item of available) {
      if (item.role !== "executor" || item.next_action !== "execute") continue;
      const surfaces = item.relevant_surfaces.filter((impact) => impact.state === "confirmed");
      if (surfaces.length === 0) continue;
      if (
        selected.some(
          (existing) => !executionImpactPolicy.allowsParallel(existing.surfaces, surfaces),
        )
      ) {
        continue;
      }
      selected.push({ item, surfaces });
    }
    if (selected.length < 2) return null;
    return {
      kind: "safe_parallel_execution",
      advisory_only: true,
      assignments: selected.map(({ item }, index) => ({
        runtime_slot: index === 0 ? "current_runtime" : `additional_runtime_${index}`,
        goal_id: item.goal.goal_id,
        title: item.goal.title,
        role: "executor",
        required_capabilities: item.resolved_policy.required_capabilities,
      })),
    };
  }

  private dependencySummary(
    boardId: string,
    goalId: string,
    snapshotIndex?: SnapshotEvaluationIndex,
  ): string[] {
    if (snapshotIndex) {
      return (snapshotIndex.dependencies_by_goal.get(goalId) ?? []).map((goal) => goal.title);
    }
    return this.ports.goals.listDependencies(boardId, goalId).map(goal => goal.title);
  }

  private riskSummary(boardId: string, goalId: string, snapshotIndex?: SnapshotEvaluationIndex): string[] {
    if (snapshotIndex) {
      return (snapshotIndex.risks_by_goal.get(goalId) ?? []).map((risk) => risk.description);
    }
    return this.ports.goals.listOpenGoalRisks(boardId, goalId).map(risk => risk.description);
  }
}
