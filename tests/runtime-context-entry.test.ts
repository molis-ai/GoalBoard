import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RuntimeProjectConnection } from "@adeptify/goalboard-app-local-host";
import { createMcpContextPresenter, createMcpRuntimeContextHandlers } from "@adeptify/goalboard-app-mcp";
import { readProjectGuidanceCapability } from "@adeptify/goalboard-plugin-goals";
import { createGoalBoardLocalHost, goalBoardHostProjectReference, projectResumeFactsCapability } from "../src/local-host/composition.js";
import { GoalBoardV1Error } from "../src/v1/coordinator.js";
import type { GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
import { GoalBoardProjectCatalog, GoalBoardProjectCatalogError } from "../src/projects/catalog.js";
import { withGoalBoardProjectCatalog } from "../src/projects/catalog-session.js";

test("context handlers preserve a denied binding and hold the catalog open through async response failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "goalboard-context-entry-"));
  const homeDirectory = join(directory, "home");
  const fixture = await GoalBoardProjectCatalog.open({ homeDirectory });
  try {
    const project = await fixture.createProject({ display_name: "Scoped connection", actor_id: "user" });
    const host: GoalBoardRuntimeContextHost = { homeDirectory,
      runtimeContext: { runtime_id: "codex", stable_work_context_id: "host-session", host_declares_stable: true } };
    fixture.bindRuntimeContext({ context: host.runtimeContext, project_id: project.project_id, actor_id: "user", user_confirmed: true });
    const before = fixture.listRuntimeContextBindings();
    const connection = new RuntimeProjectConnection({ projectId: project.project_id, boardId: project.board_id, databasePath: project.database_path, webBaseUrl: "http://127.0.0.1:4173" });
    const originalConnection = connection.connection;
    let scoped: GoalBoardProjectCatalog | undefined;
    let opened!: () => void;
    const didOpen = new Promise<void>(resolve => { opened = resolve; });
    let continueResponse!: () => void;
    const responseGate = new Promise<void>(resolve => { continueResponse = resolve; });
    let failResponse = true;
    const handlers = createMcpRuntimeContextHandlers({
      connection,
      requireHost: () => host,
      catalogs: { withCatalog: (home, operation) => withGoalBoardProjectCatalog({ homeDirectory: home }, catalog => {
        scoped = catalog;
        return operation(catalog);
      }) },
      presentResolution: async (resolution, selectedHost) => {
        opened();
        await responseGate;
        assert.equal(scoped!.listProjects()[0]!.project_id, project.project_id, "scope must remain open until the async presentation finishes");
        assert.equal(selectedHost.runtimeContext.stable_work_context_id, "host-session");
        if (failResponse) throw new Error("presentation failed after await");
        connection.accept(originalConnection, selectedHost.runtimeContext);
        return JSON.stringify(resolution);
      },
    });
    const context = { runtimeSessionId: null, runtimeSessionIdSource: null };
    await assert.rejects(handlers.goalboard_v1_context_bind({ project_id: project.project_id, actor_id: "runtime", user_confirmed: "true" }, context),
      (error: unknown) => error instanceof GoalBoardProjectCatalogError && error.code === "context.user_confirmation_required");
    assert.equal(connection.connection, originalConnection);
    assert.deepEqual(fixture.listRuntimeContextBindings(), before);
    assert.throws(() => scoped!.listProjects(), /closed|not open/);
    const resolving = handlers.goalboard_v1_context_resolve({ runtime_context: { stable_work_context_id: "model-forged-session" } }, context);
    assert.equal(connection.connection, null, "read-only resolve must drop its old cached answer immediately");
    const rejected = assert.rejects(resolving, /presentation failed after await/);
    await didOpen;
    continueResponse();
    await rejected;
    assert.equal(connection.connection, null);
    assert.throws(() => scoped!.listProjects(), /closed|not open/);
    assert.deepEqual(fixture.listRuntimeContextBindings(), before);
    failResponse = false;
    const restored = JSON.parse(await handlers.goalboard_v1_context_resolve({}, context));
    assert.equal(restored.status, "bound");
    assert.equal(restored.project.project_id, project.project_id);
    assert.equal(connection.connection?.boardId, project.board_id);
    assert.deepEqual(fixture.listRuntimeContextBindings(), before, "recovering the response does not create a second binding");
    assert.throws(() => scoped!.listProjects(), /closed|not open/);
    const localHost = createGoalBoardLocalHost();
    const client = localHost.client(goalBoardHostProjectReference({
      databasePath: project.database_path, boardId: project.board_id, projectId: project.project_id,
    }));
    let failGuidance = true;
    const calls: string[] = [];
    const presentResolution = createMcpContextPresenter({
      connection,
      createError: (code, message, details) => new GoalBoardV1Error(code, message, details),
      readGuidance: async () => {
        calls.push("guidance");
        const guidance = await client.invoke(readProjectGuidanceCapability, { board_id: project.board_id });
        if (failGuidance) throw new Error("guidance unavailable");
        return guidance;
      },
      readSession: async () => {
        calls.push("session");
        assert.equal(connection.connection?.projectId, project.project_id, "accept follows guidance and precedes the secondary Session read");
        return { sessionGoalId: null, sessionRegistry: { status: "unavailable", message: "secondary Session unavailable", session: null } };
      },
      readResumeFacts: () => {
        calls.push("resume");
        return client.invoke(projectResumeFactsCapability, { board_id: project.board_id });
      },
    });
    const actual = createMcpRuntimeContextHandlers({
      connection, requireHost: () => host, presentResolution,
      catalogs: { withCatalog: (home, operation) => withGoalBoardProjectCatalog({ homeDirectory: home }, operation) },
    });
    try {
      await assert.rejects(actual.goalboard_v1_context_resolve({}, context), /guidance unavailable/);
      assert.deepEqual(calls, ["guidance"]);
      assert.equal(connection.connection, null, "failed guidance must not accept a new connection");
      failGuidance = false;
      calls.length = 0;
      const presented = JSON.parse(await actual.goalboard_v1_context_resolve({}, context));
      assert.deepEqual(calls, ["guidance", "session", "resume"]);
      assert.equal(presented.connection.project_id, project.project_id);
      assert.equal(presented.connection.project_url, `http://127.0.0.1:4173/projects/${project.project_id}`);
      assert.deepEqual(presented.session_registry, { status: "unavailable", message: "secondary Session unavailable", session: null });
      assert.deepEqual(presented.resume, { focus: null, next_goals: [], auto_claimed: false });
      assert.equal(presented.runtime_prompt_prefix, presented.project_guidance.runtime_prompt_prefix);
      assert.deepEqual(fixture.listRuntimeContextBindings(), before);
    } finally { await localHost.close(); }
  } finally {
    fixture.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
