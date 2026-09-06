import { randomUUID } from "node:crypto";
import { goalRelationTypes, type GoalRelationRecord, type GoalsQueryApi, type GoalsPlanningApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GovernanceApplicationApi, GoalTreeSemanticReview, GoalTreeProposalRecord, GoalTreeProposalItemRecord, GoalTreeProposalDecisionAuthority } from "@adeptify/goalboard-contracts/modules/governance-collaboration";
import type { NormalizedGoalTreeProposalDecision } from "./goal-tree-decision-inputs.js";
import type { NormalizedGoalTreeProposalItem } from "./proposal-normalizer.js";
import type { GoalTreeQueryApplication } from "./goal-tree-query.js";
import type { GoalTreeInputReader } from "./goal-tree-inputs.js";
const GOAL_RELATION_TYPES = new Set<GoalRelationRecord["type"]>(goalRelationTypes);
function asText(value: unknown): string { return value == null ? "" : String(value); }

/** Preserve proposal revisions and close only equivalent historical relation proposals. */
export class GoalTreeDecisionFollowup {
  constructor(private readonly ports: {
    goals: { query: Pick<GoalsQueryApi, "getRelation" | "listRelations">; planning: Pick<GoalsPlanningApi, "analyzeChange"> };
    governance: Pick<GovernanceApplicationApi, "records" | "query" | "provenance">;
    query: GoalTreeQueryApplication; inputs: GoalTreeInputReader;
    errorFactory: (code: string, message: string) => Error;
  }) {}
  goalTreeSemanticReview(boardId: string, changedGoalIds: string[]): GoalTreeSemanticReview | null {
    const changed = [...new Set(changedGoalIds)].sort();
    if (changed.length === 0) return null;
    const impact = this.ports.goals.planning.analyzeChange(boardId, changed);
    const required = impact.affected_ancestors.length > 0 ||
      impact.affected_dependents.length > 0 ||
      impact.adjacent_dependencies.length > 0;
    return {
      ...impact,
      structural_validation: "passed",
      status: required ? "required" : "not_required",
      next_action: required ? "review_affected_subgraph" : "continue",
      review_tool: "goalboard_v1_planning_analyze_change",
      canonical_changes_require_new_user_confirmation: true,
    };
  }

  createGoalTreeProposalRevision(
    boardId: string,
    proposal: GoalTreeProposalRecord,
    revisions: Array<NormalizedGoalTreeProposalDecision & { revised_item: NormalizedGoalTreeProposalItem }>,
    authority: GoalTreeProposalDecisionAuthority,
    runtimeActorId: string | null,
    at: string,
  ): GoalTreeProposalRecord {
    const proposalId = `goal-tree-proposal-${randomUUID()}`;
    const itemIds = new Set<string>();
    for (const revision of revisions) {
      if (itemIds.has(revision.revised_item.item_id)) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.revision_item_id_duplicate",
          "同一份修订提案中的新 item_id 不能重复",
        );
      }
      itemIds.add(revision.revised_item.item_id);
      const existing = this.ports.governance.records.findGoalTreeItemOwner(
        revision.revised_item.item_id,
      );
      if (existing) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.revision_item_id_exists",
          "修订条目必须使用新的稳定 item_id",
        );
      }
    }
    const version = proposal.version + 1;
    const summary = `用户要求修订 v${proposal.version}：${revisions.map((item) => item.reason).join("；")}`;
    this.ports.governance.records.insertGoalTreeProposal({
      proposal_id: proposalId,
      board_id: boardId,
      root_goal_id: proposal.root_goal_id,
      submitted_by: runtimeActorId ?? authority.actor_id,
      discovered_in_run_id: proposal.discovered_in_run_id,
      state: "pending",
      version,
      supersedes_proposal_id: proposal.proposal_id,
      base_event_cursor: this.ports.governance.query.eventCursor(boardId),
      summary,
      narrative: proposal.narrative,
      created_at: at,
      updated_at: at,
    });
    for (const [index, revision] of revisions.entries()) {
      const item = revision.revised_item;
      const baselineVersions = item.affected_objects.map((object) => this.ports.query.baselines.objectVersion(boardId, object, item));
      this.ports.governance.records.insertGoalTreeProposalItem({
        item_id: item.item_id,
        proposal_id: proposalId,
        board_id: boardId,
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
        supersedes_item_id: revision.item_id,
        created_at: at,
        updated_at: at,
      });
    }
    this.ports.governance.records.recordGoalTreeRevision({
      board_id: boardId, proposal_id: proposalId, authority, supersedes_proposal_id: proposal.proposal_id,
      supersedes_item_ids: revisions.map(item => item.item_id), at,
    });
    return this.ports.query.readNative(boardId, proposalId);
  }

  private goalTreeRelationChanges(
    boardId: string,
    item: GoalTreeProposalItemRecord,
  ): Array<{
    action: "add" | "deactivate";
    from_goal_id: string;
    to_goal_id: string;
    type: GoalRelationRecord["type"];
    key: string;
  }> {
    const payload = this.ports.inputs.goalTreePayloadRecord(item.payload, "关系条目 payload");
    const nested = payload.rewire && typeof payload.rewire === "object" && !Array.isArray(payload.rewire)
      ? payload.rewire as Record<string, unknown>
      : payload.proposal && typeof payload.proposal === "object" && !Array.isArray(payload.proposal)
        ? payload.proposal as Record<string, unknown>
        : payload;
    const formalGoalId = String(nested.formal_goal_id ?? payload.formal_goal_id ?? "").trim();
    return this.ports.inputs.goalTreeRelationEntries(item).map((raw) => {
      const normalized = this.ports.inputs.normalizeGoalTreeRelation(item, raw);
      const stored = normalized.relation_id
        ? this.ports.goals.query.getRelation(boardId, normalized.relation_id)
        : undefined;
      const replaceFormalGoal = (value: string) => value.replace("$new_goal", formalGoalId);
      const fromGoalId = replaceFormalGoal(normalized.from_goal_id || asText(stored?.from_goal_id));
      const toGoalId = replaceFormalGoal(normalized.to_goal_id || asText(stored?.to_goal_id));
      const type = (normalized.type ?? (stored ? asText(stored.type) : "")) as GoalRelationRecord["type"];
      if (!fromGoalId || !toGoalId || !GOAL_RELATION_TYPES.has(type)) {
        throw this.ports.errorFactory(
          "goal_tree_proposal.relation_required",
          "关系变更缺少可用于兼容核对的起点、终点或类型",
        );
      }
      return {
        action: normalized.action,
        from_goal_id: fromGoalId,
        to_goal_id: toGoalId,
        type,
        key: JSON.stringify([normalized.action, fromGoalId, toGoalId, type]),
      };
    });
  }

  reconcileEquivalentLegacyRewires(
    boardId: string,
    nativeProposalId: string,
    appliedRelationItems: GoalTreeProposalItemRecord[],
    actorId: string,
    at: string,
  ): void {
    if (appliedRelationItems.length === 0) return;
    const nativeChanges = appliedRelationItems.flatMap((item) => this.goalTreeRelationChanges(boardId, item));
    const nativeKeys = nativeChanges.map((change) => change.key).sort();
    if (nativeKeys.length === 0) return;
    const snapshot = this.ports.governance.query.snapshot(boardId);
    const activeRelationKeys = new Set(this.ports.goals.query.listRelations(boardId)
      .filter(relation => relation.state === "active")
      .map(relation => JSON.stringify([relation.from_goal_id, relation.to_goal_id, relation.type])));
    const legacyViews = new Map(
      this.ports.governance.provenance.legacyProposalView(snapshot)
        .filter((proposal) => proposal.origin === "legacy_rewire")
        .map((proposal) => [proposal.proposal_id, proposal]),
    );
    for (const rewire of snapshot.rewires) {
      if (rewire.state !== "pending") continue;
      if ((rewire.proposal.impacts?.length ?? 0) > 0 || (rewire.proposal.risks?.length ?? 0) > 0) continue;
      const legacyView = legacyViews.get(`legacy-rewire:${rewire.rewire_id}`);
      const legacyItem = legacyView?.items[0];
      if (!legacyItem) continue;
      const legacyChanges = this.goalTreeRelationChanges(boardId, legacyItem);
      const legacyKeys = legacyChanges.map((change) => change.key).sort();
      if (legacyKeys.length !== nativeKeys.length || legacyKeys.some((key, index) => key !== nativeKeys[index])) {
        continue;
      }
      const canonicalStateMatches = legacyChanges.every((change) => {
        const active = activeRelationKeys.has(JSON.stringify([change.from_goal_id, change.to_goal_id, change.type]));
        return change.action === "add" ? active : !active;
      });
      if (!canonicalStateMatches) continue;
      const impact = {
        ...rewire.impact,
        proposed_changes_applied: true,
        superseded_by_goal_tree_proposal_id: nativeProposalId,
        supersession_reason: "同一关系变更已由用户确认的 native Goal Tree Proposal 落地",
      };
      const updated = this.ports.governance.records.transitionRewire(
        boardId,
        rewire.rewire_id,
        "applied",
        { impact },
        at,
      );
      if (!updated) continue;
      this.ports.governance.records.recordEquivalentRewireSupersession({
        board_id: boardId, rewire_id: rewire.rewire_id, actor_id: actorId, goal_tree_proposal_id: nativeProposalId,
        relation_changes: legacyChanges.map(({ key: _key, ...change }) => change), at,
      });
    }
  }
}
