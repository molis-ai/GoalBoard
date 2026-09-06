import assert from "node:assert/strict";
import test from "node:test";
import { executionImpactPolicy } from "@adeptify/goalboard-module-execution";
import type { ImpactAccess, ImpactBindingRecord } from "@adeptify/goalboard-contracts/modules/goals";

const declaration = (access: ImpactAccess, input_snapshot: string | null = null): ImpactBindingRecord => ({
  binding_id: "impact-requested", board_id: "project", goal_id: "goal-requested", surface: "src/shared.ts",
  access, input_snapshot, state: "confirmed", reason: "Change shared behavior", created_by: "user",
  created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z",
  deactivated_at: null, deactivation_reason: null,
});

test("only the reading party's pinned snapshot permits read/write concurrency in either direction", () => {
  const cases: [ImpactAccess, string | null, ImpactAccess, string | null, boolean][] = [
    ["read", null, "read", null, true],
    ["read", null, "write", null, false],
    ["read", "snapshot-old", "write", null, true],
    ["read", null, "write", "writers-snapshot", false],
    ["write", null, "read", null, false],
    ["write", null, "read", "snapshot-old", true],
    ["write", "writers-snapshot", "read", null, false],
    ["write", "snapshot-old", "write", "snapshot-old", false],
  ];
  for (const [currentAccess, currentSnapshot, wantedAccess, wantedSnapshot, allowed] of cases) {
    const current = declaration(currentAccess, currentSnapshot);
    const wanted = declaration(wantedAccess, wantedSnapshot);
    assert.equal(executionImpactPolicy.allowsParallel([current], [wanted]), allowed);
    const conflicts = executionImpactPolicy.conflicts([wanted], [
      { ...current, claim_id: "claim-existing", existing_goal_id: "goal-existing" },
    ]);
    assert.equal(conflicts.length, allowed ? 0 : 1);
    if (!allowed) assert.equal(conflicts[0]!.code,
      currentAccess === "write" && wantedAccess === "write" ? "impact.write_write_conflict" : "impact.read_write_unpinned");
  }
});

test("decide and exclusive block even pinned readers and report the actual occupying Claim", () => {
  for (const currentAccess of ["read", "write", "decide", "exclusive"] as const) {
    for (const wantedAccess of ["decide", "exclusive"] as const) {
      const current = declaration(currentAccess, "snapshot");
      const wanted = declaration(wantedAccess, "snapshot");
      const conflict = executionImpactPolicy.conflicts([wanted], [
        { ...current, claim_id: "claim-existing", existing_goal_id: "goal-existing" },
      ])[0];
      assert.deepEqual(conflict, {
        code: currentAccess === "exclusive" || wantedAccess === "exclusive"
          ? "impact.exclusive_conflict" : "impact.decision_conflict",
        severity: "blocker", subject_type: "surface", subject_id: "src/shared.ts",
        message: "影响面「src/shared.ts」正在被不兼容地占用",
        facts: { active_claim_id: "claim-existing", active_goal_id: "goal-existing",
          existing_access: currentAccess, requested_access: wantedAccess },
        remediation: "等待现有 Claim 释放，或确认只读输入快照",
      });
      assert.equal(executionImpactPolicy.allowsParallel([current], [wanted]), false);
      assert.equal(executionImpactPolicy.allowsParallel([wanted], [current]), false);
    }
  }
});

test("different surfaces and unconfirmed requested declarations do not create occupation blockers", () => {
  const wanted = declaration("exclusive");
  const occupied = { ...declaration("exclusive"), claim_id: "claim", existing_goal_id: "other-goal" };
  assert.deepEqual(executionImpactPolicy.conflicts([{ ...wanted, surface: "another.ts" }], [occupied]), []);
  for (const state of ["proposed", "inactive"] as const) {
    assert.deepEqual(executionImpactPolicy.conflicts([{ ...wanted, state }], [occupied]), []);
  }
  assert.equal(executionImpactPolicy.allowsParallel([declaration("exclusive")], [{ ...wanted, surface: "another.ts" }]), true);
});
