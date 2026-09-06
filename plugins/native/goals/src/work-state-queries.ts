import { activeGoalReplacement, goalReplacedReason } from "./goal-replacement-query.js";
import type { GoalsQueryApi, GoalRecord, GoalPolicy, GoalLifecycleReason as DecisionReason } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionQueryApi, ExecutionRunRecord as RunRecord, ExecutionClaimRecord as ClaimRecord, ExecutionClaimRole as ClaimRole } from "@adeptify/goalboard-contracts/modules/execution";
import type { EvidenceVerificationApplicationApi } from "@adeptify/goalboard-contracts/modules/evidence-verification";
import type { GovernanceApplicationApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { BoardSnapshot } from "./goal-entry-contract.js";
import type { GoalWorkStateView, GoalWorkState, GoalWorkAction } from "./execution-validation-contract.js";
import type { ExecutionValidationApplicationPorts } from "./execution-validation-ports.js";
import { compatibleContractRevisions } from "./contract-revisions.js";
import { goalNeedsDefinitionClarification, goalNeedsCoverageClarification } from "./clarification-policy.js";
import { executionValidationReason as reason, compareExecutionValidationReasons as compareReasons, uniqueExecutionValues as unique } from "./execution-validation-support.js";
import { recordedContractCoverageBlocksClosure } from "@adeptify/goalboard-module-goals";

export interface GoalWorkStateQueryPorts {
  goals: GoalsQueryApi;
  execution: ExecutionQueryApi;
  evidence: EvidenceVerificationApplicationApi["query"];
  governance: GovernanceApplicationApi["query"];
  snapshot(boardId: string): BoardSnapshot;
  requireGoalOnBoard(boardId: string, goalId: string): GoalRecord;
  resolvePolicy(boardId: string, goalId: string): GoalPolicy;
  evaluate: ExecutionValidationApplicationPorts["evaluate"];
}
interface AvailableAction { role: ClaimRole | null; next_action: GoalWorkAction; review_obligation_id: string | null; }

/** Read-only composition of execution phases and Module completion facts. */
export class GoalWorkStateQueries {
  constructor(private readonly ports: GoalWorkStateQueryPorts) {}

  deriveGoalWorkState(
    boardId: string,
    goal: GoalRecord,
    snapshot: BoardSnapshot,
    now: string,
  ): GoalWorkStateView {
    const childGoalIds = snapshot.relations
      .filter(
        (relation) =>
          relation.state === "active" &&
          relation.type === "part_of" &&
          relation.to_goal_id === goal.goal_id,
      )
      .map((relation) => relation.from_goal_id)
      .sort();
    const activeClaims = snapshot.claims
      .filter(
        (claim) =>
          claim.goal_id === goal.goal_id &&
          claim.state === "active" &&
          claim.expires_at > now,
      )
      .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at));
    const activeClaimById = new Map(activeClaims.map((claim) => [claim.claim_id, claim]));
    const activeRun = snapshot.runs
      .filter(
        (run) =>
          run.goal_id === goal.goal_id &&
          ["started", "blocked"].includes(run.state) &&
          activeClaimById.has(run.claim_id),
      )
      .sort((left, right) => left.started_at.localeCompare(right.started_at))
      .at(-1) ?? null;
    const activeClaim = activeRun
      ? activeClaimById.get(activeRun.claim_id) ?? null
      : activeClaims.at(-1) ?? null;
    const expiredClaim = snapshot.claims
      .filter(
        (claim) =>
          claim.goal_id === goal.goal_id &&
          claim.state === "active" &&
          claim.expires_at <= now,
      )
      .sort((left, right) => left.claimed_at.localeCompare(right.claimed_at))
      .at(-1) ?? null;
    const expiredRun = expiredClaim
      ? snapshot.runs
          .filter(
            (run) =>
              run.claim_id === expiredClaim.claim_id &&
              ["started", "blocked"].includes(run.state),
          )
          .sort((left, right) => left.started_at.localeCompare(right.started_at))
          .at(-1) ?? null
      : null;
    const leaseRecoveryReason: DecisionReason | null = expiredClaim && expiredRun
      ? {
          code: "lease.expired",
          severity: "info",
          subject_type: "claim",
          subject_id: expiredClaim.claim_id,
          message: "上一轮领取租约已到期，旧 Run 不再具有写权限",
          facts: {
            claim_id: expiredClaim.claim_id,
            run_id: expiredRun.run_id,
            expired_at: expiredClaim.expires_at,
            next_action: "select_goal",
          },
          remediation: "直接重新领取这条 Goal；无需释放旧 Claim，也不要继续报告旧 Run。",
        }
      : null;
    const phaseReasons = (blockingReasons: DecisionReason[]): DecisionReason[] =>
      blockingReasons.length > 0
        ? blockingReasons
        : leaseRecoveryReason
          ? [leaseRecoveryReason]
          : [];
    const latestClaimRun = activeClaim
      ? snapshot.runs
          .filter((run) => run.claim_id === activeClaim.claim_id)
          .sort(
            (left, right) =>
              left.started_at.localeCompare(right.started_at) || left.run_id.localeCompare(right.run_id),
          )
          .at(-1) ?? null
      : null;
    const compatibleRevisions = compatibleContractRevisions(goal, snapshot);
    const pendingReviewObligations = snapshot.review_obligations.filter(
      (obligation) =>
        obligation.goal_id === goal.goal_id &&
        compatibleRevisions.has(obligation.contract_revision) &&
        obligation.state === "pending",
    );
    const pendingReviewRoles = pendingReviewObligations.map((obligation) => obligation.role);
    const reviewReady = this.latestWorkRunState(snapshot, goal) === "completed";
    const activeClaimLease = activeClaim
      ? (() => {
          const remainingSeconds = Math.max(
            0,
            Math.ceil((new Date(activeClaim.expires_at).getTime() - new Date(now).getTime()) / 1000),
          );
          const leaseStartedAt = activeClaim.renewed_at ?? activeClaim.claimed_at;
          const currentLeaseSeconds = Math.max(
            1,
            Math.ceil(
              (new Date(activeClaim.expires_at).getTime() - new Date(leaseStartedAt).getTime()) / 1000,
            ),
          );
          const renewalWindowSeconds = Math.max(
            1,
            Math.min(300, Math.ceil(currentLeaseSeconds / 3)),
          );
          const renewRecommended = remainingSeconds <= renewalWindowSeconds;
          return {
            remaining_seconds: remainingSeconds,
            renewal_window_seconds: renewalWindowSeconds,
            renew_recommended: renewRecommended,
            next_action: renewRecommended ? "renew_claim" as const : null,
          };
        })()
      : null;
    const base = {
      goal_id: goal.goal_id,
      active_claim: activeClaim,
      active_claim_lease: activeClaimLease,
      active_run: activeRun,
      pending_review_roles: pendingReviewRoles,
      child_goal_ids: childGoalIds,
    };

    if (goal.trashed_at) {
      return { ...base, work_state: "trashed", next_action: null, reasons: [] };
    }
    if (goal.archived_at) {
      return { ...base, work_state: "archived", next_action: null, reasons: [] };
    }
    const replacement = activeGoalReplacement(this.ports.goals, boardId, goal.goal_id, snapshot);
    if (replacement) {
      return {
        ...base,
        work_state: "replaced",
        next_action: null,
        reasons: [goalReplacedReason(goal.goal_id, replacement)],
      };
    }
    if (goal.validity_state === "invalidated") {
      return {
        ...base,
        work_state: "invalidated",
        next_action: null,
        reasons: [reason("goal.invalidated", "goal", goal.goal_id, "Goal 已失效，需要重新澄清或替换")],
      };
    }
    if (
      goal.decomposition_state === "closed_compound" &&
      recordedContractCoverageBlocksClosure(goal, {
        goals: snapshot.goals,
        relations: snapshot.relations,
      })
    ) {
      return {
        ...base,
        work_state: "clarification_blocked",
        next_action: "clarify",
        reasons: [
          reason(
            "goal.contract_coverage_incomplete",
            "goal",
            goal.goal_id,
            "父 Goal 记录的承诺结果或完成条件尚未被子 Contract 完整覆盖",
            undefined,
            "继续澄清父子 Contract 映射；部分覆盖、尚未覆盖或仍需父级集成时不能关闭父 Goal",
          ),
        ],
      };
    }
    if (
      goal.decomposition_state !== "closed_compound" &&
      goal.validity_state === "valid" &&
      goal.fulfillment_state === "satisfied"
    ) {
      return { ...base, work_state: "satisfied", next_action: null, reasons: [] };
    }
    if (activeClaim && !activeRun) {
      return this.workStateWithoutRun(base, activeClaim, latestClaimRun);
    }

    const needsClarification = goalNeedsDefinitionClarification(goal) || goalNeedsCoverageClarification(goal, snapshot);
    if (needsClarification) {
      if (activeRun?.role === "clarifier") return this.workStateFromRun(base, activeRun);
      const reasons = this.workStatePhaseReasons(boardId, goal.goal_id, "clarifier", now, snapshot);
      return {
        ...base,
        work_state: reasons.length > 0 ? "clarification_blocked" : "clarification_pending",
        next_action: "clarify",
        reasons: phaseReasons(reasons),
      };
    }

    if (goal.validity_state === "needs_revalidation") {
      if (activeRun) return this.workStateFromRun(base, activeRun);
      const reasons = this.workStatePhaseReasons(boardId, goal.goal_id, "revalidator", now, snapshot);
      return {
        ...base,
        work_state: reasons.length > 0 ? "revalidation_blocked" : "revalidation_pending",
        next_action: "revalidate",
        reasons: phaseReasons(reasons),
      };
    }

    if (goal.decomposition_state === "closed_compound") {
      if (childGoalIds.length > 0) {
        const childGoalById = new Map(snapshot.goals.map((child) => [child.goal_id, child]));
        const untrustedChildren = childGoalIds
          .map((childGoalId) => childGoalById.get(childGoalId)!)
          .filter(
            (child) =>
              child.fulfillment_state !== "satisfied" ||
              child.validity_state !== "valid" ||
              child.trashed_at != null ||
              child.archived_at != null,
          );
        if (
          goal.fulfillment_state === "satisfied" &&
          goal.validity_state === "valid" &&
          untrustedChildren.length === 0
        ) {
          return { ...base, work_state: "satisfied", next_action: null, reasons: [] };
        }
        return {
          ...base,
          work_state: "waiting_children",
          next_action: null,
          reasons: untrustedChildren.map((child) =>
            reason(
              "goal.compound_child_not_trusted",
              "goal",
              child.goal_id,
              `子 Goal「${child.title}」当前还不是可信完成`,
              {
                fulfillment_state: child.fulfillment_state,
                validity_state: child.validity_state,
                trashed: child.trashed_at != null,
                archived: child.archived_at != null,
              },
              "先恢复该子 Goal 的可信完成状态",
            ),
          ),
        };
      }
      return {
        ...base,
        work_state: "clarification_blocked",
        next_action: "clarify",
        reasons: [
          reason(
            "goal.compound_children_missing",
            "goal",
            goal.goal_id,
            "复合 Goal 已确认，但还没有任何生效的子 Goal",
            undefined,
            "补充子 Goal 或重新进入澄清后再确认拆分",
          ),
        ],
      };
    }

    if (activeRun) return this.workStateFromRun(base, activeRun);

    if (goal.fulfillment_state === "satisfied") {
      return { ...base, work_state: "satisfied", next_action: null, reasons: [] };
    }

    const reworkRequested = this.hasPostExecutionNeedsChanges(boardId, goal.goal_id);
    const pendingRuntimeReviewObligations = pendingReviewObligations.filter(
      (obligation) => obligation.role !== "human_approver",
    );
    const pendingHumanReviewObligations = pendingReviewObligations.filter(
      (obligation) => obligation.role === "human_approver",
    );
    if (pendingRuntimeReviewObligations.length > 0 && reviewReady && !reworkRequested) {
      const action = pendingRuntimeReviewObligations
        .map((obligation) => this.reviewActionFor(obligation))
        .find((candidate): candidate is AvailableAction => candidate !== null);
      const reasons = action?.role
        ? this.workStatePhaseReasons(boardId, goal.goal_id, action.role, now, snapshot)
        : [];
      return {
        ...base,
        work_state: reasons.length > 0 ? "review_blocked" : "review_pending",
        next_action: "review",
        reasons: phaseReasons(reasons),
      };
    }

    const uncoveredHumanCriterionIds = goal.acceptance_criteria
      .filter((criterion) => criterion.decision_method === "human_decision")
      .filter((criterion) => !this.criterionHasPassingEvidence(goal, criterion.criterion_id))
      .map((criterion) => criterion.criterion_id);
    if (
      reviewReady &&
      !reworkRequested &&
      (pendingHumanReviewObligations.length > 0 || uncoveredHumanCriterionIds.length > 0)
    ) {
      const criterionIds = unique([
        ...pendingHumanReviewObligations.flatMap((obligation) => obligation.criterion_scope),
        ...uncoveredHumanCriterionIds,
      ]).sort();
      const singlePendingHumanObligation = pendingHumanReviewObligations.length === 1
        ? pendingHumanReviewObligations[0]
        : null;
      const singleHumanObligation = singlePendingHumanObligation &&
          unique(singlePendingHumanObligation.criterion_scope).sort().length === criterionIds.length &&
          unique(singlePendingHumanObligation.criterion_scope).sort().every(
            (criterionId, index) => criterionId === criterionIds[index],
          )
        ? singlePendingHumanObligation
        : null;
      const conversationApprovalHandoff = singleHumanObligation
        ? {
            requires_single_pending_obligation: true,
            evidence_tool: "goalboard_v1_evidence_submit",
            evidence_kind: "human_verdict",
            evidence_result: "passed",
            criterion_ids: singleHumanObligation.criterion_scope,
            obligation_id: singleHumanObligation.obligation_id,
            locator_scheme: "conversation://",
            digest_source: "exact_user_quote",
            final_action: "open_goalboard_inbox_for_single_user_submit",
            runtime_can_submit_human_review: false,
          }
        : null;
      return {
        ...base,
        work_state: "waiting_for_human",
        next_action: null,
        reasons: [
          reason(
            "review.user_approval_required",
            "goal",
            goal.goal_id,
            "Runtime 可承担的检查已经结束，当前只剩用户本人验收与决定",
            {
              criterion_ids: criterionIds,
              obligation_ids: pendingHumanReviewObligations.map((item) => item.obligation_id),
              next_action: conversationApprovalHandoff
                ? "record_explicit_user_approval_or_open_goalboard"
                : "open_goalboard",
              ...(conversationApprovalHandoff
                ? { conversation_approval_handoff: conversationApprovalHandoff }
                : {}),
            },
            conversationApprovalHandoff
              ? "若用户在当前对话明确批准这一项唯一待决验收，Runtime 只把用户原话登记为 human_verdict Evidence 并打开已预填 Inbox；最终 Human Review 仍由用户提交。含糊回复、多个待决项或不通过结论继续使用 Inbox。"
              : "请用户在 GoalBoard 中完成真实操作、提交决定及相应验收依据；Runtime 不要重复领取 Review。",
          ),
        ],
      };
    }

    if (
      reviewReady &&
      pendingReviewObligations.length === 0 &&
      !reworkRequested &&
      this.acceptanceCriteriaPassed(goal, snapshot)
    ) {
      const completionRiskReasons = this.completionRiskReasons(goal.board_id, goal.goal_id);
      if (completionRiskReasons.length > 0) {
        return {
          ...base,
          work_state: "completion_blocked",
          next_action: null,
          reasons: completionRiskReasons,
        };
      }
      return {
        ...base,
        work_state: "completion_pending",
        next_action: "complete",
        reasons: [],
      };
    }

    const reasons = this.workStatePhaseReasons(boardId, goal.goal_id, "executor", now, snapshot);
    return {
      ...base,
      work_state: reasons.length > 0 ? "execution_blocked" : "execution_pending",
      next_action: "execute",
      reasons: phaseReasons(reasons),
    };
  }

  workStateFromRun(
    base: Omit<GoalWorkStateView, "work_state" | "next_action" | "reasons">,
    run: RunRecord,
  ): GoalWorkStateView {
    const phase =
      run.role === "clarifier"
        ? "clarification"
        : run.role === "revalidator"
          ? "revalidation"
          : run.role === "self_verifier" || run.role === "cross_reviewer" || run.role === "adversarial_reviewer"
            ? "review"
            : "execution";
    const state =
      run.state === "blocked"
        ? (`${phase}_blocked` as GoalWorkState)
        : phase === "clarification"
          ? "clarifying"
          : phase === "revalidation"
            ? "revalidating"
            : phase === "review"
              ? "reviewing"
            : "executing";
    const nextAction: GoalWorkAction =
      phase === "clarification"
        ? "clarify"
        : phase === "revalidation"
          ? "revalidate"
          : phase === "review"
            ? "review"
            : "execute";
    return {
      ...base,
      work_state: state,
      next_action: nextAction,
      reasons:
        run.state === "blocked"
          ? [
              reason(
                "run.blocked",
                "run",
                run.run_id,
                run.block_reason ?? "Runtime 报告当前工作受阻",
              ),
            ]
          : [],
    };
  }

  workStateWithoutRun(
    base: Omit<GoalWorkStateView, "work_state" | "next_action" | "reasons">,
    claim: ClaimRecord,
    latestRun: RunRecord | null,
  ): GoalWorkStateView {
    const phase =
      claim.role === "clarifier"
        ? "clarification"
        : claim.role === "revalidator"
          ? "revalidation"
          : claim.role === "self_verifier" ||
              claim.role === "cross_reviewer" ||
              claim.role === "adversarial_reviewer"
            ? "review"
            : "execution";
    const nextAction: GoalWorkAction =
      phase === "clarification"
        ? "clarify"
        : phase === "revalidation"
          ? "revalidate"
          : phase === "review"
            ? "review"
            : "execute";
    if (latestRun?.state === "completed") {
      const evidenceIncomplete = phase === "execution";
      return {
        ...base,
        work_state: evidenceIncomplete ? "executing" : (`${phase}_blocked` as GoalWorkState),
        next_action: nextAction,
        reasons: [
          reason(
            evidenceIncomplete ? "action.evidence_incomplete" : "claim.release_repair_required",
            "claim",
            claim.claim_id,
            evidenceIncomplete
              ? "执行已经结束，还需要补齐当前要求对应的完成依据"
              : "本阶段已经结束，但旧 Claim 没有正常自动释放",
            { claim_id: claim.claim_id, run_id: latestRun.run_id },
            evidenceIncomplete
              ? "提交最后一条必要 Evidence；系统会自动释放 Claim 并立即给出下一动作。"
              : "这是旧数据或异常恢复场景，可使用显式 release 修复；正常流程不会到这里。",
          ),
        ],
      };
    }
    return {
      ...base,
      work_state: `${phase}_blocked` as GoalWorkState,
      next_action: nextAction,
      reasons: [
        reason(
          "run.missing",
          "claim",
          claim.claim_id,
          "这项工作已被接手，但还没有开始推进",
          undefined,
          "开始推进，或者先结束当前接手状态后再交给其他人。",
        ),
      ],
    };
  }

  latestWorkRunState(
    snapshot: BoardSnapshot,
    goal: GoalRecord,
  ): RunRecord["state"] | null {
    const compatibleRevisions = compatibleContractRevisions(goal, snapshot);
    const compatibleClaimIds = new Set(snapshot.claims
      .filter((claim) =>
        claim.goal_id === goal.goal_id && compatibleRevisions.has(claim.contract_revision)
      )
      .map((claim) => claim.claim_id));
    return (
      snapshot.runs
        .filter(
          (run) =>
            run.goal_id === goal.goal_id &&
            compatibleClaimIds.has(run.claim_id) &&
            (run.role === "executor" || run.role === "revalidator"),
        )
        .sort(
          (left, right) =>
            left.started_at.localeCompare(right.started_at) || left.run_id.localeCompare(right.run_id),
        )
        .at(-1)?.state ?? null
    );
  }

  acceptanceCriteriaPassed(
    goal: GoalRecord,
    _snapshot: BoardSnapshot,
  ): boolean {
    return goal.acceptance_criteria.every((criterion) =>
      this.criterionHasPassingEvidence(goal, criterion.criterion_id),
    );
  }

  criterionHasPassingEvidence(goal: GoalRecord, criterionId: string): boolean {
    const snapshot = this.ports.snapshot(goal.board_id);
    return this.ports.evidence.hasPassingEvidence({
      board_id: goal.board_id,
      goal_id: goal.goal_id,
      criterion_id: criterionId,
      compatible_contract_revisions: [...compatibleContractRevisions(goal, snapshot)],
    });
  }

  executorHandoffReasons(workState: GoalWorkStateView): DecisionReason[] {
    if (workState.work_state === "completion_blocked") {
      return [
        ...workState.reasons,
        reason(
          "goal.execution_finished_rework_required",
          "goal",
          workState.goal_id,
          "这条 Goal 的执行、Evidence 与 Review 已经结束；当前门禁只阻止完成，不是 executor Claim 门禁",
          {
            work_state: workState.work_state,
            completion_gate_only: true,
            recovery_tool: "goalboard_v1_rework_request",
          },
          "如果旧验收前提仍成立，处理返回的完成门禁后重试 complete；如果新反证推翻旧结论，调用 goalboard_v1_rework_request 指明受影响 criterion、反证 Evidence 和理由，再读取 Available 继续同一 Goal。",
        ),
      ].sort(compareReasons);
    }
    if (workState.work_state === "waiting_for_human") return workState.reasons;
    if (workState.work_state !== "completion_pending") return [];
    return [
      reason(
        "goal.ready_to_complete",
        "goal",
        workState.goal_id,
        "执行、证据和复核已经完成，不应开始新的执行",
        undefined,
        "直接调用完成判定；如果仍有门禁，按返回原因处理后重试。",
      ),
    ];
  }

  completionRiskReasons(boardId: string, goalId: string): DecisionReason[] {
    return this.ports.goals.listOpenGoalRisks(boardId, goalId)
      .filter(risk => risk.blocking_mode === "completion" || risk.blocking_mode === "invalidate_on_trigger")
      .map(risk => reason(
        "risk.blocks_completion", "risk", risk.risk_id, risk.description,
        { blocking_mode: risk.blocking_mode, state: risk.state, owner: risk.owner,
          scope: "direct_goal", goal_id: goalId, association: "goal_risks", affected_surfaces: risk.affected_surfaces },
        risk.revisit_condition,
      ));
  }

  externalCompletionGateReasons(boardId: string, goalId: string): DecisionReason[] {
    const goal = this.ports.requireGoalOnBoard(boardId, goalId);
    const snapshot = this.ports.snapshot(boardId);
    const reasons: DecisionReason[] = [];
    for (const criterion of goal.acceptance_criteria) {
      if (!this.criterionHasPassingEvidence(goal, criterion.criterion_id)) {
        reasons.push(
          reason(
            "evidence.criterion_uncovered",
            "criterion",
            criterion.criterion_id,
            `验收条件「${criterion.statement}」还没有通过证据`,
            undefined,
            criterion.pass_condition,
          ),
        );
      }
    }
    const pendingReviews = this.ports.governance.listReviewObligations(boardId, goalId)
      .filter((obligation) => obligation.state === "pending");
    for (const pending of pendingReviews) {
      reasons.push(
        reason(
          "policy.review_pending",
          "review",
          pending.obligation_id,
          `还缺少 ${pending.role} Review`,
        ),
      );
    }
    const currentRunCandidates = snapshot.candidates.filter((candidate) => {
      const run = snapshot.runs.find((item) => item.run_id === candidate.discovered_in_run_id);
      return run?.goal_id === goalId && candidate.blocking_mode === "current_run";
    });
    const pendingCandidates = currentRunCandidates.filter((candidate) => candidate.state === "pending");
    for (const candidate of pendingCandidates) {
      reasons.push(reason(
        "candidate.user_decision_required",
        "candidate",
        candidate.candidate_id,
        "执行中发现的新工作需要用户决定",
      ));
    }
    const currentRunCandidateIds = new Set(currentRunCandidates.map((candidate) => candidate.candidate_id));
    const pendingRewires = snapshot.rewires.filter(
      (rewire) => rewire.state === "pending" && rewire.candidate_id != null && currentRunCandidateIds.has(rewire.candidate_id),
    );
    for (const pending of pendingRewires) {
      reasons.push(reason(
        "rewire.user_confirmation_required",
        "rewire",
        pending.rewire_id,
        "用户已接受 Candidate Goal，但关系调整尚未确认",
        { candidate_id: pending.candidate_id },
      ));
    }
    const directPendingRewires = snapshot.rewires.filter(
      (rewire) =>
        rewire.candidate_id == null &&
        rewire.state === "pending" &&
        rewire.proposal.proposal_kind === "dependency" &&
        rewire.proposal.blocking_mode === "current_run" &&
        rewire.proposal.discovered_in_run_id != null,
    );
    for (const pending of directPendingRewires) {
      const discoveredRun = snapshot.runs.find(
        (run) => run.run_id === pending.proposal.discovered_in_run_id,
      );
      if (discoveredRun?.goal_id !== goalId) continue;
      reasons.push(reason(
        "rewire.user_confirmation_required",
        "rewire",
        pending.rewire_id,
        "Runtime 提出了依赖调整，等待用户决定",
      ));
    }
    return reasons;
  }

  hasPostExecutionNeedsChanges(boardId: string, goalId: string): boolean {
    const latestWorkCompletedSeq = this.ports.execution.latestCompletedWorkRunEventSeq(
      boardId,
      goalId,
    );
    const latestNeedsChangesSeq = this.ports.governance
      .latestNeedsChangesReviewEventSeq(boardId, goalId);
    const latestReworkSeq = this.ports.snapshot(boardId).lifecycle_events
      .filter((event) => event.type === "goal.rework_requested" && event.object_id === goalId)
      .reduce((latest, event) => Math.max(latest, event.seq), 0);
    return Math.max(
      latestNeedsChangesSeq,
      latestReworkSeq,
    ) > latestWorkCompletedSeq;
  }

  workStatePhaseReasons(
    boardId: string,
    goalId: string,
    role: ClaimRole,
    now: string,
    snapshot?: BoardSnapshot,
  ): DecisionReason[] {
    const policy = this.ports.resolvePolicy(boardId, goalId);
    return this.ports.evaluate({
      boardId,
      goalId,
      actorId: "work-state-observer",
      role,
      capabilities: policy.required_capabilities,
      goalModeAttestation: true,
      now,
      snapshot,
    }).reasons.filter((item) => !item.code.startsWith("claim."));
  }

  reviewActionFor(obligation: {
    obligation_id: string;
    role: "self_verifier" | "cross_reviewer" | "adversarial_reviewer" | "human_approver";
  }): AvailableAction | null {
    if (obligation.role === "human_approver") return null;
    return {
      role:
        obligation.role === "self_verifier"
          ? "self_verifier"
          : obligation.role === "cross_reviewer"
          ? "cross_reviewer"
          : obligation.role === "adversarial_reviewer"
            ? "adversarial_reviewer"
            : "executor",
      next_action: "review",
      review_obligation_id: obligation.obligation_id,
    };
  }
}
