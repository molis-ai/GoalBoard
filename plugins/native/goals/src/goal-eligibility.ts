import { GoalBoardV1Error } from "./errors.js";
import type { BoardSnapshot } from "./goal-entry-contract.js";
import type {
  GoalRecord,
  GoalPolicy,
  GoalPolicyBindingRecord,
  GoalsQueryApi,
  ImpactBindingRecord,
  GoalLifecycleReason as DecisionReason,
} from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionQueryApi, ExecutionClaimRole as ClaimRole } from "@adeptify/goalboard-contracts/modules/execution";
import type { GovernanceApplicationApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { resolveGoalPolicy } from "@adeptify/goalboard-module-goals";
import { executionImpactPolicy } from "@adeptify/goalboard-module-execution";
import { deriveGoalActionProjection } from "./action-projection.js";
import { goalNeedsDefinitionClarification, goalNeedsCoverageClarification } from "./clarification-policy.js";
import { activeGoalReplacement, goalReplacedReason } from "./goal-replacement-query.js";
import { snapshotEvaluationIndex, type SnapshotEvaluationIndex } from "./eligibility-index.js";
import { executionValidationReason as reason, compareExecutionValidationReasons as compareReasons } from "./execution-validation-support.js";
function asText(value: unknown): string { return value == null ? "" : String(value); }
export interface EvaluationInput {
  boardId: string;
  goalId: string;
  actorId: string;
  role: ClaimRole;
  capabilities: string[];
  goalModeAttestation: boolean;
  strengthenPolicy?: Partial<GoalPolicy>;
  now: string;
  snapshot?: BoardSnapshot;
  snapshot_index?: SnapshotEvaluationIndex;
  policy_rows?: GoalPolicyBindingRecord[];
}

export interface Evaluation {
  goal: GoalRecord | null;
  reasons: DecisionReason[];
  policy: GoalPolicy;
  surfaces: ImpactBindingRecord[];
}

export interface GoalEligibilityPorts {
  goals: GoalsQueryApi;
  execution: ExecutionQueryApi;
  governance: GovernanceApplicationApi["query"];
  snapshot(boardId: string): BoardSnapshot;
}
/** Shared qualification rules for reads and atomic Claim acquisition. */
export class GoalEligibility {
   constructor(private readonly ports: GoalEligibilityPorts) {}
  assertRunStartAllowed(boardId: string, goalId: string): void {
    const goal = this.ports.goals.getGoal(boardId, goalId);
    if (!goal || goal.board_id !== boardId || goal.validity_state === "invalidated") {
      throw new GoalBoardV1Error("goal.invalidated", "Goal 已失效，不能开始 Run");
    }
    if (goal.trashed_at) {
      throw new GoalBoardV1Error("goal.trashed", "回收站中的 Goal 不能开始 Run");
    }
  }

  evaluate(input: EvaluationInput): Evaluation {
    const snapshotIndex = input.snapshot_index ?? (
      input.snapshot ? snapshotEvaluationIndex(input.snapshot) : undefined
    );
    const goal = snapshotIndex
      ? snapshotIndex.goals_by_id.get(input.goalId) ?? null
      : this.ports.goals.getGoal(input.boardId, input.goalId);
    const policy = this.resolvePolicy(
      input.boardId,
      input.goalId,
      input.strengthenPolicy,
      input.policy_rows,
    );
    const surfaces = snapshotIndex
      ? snapshotIndex.impacts_by_goal.get(input.goalId) ?? []
      : this.goalImpacts(input.boardId, input.goalId, input.snapshot);
    const reasons: DecisionReason[] = [];
    if (!goal || goal.board_id !== input.boardId) {
      reasons.push(reason("goal.not_found", "goal", input.goalId, "找不到这个 Goal"));
      return { goal: null, reasons, policy, surfaces };
    }
    if (goal.trashed_at) {
      reasons.push(
        reason(
          "goal.trashed",
          "goal",
          goal.goal_id,
          "Goal 已移入回收站，当前不接受新的 Runtime 工作",
          { trashed_at: goal.trashed_at },
          "由用户恢复后再查询 Ready",
        ),
      );
    }
    if (goal.archived_at) {
      reasons.push(
        reason(
          "goal.archived",
          "goal",
          goal.goal_id,
          "Goal 已归档，当前不接受新的 Runtime 领取",
          { archived_at: goal.archived_at },
          "由用户恢复后再查询 Ready",
        ),
      );
    }
    if (!goal.trashed_at && !goal.archived_at) {
      const replacement = activeGoalReplacement(this.ports.goals, input.boardId, goal.goal_id, input.snapshot);
      if (replacement) reasons.push(goalReplacedReason(goal.goal_id, replacement));
    }
    if (input.role === "clarifier") {
      const clarificationSnapshot = input.snapshot ?? this.ports.snapshot(input.boardId);
      const needsCoverageClarification = goalNeedsCoverageClarification(goal, clarificationSnapshot);
      const needsClarification = goalNeedsDefinitionClarification(goal) || needsCoverageClarification;
      const pendingCoverageDecision = needsCoverageClarification && deriveGoalActionProjection(goal, clarificationSnapshot, input.now)
        .actions.find(action => action.actor === "user" && action.kind === "revise" &&
          (action.target_type === "goal_tree_proposal_item" || action.target_type === "goal_tree_proposal"));
      if (pendingCoverageDecision) {
        reasons.push(reason("goal_tree_proposal.user_decision_required", "goal", goal.goal_id,
          "覆盖修订已提交，正在等待用户确认或退回修改", { target_id: pendingCoverageDecision.target_id }));
      }
      if (!needsClarification) {
        reasons.push(
          reason(
            "goal.clarification_not_needed",
            "goal",
            goal.goal_id,
            "这个 Goal 已经可以进入执行领取，不再需要澄清者",
            undefined,
            "改用 executor 查询和领取",
          ),
        );
      }
      const pendingContractProposal = snapshotIndex
        ? snapshotIndex.pending_contract_proposal_by_goal.get(goal.goal_id)
        : this.ports.governance.snapshot(input.boardId).contract_proposals
          .find((proposal) => proposal.goal_id === goal.goal_id && proposal.state === "pending");
      if (pendingContractProposal) {
        reasons.push(
          reason(
            "contract_proposal.user_decision_required",
            "contract_proposal",
            asText(pendingContractProposal.proposal_id),
            "目标方案已经整理好，正在等你确认或退回修改",
          ),
        );
      }
      if (goal.validity_state === "invalidated") {
        reasons.push(reason("goal.invalidated", "goal", goal.goal_id, "Goal 已失效"));
      }
      if (goal.fulfillment_state === "satisfied" && !needsCoverageClarification) {
        reasons.push(reason("goal.already_satisfied", "goal", goal.goal_id, "Goal 已完成"));
      }
    } else {
      if (
        input.role === "self_verifier" ||
        input.role === "cross_reviewer" ||
        input.role === "adversarial_reviewer"
      ) {
        const pendingReview = snapshotIndex
          ? snapshotIndex.pending_review_keys.has(`${input.goalId}\u0000${input.role}`)
          : this.ports.governance.listReviewObligations(input.boardId, input.goalId)
            .some((obligation) => obligation.role === input.role && obligation.state === "pending");
        if (!pendingReview) {
          reasons.push(
            reason(
              "review.not_pending",
              "goal",
              goal.goal_id,
              "当前没有等待此类 Runtime Review 的义务",
            ),
          );
        }
        const latestWorkRun = snapshotIndex
          ? snapshotIndex.latest_work_run_by_goal.get(input.goalId)
          : this.ports.execution.latestRunForGoal(
              input.boardId,
              input.goalId,
              ["executor", "revalidator"],
            );
        if (!latestWorkRun || latestWorkRun.state !== "completed") {
          reasons.push(
            reason(
              "review.execution_not_completed",
              "goal",
              goal.goal_id,
              "执行 Run 尚未完成，不能开始 Review",
            ),
          );
        }
      }
      if (goal.definition_state !== "accepted") {
        reasons.push(reason("goal.not_accepted", "goal", goal.goal_id, "Goal 还没有被接受"));
      }
      if (goal.decomposition_state !== "closed_leaf") {
        reasons.push(
          reason(
            "goal.not_closed_leaf",
            "goal",
            goal.goal_id,
            "这个 Goal 还不是可以直接执行的最小 Goal",
            { decomposition_state: goal.decomposition_state },
            "继续拆分，直到结果和验收都能在 Goal 内闭环",
          ),
        );
      }
      if (input.role === "revalidator" && goal.validity_state === "valid") {
        reasons.push(
          reason(
            "goal.revalidation_not_needed",
            "goal",
            goal.goal_id,
            "Goal 当前已经是可信状态，不需要重新验证",
            undefined,
            "改用 executor 查询和领取",
          ),
        );
      } else if (input.role === "executor" && goal.validity_state === "needs_revalidation") {
        reasons.push(reason("goal.needs_revalidation", "goal", goal.goal_id, "Goal 需要重新验证后才能执行"));
      }
      if (goal.validity_state === "invalidated") {
        reasons.push(reason("goal.invalidated", "goal", goal.goal_id, "Goal 已失效"));
      }
      if (input.role === "executor" && goal.fulfillment_state === "satisfied") {
        reasons.push(reason("goal.already_satisfied", "goal", goal.goal_id, "Goal 已完成"));
      }
      if (goal.acceptance_criteria.length === 0) {
        reasons.push(reason("goal.acceptance_missing", "criterion", goal.goal_id, "Goal 没有明确验收条件"));
      }

      const dependencies = snapshotIndex
        ? snapshotIndex.dependencies_by_goal.get(input.goalId) ?? []
        : this.ports.goals.listDependencies(input.boardId, input.goalId);
      for (const dependency of dependencies) {
        const dependencyId = asText(dependency.goal_id);
        if (asText(dependency.fulfillment_state) !== "satisfied") {
          reasons.push(
            reason(
              "dependency.unsatisfied",
              "dependency",
              dependencyId,
              `前置 Goal「${asText(dependency.title)}」还未完成`,
              { dependency_goal_id: dependencyId },
            ),
          );
        }
        if (asText(dependency.validity_state) !== "valid") {
          reasons.push(
            reason(
              "dependency.not_valid",
              "dependency",
              dependencyId,
              `前置 Goal「${asText(dependency.title)}」当前不可信`,
              { validity_state: asText(dependency.validity_state) },
            ),
          );
        }
      }

      const risks = snapshotIndex
        ? snapshotIndex.risks_by_goal.get(input.goalId) ?? []
        : this.ports.goals.listOpenGoalRisks(input.boardId, input.goalId);
      for (const risk of risks) {
        const blockingMode = asText(risk.blocking_mode);
        const state = asText(risk.state);
        if (blockingMode === "claim" || (blockingMode === "invalidate_on_trigger" && state === "triggered")) {
          reasons.push(
            reason(
              "risk.blocks_claim",
              "risk",
              asText(risk.risk_id),
              asText(risk.description),
              { blocking_mode: blockingMode, state },
              asText(risk.revisit_condition),
            ),
          );
        }
      }
    }

    if (policy.goal_mode === "required" && !input.goalModeAttestation) {
      reasons.push(
        reason(
          "policy.goal_mode_required",
          "policy",
          input.goalId,
          "这个 Goal 要求 Runtime 开启 Goal 模式",
          undefined,
          "领取时提交 goal_mode_attestation=true",
        ),
      );
    }
    const capabilities = new Set(input.capabilities);
    for (const required of policy.required_capabilities) {
      if (!capabilities.has(required)) {
        reasons.push(
          reason(
            "policy.capability_missing",
            "policy",
            required,
            `Runtime 缺少能力：${required}`,
            { required_capability: required },
          ),
        );
      }
    }

    const sameGoalClaim = snapshotIndex
      ? (snapshotIndex.claims_by_goal.get(input.goalId) ?? [])
        .filter((claim) => claim.state === "active" && claim.expires_at > input.now)
        .sort((left, right) => left.claim_id.localeCompare(right.claim_id))[0]
      : this.ports.execution
        .listClaimsForGoal(input.boardId, input.goalId)
        .filter((claim) => claim.state === "active" && claim.expires_at > input.now)
        .sort((left, right) => left.claim_id.localeCompare(right.claim_id))[0];
    if (sameGoalClaim) {
      reasons.push(
        reason(
          "claim.already_active",
          "claim",
          asText(sameGoalClaim.claim_id),
          "这个 Goal 已被另一个 Runtime 领取",
          { actor_id: asText(sameGoalClaim.actor_id) },
        ),
      );
    }

    if (input.role === "executor" || input.role === "revalidator") {
      reasons.push(...this.impactConflicts(
        input.boardId,
        input.goalId,
        surfaces,
        input.now,
        snapshotIndex,
      ));
    }
    return { goal, reasons: reasons.sort(compareReasons), policy, surfaces };
  }

  resolvePolicy(
    boardId: string,
    goalId: string,
    strengthen?: Partial<GoalPolicy>,
    allActiveRows?: GoalPolicyBindingRecord[],
  ): GoalPolicy {
    const rows = allActiveRows
      ? allActiveRows.filter((row) => row.goal_id == null || row.goal_id === goalId)
      : this.ports.goals.listActivePolicyBindings(boardId, goalId);
    return resolveGoalPolicy(
      rows as Parameters<typeof resolveGoalPolicy>[0],
      strengthen,
    );
  }

  private impactConflicts(
    boardId: string,
    goalId: string,
    requested: ImpactBindingRecord[],
    now: string,
    snapshotIndex?: SnapshotEvaluationIndex,
  ): DecisionReason[] {
    const rows = snapshotIndex
      ? [...snapshotIndex.claims_by_goal.entries()]
        .filter(([existingGoalId]) => existingGoalId !== goalId)
        .flatMap(([existingGoalId, claims]) => claims
          .filter((claim) => claim.state === "active" && claim.expires_at > now)
          .flatMap((claim) => (snapshotIndex.impacts_by_goal.get(existingGoalId) ?? [])
            .filter((impact) => impact.state === "confirmed")
            .map((impact) => ({
              claim_id: claim.claim_id,
              existing_goal_id: existingGoalId,
              surface: impact.surface,
              access: impact.access,
              input_snapshot: impact.input_snapshot,
            }))))
        .sort((left, right) =>
          left.surface.localeCompare(right.surface) || left.claim_id.localeCompare(right.claim_id)
        )
      : (() => {
          const snapshot = this.ports.snapshot(boardId);
          return snapshot.claims
            .filter((claim) =>
              claim.goal_id !== goalId && claim.state === "active" && claim.expires_at > now
            )
            .flatMap((claim) => snapshot.impacts
              .filter((impact) => impact.goal_id === claim.goal_id && impact.state === "confirmed")
              .map((impact) => ({
                claim_id: claim.claim_id,
                existing_goal_id: claim.goal_id,
                surface: impact.surface,
                access: impact.access,
                input_snapshot: impact.input_snapshot,
              })))
            .sort((left, right) =>
              left.surface.localeCompare(right.surface) || left.claim_id.localeCompare(right.claim_id)
            );
        })();
    return executionImpactPolicy.conflicts(requested, rows);
  }

  private goalImpacts(
    boardId: string,
    goalId: string,
    snapshot?: BoardSnapshot,
  ): ImpactBindingRecord[] {
    return (snapshot ?? this.ports.snapshot(boardId)).impacts.filter(
      (impact) => impact.goal_id === goalId && impact.state !== "inactive",
    );
  }
}
