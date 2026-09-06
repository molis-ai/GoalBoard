import type { ExecutionImpactPolicyApi } from "@adeptify/goalboard-contracts/modules/execution";
import type { GoalLifecycleReason, ImpactBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";

type ResourceAccess = Pick<ImpactBindingRecord, "access" | "input_snapshot">;

function pairIsSafe(existing: ResourceAccess, requested: ResourceAccess): boolean {
  if (existing.access === "exclusive" || requested.access === "exclusive") return false;
  if (existing.access === "decide" || requested.access === "decide") return false;
  if (existing.access === "read" && requested.access === "read") return true;
  if (existing.access === "read" && requested.access === "write") return Boolean(existing.input_snapshot);
  if (existing.access === "write" && requested.access === "read") return Boolean(requested.input_snapshot);
  return false;
}

/** Execution owns compatibility rules; it does not read or modify the Goals Store. */
export const executionImpactPolicy: ExecutionImpactPolicyApi = {
  conflicts(requested, occupied) {
    const conflicts: GoalLifecycleReason[] = [];
    for (const wanted of requested) {
      if (wanted.state !== "confirmed") continue;
      for (const existing of occupied) {
        if (existing.surface !== wanted.surface || pairIsSafe(existing, wanted)) continue;
        const code = existing.access === "exclusive" || wanted.access === "exclusive"
          ? "impact.exclusive_conflict"
          : existing.access === "decide" || wanted.access === "decide"
            ? "impact.decision_conflict"
            : existing.access === "write" && wanted.access === "write"
              ? "impact.write_write_conflict"
              : "impact.read_write_unpinned";
        conflicts.push({
          code, severity: "blocker", subject_type: "surface", subject_id: wanted.surface,
          message: `影响面「${wanted.surface}」正在被不兼容地占用`,
          facts: { active_claim_id: existing.claim_id, active_goal_id: existing.existing_goal_id,
            existing_access: existing.access, requested_access: wanted.access },
          remediation: "等待现有 Claim 释放，或确认只读输入快照",
        });
      }
    }
    return conflicts;
  },
  allowsParallel(existing, requested) {
    return requested.every((wanted) => existing.every((current) =>
      current.surface !== wanted.surface || pairIsSafe(current, wanted)));
  },
};
