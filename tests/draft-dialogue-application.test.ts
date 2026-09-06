import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoalsQueryService, GoalsRepository } from "@adeptify/goalboard-module-goals";
import { GovernanceClarificationStore, migrateClarificationDialogue } from "@adeptify/goalboard-module-governance-collaboration";
import { DraftDialogueApplication, type DraftDialogueView } from "@adeptify/goalboard-plugin-goals";
import { SqliteGoalBoardStore } from "../src/v1/store.js";
import { GoalBoardCoordinator, GoalBoardV1Error } from "../src/v1/coordinator.js";

test("Governance migration 8 rolls back schema and marker together, then persists a usable dialogue after retry", () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dialogue-schema-"));
  const databasePath = join(directory, "project.db");
  const store = new SqliteGoalBoardStore(databasePath);
  let sessionId: string;
  try {
    store.db.exec(`
      DROP TABLE clarification_turns;
      DROP TABLE clarification_sessions;
      DELETE FROM schema_migrations WHERE migration_id = 8;
      CREATE TRIGGER fail_dialogue_migration BEFORE INSERT ON schema_migrations WHEN NEW.migration_id = 8
      BEGIN SELECT RAISE(ABORT, 'migration 8 interrupted'); END;
    `);
    assert.throws(() => migrateClarificationDialogue(store.db), /migration 8 interrupted/);
    assert.equal(store.db.prepare("SELECT 1 FROM schema_migrations WHERE migration_id = 8").get(), undefined);
    assert.deepEqual(store.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('clarification_sessions', 'clarification_turns')").all(), []);
    store.db.exec("DROP TRIGGER fail_dialogue_migration");
    migrateClarificationDialogue(store.db);
    const coordinator = new GoalBoardCoordinator(store);
    coordinator.initializeBoard({ board_id: "board", title: "Recovered dialogue", actor_id: "user", idempotency_key: "init" });
    const saved = coordinator.draftDialogue.startDraftDialogue({ board_id: "board", actor_id: "runtime",
      rough_idea: "迁移后保留的真实澄清正文", idempotency_key: "start" });
    sessionId = saved.dialogue.session_id;
  } finally { store.close(); }
  const reopened = new SqliteGoalBoardStore(databasePath);
  try {
    const snapshot = reopened.snapshot("board");
    assert.equal(snapshot.clarification_sessions.find(session => session.session_id === sessionId)?.rough_idea, "迁移后保留的真实澄清正文");
    assert.equal(snapshot.clarification_turns.find(turn => turn.session_id === sessionId)?.user_message, "迁移后保留的真实澄清正文");
    assert.equal(snapshot.runs.length, 1);
  } finally { reopened.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("dialogue owner transaction rolls back Goal, Claim, Run and answer writes together, then permits the same retry", () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dd1-atomic-"));
  const store = new SqliteGoalBoardStore(join(directory, "project.db"));
  const now = () => new Date("2026-09-06T00:00:00.000Z");
  const coordinator = new GoalBoardCoordinator(store, now);
  coordinator.initializeBoard({ board_id: "board", title: "Dialogue", actor_id: "user", idempotency_key: "init" });
  let fail = true;
  class InterruptedRecords extends GovernanceClarificationStore {
    override start(...args: Parameters<GovernanceClarificationStore["start"]>) {
      const cursor = super.start(...args);
      if (fail) throw new Error("simulated persistence failure after initial turn");
      return cursor;
    }
    override recordTurn(...args: Parameters<GovernanceClarificationStore["recordTurn"]>) {
      const cursor = super.recordTurn(...args);
      if (fail) throw new Error("simulated persistence failure after answer");
      return cursor;
    }
  }
  const application = new DraftDialogueApplication({
    goals: { query: new GoalsQueryService(new GoalsRepository(store.db)), commands: coordinator.goals.commands },
    execution: coordinator.execution, validation: coordinator.executionValidation,
    governance: { ...coordinator.governance, clarification: new InterruptedRecords(store.db, () => now().toISOString()) },
    clock: now, errorFactory: (code, message) => new GoalBoardV1Error(code, message),
  });
  const start = { board_id: "board", actor_id: "runtime", rough_idea: "保留用户最初的输入", idempotency_key: "start" };
  try {
    const empty = store.snapshot("board");
    assert.throws(() => application.startDraftDialogue(start), /initial turn/);
    assert.deepEqual(store.snapshot("board"), empty, "failed start leaves no Goal, Claim, Run, dialogue or event");
    fail = false;
    const started = application.startDraftDialogue(start);
    const afterStart = store.snapshot("board");
    assert.equal(application.startDraftDialogue(start).dialogue.session_id, started.dialogue.session_id);
    assert.deepEqual(store.snapshot("board"), afterStart);
    const answer = { board_id: "board", goal_id: started.goal.goal_id, actor_id: "runtime", run_id: started.run!.run_id,
      user_message: "保存失败也不能丢失输入", current_understanding: "仅迁移，不自动接受目标", next_question: "是否继续？", idempotency_key: "answer" };
    fail = true;
    assert.throws(() => application.recordDraftDialogueTurn(answer), /after answer/);
    assert.deepEqual(store.snapshot("board"), afterStart, "failed answer must restore session, turn, event and replay state");
    fail = false;
    const saved = application.recordDraftDialogueTurn(answer);
    assert.equal(saved.turns.at(-1)?.user_message, answer.user_message);
    assert.equal(saved.turns.at(-1)?.turn_index, 2);
    assert.equal(application.recordDraftDialogueTurn(answer).replayed, true);
    assert.deepEqual(store.snapshot("board").clarification_turns, saved.turns);
    assert.equal(saved.goal.definition_state, "draft");
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("expired dialogue rejects stale and foreign writes, then resumes the same saved discussion", () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dd1-lease-"));
  const store = new SqliteGoalBoardStore(join(directory, "project.db"));
  let at = "2026-09-06T00:00:00.000Z";
  const coordinator = new GoalBoardCoordinator(store, () => new Date(at));
  coordinator.initializeBoard({ board_id: "board", title: "Dialogue", actor_id: "user", idempotency_key: "init" });
  const application = coordinator.draftDialogue;
  try {
    const start = application.startDraftDialogue({ board_id: "board", goal_id: "draft", actor_id: "runtime",
      rough_idea: "中断后继续讨论", lease_seconds: 2, idempotency_key: "start" });
    const answer = { board_id: "board", goal_id: "draft", actor_id: "runtime", run_id: start.run!.run_id,
      user_message: "不能自动添加功能", current_understanding: "只是代码迁移", next_question: "还有哪些边界？", idempotency_key: "answer" };
    const before = store.snapshot("board");
    for (const [input, code] of [
      [{ ...answer, actor_id: "other" }, "draft_dialogue.run_not_owner"],
      [{ ...answer, goal_id: "different" }, "draft_dialogue.run_not_found"],
      [{ ...answer, board_id: "different" }, "draft_dialogue.run_not_found"],
    ] as const) {
      assert.throws(() => application.recordDraftDialogueTurn(input), (e: unknown) => e instanceof GoalBoardV1Error && e.code === code);
      assert.deepEqual(store.snapshot("board"), before);
    }
    const saved = application.recordDraftDialogueTurn(answer);
    at = "2026-09-06T00:00:03.000Z";
    const expired = store.snapshot("board");
    assert.throws(() => application.recordDraftDialogueTurn({ ...answer, idempotency_key: "late" }),
      (e: unknown) => e instanceof GoalBoardV1Error && e.code === "draft_dialogue.claim_not_active");
    assert.deepEqual(store.snapshot("board"), expired);
    const resumed = application.resumeDraftDialogue({ board_id: "board", goal_id: "draft", actor_id: "runtime", idempotency_key: "resume" });
    assert.equal(resumed.dialogue.session_id, saved.dialogue.session_id);
    assert.deepEqual(resumed.turns, saved.turns);
    assert.notEqual(resumed.run!.run_id, start.run!.run_id);
    assert.equal(resumed.work_state.work_state, "clarifying");
    assert.equal(application.recordDraftDialogueTurn(answer).replayed, true, "historical retries remain valid after recovery");
    const snapshot = store.snapshot("board");
    assert.equal(snapshot.goals.length, 1);
    assert.equal(snapshot.clarification_sessions.length, 1);
    assert.equal(snapshot.claims.filter(claim => claim.state === "active").length, 1);
    assert.equal(snapshot.runs.filter(run => run.state === "started").length, 1);
    assert.throws(() => application.recordDraftDialogueTurn({ ...answer, user_message: "different" }), /幂等键/);
    assert.deepEqual(store.snapshot("board"), snapshot);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("independent Runtime processes contend on the same start/answer and recover persisted history after restart", { timeout: 30_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-dd1-process-"));
  const databasePath = join(directory, "project.db");
  const store = new SqliteGoalBoardStore(databasePath);
  new GoalBoardCoordinator(store).initializeBoard({ board_id: "board", title: "Processes", actor_id: "user", idempotency_key: "init" });
  store.close();
  const children: ReturnType<typeof fork>[] = [];
  async function runtime() {
    const child = fork(new URL("./fixtures/draft-runtime-process.ts", import.meta.url), [databasePath, "board"], {
      execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    children.push(child);
    let stderr = "";
    child.stderr!.on("data", chunk => { stderr += String(chunk); });
    await new Promise<void>((resolve, reject) => {
      child.once("message", () => resolve());
      child.once("error", reject);
      child.once("exit", code => reject(new Error(`Runtime exited ${code}: ${stderr}`)));
    });
    let nextId = 0;
    return { child, call<T>(name: string, args: object): Promise<T> {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const listener = (message: { id: number; result: T; error?: string }) => {
          if (message.id !== id) return;
          child.off("message", listener);
          if (message.error) reject(new Error(message.error)); else resolve(message.result);
        };
        child.on("message", listener);
        child.send({ id, name: `goalboard_v1_${name}`, args });
      });
    } };
  }
  try {
    const a = await runtime();
    const b = await runtime();
    const input = { board_id: "board", goal_id: "draft", actor_id: "runtime", rough_idea: "两个进程重试同一次操作", idempotency_key: "start" };
    const starts = await Promise.all([a.call<DraftDialogueView & { replayed: boolean }>("draft_dialogue_start", input), b.call<DraftDialogueView & { replayed: boolean }>("draft_dialogue_start", input)]);
    assert.deepEqual(starts.map(x => x.replayed).sort(), [false, true]);
    assert.equal(starts[0].dialogue.session_id, starts[1].dialogue.session_id);
    assert.equal(starts[0].run!.run_id, starts[1].run!.run_id);
    const answer = { board_id: "board", goal_id: "draft", actor_id: "runtime", run_id: starts[0].run!.run_id,
      user_message: "一次回答只保留一份", current_understanding: "并发仍保留同一份记录", next_question: "下一项？", idempotency_key: "answer" };
    const answers = await Promise.all([a.call<{ replayed: boolean }>("draft_dialogue_turn", answer), b.call<{ replayed: boolean }>("draft_dialogue_turn", answer)]);
    assert.deepEqual(answers.map(x => x.replayed).sort(), [false, true]);
    const exitA = once(a.child, "exit"), exitB = once(b.child, "exit");
    a.child.disconnect(); b.child.disconnect();
    await Promise.all([exitA, exitB]);
    const reopened = await runtime();
    const resume = { board_id: "board", goal_id: "draft", actor_id: "runtime", include_history: true, history_limit: 1, idempotency_key: "resume" };
    const latest = await reopened.call<DraftDialogueView & { history: { next_before_turn_index: number } }>("draft_dialogue_resume", resume);
    assert.equal(latest.dialogue.session_id, starts[0].dialogue.session_id);
    assert.equal(latest.run!.run_id, starts[0].run!.run_id);
    assert.deepEqual(latest.turns.map(x => x.user_message), [answer.user_message]);
    const first = await reopened.call<DraftDialogueView>("draft_dialogue_resume", { ...resume, history_before_turn_index: latest.history.next_before_turn_index });
    assert.deepEqual(first.turns.map(x => x.user_message), [input.rough_idea]);
    const read = new SqliteGoalBoardStore(databasePath);
    try {
      const snapshot = read.snapshot("board");
      assert.equal(snapshot.goals.length, 1);
      assert.equal(snapshot.claims.length, 1);
      assert.equal(snapshot.runs.length, 1);
      assert.equal(snapshot.clarification_sessions.length, 1);
      assert.deepEqual(snapshot.clarification_turns.map(turn => [turn.turn_index, turn.user_message]), [[1, input.rough_idea], [2, answer.user_message]]);
      assert.equal(snapshot.goal_tree_proposals.length, 0);
    } finally { read.close(); }
  } finally {
    for (const child of children) if (child.exitCode == null) { const exited = once(child, "exit"); child.kill(); await exited; }
    rmSync(directory, { recursive: true, force: true });
  }
});
