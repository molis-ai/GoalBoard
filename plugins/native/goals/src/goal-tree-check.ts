import { createHash } from "node:crypto";
import type { GoalsQueryApi, GoalsPlanningApi, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, GoalTreeProposalRecord, GoalTreeProposalCheckInput, GoalTreeProposalCheckResult } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalTreeApplicationApi } from "./goal-tree-contract.js";
import type { SubmitContractProposalInput } from "./legacy-proposal-contract.js";
import { goalTreeProposalItemValidationIssues } from "./proposal-item-validation.js";
import { GoalTreeQueryApplication } from "./goal-tree-query.js";
import { GoalTreeMaterializationApplication } from "./goal-tree-materialization.js";
import { LegacyContractProposalValidator } from "./legacy-contract-validation.js";

interface CheckError extends Error { code: string; details?: Record<string, unknown> }
export class GoalTreeCheckApplication implements Pick<GoalTreeApplicationApi, "checkGoalTreeProposal"> {
  constructor(private readonly ports: {
    goals: { query: Pick<GoalsQueryApi, "getGoal">; planning: Pick<GoalsPlanningApi, "proposalGraphIssues"> };
    governance: Pick<GovernanceApplicationApi, "records" | "query">;
    query: GoalTreeQueryApplication;
    materialization: GoalTreeMaterializationApplication;
    legacy: LegacyContractProposalValidator;
    clock: () => Date;
    errorFactory: (code: string, message: string, details?: Record<string, unknown>) => Error;
    isDomainError: (error: unknown) => error is CheckError;
  }) {}

  checkGoalTreeProposal(input: GoalTreeProposalCheckInput): GoalTreeProposalCheckResult {
    const actorId = this.requiredText(
      input.actor_id,
      "goal_tree_proposal.actor_required",
      "检查 Goal Tree 提案需要当前 Runtime 的 actor_id",
    );
    const proposalId = this.requiredText(
      input.proposal_id,
      "goal_tree_proposal.id_required",
      "需要指定要检查的 Goal Tree proposal_id",
    );
    const proposalView = this.ports.query.listGoalTreeProposals({
      board_id: input.board_id,
      proposal_id: proposalId,
      include_legacy: true,
    }).proposals[0];
    if (!proposalView) {
      throw this.ports.errorFactory("goal_tree_proposal.not_found", `找不到 Goal Tree 提案: ${proposalId}`);
    }
    if (proposalView.origin === "legacy_contract_proposal") {
      return this.checkLegacyContractGoalTreeProposal(input, proposalView, actorId);
    }
    if (proposalView.origin !== "native") {
      throw this.ports.errorFactory(
        "goal_tree_proposal.legacy_check_unsupported",
        "当前历史提案不需要统一预检；请直接使用读取结果中的映射 proposal_id 与 item_id 做决定",
        { proposal_id: proposalView.proposal_id, next_action: "decide_legacy_proposal" },
      );
    }
    const canonicalProposalId = proposalView.proposal_id;
    const hash = requestHash({ board_id: input.board_id, proposal_id: canonicalProposalId, actor_id: actorId });
    return this.ports.governance.records.executeGoalTreeCheck({
      board_id: input.board_id, actor_id: actorId, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      const proposal = this.ports.query.readNative(input.board_id, canonicalProposalId);
      const now = this.ports.clock().toISOString();
      const conflictItemIdSet = new Set<string>();
      for (const item of proposal.items) {
        if (item.state !== "pending" && item.state !== "conflict") continue;
        const validationIssue = goalTreeProposalItemValidationIssues(item)[0];
        const baselineConflicts = item.baseline_versions.flatMap((baseline) => {
          const current = this.ports.query.baselines.forBaseline(input.board_id, baseline, item);
          return baseline.exists === current.exists && baseline.version === current.version
            ? []
            : [{ object: { object_type: baseline.object_type, object_id: baseline.object_id }, baseline, current }];
        });
        const conflict = validationIssue
          ? {
              code: validationIssue.code,
              field: validationIssue.field,
              message: validationIssue.message,
              recovery: validationIssue.recovery,
            }
          : baselineConflicts.length > 0
            ? { objects: baselineConflicts }
            : null;
        if (conflict) conflictItemIdSet.add(item.item_id);
        this.ports.governance.records.setGoalTreeItemCheck(
          canonicalProposalId,
          item.item_id,
          conflict ? "conflict" : "pending",
          conflict,
          now,
        );
      }
      const checkedItems = this.ports.query.readNative(input.board_id, canonicalProposalId).items;
      const materializationConflicts = this.ports.materialization.preflight(
        input.board_id,
        checkedItems.filter((item) => item.state === "pending"),
        actorId,
        now,
      );
      for (const item of checkedItems) {
        const conflict = materializationConflicts.get(item.item_id);
        if (!conflict) continue;
        conflictItemIdSet.add(item.item_id);
        this.ports.governance.records.setGoalTreeItemCheck(
          canonicalProposalId,
          item.item_id,
          "conflict",
          conflict,
          now,
        );
      }
      const conflictItemIds = proposal.items
        .filter((item) => conflictItemIdSet.has(item.item_id))
        .map((item) => item.item_id);
      const planningIssues = this.ports.goals.planning.proposalGraphIssues(input.board_id, proposal.items);
      const cursor = this.ports.governance.records.recordGoalTreeCheck({
        board_id: input.board_id, proposal_id: canonicalProposalId, actor_id: actorId,
        conflict_item_ids: conflictItemIds, planning_issue_codes: planningIssues.map(issue => issue.code), at: now,
        origin: "native",
      });
      const outcome: GoalTreeProposalCheckResult = {
        proposal: this.ports.query.readNative(input.board_id, canonicalProposalId),
        conflict_item_ids: conflictItemIds,
        planning_issues: planningIssues,
        observed_event_cursor: cursor,
      };
      return { value: outcome, at: now };
    });
  }

  private checkLegacyContractGoalTreeProposal(
    input: GoalTreeProposalCheckInput,
    proposalView: GoalTreeProposalRecord,
    actorId: string,
  ): GoalTreeProposalCheckResult {
    const canonicalProposalId = proposalView.proposal_id;
    const rawProposalId = canonicalProposalId.slice("legacy-contract-proposal:".length);
    const hash = requestHash({
      board_id: input.board_id,
      proposal_id: canonicalProposalId,
      actor_id: actorId,
    });
    return this.ports.governance.records.executeGoalTreeCheck({
      board_id: input.board_id, actor_id: actorId, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {

      const proposal = this.ports.governance.query.getContractProposal(input.board_id, rawProposalId);
      if (!proposal) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.not_found",
          `找不到 Goal Tree 提案: ${canonicalProposalId}`,
        );
      }
      const now = this.ports.clock().toISOString();
      let conflict: Record<string, unknown> | null = null;
      try {
        if (proposal.state !== "pending") {
          throw this.ports.errorFactory(
            "contract_proposal.already_decided",
            "Contract Proposal 已经做过决定",
            { state: proposal.state },
          );
        }
        const validationInput: SubmitContractProposalInput = {
          board_id: input.board_id,
          goal_id: proposal.goal_id,
          actor_id: proposal.submitted_by,
          discovered_in_run_id: proposal.discovered_in_run_id,
          proposed_goal: proposal.proposed_goal,
          field_sources: proposal.field_sources,
          review_policy: proposal.review_policy,
          proposed_impacts: proposal.proposed_impacts,
          proposed_risks: proposal.proposed_risks,
          dependency_rewire_ids: proposal.dependency_rewire_ids,
          idempotency_key: `preflight:${rawProposalId}`,
        };
        this.ports.legacy.validateShape(validationInput);
        const goal = this.requireGoalOnBoard(input.board_id, proposal.goal_id);
        if (goal.definition_state !== "draft") {
          throw this.ports.errorFactory(
            "contract_proposal.goal_not_draft",
            "这个 Goal 已经不是 Draft，不能再用补全提案改写",
          );
        }
        this.ports.legacy.validate(
          input.board_id,
          proposal.goal_id,
          proposal.proposed_goal,
          proposal.field_sources,
          proposal.review_policy,
          proposal.proposed_impacts,
          proposal.proposed_risks,
          proposal.dependency_rewire_ids,
          true,
        );
      } catch (error) {
        if (this.ports.isDomainError(error)) {
          conflict = {
            code: error.code,
            message: error.message,
            ...(error.details ?? {}),
            recovery:
              error.details?.recovery ??
              "请根据字段路径修订 Contract Proposal；在冲突消失前不要提交用户决定。",
          };
        } else {
          conflict = {
            code: "contract_proposal.preflight_failed",
            message: error instanceof Error ? error.message : String(error),
            recovery: "请重新读取 Contract Proposal 并按工具 schema 修订；预检失败不会改写 canonical Goal。",
          };
        }
      }

      const checkedItem = {
        ...proposalView.items[0]!,
        state: conflict ? "conflict" as const : "pending" as const,
        conflict,
        updated_at: now,
      };
      const checkedProposal: GoalTreeProposalRecord = {
        ...proposalView,
        items: [checkedItem],
        updated_at: now,
      };
      const conflictItemIds = conflict ? [checkedItem.item_id] : [];
      const planningIssues = this.ports.goals.planning.proposalGraphIssues(input.board_id, checkedProposal.items);
      const cursor = this.ports.governance.records.recordGoalTreeCheck({
        board_id: input.board_id, proposal_id: canonicalProposalId, actor_id: actorId,
        conflict_item_ids: conflictItemIds, planning_issue_codes: planningIssues.map(issue => issue.code), at: now,
        origin: "legacy_contract_proposal", raw_proposal_id: rawProposalId,
      });
      const outcome: GoalTreeProposalCheckResult = {
        proposal: checkedProposal,
        conflict_item_ids: conflictItemIds,
        planning_issues: planningIssues,
        observed_event_cursor: cursor,
      };
      return { value: outcome, at: now };
    });
  }

  private requiredText(value: string, code: string, message: string): string {
    const text = value.trim();
    if (!text) throw this.ports.errorFactory(code, message);
    return text;
  }
  private requireGoalOnBoard(boardId: string, goalId: string): GoalRecord {
    const goal = this.ports.goals.query.getGoal(boardId, goalId);
    if (!goal) throw this.ports.errorFactory("goal.not_found", `Goal 不存在: ${goalId}`);
    return goal;
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
