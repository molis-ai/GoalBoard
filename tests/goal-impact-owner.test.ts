import { GovernanceRecordStore } from "@adeptify/goalboard-module-governance-collaboration";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoalsModule, migrateGoalImpactHistory } from "@adeptify/goalboard-module-goals";
import { GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";

function goals(store: LocalProjectDatabase) {
  return new GoalsModule(store.db, {
    supersedePendingContractProposals: (...args) => new GovernanceRecordStore(store.db).supersedePendingContractProposals(...args),
    currentActionToken: () => "unused",
    authorizeRiskUpdate: () => undefined, authorizeRiskState: () => undefined,
    transitionRevisionDependents: () => undefined, reconcileLifecycle: () => undefined,
  });
}

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-impact-owner-"));
  const databasePath = join(directory, "project.db");
  const store = new LocalProjectDatabase(databasePath);
  const owner = goals(store);
  for (const id of ["one", "two"]) {
    new GoalProjectApplication(store).initializeBoard({ board_id: id, title: id, actor_id: "user", idempotency_key: `board-${id}` });
    owner.commands.createGoal(id, { goal_id: `goal-${id}`, title: id, outcome: "", why: "", business_logic: "", acceptance_criteria: [] },
      { actor_id: "user", idempotency_key: `goal-${id}` });
  }
  return { directory, databasePath, store, owner };
}

const input = { goal_id: "goal-one", surface: "src/shared.ts", access: "read" as const,
  input_snapshot: "commit://original", reason: "Read original source", state: "proposed" as const };
const write = (id: string) => ({ actor_id: "user", idempotency_key: id, reason: "Confirmed scope change" });

test("Goals owns Impact writes, exact audit history, replay and persisted reads across reopen", () => {
  const data = fixture();
  let store = data.store;
  try {
    const api = data.owner.impacts;
    const added = api.add("one", input, write("add"));
    assert.equal(api.add("one", input, write("add")).replayed, true);
    const changed = api.update("one", { ...input, binding_id: added.binding_id, access: "write", state: "confirmed",
      input_snapshot: null, reason: "Write shared source" }, write("update"));
    assert.deepEqual(api.get("one", added.binding_id), changed.impact);
    assert.equal(api.get("two", added.binding_id), null);
    assert.deepEqual(api.list("two"), []);
    const removed = api.deactivate("one", { binding_id: added.binding_id, reason: "Superseded by another task" }, write("deactivate"));
    assert.equal(api.deactivate("one", { binding_id: added.binding_id, reason: "Superseded by another task" }, write("deactivate")).replayed, true);
    assert.throws(() => api.update("one", { ...input, binding_id: added.binding_id }, write("edit-history")), /历史保留/);
    assert.throws(() => api.add("two", input, write("foreign-goal")), /Goal 不存在/);
    const events = store.db.prepare("SELECT type, payload_json FROM events WHERE object_type = 'impact' ORDER BY seq").all() as { type: string; payload_json: string }[];
    assert.deepEqual(events.map((event) => event.type), ["impact.added", "impact.updated", "impact.deactivated"]);
    assert.deepEqual(JSON.parse(events[1]!.payload_json), {
      previous: input,
      current: { ...input, access: "write", state: "confirmed", input_snapshot: null, reason: "Write shared source" },
    });
    assert.deepEqual(JSON.parse(events[2]!.payload_json), {
      goal_id: "goal-one", surface: "src/shared.ts", access: "write", previous_state: "confirmed",
    });
    store.close();
    store = new LocalProjectDatabase(data.databasePath);
    assert.deepEqual(goals(store).impacts.list("one"), [removed.impact]);
    assert.deepEqual(store.snapshot("one").impacts, [removed.impact]);
    assert.equal(removed.impact.created_by, "user");
    assert.equal(removed.impact.created_at, added.impact.created_at);
    assert.equal(removed.impact.reason, "Write shared source");
  } finally { store.close(); rmSync(data.directory, { recursive: true, force: true }); }
});

test("failed Impact audit writes roll back the declaration and idempotency receipt, allowing an exact retry", () => {
  const data = fixture();
  try {
    const api = data.owner.impacts;
    let saved = api.add("one", input, write("baseline")).impact;
    const fail = () => data.store.db.exec(`CREATE TRIGGER reject_impact_audit BEFORE INSERT ON events
      WHEN NEW.object_type = 'impact' BEGIN SELECT RAISE(ABORT, 'injected impact audit failure'); END;`);
    const recover = () => data.store.db.exec("DROP TRIGGER reject_impact_audit");
    const add = () => api.add("one", { ...input, surface: "src/new.ts" }, write("new"));
    const update = () => api.update("one", { ...input, binding_id: saved.binding_id, access: "write", state: "confirmed" }, write("change"));
    const deactivate = () => api.deactivate("one", { binding_id: saved.binding_id, reason: "No longer used" }, write("remove"));
    for (const operation of [add, update, deactivate]) {
      const before = data.store.snapshot("one");
      fail();
      assert.throws(operation, /injected impact audit failure/);
      assert.deepEqual(data.store.snapshot("one"), before);
      recover();
      const result = operation();
      assert.equal(result.replayed, false);
      assert.deepEqual(api.get("one", result.impact.binding_id), result.impact);
      assert.equal(operation().replayed, true);
      if (operation !== add) saved = result.impact;
    }
  } finally { data.store.close(); rmSync(data.directory, { recursive: true, force: true }); }
});

test("legacy Impact history schema migrates atomically and reopens without changing old declarations", () => {
  const data = fixture();
  let store = data.store;
  try {
    const original = data.owner.impacts.add("one", input, write("original")).impact;
    store.db.exec(`DROP TABLE impact_bindings;
      CREATE TABLE impact_bindings (
        binding_id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(board_id),
        goal_id TEXT NOT NULL REFERENCES goals(goal_id), surface TEXT NOT NULL, access TEXT NOT NULL,
        input_snapshot TEXT, state TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
      DELETE FROM schema_migrations WHERE migration_id = 5;`);
    store.db.prepare("INSERT INTO impact_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      original.binding_id, original.board_id, original.goal_id, original.surface, original.access,
      original.input_snapshot, original.state, original.reason, original.created_by, original.created_at);
    const legacy = store.db.prepare("SELECT * FROM impact_bindings").all();
    store.db.exec(`CREATE TRIGGER reject_impact_migration BEFORE INSERT ON schema_migrations
      WHEN NEW.migration_id = 5 BEGIN SELECT RAISE(ABORT, 'injected migration receipt failure'); END;`);
    assert.throws(() => migrateGoalImpactHistory(store.db, "2026-09-05T00:00:00Z"), /injected migration receipt failure/);
    assert.deepEqual(store.db.prepare("SELECT * FROM impact_bindings").all(), legacy);
    assert.equal(store.db.prepare("SELECT 1 FROM schema_migrations WHERE migration_id = 5").get(), undefined);
    store.db.exec("DROP TRIGGER reject_impact_migration");
    store.close();
    store = new LocalProjectDatabase(data.databasePath);
    assert.deepEqual(goals(store).impacts.get("one", original.binding_id), original);
    assert.deepEqual(store.snapshot("one").impacts, [original]);
    store.close();
    store = new LocalProjectDatabase(data.databasePath);
    assert.deepEqual(goals(store).impacts.get("one", original.binding_id), original);
  } finally { store.close(); rmSync(data.directory, { recursive: true, force: true }); }
});
