import type { GoalTreeProposalDecideInput, GoalTreeProposalDecisionAuthority } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { GoalTreeProposalDecisionResult } from "./goal-tree-contract.js";
import type { LegacyProposalApplicationApi } from "./legacy-proposal-contract.js";
import type { GoalTreeQueryApplication } from "./goal-tree-query.js";
import type { GoalTreeDecisionNormalizer } from "./goal-tree-decision-inputs.js";
import type { GoalTreeDecisionFollowup } from "./goal-tree-decision-followup.js";

/** Unified IDs route to the original historical decisions, never rewrite their records. */
export class LegacyGoalTreeDecisionApplication {
  constructor(private readonly ports: {
    query: GoalTreeQueryApplication; normalizer: GoalTreeDecisionNormalizer; followup: GoalTreeDecisionFollowup;
    contract: Pick<LegacyProposalApplicationApi, "decideContractProposal">;
    candidate: Pick<LegacyProposalApplicationApi, "decideCandidate">;
    rewire: Pick<LegacyProposalApplicationApi, "confirmRewire">;
    errorFactory: (code: string, message: string, details?: Record<string, unknown>) => Error;
  }) {}
  decide(
    input: GoalTreeProposalDecideInput,
    proposalId: string,
    authority: GoalTreeProposalDecisionAuthority,
  ): GoalTreeProposalDecisionResult {
    const before = this.ports.query.listGoalTreeProposals({
      board_id: input.board_id,
      proposal_id: proposalId,
      include_legacy: true,
    }).proposals[0];
    if (!before || before.origin === "native") {
      throw this.ports.errorFactory(
        "goal_tree_proposal.not_found",
        `找不到 Goal Tree 提案: ${proposalId}`,
      );
    }
    const item = before.items[0];
    if (!item || before.items.length !== 1) {
      throw this.ports.errorFactory(
        "goal_tree_proposal.legacy_shape_invalid",
        "历史提案无法映射为唯一可决定条目；请使用对应历史决定入口",
      );
    }
    let decisions = this.ports.normalizer.normalizeDecisions(input.decisions, input.reason);
    if (input.confirm_all_pending === true) {
      if (decisions.length > 0) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.whole_confirmation_mixed",
          "整份确认不能同时携带逐项决定；请二选一",
        );
      }
      if (
        authority.whole_confirmation_prompted !== true ||
        (authority.authority_source === "runtime_dialogue" &&
          authority.prompted_proposal_id !== proposalId)
      ) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.whole_confirmation_ambiguous",
          "简短确认只有在上一问明确点名这一份历史提案时才能生效",
          {
            proposal_id: proposalId,
            whole_confirmation_prompted: authority.whole_confirmation_prompted === true,
            prompted_proposal_id: authority.prompted_proposal_id ?? null,
            next_action: "bind_confirmation_to_exact_proposal_or_decide_item",
          },
        );
      }
      decisions = [{
        item_id: item.item_id,
        decision: "confirm",
        reason: this.requiredText(
          input.reason ?? "",
          "goal_tree_proposal.decision_reason_required",
          "整份确认需要记录用户的确认理由或原始表达",
        ),
        revised_item: null,
      }];
    }
    if (decisions.length !== 1) {
      throw this.ports.errorFactory(
        "goal_tree_proposal.legacy_single_decision_required",
        "每个历史兼容提案只包含一项，请明确确认或拒绝这一项",
      );
    }
    const decision = decisions[0]!;
    if (decision.item_id !== item.item_id) {
      throw this.ports.errorFactory(
        "goal_tree_proposal.decision_item_not_found",
        `提案中不存在条目: ${decision.item_id}`,
      );
    }
    if (decision.decision === "revise") {
      throw this.ports.errorFactory(
        "goal_tree_proposal.legacy_revision_unsupported",
        "历史兼容提案不能在原记录上修订；请创建 native Goal Tree Proposal 并引用这条历史提案",
        { proposal_id: proposalId, next_action: "create_native_revision" },
      );
    }

    let observedEventCursor: number;
    let replayed: boolean;
    if (proposalId.startsWith("legacy-contract-proposal:")) {
      const result = this.ports.contract.decideContractProposal({
        board_id: input.board_id,
        proposal_id: proposalId.slice("legacy-contract-proposal:".length),
        actor_id: authority.actor_id,
        actor_kind: "user",
        decision: decision.decision === "confirm" ? "approved" : "rejected",
        reason: decision.reason,
        idempotency_key: input.idempotency_key,
      });
      observedEventCursor = result.observed_event_cursor;
      replayed = result.replayed;
    } else if (proposalId.startsWith("legacy-candidate:")) {
      const result = this.ports.candidate.decideCandidate({
        board_id: input.board_id,
        candidate_id: proposalId.slice("legacy-candidate:".length),
        actor_id: authority.actor_id,
        actor_kind: "user",
        decision: decision.decision === "confirm" ? "approved" : "rejected",
        reason: decision.reason,
        idempotency_key: input.idempotency_key,
      });
      observedEventCursor = result.observed_event_cursor;
      replayed = result.replayed;
    } else if (proposalId.startsWith("legacy-rewire:")) {
      const result = this.ports.rewire.confirmRewire({
        board_id: input.board_id,
        rewire_id: proposalId.slice("legacy-rewire:".length),
        actor_id: authority.actor_id,
        actor_kind: "user",
        decision: decision.decision === "confirm" ? "confirmed" : "rejected",
        reason: decision.reason,
        idempotency_key: input.idempotency_key,
      });
      observedEventCursor = result.observed_event_cursor;
      replayed = result.replayed;
    } else {
      throw this.ports.errorFactory(
        "goal_tree_proposal.legacy_origin_unsupported",
        "这个历史提案类型还不能从统一决定入口处理",
      );
    }

    const proposal = this.ports.query.listGoalTreeProposals({
      board_id: input.board_id,
      proposal_id: proposalId,
      include_legacy: true,
    }).proposals[0];
    if (!proposal) {
      throw this.ports.errorFactory(
        "goal_tree_proposal.not_found",
        `决定完成后无法读取 Goal Tree 提案: ${proposalId}`,
      );
    }
    return {
      proposal,
      revision_proposals: [],
      applied_item_ids: decision.decision === "confirm" ? [item.item_id] : [],
      rejected_item_ids: decision.decision === "reject" ? [item.item_id] : [],
      revised_item_ids: [],
      conflict_item_ids: [],
      semantic_review: decision.decision === "confirm"
        ? this.ports.followup.goalTreeSemanticReview(
            input.board_id,
            item.affected_objects
              .filter((object) => object.object_type === "goal")
              .map((object) => object.object_id),
          )
        : null,
      transitions: [],
      observed_event_cursor: observedEventCursor,
      replayed,
    };
  }
  private requiredText(value: string, code: string, message: string): string {
    const text = value.trim();
    if (!text) throw this.ports.errorFactory(code, message);
    return text;
  }
}
