import { createHash, randomUUID } from "node:crypto";
import type { GoalsQueryApi, GoalsApplicationApi, GoalRecord } from "@adeptify/goalboard-contracts/modules/goals";
import type { ExecutionApplicationApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { GovernanceApplicationApi, GoalTreeProposalSubmitInput, GoalTreeProposalRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import { goalTreeProposalDecompositionIssues } from "@adeptify/goalboard-module-goals";
import type { GoalTreeApplicationApi } from "./goal-tree-contract.js";
import { GoalTreeQueryApplication } from "./goal-tree-query.js";
import { GoalTreeInputReader } from "./goal-tree-inputs.js";
import { GoalTreeProposalNormalizer } from "./proposal-normalizer.js";
import { goalTreeProposalItemValidationIssues, goalTreeRiskDescription } from "./proposal-item-validation.js";
import { requireActiveGoalTreeProposalRun } from "./goal-tree-run-authority.js";
import { LifecycleReconciliationApplication } from "./lifecycle-application.js";

export interface GoalTreeSubmissionPorts {
  goals: Pick<GoalsApplicationApi, "commands" | "planning"> & { query: GoalsQueryApi };
  governance: Pick<GovernanceApplicationApi, "records" | "query" | "provenance">;
  execution: ExecutionApplicationApi;
  query: GoalTreeQueryApplication;
  lifecycle: LifecycleReconciliationApplication;
  clock: () => Date;
  errorFactory: (code: string, message: string, details?: Record<string, unknown>) => Error;
}

/** Submit a proposal, never materialize its suggested Goal/Relation/Risk changes. */
export class GoalTreeSubmissionApplication implements Pick<GoalTreeApplicationApi, "submitGoalTreeProposal"> {
  private readonly normalizer: GoalTreeProposalNormalizer;
  private readonly inputs: GoalTreeInputReader;
  constructor(private readonly ports: GoalTreeSubmissionPorts) {
    this.normalizer = new GoalTreeProposalNormalizer(ports.governance.provenance, ports.errorFactory);
    this.inputs = new GoalTreeInputReader({ query: ports.goals.query, commands: ports.goals.commands, errorFactory: ports.errorFactory });
  }

  submitGoalTreeProposal(
    input: GoalTreeProposalSubmitInput,
  ): { proposal: GoalTreeProposalRecord; replayed: boolean; observed_event_cursor: number } {
    const actorId = this.requiredText(
      input.actor_id,
      "goal_tree_proposal.actor_required",
      "提交 Goal Tree 提案需要当前 Runtime 的 actor_id",
    );
    const summary = this.requiredText(
      input.summary,
      "goal_tree_proposal.summary_required",
      "Goal Tree 提案需要面向用户的自然语言摘要",
    );
    const items = this.normalizer.normalizeGoalTreeProposalItems(input.items);
    const narrative = this.normalizer.normalizeGoalTreeProposalNarrative(input.narrative, items.length);
    for (const [index, item] of items.entries()) {
      const issue = goalTreeProposalItemValidationIssues(item)[0];
      if (issue) {
        throw this.ports.errorFactory(
          issue.code,
          `第 ${index + 1} 个条目中的风险「${goalTreeRiskDescription(item)}」不能提交：${issue.message}${issue.recovery}`,
        );
      }
    }
    const rootGoalId = input.root_goal_id?.trim() || null;
    const supersedesProposalId = input.supersedes_proposal_id?.trim() || null;
    const hash = requestHash({
      board_id: input.board_id,
      actor_id: actorId,
      discovered_in_run_id: input.discovered_in_run_id,
      root_goal_id: rootGoalId,
      summary,
      narrative,
      items: input.items,
      base_event_cursor: input.base_event_cursor ?? null,
      supersedes_proposal_id: supersedesProposalId,
    });
    return this.ports.governance.records.executeGoalTreeSubmission({
      board_id: input.board_id, actor_id: actorId, idempotency_key: input.idempotency_key, request_hash: hash,
    }, () => {
      this.requireBoard(input.board_id);
      const proposalRun = requireActiveGoalTreeProposalRun(
        { execution: this.ports.execution.query, clock: this.ports.clock,
          errorFactory: (code, message, details) => this.ports.errorFactory(code, message, details) },
        input.board_id,
        input.discovered_in_run_id,
        actorId,
        rootGoalId,
      );
      const decompositionIssue = goalTreeProposalDecompositionIssues(
        items,
        this.ports.goals.query.snapshot(input.board_id),
        this.ports.goals.planning.effectiveMethods(input.board_id),
        this.ports.goals.planning.projectComposition(input.board_id).method_pack_ids,
      )[0];
      if (decompositionIssue) {
        const { code, message, recovery, ...details } = decompositionIssue;
        throw this.ports.errorFactory(
          code,
          `${message}${recovery}`,
          details,
        );
      }
      const currentCursor = this.ports.governance.query.eventCursor(input.board_id);
      const baseEventCursor = input.base_event_cursor ?? currentCursor;
      if (!Number.isInteger(baseEventCursor) || baseEventCursor < 0 || baseEventCursor > currentCursor) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.base_cursor_invalid",
          "Goal Tree 提案的 base_event_cursor 必须是当前 Board 已观察到的事件游标",
        );
      }

      let previous: GoalTreeProposalRecord | null = null;
      if (supersedesProposalId) {
        previous = this.ports.query.listGoalTreeProposals({
          board_id: input.board_id,
          proposal_id: supersedesProposalId,
          include_legacy: true,
        }).proposals[0] ?? null;
        if (!previous) {
          throw this.ports.errorFactory(
            "goal_tree_proposal.not_found",
            `找不到 Goal Tree 提案: ${supersedesProposalId}`,
          );
        }
        if (previous.origin !== "native" && previous.origin !== "legacy_contract_proposal") {
          throw this.ports.errorFactory(
            "goal_tree_proposal.legacy_supersession_unsupported",
            `supersedes_proposal_id=${supersedesProposalId} 指向 ${previous.origin}；当前只支持修订 native Proposal 或 legacy Contract Proposal。Candidate 请用 candidate item 晋升，Rewire 只会在等价关系变更确认落地后自动关闭。`,
            {
              path: "supersedes_proposal_id",
              received_value: supersedesProposalId,
              resolved_proposal_id: previous.proposal_id,
              origin: previous.origin,
              allowed_origins: ["native", "legacy_contract_proposal"],
              next_action: previous.origin === "legacy_candidate"
                ? "promote_candidate_with_candidate_item"
                : "submit_equivalent_relation_change_without_supersedes_handle",
            },
          );
        }
        if (previous.state !== "pending") {
          throw this.ports.errorFactory(
            "goal_tree_proposal.revision_not_pending",
            "只能修订仍待用户决定的 Goal Tree 提案",
          );
        }
        if (previous.submitted_by !== actorId) {
          throw this.ports.errorFactory(
            "goal_tree_proposal.revision_not_owner",
            "只有原提案的当前 Runtime 可以创建它的修订版本",
          );
        }
      }
      const canonicalSupersedesProposalId = previous?.proposal_id ?? null;
      const supersedesNativeProposalId = previous?.origin === "native" ? previous.proposal_id : null;
      const supersedesLegacyProposalId = previous?.origin === "legacy_contract_proposal"
        ? previous.proposal_id
        : null;
      const effectiveRootGoalId = rootGoalId ?? previous?.root_goal_id ?? proposalRun.goal_id;
      if (
        items.some((item) => this.inputs.isRiskLifecycleChange(input.board_id, item)) &&
        effectiveRootGoalId !== proposalRun.goal_id
      ) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.root_goal_mismatch",
          "Risk 生命周期提案必须修改发起本轮澄清的同一条 Goal；不能用一条 Goal 的 clarifier Run 代替另一条 Goal 处理 Risk",
        );
      }
      const rootGoal = this.requireGoalOnBoard(input.board_id, effectiveRootGoalId);
      if (proposalRun.role === "executor" || proposalRun.role === "revalidator") {
        if (!items.every((item) => this.inputs.isRiskLifecycleChange(input.board_id, item))) {
          const roleLabel = proposalRun.role === "executor" ? "executor" : "revalidator";
          throw this.ports.errorFactory(
            `goal_tree_proposal.${roleLabel}_scope_invalid`,
            `${roleLabel} Run 只能为自己的同一 Goal 提交 Risk 生命周期条目；Goal、Contract、关系和普通 Risk 事实仍由 clarifier 规划`,
          );
        }
        if (
          rootGoal.definition_state !== "accepted" ||
          rootGoal.decomposition_state !== "closed_leaf"
        ) {
          throw this.ports.errorFactory(
            "goal_tree_proposal.executor_goal_not_executable",
            "executor 只能从已接受、可直接执行的同一条叶子 Goal 提交 Risk 生命周期结果",
          );
        }
      }
      this.inputs.requireDraftRiskLifecycleContract(input.board_id, rootGoal, items);
      if (!previous && items.some((item) => item.supersedes_item_id)) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.item_revision_without_proposal",
          "条目要引用 supersedes_item_id 时，必须同时指定 supersedes_proposal_id",
        );
      }
      if (previous) {
        const priorItemIds = new Set(previous.items.map((item) => item.item_id));
        for (const item of items) {
          if (item.supersedes_item_id && !priorItemIds.has(item.supersedes_item_id)) {
            throw this.ports.errorFactory(
              "goal_tree_proposal.item_revision_unknown",
              "修订条目只能引用被修订提案中的已有 item_id",
            );
          }
        }
      }

      for (const [index, item] of items.entries()) {
        const existingItem = this.ports.governance.records.findGoalTreeItemOwner(item.item_id);
        if (!existingItem) continue;
        const conflictingProposalId = existingItem.proposal_id;
        throw this.ports.errorFactory(
          "goal_tree_proposal.item_id_conflict",
          `items[${index}].item_id=${item.item_id} 已被提案 ${conflictingProposalId} 使用；请为修订条目提供新的全局唯一 item_id，并用 supersedes_item_id 保留来源关联。`,
          {
            path: `items[${index}].item_id`,
            received_value: item.item_id,
            conflicting_proposal_id: conflictingProposalId,
            conflicting_board_id: existingItem.board_id,
            next_action: "use_unique_item_id",
            recovery: "生成新的全局唯一 item_id；若这是对旧条目的修订，同时填写 supersedes_proposal_id 和 supersedes_item_id。失败调用不会创建 Proposal。",
          },
        );
      }

      const proposalId = `goal-tree-proposal-${randomUUID()}`;
      const now = this.ports.clock().toISOString();
      const version = (previous?.version ?? 0) + 1;
      this.ports.governance.records.insertGoalTreeProposal({
        proposal_id: proposalId,
        board_id: input.board_id,
        root_goal_id: effectiveRootGoalId,
        submitted_by: actorId,
        discovered_in_run_id: input.discovered_in_run_id,
        state: "pending",
        version,
        supersedes_proposal_id: supersedesNativeProposalId,
        supersedes_legacy_proposal_id: supersedesLegacyProposalId,
        base_event_cursor: baseEventCursor,
        summary,
        narrative,
        created_at: now,
        updated_at: now,
      });
      for (const [index, item] of items.entries()) {
        const baselineVersions = item.affected_objects.map((object) =>
          this.ports.query.baselines.objectVersion(input.board_id, object, item),
        );
        this.ports.governance.records.insertGoalTreeProposalItem({
          item_id: item.item_id,
          proposal_id: proposalId,
          board_id: input.board_id,
          ordinal: index + 1,
          kind: item.kind,
          operation: item.operation,
          payload: item.payload,
          source_refs: item.source_refs,
          reason: item.reason,
          explanation: item.explanation,
          confidence: item.confidence,
          affected_objects: item.affected_objects,
          baseline_versions: baselineVersions,
          requires_user_confirmation: true,
          state: "pending",
          supersedes_item_id: item.supersedes_item_id,
          created_at: now,
          updated_at: now,
        });
      }
      if (previous) {
        if (previous.origin === "native") {
          this.ports.governance.records.supersedeGoalTreeProposal(previous.proposal_id, now);
        } else {
          const rawLegacyProposalId = previous.proposal_id.slice("legacy-contract-proposal:".length);
          this.ports.governance.records.transitionContractProposal(
            input.board_id,
            rawLegacyProposalId,
            "superseded",
            {
              reason: "clarifier 用新的 native Goal Tree Proposal 修订了这份历史 Contract Proposal",
              superseded_by: actorId,
              superseded_by_goal_tree_proposal_id: proposalId,
            },
            now,
          );
        }
      }
      let cursor = this.ports.governance.records.recordGoalTreeSubmission({
        board_id: input.board_id, proposal_id: proposalId, actor_id: actorId,
        root_goal_id: effectiveRootGoalId, discovered_in_run_id: input.discovered_in_run_id,
        base_event_cursor: baseEventCursor, version, supersedes_proposal_id: canonicalSupersedesProposalId,
        item_ids: items.map(item => item.item_id), at: now,
      });
      if (proposalRun.role === "clarifier") {
        cursor = this.ports.execution.commands.completeRunForProposal(
          input.board_id, input.discovered_in_run_id, proposalId, actorId, now,
        );
        const beforeRelease = this.ports.lifecycle.projection(
          input.board_id, proposalRun.goal_id, this.ports.clock().toISOString(),
        );
        cursor = this.ports.lifecycle.reconcile(
          input.board_id,
          proposalRun.goal_id,
          actorId,
          beforeRelease.action_token,
          "完整 Proposal 已提交，Clarifier 工作已自动释放",
          now,
        ).observed_event_cursor;
      }
      const proposal = this.ports.query.readNative(input.board_id, proposalId);
      const outcome = { proposal, observed_event_cursor: cursor };
      return outcome;
    });
  }

  private requiredText(value: string, code: string, message: string): string {
    const text = value.trim();
    if (!text) throw this.ports.errorFactory(code, message);
    return text;
  }

  private requireBoard(boardId: string): void {
    if (!this.ports.goals.query.getBoard(boardId)) throw this.ports.errorFactory("board.not_found", `Board 不存在: ${boardId}`);
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
