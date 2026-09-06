import { randomUUID } from "node:crypto";
import type { GoalTreeProposalItemRecord, GoalTreeProposalItemInput, GoalTreeProposalItemExplanation, GoalTreeProposalNarrative, ProposalAffectedObject, GovernanceProvenanceApi } from "@adeptify/goalboard-contracts/modules/governance-collaboration";

const GOAL_TREE_PROPOSAL_KINDS = new Set<GoalTreeProposalItemRecord["kind"]>([
  "goal",
  "contract",
  "relation",
  "dependency",
  "risk",
  "policy",
  "candidate",
  "rewire",
]);

const GOAL_TREE_PROPOSAL_OPERATIONS = new Set<GoalTreeProposalItemRecord["operation"]>([
  "create",
  "update",
  "deactivate",
]);

const PROPOSAL_AFFECTED_OBJECT_TYPES = new Set<ProposalAffectedObject["object_type"]>([
  "goal",
  "relation",
  "risk",
  "policy",
  "candidate",
  "rewire",
]);

export interface NormalizedGoalTreeProposalItem {
  item_id: string;
  kind: GoalTreeProposalItemRecord["kind"];
  operation: GoalTreeProposalItemRecord["operation"];
  payload: Record<string, unknown>;
  source_refs: string[];
  reason: string;
  explanation: GoalTreeProposalItemExplanation | null;
  confidence: number;
  affected_objects: ProposalAffectedObject[];
  requires_user_confirmation: true;
  supersedes_item_id: string | null;
}

const LARGE_GOAL_TREE_PROPOSAL_ITEM_COUNT = 5;

/** Existing proposal wire normalization; no owner facts or user decisions are written here. */
export class GoalTreeProposalNormalizer {
  constructor(private readonly provenance: Pick<GovernanceProvenanceApi, "normalizeProposalSource">,
    private readonly errorFactory: (code: string, message: string) => Error) {}

  private semanticText(value: unknown, code: string, message: string): string {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) throw this.errorFactory(code, message);
    return normalized;
  }
  
  private semanticTextList(value: unknown, code: string, message: string): string[] {
    if (!Array.isArray(value)) throw this.errorFactory(code, message);
    return unique(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean));
  }
  
  normalizeGoalTreeProposalNarrative(
    narrative: GoalTreeProposalNarrative | null | undefined,
    itemCount: number,
  ): GoalTreeProposalNarrative | null {
    if (narrative == null) {
      if (itemCount >= LARGE_GOAL_TREE_PROPOSAL_ITEM_COUNT) {
        throw this.errorFactory(
          "goal_tree_proposal.narrative_required",
          `包含 ${itemCount} 项变化的大型 Goal Tree 提案必须说明 why_now、problem、main_path、expected_effect 和 non_goals，让用户能在确认前理解“原问题 → 新链路 → 预期效果”；单纯 summary 不足以审批整份变更`,
        );
      }
      return null;
    }
    if (typeof narrative !== "object" || Array.isArray(narrative)) {
      throw this.errorFactory("goal_tree_proposal.narrative_invalid", "Goal Tree 提案的 narrative 必须是结构化对象");
    }
    const mainPath = this.semanticTextList(
      narrative.main_path,
      "goal_tree_proposal.narrative_main_path_invalid",
      "Goal Tree 提案的 narrative.main_path 必须是按依赖顺序排列的非空文字数组",
    );
    if (mainPath.length === 0) {
      throw this.errorFactory(
        "goal_tree_proposal.narrative_main_path_required",
        "Goal Tree 提案必须至少说明一段变更后的主链路",
      );
    }
    return {
      why_now: this.semanticText(
        narrative.why_now,
        "goal_tree_proposal.narrative_why_now_required",
        "Goal Tree 提案必须说明为什么现在需要改变",
      ),
      problem: this.semanticText(
        narrative.problem,
        "goal_tree_proposal.narrative_problem_required",
        "Goal Tree 提案必须说明原目标或流程的具体问题",
      ),
      main_path: mainPath,
      expected_effect: this.semanticText(
        narrative.expected_effect,
        "goal_tree_proposal.narrative_effect_required",
        "Goal Tree 提案必须说明采用后的预期效果",
      ),
      non_goals: this.semanticTextList(
        narrative.non_goals,
        "goal_tree_proposal.narrative_non_goals_invalid",
        "Goal Tree 提案的 narrative.non_goals 必须是文字数组；没有非目标时传空数组",
      ),
    };
  }
  
  private normalizeGoalTreeProposalItemExplanation(
    explanation: GoalTreeProposalItemExplanation | null | undefined,
    index: number,
  ): GoalTreeProposalItemExplanation | null {
    if (explanation == null) return null;
    if (typeof explanation !== "object" || Array.isArray(explanation)) {
      throw this.errorFactory(
        "goal_tree_proposal.item_explanation_invalid",
        `第 ${index + 1} 个条目的 explanation 必须是结构化对象`,
      );
    }
    return {
      problem: this.semanticText(
        explanation.problem,
        "goal_tree_proposal.item_problem_required",
        `第 ${index + 1} 个条目必须说明主要解决什么问题`,
      ),
      expected_effect: this.semanticText(
        explanation.expected_effect,
        "goal_tree_proposal.item_effect_required",
        `第 ${index + 1} 个条目必须说明会改变什么`,
      ),
      non_goals: this.semanticTextList(
        explanation.non_goals,
        "goal_tree_proposal.item_non_goals_invalid",
        `第 ${index + 1} 个条目的 explanation.non_goals 必须是文字数组；没有非目标时传空数组`,
      ),
      depends_on_item_ids: this.semanticTextList(
        explanation.depends_on_item_ids,
        "goal_tree_proposal.item_dependencies_invalid",
        `第 ${index + 1} 个条目的 explanation.depends_on_item_ids 必须是 item_id 数组`,
      ),
    };
  }
  
  private goalTreeProposalRelationPayloads(
    item: GoalTreeProposalItemInput,
    itemIndex: number,
  ): Record<string, unknown>[] {
    const source = item.payload.relations ?? item.payload.relation ?? item.payload;
    const values = Array.isArray(source) ? source : [source];
    if (values.length === 0) {
      throw this.errorFactory(
        "goal_tree_proposal.relations_required",
        `第 ${itemIndex + 1} 个 ${item.kind} 条目至少需要一条关系；请在 payload 直接提供关系字段，或使用 relations 数组。`,
      );
    }
    return values.map((value, relationIndex) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw this.errorFactory(
          "goal_tree_proposal.item_payload_invalid",
          `第 ${itemIndex + 1} 个 ${item.kind} 条目的第 ${relationIndex + 1} 条关系必须是结构化对象。`,
        );
      }
      return value as Record<string, unknown>;
    });
  }
  
  private validateGoalTreeProposalRelationPayload(
    item: GoalTreeProposalItemInput,
    itemIndex: number,
  ): void {
    if (item.kind !== "relation" && item.kind !== "dependency") return;
    for (const [relationIndex, relation] of this.goalTreeProposalRelationPayloads(item, itemIndex).entries()) {
      const location = `第 ${itemIndex + 1} 个 ${item.kind} 条目的第 ${relationIndex + 1} 条关系`;
      const action = String(relation.action ?? (item.operation === "deactivate" ? "deactivate" : "add"));
      if (action !== "add" && action !== "deactivate") {
        throw this.errorFactory(
          "goal_tree_proposal.relation_action_invalid",
          `${location} 的 action 必须是 add 或 deactivate。`,
        );
      }
      const relationId = String(relation.relation_id ?? "").trim();
      const fromGoalId = String(relation.from_goal_id ?? "").trim();
      const toGoalId = String(relation.to_goal_id ?? "").trim();
      const relationType = String(relation.type ?? "").trim();
      if (item.kind === "dependency" && relationType && relationType !== "depends_on") {
        throw this.errorFactory(
          "goal_tree_proposal.dependency_type_invalid",
          `${location} 的 type 只能是 depends_on；kind=dependency 已固定该类型。方向是消费方/依赖方 Goal → 提供方/前置 Goal。`,
        );
      }
      if (action === "deactivate" && relationId) continue;
      const missing = [
        ...(!fromGoalId ? ["from_goal_id"] : []),
        ...(!toGoalId ? ["to_goal_id"] : []),
        ...(item.kind === "relation" && !relationType ? ["type"] : []),
      ];
      if (missing.length === 0) continue;
      if (item.kind === "dependency") {
        throw this.errorFactory(
          "goal_tree_proposal.dependency_required",
          `${location}缺少字段：${missing.join("、")}。规范格式示例：{"from_goal_id":"consumer-goal","to_goal_id":"provider-goal","type":"depends_on"}；方向是消费方/依赖方 Goal → 提供方/前置 Goal。`,
        );
      }
      throw this.errorFactory(
        "goal_tree_proposal.relation_required",
        `${location}缺少字段：${missing.join("、")}。规范格式示例：{"from_goal_id":"child-goal","to_goal_id":"parent-goal","type":"part_of"}；part_of 方向是子 Goal → 父 Goal。`,
      );
    }
  }
  
  normalizeGoalTreeProposalItems(
    items: GoalTreeProposalItemInput[],
  ): NormalizedGoalTreeProposalItem[] {
    if (items.length === 0) {
      throw this.errorFactory("goal_tree_proposal.items_required", "一份 Goal Tree 提案至少需要一个变更条目");
    }
    const ids = new Set<string>();
    const normalized = items.map((item, index) => {
      if (!GOAL_TREE_PROPOSAL_KINDS.has(item.kind)) {
        throw this.errorFactory("goal_tree_proposal.item_kind_invalid", `第 ${index + 1} 个条目的类型无效`);
      }
      if (!GOAL_TREE_PROPOSAL_OPERATIONS.has(item.operation)) {
        throw this.errorFactory("goal_tree_proposal.item_operation_invalid", `第 ${index + 1} 个条目的操作无效`);
      }
      if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) {
        throw this.errorFactory("goal_tree_proposal.item_payload_invalid", `第 ${index + 1} 个条目必须带结构化内容`);
      }
      this.validateGoalTreeProposalRelationPayload(item, index);
      const itemId = item.item_id?.trim() || `goal-tree-proposal-item-${randomUUID()}`;
      if (ids.has(itemId)) {
        throw this.errorFactory("goal_tree_proposal.item_id_duplicate", "同一份提案中的 item_id 不能重复");
      }
      ids.add(itemId);
      const source = this.provenance.normalizeProposalSource(item, index);
      const seenObjects = new Set<string>();
      const affectedObjects: ProposalAffectedObject[] = [];
      const addAffectedObject = (object: ProposalAffectedObject, objectIndex: number): void => {
        if (!PROPOSAL_AFFECTED_OBJECT_TYPES.has(object.object_type)) {
          throw this.errorFactory(
            "goal_tree_proposal.affected_object_type_invalid",
            `第 ${index + 1} 个条目的第 ${objectIndex + 1} 个受影响对象类型无效`,
          );
        }
        const objectId = object.object_id.trim();
        if (!objectId) {
          throw this.errorFactory(
            "goal_tree_proposal.affected_object_required",
            `第 ${index + 1} 个条目的第 ${objectIndex + 1} 个受影响对象缺少 ID`,
          );
        }
        const key = `${object.object_type}:${objectId}`;
        if (seenObjects.has(key)) return;
        seenObjects.add(key);
        affectedObjects.push({ object_type: object.object_type, object_id: objectId });
      };
      item.affected_objects.forEach(addAffectedObject);
      if (item.kind === "relation" || item.kind === "dependency") {
        for (const relation of this.goalTreeProposalRelationPayloads(item, index)) {
          const relationId = String(relation.relation_id ?? "").trim();
          const fromGoalId = String(relation.from_goal_id ?? "").trim();
          const toGoalId = String(relation.to_goal_id ?? "").trim();
          if (relationId) addAffectedObject({ object_type: "relation", object_id: relationId }, affectedObjects.length);
          if (fromGoalId) addAffectedObject({ object_type: "goal", object_id: fromGoalId }, affectedObjects.length);
          if (toGoalId) addAffectedObject({ object_type: "goal", object_id: toGoalId }, affectedObjects.length);
        }
      }
      if (affectedObjects.length === 0) {
        throw this.errorFactory("goal_tree_proposal.affected_objects_required", `第 ${index + 1} 个条目必须标出受影响对象`);
      }
      return {
        item_id: itemId,
        kind: item.kind,
        operation: item.operation,
        payload: canonicalize(item.payload) as Record<string, unknown>,
        ...source,
        explanation: this.normalizeGoalTreeProposalItemExplanation(item.explanation, index),
        affected_objects: affectedObjects,
        supersedes_item_id: item.supersedes_item_id?.trim() || null,
      };
    });
    for (const [index, item] of normalized.entries()) {
      if (items.length >= LARGE_GOAL_TREE_PROPOSAL_ITEM_COUNT && !item.explanation) {
        throw this.errorFactory(
          "goal_tree_proposal.item_explanation_required",
          `包含 ${items.length} 项变化的大型 Goal Tree 提案中，第 ${index + 1} 项必须用 explanation 说明主要问题、预期效果、非目标和与其他 change 的依赖`,
        );
      }
      for (const dependencyId of item.explanation?.depends_on_item_ids ?? []) {
        if (dependencyId === item.item_id) {
          throw this.errorFactory(
            "goal_tree_proposal.item_dependency_self",
            `第 ${index + 1} 个条目不能把自己列为语义依赖`,
          );
        }
        if (!ids.has(dependencyId)) {
          throw this.errorFactory(
            "goal_tree_proposal.item_dependency_unknown",
            `第 ${index + 1} 个条目引用了同一提案中不存在的依赖 item_id「${dependencyId}」`,
          );
        }
      }
    }
    return normalized;
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

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
