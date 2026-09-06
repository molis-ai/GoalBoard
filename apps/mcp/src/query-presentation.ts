import { createHash } from "node:crypto";
import type { PlanningMethodComposition, PlanningMethodPack } from "@adeptify/goalboard-contracts/modules/goals";
import type { AvailableQueryResult } from "@adeptify/goalboard-plugin-goals";

/** Keep host-specific Error classes outside the presentation package. */
export type McpPresentationErrorFactory = (code: string, message: string, details?: Record<string, unknown>) => Error;

function planningMethodCatalogId(methods: readonly PlanningMethodPack[]): string {
  const canonical = [...methods]
    .sort((left, right) => left.method_id.localeCompare(right.method_id))
    .map((method) => ({
      method_id: method.method_id,
      version: method.version,
      scope: method.scope,
      updated_at: method.updated_at,
      digest: createHash("sha256").update(JSON.stringify(method)).digest("hex"),
    }));
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 24)}`;
}

function planningMethodSummary(method: PlanningMethodPack): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    method_id: method.method_id,
    version: method.version,
    scope: method.scope,
    kind: method.kind,
    name: method.name,
    summary: method.summary,
    applies_to: method.applies_to,
    domain_tags: method.domain_tags,
    enabled: method.enabled,
    created_at: method.created_at,
    updated_at: method.updated_at,
  };
  if ("overridden_scopes" in method) {
    summary.overridden_scopes = method.overridden_scopes;
  }
  return summary;
}

function planningMethodDetail(method: PlanningMethodPack): Record<string, unknown> {
  return { ...planningMethodSummary(method), instructions: method.instructions };
}

export function planningMethodResponse(
  methods: readonly PlanningMethodPack[],
  composition: PlanningMethodComposition,
  arguments_: Record<string, unknown>,
  createError: McpPresentationErrorFactory,
): Record<string, unknown> {
  const modernRead = Object.hasOwn(arguments_, "method_ids") || Object.hasOwn(arguments_, "include_instructions");
  const requestedIds = Array.isArray(arguments_.method_ids)
    ? [...new Set(arguments_.method_ids.map((value) => String(value).trim()).filter(Boolean))]
    : null;
  const byId = new Map(methods.map((method) => [method.method_id, method]));
  const missingIds = requestedIds?.filter((methodId) => !byId.has(methodId)) ?? [];
  if (missingIds.length) {
    throw createError(
      "planning_method.not_found",
      `找不到规划方法：${missingIds.join("、")}`,
      { missing_method_ids: missingIds, available_method_ids: methods.map((method) => method.method_id) },
    );
  }
  const selected = requestedIds == null
    ? [...methods]
    : requestedIds.map((methodId) => byId.get(methodId)!).filter(Boolean);
  const includeInstructions = arguments_.include_instructions !== false;
  const result: Record<string, unknown> = {
    catalog_id: planningMethodCatalogId(methods),
    returned_method_ids: selected.map((method) => method.method_id),
    include_instructions: includeInstructions,
    methods: modernRead
      ? selected.map((method) => includeInstructions ? planningMethodDetail(method) : planningMethodSummary(method))
      : selected,
    composition: modernRead
      ? { method_pack_ids: composition.method_pack_ids, method_names: composition.method_names }
      : composition,
  };
  return result;
}

export function availableResponse(
  result: AvailableQueryResult,
  detailLevel: "summary" | "full",
): Record<string, unknown> {
  const metadata = {
    detail_level: detailLevel,
    available_count: result.available.length,
    blocked_count: result.blocked.length,
    blocked_overview_count: result.blocked_overview.length,
  };
  if (detailLevel === "full") return { ...metadata, ...result };
  return {
    ...metadata,
    observed_event_cursor: result.observed_event_cursor,
    available: result.available.map((item) => ({
      goal: { goal_id: item.goal.goal_id, title: item.goal.title },
      action_id: item.action_id,
      action_token: item.action_token,
      action_kind: item.action_kind,
      action_target_type: item.action_target_type,
      action_target_id: item.action_target_id,
      role: item.role,
      work_state: item.work_state,
      next_action: item.next_action,
      review_obligation_id: item.review_obligation_id,
      requires_parent_confirmation: item.requires_parent_confirmation,
      why_now: item.why_now,
      priority_hint: item.priority_hint,
      dependency_summary: item.dependency_summary,
      risk_summary: item.risk_summary,
      required_capabilities: item.resolved_policy.required_capabilities,
      planning: item.planning,
    })),
    blocked: result.blocked.map((item) => ({
      goal: { goal_id: item.goal.goal_id, title: item.goal.title },
      work_state: item.work_state,
      next_action: item.next_action,
      reasons: item.reasons,
      priority_hint: item.priority_hint,
      risk_summary: item.risk_summary,
    })),
    blocked_overview: result.blocked_overview.map((item) => ({
      goal: { goal_id: item.goal.goal_id, title: item.goal.title },
      work_state: item.work_state,
      next_action: item.next_action,
      reasons: item.reasons,
      priority_hint: item.priority_hint,
    })),
    parallel_suggestion: result.parallel_suggestion,
  };
}

export interface DraftDialogueHistoryOptions {
  includeHistory: boolean;
  historyLimit: number;
  beforeTurnIndex: number | null;
}

export function draftDialogueHistoryOptions(
  arguments_: Record<string, unknown>,
  createError: McpPresentationErrorFactory,
): DraftDialogueHistoryOptions {
  const includeHistory = arguments_.include_history === true;
  if (!includeHistory && (arguments_.history_limit != null || arguments_.history_before_turn_index != null)) {
    throw createError(
      "draft_dialogue.history_not_requested",
      "history_limit 和 history_before_turn_index 只在 include_history=true 时使用",
      { next_action: "set_include_history_true" },
    );
  }
  const historyLimit = arguments_.history_limit == null ? 20 : Number(arguments_.history_limit);
  if (!Number.isInteger(historyLimit) || historyLimit < 1 || historyLimit > 100) {
    throw createError(
      "draft_dialogue.history_limit_invalid",
      "history_limit 必须是 1 到 100 的整数",
      { field_path: "history_limit", received_value: arguments_.history_limit, minimum: 1, maximum: 100 },
    );
  }
  const beforeTurnIndex = arguments_.history_before_turn_index == null
    ? null
    : Number(arguments_.history_before_turn_index);
  if (beforeTurnIndex != null && (!Number.isInteger(beforeTurnIndex) || beforeTurnIndex < 1)) {
    throw createError(
      "draft_dialogue.history_cursor_invalid",
      "history_before_turn_index 必须是正整数",
      { field_path: "history_before_turn_index", received_value: arguments_.history_before_turn_index, minimum: 1 },
    );
  }
  return { includeHistory, historyLimit, beforeTurnIndex };
}

export function draftDialogueResponse<Turn extends { turn_index: number }, Rest extends object>(
  result: Rest & { turns: Turn[] },
  options: DraftDialogueHistoryOptions,
) {
  const { includeHistory, historyLimit, beforeTurnIndex } = options;
  const allTurns = [...result.turns].sort((left, right) => left.turn_index - right.turn_index);
  const latestTurn = allTurns.at(-1) ?? null;
  const eligibleTurns = beforeTurnIndex == null
    ? allTurns
    : allTurns.filter((turn) => turn.turn_index < beforeTurnIndex);
  const returnedTurns: Turn[] = includeHistory
    ? eligibleTurns.slice(-historyLimit)
    : [];
  const hasMore = includeHistory
    ? eligibleTurns.length > returnedTurns.length
    : allTurns.length > 0;
  const nextBeforeTurnIndex = includeHistory
    ? hasMore ? returnedTurns[0]?.turn_index ?? null : null
    : latestTurn ? latestTurn.turn_index + 1 : null;
  const { turns: _turns, ...compact } = result;
  return {
    ...compact,
    latest_turn: latestTurn,
    turn_count: allTurns.length,
    history: {
      included: includeHistory,
      returned_count: returnedTurns.length,
      total_count: allTurns.length,
      has_more: hasMore,
      next_before_turn_index: nextBeforeTurnIndex,
    },
    ...(includeHistory ? { turns: returnedTurns } : {}),
  };
}
