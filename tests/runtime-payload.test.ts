import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGoalBoardRuntimePayload } from "@adeptify/goalboard-app-local-host";

const exec = promisify(execFile);

test("real workspace payload installs offline from an unrelated directory and preserves vendor sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "goalboard-runtime-payload-"));
  try {
    const payload = join(directory, "payload");
    await exec(process.execPath, [
      join(process.cwd(), "apps", "desktop", "tooling", "prepare-runtime-payload.mjs"),
      process.cwd(), payload, process.execPath,
    ]);
    const provenance = "vendor/intelligence-client/adeptify-intelligence-client-0.2.2.tgz.provenance.json";
    const sbom = "vendor/intelligence-client/sbom.cdx.json";
    for (const relative of [provenance, sbom, "LICENSE"]) {
      assert.deepEqual(await readFile(join(payload, relative)), await readFile(join(process.cwd(), relative)));
    }
    for (const [folder, archive] of [
      ["intelligence-client", "adeptify-intelligence-client-0.2.2.tgz"],
      ["search-evidence-layer", "adeptify-search-evidence-layer-0.4.1.tgz"],
    ]) {
      const vendor = join(payload, "vendor", folder!);
      const origin = JSON.parse(await readFile(join(vendor, `${archive}.provenance.json`), "utf8"));
      const bill = JSON.parse(await readFile(join(vendor, "sbom.cdx.json"), "utf8"));
      const bytes = await readFile(join(vendor, archive!));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), origin.artifact.sha256);
      assert.equal(bill.metadata.component.name, origin.package.name);
      assert.equal(bill.metadata.component.version, origin.package.version);
    }
    const marker = await readFile(join(payload, "release.json"));
    await assert.rejects(createGoalBoardRuntimePayload({ sourceDirectory: process.cwd(), destinationDirectory: payload, nodeExecutablePath: process.execPath }), /输出已存在/);
    assert.deepEqual(await readFile(join(payload, "release.json")), marker);
    const home = join(directory, "home");
    const node = join(payload, "runtime", "node");
    const output = await exec(node, [join(payload, "dist", "cli", "main.js"), "install", "--source", payload, "--home", home, "--json"], {
      cwd: directory, env: { ...process.env, PATH: "/usr/bin:/bin", NODE_PATH: "" },
    });
    const installed = JSON.parse(output.stdout);
    assert.equal(installed.status, "installed");
    assert.deepEqual(await readFile(join(installed.release_directory, provenance)), await readFile(join(payload, provenance)));
    // The actual installed launcher must no longer need its source payload.
    await rm(payload, { recursive: true, force: true });
    const help = await exec(installed.launchers.cli, ["--help"], { cwd: directory, env: { ...process.env, PATH: "/usr/bin:/bin", NODE_PATH: "" } });
    assert.match(help.stdout, /goalboard plugin/);
    const moduleResult = await exec(join(installed.release_directory, "runtime", "node"), ["--input-type=module", "-e", `
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(':memory:'); db.exec('CREATE TABLE probe(value TEXT)'); db.close();
      await import('node-pty');
      const { ProjectsModule } = await import('@adeptify/goalboard-module-projects');
      const { loadBuiltinPlanningMethodPacks } = await import('@adeptify/goalboard-module-goals');
      const developerMethod = loadBuiltinPlanningMethodPacks().find(method => method.method_id === 'industry-developer-tools');
      console.log(JSON.stringify({ projectType: typeof ProjectsModule, method: developerMethod?.name }));
    `], { cwd: installed.release_directory, env: { ...process.env, NODE_PATH: "" } });
    assert.deepEqual(JSON.parse(moduleResult.stdout), { projectType: "function", method: "开发者工具" });
    const methodPath = "industries/industry-developer-tools.md";
    assert.deepEqual(await readFile(join(installed.skill_directory, "goal-advance", "methods", methodPath)),
      await readFile(join(process.cwd(), "modules", "goals", "methods", methodPath)));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("failed payload preparation leaves an existing Desktop resource untouched", async () => {
  const directory = await mkdtemp(join(tmpdir(), "goalboard-runtime-resource-"));
  try {
    const resources = join(directory, "resources");
    await mkdir(resources);
    await writeFile(join(resources, "existing"), "old working payload");
    await assert.rejects(exec(process.execPath, [
      join(process.cwd(), "apps", "desktop", "tooling", "prepare-runtime-payload.mjs"),
      join(directory, "missing-source"), resources, process.execPath,
    ]));
    assert.equal(await readFile(join(resources, "existing"), "utf8"), "old working payload");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
