import type { SetRiskStateInput as GoalsSetRiskStateInput, UpdateRiskInput as GoalsUpdateRiskInput, GoalsActorWrite as ActorWrite, RiskRecord, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { ExecutionValidationApplicationApi } from "./execution-validation-contract.js";
import { contractRevisionIsCompatible } from "./contract-revisions.js";
import { deriveGoalActionProjection } from "./action-projection.js";
export interface RiskActionAuthorizationPorts {
 snapshot(boardId: string): BoardSnapshot;
 requireGoalOnBoard(boardId: string, goalId: string): GoalRecord;
 validation: Pick<ExecutionValidationApplicationApi<BoardSnapshot>["query"], "getGoalActionProjection">;
 clock(): Date;
 error(code: string, message: string, details?: Record<string, unknown>): Error;
}
/** Cross-module authorization before the Goals owner persists Risk changes. */
export class RiskActionAuthorization {
  constructor(private readonly ports: RiskActionAuthorizationPorts) {}
  authorizeGoalRiskUpdate(
    boardId: string,
    input: GoalsUpdateRiskInput,
    write: ActorWrite,
    _current: RiskRecord,
  ): void {
    const actionContextValues = [
      input.action_goal_id,
      input.contract_revision,
      input.action_id,
      input.action_token,
    ];
    if (!actionContextValues.some((value) => value != null)) return;
    const goal = this.ports.requireGoalOnBoard(boardId, input.action_goal_id!);
    const projection = this.ports.validation.getGoalActionProjection({ board_id: boardId, goal_id: goal.goal_id });
    if (!contractRevisionIsCompatible(goal, this.ports.snapshot(boardId), input.contract_revision!)) {
      throw this.ports.error(
        "contract.revision_stale",
        "Risk 决定属于旧 Contract revision。",
        { current_contract_revision: goal.current_contract_revision, projection },
      );
    }
    if (input.action_token !== projection.action_token) {
      throw this.ports.error(
        "action.token_stale",
        "处理 Risk 前 Goal 已变化；旧决定未生效。",
        { projection },
      );
    }
    if (!projection.actions.some((action) =>
      action.action_id === input.action_id &&
      action.actor === "user" &&
      action.kind === "accept_risk" &&
      action.target_type === "risk" &&
      action.target_id === input.risk_id
    )) {
      throw this.ports.error(
        "action.not_available",
        "当前用户动作不再指向这条 Risk。",
        { projection },
      );
    }
    if (write.actor_kind !== "user") {
      throw this.ports.error(
        "risk.user_acceptance_required",
        "只有用户可以决定是否接受这条 Risk。",
      );
    }
  }

  authorizeGoalRiskState(
    boardId: string,
    input: GoalsSetRiskStateInput,
    write: ActorWrite,
    _current: RiskRecord,
    linkedGoalIds: string[],
    resolutionBasis: RiskRecord["resolution_basis"],
  ): void {
    const snapshot = this.ports.snapshot(boardId);
    const authorizationGoalIds = input.goal_id ? [input.goal_id] : linkedGoalIds;
    for (const goalId of linkedGoalIds) {
      const goal = snapshot.goals.find((candidate) => candidate.goal_id === goalId)!;
      const projection = deriveGoalActionProjection(goal, snapshot, this.ports.clock().toISOString());
      const isActionGoal = goalId === input.goal_id;
      if (
        isActionGoal &&
        !contractRevisionIsCompatible(goal, snapshot, input.contract_revision!)
      ) {
        throw this.ports.error(
          "contract.revision_stale",
          "Risk 写入属于旧 Contract revision。",
          { current_contract_revision: goal.current_contract_revision, projection },
        );
      }
      if (isActionGoal && input.action_token !== projection.action_token) {
        throw this.ports.error(
          "action.token_stale",
          "处理 Risk 前 Goal 已变化；旧写入未生效。",
          { projection },
        );
      }
      if (isActionGoal && !projection.actions.some((candidate) =>
        candidate.action_id === input.action_id &&
        candidate.target_type === "risk" &&
        candidate.target_id === input.risk_id &&
        candidate.actor === (write.actor_kind === "user" ? "user" : "runtime") &&
        candidate.kind === (write.actor_kind === "user" ? "accept_risk" : "mitigate_risk")
      )) {
        throw this.ports.error(
          "action.not_available",
          "当前动作已经变化或不属于这个操作者。",
          { projection },
        );
      }
    }
    if (
      input.state === "resolved" &&
      (write.actor_kind != null ||
        input.action_token != null ||
        input.contract_revision != null ||
        input.goal_id != null)
    ) {
      const evidenceById = new Map(
        snapshot.evidence.map((evidence) => [evidence.evidence_id, evidence]),
      );
      for (const evidenceRef of resolutionBasis?.evidence_refs ?? []) {
        const evidence = evidenceById.get(evidenceRef);
        const goal = evidence
          ? snapshot.goals.find((candidate) => candidate.goal_id === evidence.goal_id)
          : null;
        if (
          !evidence ||
          !goal ||
          !linkedGoalIds.includes(evidence.goal_id) ||
          !contractRevisionIsCompatible(goal, snapshot, evidence.contract_revision) ||
          evidence.lifecycle_state !== "effective" ||
          evidence.historical_unmapped
        ) {
          throw this.ports.error(
            "risk.evidence_not_current",
            "Risk resolved 只能引用关联 Goal 当前 Contract revision 的有效 Evidence。",
            { evidence_id: evidenceRef },
          );
        }
      }
    }
    if (write.actor_kind === "runtime") {
      const authorized = authorizationGoalIds.every((goalId) => {
        const goal = snapshot.goals.find((candidate) => candidate.goal_id === goalId)!;
        const claims = snapshot.claims
          .filter((claim) =>
            claim.goal_id === goalId &&
            claim.actor_id === write.actor_id &&
            contractRevisionIsCompatible(goal, snapshot, claim.contract_revision)
          )
          .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at));
        const claim = claims.at(-1);
        if (!claim) return false;
        if (
          claim.state === "active" &&
          claim.action_kind === "mitigate_risk" &&
          claim.action_target_id === input.risk_id
        ) {
          return true;
        }
        const run = snapshot.runs
          .filter((candidate) => candidate.claim_id === claim.claim_id)
          .sort((left, right) => left.started_at.localeCompare(right.started_at))
          .at(-1);
        const newerClaim = snapshot.claims.some((candidate) =>
          candidate.goal_id === goalId && candidate.claimed_at > claim.claimed_at
        );
        return run?.state === "completed" && !newerClaim;
      });
      if (!authorized) {
        throw this.ports.error(
          "risk.runtime_authority_missing",
          "Runtime 没有当前 Risk action，也不是刚完成同一 revision 的原执行者。",
        );
      }
    }
  }
}
