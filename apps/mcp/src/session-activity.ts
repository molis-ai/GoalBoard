import type { RuntimeGoalSessionActivity } from "@adeptify/goalboard-contracts/modules/private-work-context";

type RuntimeSessionLifecycle = {
  actorId: string;
  kind: "status" | "artifact" | "approval";
  label: string;
};

function runtimeSessionLifecycleEvent(name: string): RuntimeSessionLifecycle | null {
  switch (name) {
    case "goalboard_v1_select_goal":
      return { actorId: "goalboard:select-goal", kind: "status", label: "选择 Goal" };
    case "goalboard_v1_run_start":
      return { actorId: "goalboard:run-start", kind: "status", label: "开始执行" };
    case "goalboard_v1_run_report":
      return { actorId: "goalboard:run-report", kind: "status", label: "更新执行状态" };
    case "goalboard_v1_evidence_submit":
      return { actorId: "goalboard:evidence", kind: "artifact", label: "提交 Evidence" };
    case "goalboard_v1_review_submit":
      return { actorId: "goalboard:review", kind: "approval", label: "提交 Review" };
    case "goalboard_v1_complete":
      return { actorId: "goalboard:complete", kind: "status", label: "评估 Goal 完成状态" };
    case "goalboard_v1_revalidate":
      return { actorId: "goalboard:revalidate", kind: "status", label: "重新验证 Goal" };
    case "goalboard_v1_rework_request":
      return { actorId: "goalboard:rework", kind: "status", label: "请求返工" };
    case "goalboard_v1_release":
      return { actorId: "goalboard:claim-release", kind: "status", label: "释放 Goal" };
    default:
      return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalRecordText(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function lifecycleNestedText(
  record: Record<string, unknown>,
  parent: string,
  key: string,
): string | null {
  return optionalRecordText(asRecord(record[parent]), key);
}

function findLifecycleText(value: unknown, key: string, depth: number = 0): string | null {
  if (depth > 4 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findLifecycleText(entry, key, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const direct = optionalRecordText(record, key);
  if (direct) return direct;
  for (const nested of Object.values(record)) {
    const found = findLifecycleText(nested, key, depth + 1);
    if (found) return found;
  }
  return null;
}

function lifecycleGoalId(
  arguments_: Record<string, unknown>,
  result: Record<string, unknown>,
): string | null {
  return optionalRecordText(arguments_, "goal_id")
    ?? optionalRecordText(asRecord(arguments_.payload), "goal_id")
    ?? findLifecycleText(result, "goal_id");
}

function lifecycleResultId(result: Record<string, unknown>): string | null {
  for (const key of ["run_id", "claim_id", "evidence_id", "review_id"]) {
    const value = findLifecycleText(result, key);
    if (value) return value;
  }
  return null;
}

function lifecycleState(
  arguments_: Record<string, unknown>,
  result: Record<string, unknown>,
): string {
  const payload = asRecord(arguments_.payload);
  const state = optionalRecordText(payload, "state")
    ?? lifecycleNestedText(result, "run", "state")
    ?? lifecycleNestedText(result, "goal", "state")
    ?? optionalRecordText(result, "status");
  return state ? ` · ${state}` : "";
}

/** Extract only the established activity fields after a successful tool call. */
export function mcpRuntimeSessionActivity(name: string, arguments_: Record<string, unknown>, response: string): RuntimeGoalSessionActivity | null {
  const lifecycle = runtimeSessionLifecycleEvent(name);
  if (!lifecycle) return null;
  let result: Record<string, unknown>;
  try { result = JSON.parse(response) as Record<string, unknown>; } catch { return null; }
  if (name === "goalboard_v1_select_goal" && result.allowed !== true) return null;
  const goalId = lifecycleGoalId(arguments_, result);
  if (!goalId) return null;
  const payload = asRecord(arguments_.payload);
  const idempotencyKey = optionalRecordText(payload, "idempotency_key")
    ?? optionalRecordText(arguments_, "idempotency_key")
    ?? lifecycleResultId(result)
    ?? `${goalId}:${lifecycle.label}`;
  return {
    goal_id: goalId,
    actor_id: lifecycle.actorId,
    event: {
      source: "goalboard",
      kind: lifecycle.kind,
      source_id: `${name}:${idempotencyKey}`,
      content: `${lifecycle.label}：${goalId}${lifecycleState(arguments_, result)}`,
      metadata: {
        tool: name,
        goal_id: goalId,
        run_id: optionalRecordText(payload, "run_id") ?? lifecycleNestedText(result, "run", "run_id"),
        state: optionalRecordText(payload, "state") ?? lifecycleNestedText(result, "run", "state"),
      },
    },
  };
}
