import { openGoalBoardProjectCatalog } from "@adeptify/goalboard-app-desktop";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { artifactWorkbench } from "@adeptify/goalboard-app-workbench";
import { readArtifactBrowser } from "@adeptify/goalboard-plugin-artifacts";
import type { RegisterArtifactVersionInput } from "@adeptify/goalboard-contracts/modules/artifacts";
import { GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { DEMO_BOARD_ID, seedDemoBoard } from "@adeptify/goalboard-app-local-host";
import { LocalProjectDatabase } from "@adeptify/goalboard-app-local-host";
import { createGoalBoardWebServer } from "../apps/desktop/launchers/web/server.js";

import { createContextLedger } from "@adeptify/goalboard-module-context-ledger";

const artifactId = "report/季度 & <draft>";
const encodedId = encodeURIComponent(artifactId);
const exactPath = (version: number) => `/artifacts/${encodedId}/versions/${version}`;

function registration(overrides: Partial<RegisterArtifactVersionInput> = {}): RegisterArtifactVersionInput {
  return {
    board_id: DEMO_BOARD_ID, actor_id: "report-owner", artifact_id: artifactId, version: 1,
    artifact_type_id: "io.example.report", schema_version: 1,
    producer: { plugin_id: "io.example.writer", plugin_version: "1.0.0", binding_signature: "fixture-publisher" },
    content: { kind: "inline", payload: { title: "Original report", custom: ["</pre><script>attack()</script>", 7, null] } },
    metadata: { origin: "plugin-owned-shape", details: { preserved: true } }, ...overrides,
  };
}

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "goalboard-artifact-browser-"));
  const databasePath = join(directory, "fixture.db");
  seedDemoBoard(databasePath);
  const store = new LocalProjectDatabase(databasePath);
  const coordinator = new GoalProjectApplication(store);
  const server = createGoalBoardWebServer({ databasePath, boardId: DEMO_BOARD_ID, homeDirectory: directory,
    controlToken: "artifact-browser-test-control-token-0123456789" });
  t.after(async () => {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const get = (path: string, lang = "zh") => fetch(origin + path, { headers: { "accept-language": lang } });
  // Allow the normal host's first-request initialization before taking the read-only baseline.
  await (await get("/health")).text();
  return { store, coordinator, get };
}

test("Artifact HTTP links exact versions, exports opaque records and preserves existing Goal/Evidence state", async (t) => {
  const { store, coordinator, get } = await fixture(t);
  const first = coordinator.artifacts.commands.registerVersion(registration()).artifact;
  const second = coordinator.artifacts.commands.registerVersion(registration({ version: 2,
    content: { kind: "inline", payload: { title: "Later report" } } })).artifact;
  const before = store.snapshot(DEMO_BOARD_ID);
  const versions = coordinator.artifacts.query.listArtifacts(DEMO_BOARD_ID);
  const root = await (await get("/")).text();
  assert.match(root, /href="\/artifacts"/);
  const index = await get("/artifacts");
  assert.equal(index.status, 200);
  const directory = await index.text();
  assert.ok(directory.includes(`href="${exactPath(1)}"`));
  assert.ok(directory.includes(`href="${exactPath(2)}"`));
  const detail = await get(exactPath(1));
  assert.equal(detail.status, 200);
  assert.match(detail.headers.get("content-security-policy")!, /default-src 'self'/);
  const html = await detail.text();
  assert.match(html, /没有兼容插件/);
  assert.match(html, /Original report/);
  assert.doesNotMatch(html, /Later report|<script>attack\(\)<\/script>/);
  assert.match(html, /&lt;\/pre&gt;&lt;script&gt;attack/);
  assert.ok(html.includes(`href="/api${exactPath(1)}/export"`));
  for (const record of [first, second]) {
    const exported = await get(`/api${exactPath(record.version)}/export`);
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get("content-disposition"), `attachment; filename="artifact-v${record.version}.json"`);
    assert.deepEqual(await exported.json(), record);
  }
  const english = await (await get(exactPath(1), "en")).text();
  assert.match(english, /lang="en"/);
  assert.match(english, /No compatible plugin/);
  assert.match(english, /Export this version/);
  assert.deepEqual(coordinator.artifacts.query.listArtifacts(DEMO_BOARD_ID), versions);
  const after = store.snapshot(DEMO_BOARD_ID);
  assert.deepEqual(after.goals, before.goals);
  assert.deepEqual(after.evidence, before.evidence);
  assert.deepEqual(after.runs, before.runs);
  assert.deepEqual(after.reviews, before.reviews);
});

test("Artifact HTTP keeps unknown and cross-project versions missing and rejects malformed exact references", async (t) => {
  const { coordinator, get } = await fixture(t);
  coordinator.artifacts.commands.registerVersion(registration());
  coordinator.initializeBoard({ board_id: "other-project", title: "Private project", actor_id: "owner", idempotency_key: "other-project" });
  coordinator.artifacts.commands.registerVersion(registration({ board_id: "other-project", artifact_id: "other-only" }));
  for (const path of [exactPath(2), "/artifacts/missing/versions/1", "/artifacts/other-only/versions/1"]) {
    const page = await get(path);
    assert.equal(page.status, 404);
    const html = await page.text();
    assert.match(html, /不会自动替换成最新版本/);
    assert.doesNotMatch(html, /Original report/);
    const exported = await get(`/api${path}/export`);
    assert.equal(exported.status, 404);
    await exported.text();
  }
  for (const path of ["/artifacts/a/versions/0", "/artifacts/a/versions/-1", "/artifacts/a/versions/1.5",
    "/artifacts/a/versions/9007199254740992", "/artifacts/%ZZ/versions/1"]) {
    const page = await get(path);
    assert.equal(page.status, 400, path);
    await page.text();
  }
  assert.equal(coordinator.artifacts.query.listArtifacts(DEMO_BOARD_ID).length, 1);
});

test("Artifact empty, unavailable, archived and embedded views reflect Module state without inventing consumers", async (t) => {
  const { coordinator, get } = await fixture(t);
  assert.match(await (await get("/artifacts")).text(), /还没有 Artifact/);
  coordinator.artifacts.commands.registerVersion(registration());
  const query = coordinator.artifacts.query;
  const reference = { artifact_id: artifactId, version: 1 };
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const view = readArtifactBrowser(query, DEMO_BOARD_ID, reference);
  const embed = artifactWorkbench.embed({ view, routePrefix: "/projects/current", primitives: { escape, text: escape, formatDate: (value) => value } });
  assert.ok(embed.includes(`href="/projects/current${exactPath(1)}"`));
  assert.match(embed, /data-artifact-version="1"/);
  assert.match(embed, /没有兼容插件/);
  assert.doesNotMatch(embed, /Original report|attack\(\)|\/export/);
  assert.equal(readArtifactBrowser(query, DEMO_BOARD_ID, reference, [{ artifact_type_id: "io.example.report", schema_version: 1 }]).compatibility?.consumable, true);
  assert.equal(readArtifactBrowser(query, DEMO_BOARD_ID, reference, [{ artifact_type_id: "io.example.report", schema_version: 2 }]).compatibility?.consumable, false);
  coordinator.artifacts.commands.markUnavailable({ board_id: DEMO_BOARD_ID, ...reference, actor_id: "report-owner", reason: "Source disconnected" });
  const unavailable = await (await get(exactPath(1))).text();
  assert.match(unavailable, /这个版本的内容不可用|Source disconnected/);
  assert.doesNotMatch(unavailable, /Original report/);
  coordinator.artifacts.commands.archiveVersion({ board_id: DEMO_BOARD_ID, ...reference, actor_id: "report-owner" });
  assert.match(await (await get("/artifacts")).text(), /已归档/);
  assert.equal(query.getArtifactVersion(DEMO_BOARD_ID, reference)?.lifecycle_state, "archived");
});

test("Artifact navigation and export retain the selected catalog Project", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "goalboard-artifact-projects-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalog = await openGoalBoardProjectCatalog({ homeDirectory: directory });
  const alpha = await catalog.createProject({ display_name: "Alpha results", actor_id: "fixture-user" });
  const beta = await catalog.createProject({ display_name: "Beta results", actor_id: "fixture-user" });
  catalog.close();
  const store = new LocalProjectDatabase(alpha.database_path);
  const coordinator = new GoalProjectApplication(store);
  const original = coordinator.artifacts.commands.registerVersion(registration({ board_id: alpha.board_id })).artifact;
  store.close();
  const server = createGoalBoardWebServer({ homeDirectory: directory, controlToken: "artifact-project-test-control-token-0123456789" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const prefix = `/projects/${alpha.project_id}`;
  const page = await (await fetch(origin + prefix + exactPath(1))).text();
  assert.match(page, /Alpha results/);
  assert.ok(page.includes(`href="${prefix}/artifacts"`));
  assert.ok(page.includes(`href="${prefix}/api${exactPath(1)}/export"`));
  assert.ok(page.includes(`href="${prefix}/"`));
  const root = await (await fetch(origin + prefix + "/")).text();
  assert.ok(root.includes(`href="${prefix}/artifacts"`));
  const exported = await fetch(origin + prefix + `/api${exactPath(1)}/export`);
  assert.deepEqual(await exported.json(), original);
  const other = await fetch(origin + `/projects/${beta.project_id}` + exactPath(1));
  assert.equal(other.status, 404);
  assert.doesNotMatch(await other.text(), /Original report|Alpha results/);
});

test("Goal context embeds explicit exact Artifact relations and refreshes owner state without mutating facts", async (t) => {
  const { store, coordinator, get } = await fixture(t);
  const panelPath = "/api/goals/V1/panels/completion?view=current";
  const empty = await (await get(panelPath)).text();
  assert.doesNotMatch(empty, /artifact-embed|关联结果/);
  const first = coordinator.artifacts.commands.registerVersion(registration()).artifact;
  coordinator.artifacts.commands.registerVersion(registration({ version: 2,
    content: { kind: "inline", payload: { title: "Later report" } } }));
  const ledger = createContextLedger(store.db, { authorize: () => true });
  const scope = { kind: "personal" as const, id: DEMO_BOARD_ID };
  const access = { actor_id: "fixture-goal-owner", scope };
  for (const [key, type, version] of [["input", "goal.input", 1], ["output", "goal.output", 2], ["missing", "goal.output", 99]] as const) {
    ledger.commands.put(access, { key, type, cause: "Explicit fixture association",
      source: { module: "goals", id: "V1", version: null, scope },
      target: { module: "artifacts", id: artifactId, version, scope } });
  }
  ledger.commands.put(access, { key: "unrelated", type: "goal.output", cause: "Another Goal's result",
    source: { module: "goals", id: "PLATFORM", version: null, scope },
    target: { module: "artifacts", id: "not-for-V1", version: 1, scope } });
  ledger.commands.put(access, { key: "foreign", type: "goal.input", cause: "Explicit foreign namespace",
    source: { module: "goals", id: "V1", version: null, scope },
    target: { module: "artifacts", id: artifactId, version: 1, scope, project_id: "foreign-project" } });
  const before = store.snapshot(DEMO_BOARD_ID);
  const beforeEdges = ledger.query.list(access);
  const beforeArtifacts = coordinator.artifacts.query.listArtifacts(DEMO_BOARD_ID);
  // The ordinary document stays light; the actual context click loads the embedding fragment.
  assert.doesNotMatch(await (await get("/goals/V1")).text(), /artifact-embed artifact|Original report|Later report/);
  const panel = await (await get(panelPath)).text();
  assert.match(panel, /关联结果/);
  assert.match(panel, /v1 · 输入结果/);
  assert.match(panel, /v2 · 产出结果/);
  assert.ok(panel.includes(`href="${exactPath(1)}"`));
  assert.ok(panel.includes(`href="${exactPath(2)}"`));
  assert.match(panel, /v99/);
  assert.match(panel, /关联的版本不可用或不存在/);
  assert.doesNotMatch(panel, /not-for-V1|Original report|Later report|attack\(\)|foreign-project/);
  assert.match(await (await get(panelPath, "en")).text(), /Linked results/);
  const opened = await get(exactPath(1));
  assert.match(await opened.text(), /Original report/);
  assert.deepEqual(coordinator.artifacts.query.getArtifactVersion(DEMO_BOARD_ID, { artifact_id: artifactId, version: 1 }), first);
  assert.deepEqual(coordinator.artifacts.query.listArtifacts(DEMO_BOARD_ID), beforeArtifacts);
  assert.deepEqual(ledger.query.list(access), beforeEdges);
  const after = store.snapshot(DEMO_BOARD_ID);
  for (const field of ["goals", "evidence", "runs", "reviews"] as const) assert.deepEqual(after[field], before[field]);

  coordinator.artifacts.commands.markUnavailable({ board_id: DEMO_BOARD_ID, artifact_id: artifactId, version: 1,
    actor_id: "report-owner", reason: "Source disconnected" });
  coordinator.artifacts.commands.archiveVersion({ board_id: DEMO_BOARD_ID, artifact_id: artifactId, version: 2, actor_id: "report-owner" });
  const changed = await (await get(panelPath)).text();
  assert.match(changed, /这个版本的内容不可用/);
  assert.match(changed, /Source disconnected/);
  assert.match(changed, /这个版本已归档/);
  ledger.commands.remove(access, "input", "Owner removed the input association");
  const removed = await (await get(panelPath)).text();
  assert.doesNotMatch(removed, /v1 · 输入结果|Source disconnected/);
  assert.match(removed, /v2 · 产出结果/);
  const unknown = await get("/api/goals/missing/panels/completion?view=current");
  assert.equal(unknown.status, 404);
  assert.doesNotMatch(await unknown.text(), /artifact-embed|report/);
});
