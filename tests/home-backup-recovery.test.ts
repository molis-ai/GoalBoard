import assert from "node:assert/strict";
import { cp, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openWorkSessionRegistry } from "@adeptify/goalboard-app-local-host";
import { ArtifactsModule } from "@adeptify/goalboard-module-artifacts";
import { createSessionContentStore } from "@adeptify/goalboard-module-private-work-context";
import { GoalBoardProjectCatalog } from "../src/projects/catalog.js";
import { SqliteGoalBoardStore } from "../src/v1/store.js";
import {
  createGoalBoardLocalHost, createGoalCapability, goalBoardHostProjectReference,
  snapshotBoardCapability,
} from "../src/local-host/composition.js";

test("offline Home restore preserves Project, Goal history, Artifact versions and encrypted Session content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "goalboard-home-recovery-"));
  const home = join(directory, "home");
  const backup = join(directory, "backup");
  try {
    const catalog = await GoalBoardProjectCatalog.open({ homeDirectory: home });
    const project = await catalog.createProject({ display_name: "恢复演练项目", actor_id: "user" });
    catalog.close();
    const reference = goalBoardHostProjectReference({ databasePath: project.database_path, boardId: project.board_id });
    const host = createGoalBoardLocalHost({ instanceId: "backup-source" });
    try {
      await host.client(reference).invoke(createGoalCapability, {
        board_id: project.board_id, actor_id: "user", idempotency_key: "backup-goal",
        goal: { goal_id: "retained-goal", title: "保留交接正文", outcome: "恢复后继续工作",
          why: "不能只恢复空壳", business_logic: "保留正文、关系、版本和历史",
          definition_state: "draft", decomposition_state: "abstract", priority: 50, acceptance_criteria: [] },
      });
    } finally { await host.close(); }

    const source = new SqliteGoalBoardStore(project.database_path);
    const artifacts = new ArtifactsModule({ db: source.db, appendEvent: event => source.appendEvent(event) });
    try {
      for (const version of [1, 2]) artifacts.commands.registerVersion({
        board_id: project.board_id, artifact_id: "report", version, actor_id: "user",
        artifact_type_id: "example.report", schema_version: 1,
        producer: { plugin_id: "example.writer", plugin_version: "1.0.0", binding_signature: "example-publisher" },
        content: { kind: "inline", payload: { text: `第${version}版报告`, custom: [null, 7, "附件说明"] } },
      });
    } catch (error) { source.close(); throw error; }
    const before = source.snapshot(project.board_id);
    source.close();

    const registry = await openWorkSessionRegistry({ homeDirectory: home });
    const session = registry.createSession({ runtime_id: "codex", actor_id: "user", user_confirmed: true,
      project_id: project.project_id, current_goal_id: "retained-goal" });
    registry.appendEvent({ session_id: session.session_id, source: "goalboard_tui", kind: "terminal_output",
      source_id: "before-backup", content: "恢复前的私人正文" });
    const links = registry.goalHistory(session.session_id);
    registry.close();

    // Offline backup: every product writer is closed. Restore to the original
    // absolute Home path because Catalog records deliberately retain DB paths.
    await cp(home, backup, { recursive: true, errorOnExist: true, force: false });
    await rename(home, join(directory, "offline-original"));
    await cp(backup, home, { recursive: true, errorOnExist: true, force: false });

    const restoredCatalog = await GoalBoardProjectCatalog.open({ homeDirectory: home });
    try { assert.deepEqual(restoredCatalog.getProject(project.project_id), project); }
    finally { restoredCatalog.close(); }
    const restoredHost = createGoalBoardLocalHost({ instanceId: "backup-restored" });
    try {
      const snapshot = await restoredHost.client(reference).invoke(snapshotBoardCapability, { board_id: project.board_id });
      assert.deepEqual(snapshot, before, "all Goal facts and event history survive, not only IDs");
      assert.equal(snapshot.goals.find(goal => goal.goal_id === "retained-goal")?.outcome, "恢复后继续工作");
    } finally { await restoredHost.close(); }
    const restored = new SqliteGoalBoardStore(project.database_path);
    try {
      const reader = new ArtifactsModule({ db: restored.db, appendEvent: event => restored.appendEvent(event) });
      assert.deepEqual(reader.query.listArtifactVersions(project.board_id, "report").map(item => item.version).sort(), [1, 2]);
      for (const version of [1, 2]) assert.deepEqual(
        reader.query.getArtifactVersion(project.board_id, { artifact_id: "report", version })?.payload,
        { text: `第${version}版报告`, custom: [null, 7, "附件说明"] },
      );
    } finally { restored.close(); }
    const recoveredRegistry = await openWorkSessionRegistry({ homeDirectory: home });
    try {
      assert.deepEqual(recoveredRegistry.goalHistory(session.session_id), links);
      assert.equal(recoveredRegistry.get(session.session_id).project_id, project.project_id);
      assert.deepEqual(recoveredRegistry.events(session.session_id).map(event => event.content), ["恢复前的私人正文"]);
      recoveredRegistry.appendEvent({ session_id: session.session_id, source: "goalboard_tui", kind: "terminal_output",
        source_id: "after-restore", content: "恢复后继续工作" });
    } finally { recoveredRegistry.close(); }
    const reopened = await openWorkSessionRegistry({ homeDirectory: home });
    try { assert.deepEqual(reopened.events(session.session_id).map(event => event.content), ["恢复前的私人正文", "恢复后继续工作"]); }
    finally { reopened.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("restoring encrypted blobs without their key fails closed and recovers with the original key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "goalboard-incomplete-backup-"));
  try {
    const content = createSessionContentStore(directory);
    const written = content.write("密钥和正文必须一起备份");
    const key = join(directory, "content.key");
    const retainedKey = join(directory, "offline.key");
    await rename(key, retainedKey);
    const incomplete = createSessionContentStore(directory);
    assert.throws(() => incomplete.read(written.content_ref), /key unavailable/);
    assert.throws(() => incomplete.write("不能用新密钥覆盖旧资料"), /key unavailable/);
    await rename(retainedKey, key);
    const recovered = createSessionContentStore(directory);
    assert.equal(recovered.read(written.content_ref), "密钥和正文必须一起备份");
    assert.equal(recovered.read(recovered.write("原密钥下的新资料").content_ref), "原密钥下的新资料");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
