import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GoalBoardHomeInstallError, SCHEMA_VERSION, INSTALLER_ID } from "./home-contract.js";
import type { InspectedSource, ReleaseManifest, PromotedRelease } from "./home-contract.js";
import { pathState, writeAtomic, readJsonIfPresent } from "./home-files.js";
import { releaseAssetPaths } from "./release-assets.js";

export async function createRelease(
  stagingDirectory: string,
  source: InspectedSource,
  version: string,
): Promise<void> {
  await fs.mkdir(stagingDirectory, { recursive: false });
  const embeddedNodeModules = path.join(stagingDirectory, "node_modules");
  await fs.mkdir(embeddedNodeModules, { recursive: true });
  if (source.bundledNodePath) {
    await fs.mkdir(path.join(stagingDirectory, "runtime"), { recursive: true });
  }
  await Promise.all([
    ...(await releaseAssetPaths(source.directory)).map(entry => fs.cp(
      path.join(source.directory, entry), path.join(stagingDirectory, entry),
      { recursive: true, force: false, errorOnExist: true, dereference: true },
    )),
    fs.cp(path.join(source.directory, "dist"), path.join(stagingDirectory, "dist"), {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: true,
    }),
    fs.cp(path.join(source.directory, "skills"), path.join(stagingDirectory, "skills"), {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: true,
    }),
    ...(source.bundledNodePath
      ? [
          fs.cp(source.bundledNodePath, path.join(stagingDirectory, "runtime", "node"), {
            recursive: false,
            force: false,
            errorOnExist: true,
          }),
        ]
      : []),
  ]);
  if (source.bundledNodePath) {
    await fs.chmod(path.join(stagingDirectory, "runtime", "node"), 0o755);
  }
  for (const dependency of source.runtimeDependencies) {
    const target = path.join(embeddedNodeModules, dependency.name);
    // Runtime dependencies are collected recursively and flattened into the
    // release's top-level node_modules. Package-manager links inside a
    // dependency's own node_modules are therefore build inputs, not files we
    // should copy into the self-contained release.
    await assertContainedDependencyLinks(dependency.directory, {
      ignoredTopLevelDirectories: ["node_modules"],
    });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(dependency.directory, target, {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: true,
      filter(sourcePath) {
        const relative = path.relative(dependency.directory, sourcePath);
        return relative === "" || relative.split(path.sep)[0] !== "node_modules";
      },
    });
  }
  const planningMethodsDirectory = path.join(
    embeddedNodeModules,
    "@adeptify",
    "goalboard-module-goals",
    "methods",
  );
  if ((await pathState(planningMethodsDirectory))?.isDirectory()) {
    const skillMethodsDirectory = path.join(stagingDirectory, "skills", "goal-advance", "methods");
    await fs.rm(skillMethodsDirectory, { recursive: true, force: true });
    await fs.symlink(
      path.relative(path.dirname(skillMethodsDirectory), planningMethodsDirectory),
      skillMethodsDirectory,
      "dir",
    );
  }
  await assertContainedDependencyLinks(embeddedNodeModules);
  await writeAtomic(
    path.join(stagingDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "@adeptify/goalboard-home-runtime",
        private: true,
        type: "module",
        version,
        dependencies: Object.fromEntries(
          source.runtimeDependencies.map((dependency) => [dependency.name, dependency.version]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  await writeAtomic(
    path.join(stagingDirectory, "release.json"),
    `${JSON.stringify(
      {
        schema_version: SCHEMA_VERSION,
        installer: INSTALLER_ID,
        version,
        dependencies: "embedded",
        ...(source.bundledNodePath ? { node_runtime: "embedded" as const } : {}),
        content_digest: source.contentDigest,
        created_at: new Date().toISOString(),
      } satisfies ReleaseManifest,
      null,
      2,
    )}\n`,
  );
}

export async function assertContainedDependencyLinks(
  rootDirectory: string,
  options: { ignoredTopLevelDirectories?: readonly string[] } = {},
): Promise<void> {
  const ignoredTopLevelDirectories = new Set(options.ignoredTopLevelDirectories ?? []);
  const pending = [rootDirectory];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (directory === rootDirectory && ignoredTopLevelDirectories.has(entry.name)) continue;
        pending.push(entryPath);
        continue;
      }
      if (!entry.isSymbolicLink()) continue;
      const target = await fs.readlink(entryPath);
      const resolved = path.resolve(path.dirname(entryPath), target);
      const relative = path.relative(rootDirectory, resolved);
      if (path.isAbsolute(target) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
        throw new GoalBoardHomeInstallError(
          "source.invalid",
          `GoalBoard 依赖链接指向安装 release 外部，无法生成自包含安装: ${entryPath}`,
        );
      }
    }
  }
}

export async function inspectRelease(
  releaseDirectory: string,
  version: string,
  expectedContentDigest: string,
  expectsBundledNode: boolean,
): Promise<"missing" | "valid" | "refreshable" | "repairable"> {
  const state = await pathState(releaseDirectory);
  if (!state) return "missing";
  if (!state.isDirectory()) {
    throw new GoalBoardHomeInstallError("release.conflict", `已存在未知 GoalBoard release 文件: ${releaseDirectory}`);
  }
  const manifest = await readJsonIfPresent<ReleaseManifest>(path.join(releaseDirectory, "release.json"));
  if (!manifest || manifest.installer !== INSTALLER_ID || manifest.version !== version) {
    throw new GoalBoardHomeInstallError("release.conflict", `已存在未知 GoalBoard release 目录: ${releaseDirectory}`);
  }
  if (
    manifest.schema_version !== SCHEMA_VERSION
    || manifest.dependencies !== "embedded"
    || typeof manifest.content_digest !== "string"
    || (expectsBundledNode && manifest.node_runtime !== "embedded")
  ) {
    return "repairable";
  }
  const required = [
    "dist/cli/main.js",
    "dist/mcp/server.js",
    "dist/web/server.js",
    "skills/goal-advance/SKILL.md",
    "node_modules",
    "package.json",
    ...(expectsBundledNode ? ["runtime/node"] : []),
  ];
  const states = await Promise.all(required.map((item) => pathState(path.join(releaseDirectory, item))));
  if (!states.every(Boolean)) return "repairable";
  const nodeModulesState = states[4];
  if (!nodeModulesState?.isDirectory() || nodeModulesState.isSymbolicLink()) return "repairable";
  if (expectsBundledNode && !states.at(-1)?.isFile()) return "repairable";
  return manifest.content_digest === expectedContentDigest ? "valid" : "refreshable";
}

export async function promoteRelease(
  stagingDirectory: string,
  releaseDirectory: string,
  repairing: boolean,
): Promise<PromotedRelease> {
  if (!repairing) {
    await fs.rename(stagingDirectory, releaseDirectory);
    return { releaseDirectory, created: true, backupDirectory: null };
  }
  const backupDirectory = `${releaseDirectory}.backup-${randomUUID()}`;
  await fs.rename(releaseDirectory, backupDirectory);
  try {
    await fs.rename(stagingDirectory, releaseDirectory);
    return { releaseDirectory, created: false, backupDirectory };
  } catch (error) {
    await fs.rename(backupDirectory, releaseDirectory);
    throw error;
  }
}

export async function rollbackPromotedRelease(promoted: PromotedRelease): Promise<void> {
  try {
    if (promoted.created) {
      await fs.rm(promoted.releaseDirectory, { recursive: true, force: true });
      return;
    }
    if (promoted.backupDirectory) {
      await fs.rm(promoted.releaseDirectory, { recursive: true, force: true });
      await fs.rename(promoted.backupDirectory, promoted.releaseDirectory);
    }
  } catch {
    // Preserve the original error. A later repair can recover this owned release.
  }
}
