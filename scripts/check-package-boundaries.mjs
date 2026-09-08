import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  evaluateImportBoundary,
  extractImportSpecifiers,
  findDependencyCycles,
} from "@adeptify/goalboard-test-kit";

import { checkWorkspacePackages, WORKSPACE_PACKAGES } from "./workspace-packages.mjs";

const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const LEGACY_HUGE_FILE_LINE_LIMIT = 1_000;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function filesUnder(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const name of fs.readdirSync(directory)) {
    if (name === "dist" || name === "node_modules") continue;
    const child = path.join(directory, name);
    const stat = fs.lstatSync(child);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) result.push(...filesUnder(child, predicate));
    else if (predicate(child)) result.push(child);
  }
  return result;
}

function isWithin(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function exportedSubpaths(manifest) {
  if (typeof manifest.exports === "string") return ["."];
  return Object.keys(manifest.exports ?? {});
}

function packageInfos(repositoryRoot) {
  return WORKSPACE_PACKAGES.map((item) => {
    const manifest = readJson(path.join(repositoryRoot, item.path, "package.json"));
    return {
      name: item.name,
      path: item.path,
      kind: item.kind,
      exportedSubpaths: exportedSubpaths(manifest),
      declaredDependencies: Object.keys(manifest.dependencies ?? {}),
      root: path.join(repositoryRoot, item.path),
      manifest,
    };
  });
}

function targetForSpecifier(specifier, packages) {
  return packages.find((item) => specifier === item.name || specifier.startsWith(`${item.name}/`));
}

function ownerForPath(candidate, packages) {
  return packages.find((item) => isWithin(candidate, item.root));
}

function formatViolation(violation) {
  return `${violation.sourceFile}: [${violation.code}] ${violation.message} (${violation.specifier})`;
}

function checkSourceImports(repositoryRoot, packages) {
  const errors = [];
  let sourceFileCount = 0;
  let importCount = 0;

  for (const importer of packages) {
    const sourceFiles = ["src", "tooling", "bin"].flatMap(directory => filesUnder(path.join(importer.root, directory), (filePath) =>
      SOURCE_EXTENSIONS.has(path.extname(filePath)),
    ));
    sourceFileCount += sourceFiles.length;

    for (const sourceFile of sourceFiles) {
      const relativeSource = path.relative(repositoryRoot, sourceFile);
      for (const specifier of extractImportSpecifiers(fs.readFileSync(sourceFile, "utf8"))) {
        importCount += 1;
        let target = targetForSpecifier(specifier, packages);
        let relativeCrossOwner = false;

        if (specifier.startsWith(".")) {
          const resolvedTarget = path.resolve(path.dirname(sourceFile), specifier);
          const relativeOwner = ownerForPath(resolvedTarget, packages);
          if (relativeOwner && relativeOwner.name !== importer.name) target = relativeOwner;
          relativeCrossOwner = !isWithin(resolvedTarget, importer.root);
        }

        for (const violation of evaluateImportBoundary({
          importer,
          target,
          specifier,
          sourceFile: relativeSource,
          relativeCrossOwner,
        })) {
          errors.push(formatViolation(violation));
        }
      }
    }
  }

  return { errors, importCount, sourceFileCount };
}

function checkDependencyGraph(packages) {
  const errors = [];
  const packageNames = new Set(packages.map((item) => item.name));
  const graph = new Map();

  for (const importer of packages) {
    const workspaceDependencies = importer.declaredDependencies.filter((name) => packageNames.has(name));
    graph.set(importer.name, workspaceDependencies);
    for (const dependency of importer.declaredDependencies) {
      const target = packages.find((item) => item.name === dependency);
      for (const violation of evaluateImportBoundary({
        importer,
        target,
        specifier: dependency,
        sourceFile: `${importer.path}/package.json`,
      })) {
        // A manifest declares the npm package; source code must still select an
        // explicit exported Contract subpath.
        if (violation.code === "contracts-root-import") continue;
        errors.push(formatViolation(violation));
      }
    }
  }

  for (const cycle of findDependencyCycles(graph)) {
    errors.push(`[workspace-dependency-cycle] ${cycle.join(" -> ")}`);
  }
  return { errors, edgeCount: [...graph.values()].reduce((total, edges) => total + edges.length, 0) };
}

function checkCompatibilityAllowlist(repositoryRoot) {
  const errors = [];
  const allowlistPath = path.join(repositoryRoot, "tooling/boundaries/compatibility-allowlist.json");
  if (!fs.existsSync(allowlistPath)) {
    return { errors: ["missing tooling/boundaries/compatibility-allowlist.json"], entryCount: 0, hugeFileCount: 0 };
  }

  const allowlist = readJson(allowlistPath);
  const entries = Array.isArray(allowlist.entries) ? allowlist.entries : [];
  const listedPaths = new Set();
  for (const entry of entries) {
    if (typeof entry.path !== "string" || entry.path.includes("*") || path.isAbsolute(entry.path)) {
      errors.push("compatibility allowlist entries require one explicit repository-relative path");
      continue;
    }
    if (listedPaths.has(entry.path)) errors.push(`compatibility allowlist duplicates ${entry.path}`);
    listedPaths.add(entry.path);
    if (!fs.existsSync(path.join(repositoryRoot, entry.path))) errors.push(`compatibility allowlist path does not exist: ${entry.path}`);
    if (typeof entry.removalOwner !== "string" || entry.removalOwner.length === 0) {
      errors.push(`${entry.path}: missing removalOwner`);
    }
    if (!Array.isArray(entry.migrationGoals) || entry.migrationGoals.length === 0) {
      errors.push(`${entry.path}: missing migrationGoals`);
    }
    if (typeof entry.removalCondition !== "string" || entry.removalCondition.length === 0) {
      errors.push(`${entry.path}: missing removalCondition`);
    }
  }

  const legacySources = filesUnder(path.join(repositoryRoot, "src"), (filePath) =>
    SOURCE_EXTENSIONS.has(path.extname(filePath)),
  );
  let hugeFileCount = 0;
  for (const filePath of legacySources) {
    const lineCount = fs.readFileSync(filePath, "utf8").split(/\r?\n/u).length;
    if (lineCount <= LEGACY_HUGE_FILE_LINE_LIMIT) continue;
    hugeFileCount += 1;
    const relativePath = path.relative(repositoryRoot, filePath);
    if (!listedPaths.has(relativePath)) {
      errors.push(`${relativePath}: ${lineCount} lines requires an explicit compatibility allowlist entry`);
    }
  }

  return { errors, entryCount: entries.length, hugeFileCount };
}

function checkMigratedFeedOwnership(repositoryRoot) {
  const errors = [];
  if (fs.existsSync(path.join(repositoryRoot, "src/feed/relay-import.ts"))) {
    errors.push("src/feed/relay-import.ts: migrated Relay compatibility implementation must stay deleted");
  }
  for (const relativePath of ["plugins/native/feed/src/relay-import.ts", "plugins/native/feed/src/relay-import-sources.ts"]) {
    const source = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    if (/\b(?:FROM|INTO|UPDATE)\s+(?:inbox_sources|items|evidence_refs|connectors|connector_cursors)\b/iu.test(source)) {
      errors.push(`${relativePath}: legacy database access belongs to the isolated Relay reader adapter`);
    }
  }
  const legacyCallers = [
    "apps/local-host/src/feed-application.ts",
    "apps/local-host/src/feed-source-service.ts",
    "plugins/native/feed/src/application.ts",
    "plugins/native/feed/src/source-service.ts",
    "plugins/native/feed/src/source-sync.ts",
    "plugins/native/feed/src/connector-service.ts",
    "plugins/native/feed/src/connector-source-registration.ts",
    "plugins/native/feed/src/connector-sync.ts",
    "plugins/native/feed/src/source-scheduler.ts",
    "apps/local-host/src/relay-import.ts",
    "plugins/native/feed/src/relay-import.ts",
    "plugins/native/feed/src/relay-import-sources.ts",
    "apps/local-host/src/web-request.ts",
  ];
  const directFactSql = /\b(?:CREATE TABLE IF NOT EXISTS|FROM|INTO|UPDATE|DELETE FROM)\s+(feed_items|feed_materials|inbox_entries)\b/giu;
  for (const relativePath of legacyCallers) {
    const source = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    for (const match of source.matchAll(directFactSql)) {
      errors.push(`${relativePath}: direct ${match[1]} SQL must use the owning Module public API`);
    }
  }
  return { errors };
}

function checkMigratedIntegrationOwnership(repositoryRoot) {
  const errors = [];
  const servicePath = "plugins/native/feed/src/connector-sync.ts";
  const service = fs.readFileSync(path.join(repositoryRoot, servicePath), "utf8");
  for (const forbidden of [
    "legacy-adapter:",
    "RawEventAdapter",
    "ConnectorDriver",
    "createGithubConnector",
    "createGmailConnector",
  ]) {
    if (service.includes(forbidden)) {
      errors.push(`${servicePath}: ${forbidden} belongs to the official Plugin composition boundary`);
    }
  }
  const hostPath = "apps/local-host/src/feed-connector-sync.ts";
  const host = fs.readFileSync(path.join(repositoryRoot, hostPath), "utf8");
  if (!service.includes("this.ports.createListener") || !host.includes("OfficialIntegrationRegistry")) {
    errors.push(`${servicePath}: Feed must consume a Host-composed Listener backed by official Integration contributions`);
  }

  const listenerPath = "horizontal/listener-host/src/index.ts";
  const listener = fs.readFileSync(path.join(repositoryRoot, listenerPath), "utf8");
  if (/io\.goalboard\.integration\.|\b(?:github|gmail|youtube)\b/iu.test(listener)) {
    errors.push(`${listenerPath}: Listener Host must remain Provider-neutral`);
  }

  for (const name of ["github", "gmail", "rss", "web-query", "youtube"]) {
    const pluginRoot = path.join(repositoryRoot, "plugins/official-integrations", name);
    const manifestPath = path.join(pluginRoot, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      errors.push(`plugins/official-integrations/${name}: missing manifest.json`);
      continue;
    }
    const manifest = readJson(manifestPath);
    if (
      manifest.schema_version !== 1
      || manifest.kind !== "integration"
      || !String(manifest.plugin_id ?? "").startsWith("io.goalboard.integration.")
      || !String(manifest.version ?? "").match(/^\d+\.\d+\.\d+/u)
      || !String(manifest.publisher?.signature ?? "").trim()
      || !Array.isArray(manifest.entrypoints)
      || manifest.entrypoints.length === 0
    ) {
      errors.push(`plugins/official-integrations/${name}/manifest.json: invalid install identity`);
    }
    const packageManifest = readJson(path.join(pluginRoot, "package.json"));
    if (!Array.isArray(packageManifest.files) || !packageManifest.files.includes("manifest.json")) {
      errors.push(`plugins/official-integrations/${name}/package.json: install package must include manifest.json`);
    }
    const entrypoint = fs.readFileSync(path.join(pluginRoot, "src/index.ts"), "utf8");
    for (const identity of [manifest.plugin_id, manifest.version, manifest.publisher?.signature]) {
      if (typeof identity === "string" && !entrypoint.includes(JSON.stringify(identity))) {
        errors.push(`plugins/official-integrations/${name}: source Manifest differs from manifest.json identity`);
      }
    }
  }

  for (const composition of [
    { provider: "github", packageName: "@adeptify/goalboard-integration-github", forbidden: "api.github.com" },
    { provider: "gmail", packageName: "@adeptify/goalboard-integration-gmail", forbidden: "gmail.googleapis.com" },
  ]) {
    const legacyPath = `src/feed/connectors/${composition.provider}.ts`;
    if (fs.existsSync(path.join(repositoryRoot, legacyPath))) {
      errors.push(`${legacyPath}: migrated Provider compatibility entrypoint must stay deleted`);
    }
    const hostPath = `apps/local-host/src/${composition.provider}-connector.ts`;
    const source = fs.readFileSync(path.join(repositoryRoot, hostPath), "utf8");
    if (!source.includes(composition.packageName) || source.includes(composition.forbidden)) {
      errors.push(`${hostPath}: Host must compose the public Integration without owning Provider protocol`);
    }
  }
  return { errors };
}

function checkMigratedFeedUiOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const renderer = read("apps/workbench/src/renderer.ts");
  const server = read("apps/local-host/src/web-request.ts");
  const uiAdapter = read("apps/workbench/src/feed-projection-ui.ts");
  const httpAdapter = read("apps/local-host/src/feed-native-plugin-http.ts");
  if (fs.existsSync(path.join(repositoryRoot, "src/web/feed-native-plugin-http.ts"))) {
    errors.push("src/web/feed-native-plugin-http.ts: migrated Feed HTTP entry must stay deleted");
  }
  if (!httpAdapter.includes("createFeedRouteHandlers")) {
    errors.push("Feed HTTP adapter must bind the Native Feed request handlers");
  }
  const pluginUi = read("plugins/native/feed/src/ui.ts");
  const pluginRoutes = read("plugins/native/feed/src/routes.ts");
  const workbench = read("apps/workbench/src/index.ts") + read("apps/workbench/src/ui-composition.ts");
  const uiHost = read("packages/ui-host/src/index.ts");

  for (const forbidden of [
    "function renderFeedDirectory(",
    "function renderSourceDirectory(",
    "function renderSourceWorkbench(",
    "function renderPersistedFeedDetail(",
  ]) {
    if (renderer.includes(forbidden)) {
      errors.push(`apps/workbench/src/renderer.ts: ${forbidden} must be owned by the Feed UI Contribution`);
    }
  }
  if (!renderer.includes("renderFeedNativePluginSurface")) {
    errors.push("apps/workbench/src/renderer.ts: Feed caller must render through the Native Plugin adapter");
  }
  for (const forbidden of ["/api/feed", "/api/inbox/", "promoteFeedItemToGoal(", "sendFeedError("]) {
    if (server.includes(forbidden)) {
      errors.push(`apps/local-host/src/web-request.ts: ${forbidden} must be owned by the Feed Plugin HTTP adapter`);
    }
  }
  if (!server.includes("handleFeedNativePluginHttp") || !httpAdapter.includes("new FeedPluginRouteTable") || !httpAdapter.includes("routes.handle")) {
    errors.push("apps/local-host/src/web-request.ts: Feed HTTP caller must delegate through the public Plugin route table");
  }
  if (!uiAdapter.includes("renderFeedContribution") || !pluginUi.includes("feedUiContribution")) {
    errors.push("Feed UI must cross the Workbench public contribution entrypoint");
  }
  if (!pluginRoutes.includes("class FeedPluginRouteTable") || !workbench.includes("host.register(feedUiContribution)")) {
    errors.push("Feed route/UI contributions must be registered by their declared public hosts");
  }
  if (!uiHost.includes("class UiHost") || !uiHost.includes("render<TModel>(request")) {
    errors.push("packages/ui-host: real contribution registry/render behavior is missing");
  }
  return { errors };
}

function checkMigratedGoalsCommandOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const coordinatorPath = "apps/local-host/src/goal-project-application.ts";
  const coordinator = read(coordinatorPath);
  errors.push(...checkDraftProposalOwnerSql(read("modules/goals/src/goal-commands.ts")));
  if (!coordinator.includes('from "@adeptify/goalboard-module-goals"')) {
    errors.push(`${coordinatorPath}: Goal application composition must use the Goals Module public entrypoint`);
  }

  if (
    !coordinator.includes("readonly goals: GoalsApplicationApi<ActionTransitionReceipt>")
    || !coordinator.includes("commands: goalsModule.commands")
    || !coordinator.includes("lifecycle: goalsModule.lifecycle")
    || !coordinator.includes("planning: goalsModule.planning")
  ) {
    errors.push(`${coordinatorPath}: Apps require one Contract-typed Goals application port`);
  }
  const removedGoalFacadeMethods = [
    "addProjectGuidance",
    "updateProjectGuidance",
    "createGoal",
    "updateDraftGoal",
    "addRelation",
    "deactivateRelation",
    "setPolicy",
    "addRisk",
    "updateRisk",
    "setRiskState",
    "setGoalArchived",
    "setGoalTrashed",
    "revalidateGoal",
    "evaluateLeafCompletion",
    "effectivePlanningMethods",
    "projectPlanningComposition",
    "saveProjectPlanningMethod",
    "analyzePlanningChange",
    "validatePlanningGraph",
  ];
  for (const method of removedGoalFacadeMethods) {
    if (coordinator.includes(`  ${method}(`)) {
      errors.push(`${coordinatorPath}: GW4 requires the ${method} compatibility facade to stay deleted`);
    }
  }

  const requiredOwnerFiles = [
    "modules/goals/src/goal-commands.ts",
    "modules/goals/src/risk-commands.ts",
    "modules/goals/src/guidance-commands.ts",
    "modules/goals/src/lifecycle-archive.ts",
    "modules/goals/src/lifecycle-commands.ts",
    "modules/goals/src/lifecycle-completion.ts",
    "modules/goals/src/lifecycle-ports.ts",
    "modules/goals/src/lifecycle-reasons.ts",
    "modules/goals/src/lifecycle-revalidation.ts",
    "modules/goals/src/lifecycle-revisions.ts",
    "modules/goals/src/migrations.ts",
    "modules/goals/src/planning/decomposition-coverage.ts",
    "modules/goals/src/planning/decomposition-validation.ts",
    "modules/goals/src/planning/engine.ts",
    "modules/goals/src/planning/goal-graph.ts",
    "modules/goals/src/planning/method-catalog.ts",
    "modules/goals/src/planning/method-packs.ts",
    "modules/goals/src/query.ts",
    "modules/goals/src/repository.ts",
    "packages/contracts/src/modules/goals.ts",
    "plugins/native/goals/src/goal-query-application.ts",
    "tooling/migrations/audit-goal-lifecycle.mjs",
    "tooling/migrations/README.md",
  ];
  for (const relativePath of requiredOwnerFiles) {
    if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: missing Goals command owner boundary`);
    }
  }
  const moduleManifest = readJson(path.join(repositoryRoot, "modules/goals/package.json"));
  if (moduleManifest.goalboard?.maturity !== "partial") {
    errors.push("modules/goals/package.json: migrated Goal commands require partial maturity");
  }
  if (!moduleManifest.goalboard?.capabilities?.includes("goals.lifecycle.v1")) {
    errors.push("modules/goals/package.json: GW2 requires goals.lifecycle.v1 capability");
  }
  if (!moduleManifest.goalboard?.capabilities?.includes("goals.planning.v1")) {
    errors.push("modules/goals/package.json: GW3 requires goals.planning.v1 capability");
  }
  if (!moduleManifest.goalboard?.capabilities?.includes("goals.query.v1")) {
    errors.push("modules/goals/package.json: Goals Query requires goals.query.v1 capability");
  }
  if (!moduleManifest.files?.includes("methods")) {
    errors.push("modules/goals/package.json: Planning method assets must ship with the Goals package");
  }
  const planningMethodAssets = filesUnder(
    path.join(repositoryRoot, "modules/goals/methods"),
    (filePath) => path.extname(filePath) === ".md",
  );
  if (planningMethodAssets.length !== 37) {
    errors.push(`modules/goals/methods: expected 37 owned Planning method assets, found ${planningMethodAssets.length}`);
  }
  const legacyPlanningMethodAssets = filesUnder(
    path.join(repositoryRoot, "skills/goal-advance/methods"),
    (filePath) => path.extname(filePath) === ".md",
  );
  if (legacyPlanningMethodAssets.length > 0) {
    errors.push("skills/goal-advance/methods: source assets must not duplicate Goals-owned Planning methods");
  }
  const homeInstaller = read("apps/local-host/src/installer/home-release.ts");
  if (
    !homeInstaller.includes('"goalboard-module-goals"')
    || !homeInstaller.includes("skillMethodsDirectory")
    || !homeInstaller.includes("fs.symlink(")
  ) {
    errors.push("apps/local-host/src/installer/home-release.ts: installed GoalBoard Skill must link to packaged Goals method assets");
  }

  const factMaterializerPath = "plugins/native/goals/src/goal-tree-fact-materializer.ts";
  const factMaterializer = read(factMaterializerPath);
  if (coordinator.includes("private materializeAcceptedGoalContractRevision(")
      || coordinator.includes("private materializeGoalTreeGoal(")
      || !factMaterializer.includes("this.goals.lifecycle.applyAcceptedContractRevision(")
      || /\bthis\.store\b|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/iu.test(factMaterializer)) {
    errors.push(`${factMaterializerPath}: confirmed Goal materialization must use public owner lifecycle, not legacy methods or SQL`);
  }
  const decideContractPath = "plugins/native/goals/src/legacy-contract-decision.ts";
  const decideContract = read(decideContractPath);
  if (
    coordinator.includes("  decideContractProposal(")
    || !decideContract.includes("this.ports.goals.lifecycle.acceptDraft")
    || /\bthis\.store\b|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/iu.test(decideContract)
  ) {
    errors.push(`${decideContractPath}: accepted Draft materialization must use Goals lifecycle public API`);
  }
  for (const match of coordinator.matchAll(/UPDATE goals SET[\s\S]{0,500}?(?:archived_at|trashed_at|validity_state|fulfillment_state|current_contract_revision)/giu)) {
    errors.push(`${coordinatorPath}: Goal lifecycle state writes must use GoalsModule.lifecycle (${match[0].split(/\r?\n/u)[0]})`);
  }
  const reconciliationPath = "plugins/native/goals/src/lifecycle-application.ts";
  const reconcileBody = read(reconciliationPath);
  if (
    coordinator.includes("private reconcileLifecycle(")
    || coordinator.includes("this.reconcileLifecycle(")
    || !coordinator.includes("new LifecycleReconciliationApplication(")
    || !reconcileBody.includes("this.ports.goals.reopenForLifecycleFacts")
    || !reconcileBody.includes("this.ports.goals.satisfyForLifecycleFacts")
    || !reconcileBody.includes("this.ports.execution.releaseClaimForLifecycleFacts")
    || /\b(?:store|repository)\b|UPDATE goals SET/iu.test(reconcileBody)
  ) {
    errors.push(`${reconciliationPath}: lifecycle reconciliation must compose public owner APIs without legacy callbacks or persistence`);
  }

  const storePath = "src/sdk-store.ts";
  const store = read(storePath);
  for (const method of [
    "migrateGoalArchive",
    "migrateGoalTrash",
    "migrateLifecycleState",
    "migrateActiveGoalLifecycle",
    "migrateContractCoverageAndRiskResolution",
  ]) {
    if (store.includes(`private ${method}(`)) {
      errors.push(`${storePath}: legacy ${method} implementation must not coexist with Goals migrations`);
    }
  }
  for (const migration of [
    "migrateGoalArchiveSchema",
    "migrateGoalTrashSchema",
    "migrateGoalLifecycleState",
    "migrateActiveGoalLifecycle",
    "migrateGoalContractCoverageSchema",
    "migratePlanningMethodPacksSchema",
  ]) {
    if (!read("apps/local-host/src/project-migrations.ts").includes(migration) || !read("apps/local-host/src/project-database.ts").includes("migrateLocalProjectDatabase")) {
      errors.push(`${storePath}: startup migration must call public ${migration}`);
    }
  }

  if (store.includes("private migratePlanningMethodPacks(")) {
    errors.push(`${storePath}: legacy Planning migration must not coexist with Goals migrations`);
  }
  if (/\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\s+planning_method_packs\b/iu.test(store)) {
    errors.push(`${storePath}: Planning method persistence must use GoalsRepository`);
  }

  for (const relativePath of [
    "src/planning/goal-graph.ts",
    "src/planning/method-catalog.ts",
    "src/planning/method-packs.ts",
    "src/v1/goal-decomposition-validation.ts",
  ]) {
    if (fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: GW4 requires the zero-caller Planning compatibility entrypoint to stay deleted`);
    }
  }

  const planningTest = read("tests/planning-engine.test.ts");
  if (!planningTest.includes('from "@adeptify/goalboard-module-goals"')) {
    errors.push("tests/planning-engine.test.ts: Planning behavior must be tested through the Goals public API");
  }

  const queryDelegates = [
    ["readProjectGuidance", "setActiveGoal", "this.goalQueries.readProjectGuidance"],
    ["listTrashedGoals", "queryReady", "this.goalQueries.listTrashedGoals"],
    ["queryReady", "queryAvailable", "this.availability.queryReady"],
    ["getResolvedGoalPolicy", "explainGoal", "this.goalQueries.getResolvedGoalPolicy"],
    ["readGoalContract", "private readRun", "this.goalQueries.readGoalContract"],
  ];
  for (const [method, nextMethod, expectedCall] of queryDelegates) {
    const start = coordinator.indexOf(`  ${method}(`);
    const end = coordinator.indexOf(`  ${nextMethod}(`, start + method.length + 3);
    if (start < 0 || end < 0) {
      errors.push(`${coordinatorPath}: cannot locate migrated ${method} Query method`);
      continue;
    }
    const body = coordinator.slice(start, end);
    if (!body.includes(expectedCall)) {
      errors.push(`${coordinatorPath}: ${method} must read Goal-owned facts through ${expectedCall}`);
    }
  }

  const storeQuerySlices = [
    ["getGoal", "listGoals", "new GoalsRepository"],
    ["listGoals", "listTrashedGoals", "this.goalsQuery.listGoals"],
    ["listTrashedGoals", "listPlanningMethodPacks", "this.goalsQuery.listTrashedGoals"],
    ["activePolicyRows", "activePolicyRowsForBoard", "listActivePolicyBindings"],
  ];
  for (const [method, nextMethod, expectedCall] of storeQuerySlices) {
    const start = store.indexOf(`  ${method}(`);
    const end = store.indexOf(`  ${nextMethod}(`, start + method.length + 3);
    if (start < 0 || end < 0 || !store.slice(start, end).includes(expectedCall)) {
      errors.push(`${storePath}: ${method} must delegate Goal reads through the Goals public owner`);
    }
  }

  const queryTest = read("tests/goals-query-module.test.ts");
  if (
    !queryTest.includes('from "@adeptify/goalboard-module-goals"')
    || !queryTest.includes("goals.query.readGoal")
    || !queryTest.includes("goals.query.snapshot")
  ) {
    errors.push("tests/goals-query-module.test.ts: Goal facts and parity must be tested through the public Query API");
  }

  const goalReadApplicationPath = "plugins/native/goals/src/goal-query-application.ts";
  const goalReadApplication = read(goalReadApplicationPath);
  if (
    !goalReadApplication.includes("GoalsQueryApi")
    || !goalReadApplication.includes("this.goals.readGoal")
  ) {
    errors.push(`${goalReadApplicationPath}: Goal-owned facts must come from the public Goals Query API`);
  }
  if (
    goalReadApplication.includes("GoalsRepository")
    || /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/iu.test(goalReadApplication)
    || /\bthis\.(?:db|store)\b/u.test(goalReadApplication)
  ) {
    errors.push(`${goalReadApplicationPath}: compatibility composition must not own Goal persistence or bypass Goals Query`);
  }
  for (const relativePath of ["src/sdk-store.ts", "plugins/native/goals/src/board-v3-import.ts"]) {
    errors.push(...checkGoalStorageOwnership(read(relativePath)).map(error => `${relativePath}: ${error}`));
  }
  errors.push(...checkGoalReadOwnerSql(read("apps/local-host/src/feed-application.ts")).map(error => `apps/local-host/src/feed-application.ts: ${error}`));
  for (const relativePath of ["apps/local-host/src/web-request.ts", "apps/mcp/src/tool-dispatch.ts", "apps/cli/src/command-dispatch.ts"]) {
    const source = read(relativePath);
    errors.push(...checkGoalReadOwnerSql(source).map(error => `${relativePath}: ${error}`));
    if (
      /\bcoordinator(?:ForResume)?\.(?:readGoalContract|readProjectGuidance|listTrashedGoals|getResolvedGoalPolicy)\b/u.test(source)
    ) {
      errors.push(`${relativePath}: Goal read callers must use the public Goal query application boundary`);
    }
    if (relativePath === "apps/local-host/src/web-request.ts") {
      if (!source.includes(".goalQueries.")) errors.push(`${relativePath}: migrated Goal read caller is missing goalQueries public usage`);
    } else {
      const hostSource = read("apps/local-host/src/project-capabilities.ts");
      if (!source.includes("client.invoke(readGoalContractCapability,")
        || !source.includes('from "@adeptify/goalboard-plugin-goals"')
        || !hostSource.includes("host.register(readGoalContractCapability,")
        || !hostSource.includes("runtime.coordinator.goalQueries.readGoalContract(input.board_id, input.goal_id)")) {
        errors.push(`${relativePath}: Goal Contract reads must invoke the public capability registered against the existing query owner`);
      }
      if (source.includes(".goalQueries.")) errors.push(`${relativePath}: migrated Goal reads must not bypass the Host Client`);
    }
  }
  errors.push(...checkGoalReadOwnerSql(coordinator).map(error => `${coordinatorPath}: ${error}`));

  const appAdapters = [
    {
      appPath: "apps/workbench/src/index.ts",
      callerPath: "apps/local-host/src/web-request.ts",
      factory: "createWorkbenchGoalsAdapter",
      capability: "workbench.goals-command-adapter.v1",
    },
    {
      appPath: "apps/mcp/src/index.ts",
      callerPath: "apps/mcp/src/tool-dispatch.ts",
      factory: "createMcpGoalsAdapter",
      capability: "mcp.goals-command-adapter.v1",
      commandHandlerPath: "apps/mcp/src/goal-commands.ts",
      commandHandlerFactory: "createMcpGoalToolHandlers",
      commandDispatch: "goalTools[name](arguments_)",
    },
    {
      appPath: "apps/cli/src/index.ts",
      callerPath: "apps/cli/src/command-dispatch.ts",
      factory: "createCliGoalsAdapter",
      capability: "cli.goals-command-adapter.v1",
      commandHandlerPath: "apps/cli/src/goal-commands.ts",
      commandHandlerFactory: "createCliGoalCommandHandlers",
      commandDispatch: "goalCommands[operation](input)",
    },
  ];
  for (const { appPath, callerPath, factory, capability, commandHandlerPath, commandHandlerFactory, commandDispatch } of appAdapters) {
    const app = read(appPath) + (appPath === "apps/workbench/src/index.ts" ? read("apps/workbench/src/ui-composition.ts") : "");
    const caller = read(callerPath);
    if (
      !app.includes("GoalsApplicationApi")
      || !app.includes(`function ${factory}`)
      || !app.includes(`"${capability}"`)
    ) {
      errors.push(`${appPath}: GW4 requires a Contract-typed ${factory} public adapter`);
    }
    if (
      app.includes("@adeptify/goalboard-module-goals")
      || /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/iu.test(app)
      || /\b(?:SqliteGoalBoardStore|GoalsRepository|GoalBoardCoordinator)\b/u.test(app)
    ) {
      errors.push(`${appPath}: App adapter must not import the Goal implementation, Store, or business rules`);
    }
    const commandHandler = commandHandlerPath ? read(commandHandlerPath) : null;
    const hasCommandPath = commandHandler !== null
      ? app.includes(`export { ${commandHandlerFactory} }`)
        && caller.includes(`${commandHandlerFactory}(goalsAdapter`)
        && caller.includes(commandDispatch)
        && commandHandler.includes(`function ${commandHandlerFactory}`)
        && commandHandler.includes("GoalsEntryApi")
        && commandHandler.includes("goals.commands.")
      : caller.includes("handleGoalsWebHttp({")
        && caller.includes("commands: goalsAdapter.commands")
        && read("plugins/native/goals/src/http/index.ts").includes("handleGoalCreateHttp(context)")
        && read("plugins/native/goals/src/http/create.ts").includes("context.commands.createGoal(");
    if (
      !(["apps/mcp/src/tool-dispatch.ts", "apps/cli/src/command-dispatch.ts"].includes(callerPath)
        ? caller.includes('from "./goal-commands.js"')
        : caller.includes(`from "@adeptify/goalboard-app-${appPath.split("/")[1]}"`))
      || !(commandHandler !== null
        ? caller.includes("createGoalsEntryClient(client)")
          && caller.includes("client.withScope(")
          && !caller.includes(".withProject(")
          && !caller.includes("coordinator.goals")
        : caller.includes(`${factory}(coordinator.goals)`))
      || !hasCommandPath
    ) {
      errors.push(`${callerPath}: Goal writes must enter through the public App commands and its Host Client (or unmigrated Workbench adapter)`);
    }
    if (commandHandler !== null && (
      commandHandler.includes("@adeptify/goalboard-module-goals")
      || /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/iu.test(commandHandler)
      || /\b(?:SqliteGoalBoardStore|GoalsRepository|GoalBoardCoordinator)\b/u.test(commandHandler)
    )) {
      errors.push(`${commandHandlerPath}: command handlers must not own Module implementations, Store, or copied business rules`);
    }
  }
  for (const file of ["create", "draft", "relations", "risk-impact", "policy-guidance", "verification", "lifecycle", "decisions"]) {
    const nativePath = `plugins/native/goals/src/http/${file}.ts`;
    const source = read(nativePath);
    errors.push(...checkGoalStorageOwnership(source).map(error => `${nativePath}: ${error}`));
    if (/goalboard-app-|goalboard-module-|node:http|\b(?:LocalProjectDatabase|GoalProjectApplication|SqliteGoalBoardStore|GoalsRepository)\b/u.test(source)) {
      errors.push(`${nativePath}: Native Goal requests must consume public operation ports without Host or Module implementations`);
    }
  }
  const appAdapterTestPath = "tests/goals-app-adapters.test.ts";
  const appAdapterTest = read(appAdapterTestPath);
  for (const { factory } of appAdapters) {
    if (!appAdapterTest.includes(factory)) {
      errors.push(`${appAdapterTestPath}: GW4 compatibility test must exercise ${factory}`);
    }
  }
  if (
    !appAdapterTest.includes("goal.title_required")
    || !appAdapterTest.includes("replay.replayed")
    || !appAdapterTest.includes("assert.equal(adapter.commands, coordinator.goals.commands)")
  ) {
    errors.push(`${appAdapterTestPath}: GW4 must pin adapter identity, idempotency, and shared error behavior`);
  }
  const removedFacadeCall = /\bcoordinator(?:ForResume)?\.(?:addProjectGuidance|updateProjectGuidance|createGoal|updateDraftGoal|addRelation|deactivateRelation|setPolicy|addRisk|updateRisk|setRiskState|setGoalArchived|setGoalTrashed|revalidateGoal|evaluateLeafCompletion|effectivePlanningMethods|projectPlanningComposition|saveProjectPlanningMethod|analyzePlanningChange|validatePlanningGraph)\b/u;
  for (const relativePath of [
    "apps/local-host/src/web-request.ts",
    "apps/mcp/src/tool-dispatch.ts",
    "apps/cli/src/command-dispatch.ts",
    "apps/local-host/src/demo-seed.ts",
    "plugins/native/goals/src/board-v3-import.ts",
    "apps/local-host/src/feed-native-plugin-http.ts",
    "plugins/native/feed/src/goal-promotion.ts",
  ]) {
    if (removedFacadeCall.test(read(relativePath))) {
      errors.push(`${relativePath}: GW4 caller still uses a removed GoalBoardCoordinator Goal facade`);
    }
  }

  for (const relativePath of filesUnder(path.join(repositoryRoot, "modules/goals/src"), (filePath) =>
    SOURCE_EXTENSIONS.has(path.extname(filePath)))) {
    const source = fs.readFileSync(relativePath, "utf8");
    const lineCount = source.split(/\r?\n/u).length;
    if (lineCount > 700) {
      errors.push(`${path.relative(repositoryRoot, relativePath)}: ${lineCount} lines exceeds the migrated owner limit; split by responsibility`);
    }
    if (
      path.basename(relativePath) !== "migrations.ts"
      && /\b(?:FROM|INTO|UPDATE|DELETE FROM)\s+(claims|runs|review_obligations)\b/iu.test(source)
    ) {
      errors.push(`${path.relative(repositoryRoot, relativePath)}: lifecycle code must use explicit cross-owner ports`);
    }
  }
  return { errors };
}

function checkMigratedGovernanceOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const requiredOwnerFiles = [
    "packages/contracts/src/modules/governance-collaboration.ts",
    "modules/governance-collaboration/src/index.ts",
    "modules/governance-collaboration/src/schema.ts",
    "modules/governance-collaboration/src/migrations.ts",
    "modules/governance-collaboration/src/repository.ts",
    "modules/governance-collaboration/src/review-lifecycle.ts",
    "modules/governance-collaboration/src/record-store.ts",
    "modules/governance-collaboration/src/goal-tree-records.ts",
    "modules/governance-collaboration/src/state-machine.ts",
    "tests/governance-collaboration-module.test.ts",
  ];
  for (const relativePath of requiredOwnerFiles) {
    if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: missing Governance owner boundary`);
    }
  }

  const manifest = readJson(path.join(repositoryRoot, "modules/governance-collaboration/package.json"));
  const requiredCapabilities = [
    "governance.review-obligations.v1",
    "governance.reviews.v1",
    "governance.proposals.v1",
    "governance.decisions.v1",
  ];
  if (manifest.goalboard?.maturity !== "partial") {
    errors.push("modules/governance-collaboration/package.json: EX3 requires partial maturity");
  }
  for (const capability of requiredCapabilities) {
    if (!manifest.goalboard?.capabilities?.includes(capability)) {
      errors.push(`modules/governance-collaboration/package.json: missing ${capability}`);
    }
  }

  const contractPath = "packages/contracts/src/modules/governance-collaboration.ts";
  const contract = read(contractPath);
  for (const publicApi of [
    "GovernanceQueryApi",
    "GovernanceReviewApi",
    "GovernanceRecordsApi",
    "GovernanceDecisionApi",
    "GovernanceApplicationApi",
  ]) {
    if (!contract.includes(`interface ${publicApi}`)) {
      errors.push(`${contractPath}: missing public ${publicApi}`);
    }
  }

  const coordinatorPath = "apps/local-host/src/goal-project-application.ts";
  const coordinator = read(coordinatorPath);
  if (
    !coordinator.includes('from "@adeptify/goalboard-module-governance-collaboration"')
    || !coordinator.includes("readonly governance: GovernanceApplicationApi")
    || !coordinator.includes("records: governanceModule.records")
  ) {
    errors.push(`${coordinatorPath}: Governance callers must use the Contract-typed public application port`);
  }
  if (coordinator.includes("this.governanceModule")) {
    errors.push(`${coordinatorPath}: concrete Governance implementation must not escape composition`);
  }

  const governanceTables = "review_obligations|reviews|candidates|contract_proposals|rewires|goal_tree_proposals|goal_tree_proposal_items|goal_tree_proposal_decisions";
  const directGovernanceSql = new RegExp(
    `\\b(?:CREATE TABLE IF NOT EXISTS|FROM|INTO|UPDATE|DELETE FROM)\\s+(?:${governanceTables})\\b`,
    "giu",
  );
  for (const relativePath of [coordinatorPath, "src/sdk-store.ts"]) {
    const source = read(relativePath);
    for (const match of source.matchAll(directGovernanceSql)) {
      errors.push(`${relativePath}: direct Governance SQL must use the owning Module public entrypoint (${match[0]})`);
    }
  }

  const legacyTypes = read("src/sdk-types.ts");
  for (const typeName of [
    "ReviewObligationRecord",
    "ReviewRecord",
    "ContractProposalRecord",
    "CandidateGoalRecord",
    "RewireRecord",
    "GoalTreeProposalRecord",
  ]) {
    const typeAlias = new RegExp(
      `export type ${typeName}\\s*=\\s*[\\s\\S]{0,160}governance-collaboration`,
      "u",
    );
    if (!typeAlias.test(legacyTypes)) {
      errors.push(`src/sdk-types.ts: ${typeName} must remain a public Governance Contract alias`);
    }
  }

  for (const filePath of filesUnder(
    path.join(repositoryRoot, "modules/governance-collaboration/src"),
    (candidate) => SOURCE_EXTENSIONS.has(path.extname(candidate)),
  )) {
    const lineCount = fs.readFileSync(filePath, "utf8").split(/\r?\n/u).length;
    if (lineCount > 400) {
      errors.push(`${path.relative(repositoryRoot, filePath)}: ${lineCount} lines exceeds the Governance owner limit; split by responsibility`);
    }
  }

  const testPath = "tests/governance-collaboration-module.test.ts";
  const test = read(testPath);
  for (const requiredBehavior of [
    "submitAuthorizedReview",
    "authority_source",
    "conversation_ref",
    "materializeAtomically",
    "assert.throws",
  ]) {
    if (!test.includes(requiredBehavior)) {
      errors.push(`${testPath}: missing EX3 coverage for ${requiredBehavior}`);
    }
  }
  return { errors };
}

function checkExecutionValidationOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const requiredFiles = [
    "plugins/native/goals/src/execution-validation-contract.ts",
    "plugins/native/goals/src/action-projection.ts",
    "plugins/native/goals/src/action-projection-index.ts",
    "plugins/native/goals/src/action-projection-factory.ts",
    "plugins/native/goals/src/execution-validation-application.ts",
    "plugins/native/goals/src/execution-validation-claim-commands.ts",
    "plugins/native/goals/src/execution-validation-run-commands.ts",
    "plugins/native/goals/src/execution-validation-verification-commands.ts",
    "plugins/native/goals/src/execution-validation-ports.ts",
    "apps/workbench/src/execution-validation-ui.ts",
    "tests/execution-validation-app-adapters.test.ts",
  ];
  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: missing EX4 execution-validation owner boundary`);
    }
  }
  if (errors.length > 0) return { errors };

  const coordinatorPath = "apps/local-host/src/goal-project-application.ts";
  const coordinator = read(coordinatorPath);
  if (
    !coordinator.includes("readonly executionValidation: ExecutionValidationApplicationApi<BoardSnapshot>")
    || !coordinator.includes("new ExecutionValidationApplication({")
  ) {
    errors.push(`${coordinatorPath}: EX4 requires one Contract-typed execution-validation application port`);
  }
  const removedCoordinatorMethods = [
    "claimGoal",
    "renewClaim",
    "selectGoalAndStart",
    "releaseClaim",
    "revokeClaim",
    "startRun",
    "requestGoalRework",
    "reportRun",
    "submitEvidence",
    "correctEvidence",
    "submitReview",
    "submitHumanReviewFromDialogue",
    "getGoalWorkState",
    "getGoalWorkStates",
    "getGoalActionProjection",
    "getGoalActionProjections",
  ];
  for (const method of removedCoordinatorMethods) {
    if (new RegExp(`^  ${method}\\(`, "mu").test(coordinator)) {
      errors.push(`${coordinatorPath}: EX4 requires the ${method} Coordinator facade to stay deleted`);
    }
  }

  for (const relativePath of [
    "src/v1/action-projection.ts",
    "src/v1/contract-revisions.ts",
    "src/v1/human-review.ts",
    "src/v1/parent-completion.ts",
  ]) {
    if (fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: zero-caller execution compatibility implementation must stay deleted`);
    }
  }

  const appAdapters = [
    {
      appPath: "apps/workbench/src/index.ts",
      callerPath: "apps/local-host/src/web-request.ts",
      factory: "createWorkbenchExecutionValidationAdapter",
      capability: "workbench.execution-validation-adapter.v1",
    },
    {
      appPath: "apps/mcp/src/index.ts",
      callerPath: "apps/mcp/src/tool-dispatch.ts",
      factory: "createMcpExecutionValidationAdapter",
      capability: "mcp.execution-validation-adapter.v1",
    },
    {
      appPath: "apps/cli/src/index.ts",
      callerPath: "apps/cli/src/command-dispatch.ts",
      factory: "createCliExecutionValidationAdapter",
      capability: "cli.execution-validation-adapter.v1",
    },
  ];
  for (const { appPath, callerPath, factory, capability } of appAdapters) {
    const app = read(appPath) + (appPath === "apps/workbench/src/index.ts" ? read("apps/workbench/src/ui-composition.ts") : "");
    const caller = read(callerPath);
    if (
      !app.includes("ExecutionValidationApplicationApi")
      || !app.includes(`function ${factory}`)
      || !app.includes(`"${capability}"`)
    ) {
      errors.push(`${appPath}: EX4 requires a Contract-typed ${factory} public adapter`);
    }
    if (
      app.includes("@adeptify/goalboard-module-execution")
      || app.includes("@adeptify/goalboard-module-evidence-verification")
      || app.includes("@adeptify/goalboard-module-governance-collaboration")
      || /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/iu.test(app)
      || /\b(?:SqliteGoalBoardStore|GoalBoardCoordinator)\b/u.test(app)
    ) {
      errors.push(`${appPath}: execution adapter must not import Module implementations, Store, or copied rules`);
    }
    const usesClient = callerPath !== "apps/local-host/src/web-request.ts";
    const hostClientPath = caller.includes("createExecutionEntryClient(client)")
      && caller.includes("client.withScope(")
      && !caller.includes(".withProject(")
      && !caller.includes("coordinator.executionValidation");
    const workbenchPath = caller.includes(`${factory}(coordinator.executionValidation)`)
      && caller.includes("executionAdapter.");
    if (usesClient ? !hostClientPath : !workbenchPath) {
      errors.push(`${callerPath}: execution-validation must use the public Host Client or the existing Workbench adapter`);
    }
    if (/coordinator(?:ForResume)?\.executionValidation\.(?:query|commands)\./u.test(caller)) {
      errors.push(`${callerPath}: direct execution-validation calls bypass the App adapter`);
    }
  }

  const renderer = read("apps/workbench/src/renderer.ts");
  const workbenchUi = read("apps/workbench/src/execution-validation-ui.ts");
  for (const functionName of [
    "renderClaimCell",
    "renderRunCell",
    "renderEvidenceRecord",
    "renderEvidenceForm",
    "renderEvidenceSubmitForm",
    "renderEvidenceCell",
    "renderReviewCell",
  ]) {
    if (renderer.includes(`function ${functionName}(`)) {
      errors.push(`apps/workbench/src/renderer.ts: ${functionName} must stay owned by the Workbench execution contribution`);
    }
    if (!workbenchUi.includes(functionName)) {
      errors.push(`apps/workbench/src/execution-validation-ui.ts: missing ${functionName}`);
    }
  }
  if (
    !renderer.includes("createWorkbenchExecutionValidationRenderer")
    || !workbenchUi.includes("WorkbenchExecutionValidationUiDependencies")
  ) {
    errors.push("Workbench execution UI must be composed through its public contribution renderer");
  }

  const test = read("tests/execution-validation-app-adapters.test.ts");
  for (const requiredBehavior of [
    "createCliExecutionValidationAdapter",
    "createMcpExecutionValidationAdapter",
    "createWorkbenchExecutionValidationAdapter",
    "run.not_owner",
    "action.token_stale",
    "submitEvidence",
    "submitReview",
    "display_status, \"completed\"",
  ]) {
    if (!test.includes(requiredBehavior)) {
      errors.push(`tests/execution-validation-app-adapters.test.ts: missing EX4 coverage for ${requiredBehavior}`);
    }
  }

  for (const relativePath of [
    "plugins/native/goals/src/execution-validation-application.ts",
    "plugins/native/goals/src/execution-validation-claim-commands.ts",
    "plugins/native/goals/src/execution-validation-run-commands.ts",
    "plugins/native/goals/src/execution-validation-verification-commands.ts",
    "plugins/native/goals/src/action-projection.ts",
  ]) {
    const lineCount = read(relativePath).split(/\r?\n/u).length;
    if (lineCount > 1_000) {
      errors.push(`${relativePath}: ${lineCount} lines exceeds the EX4 owner limit; split by responsibility`);
    }
  }
  return { errors };
}

function checkArtifactsOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const contractPath = "packages/contracts/src/modules/artifacts.ts";
  const contract = read(contractPath);
  for (const required of [
    'maturity: "partial"',
    "ArtifactReference",
    "ArtifactVersionRecord",
    "RegisterArtifactVersionInput",
    "ArtifactsApplicationApi",
    "team_share_authorized",
  ]) {
    if (!contract.includes(required)) {
      errors.push(`${contractPath}: AR1 public Contract is missing ${required}`);
    }
  }

  const entryPath = "modules/artifacts/src/index.ts";
  const entry = read(entryPath);
  for (const required of [
    "class ArtifactsModule",
    'maturity: "partial"',
    '"artifacts.identity.v1"',
    '"artifacts.version-repository.v1"',
    '"artifacts.opaque-content.v1"',
    '"artifacts.compatibility.v1"',
  ]) {
    if (!entry.includes(required)) {
      errors.push(`${entryPath}: AR1 public Module entrypoint is missing ${required}`);
    }
  }

  const repository = read("modules/artifacts/src/repository.ts");
  for (const required of [
    "CREATE TABLE IF NOT EXISTS artifacts",
    "CREATE TABLE IF NOT EXISTS artifact_versions",
    "PRIMARY KEY (artifact_id, version)",
    "producer_binding_signature",
    "content_digest",
  ]) {
    if (!repository.includes(required)) {
      errors.push(`modules/artifacts/src/repository.ts: Artifact Repository is missing ${required}`);
    }
  }

  const service = read("modules/artifacts/src/service.ts");
  for (const required of [
    "artifact.version_not_increasing",
    "artifact.version_conflict",
    "artifact.producer_mismatch",
    "artifact.hash_mismatch",
    "artifact.team_share_not_authorized",
    '"consumer_missing"',
  ]) {
    if (!service.includes(required)) {
      errors.push(`modules/artifacts/src/service.ts: Artifact lifecycle is missing ${required}`);
    }
  }
  if (/plugins\/(?:native|official-integrations)\//u.test(service + repository)) {
    errors.push("modules/artifacts: Artifact owner must not import producer or consumer Plugin implementations");
  }

  if (fs.existsSync(path.join(repositoryRoot, "src/web/artifact-native-plugin-http.ts"))) {
    errors.push("src/web/artifact-native-plugin-http.ts: migrated Artifact HTTP entry must stay deleted");
  }
  if (fs.existsSync(path.join(repositoryRoot, "src/web/onboarding.ts"))) {
    errors.push("src/web/onboarding.ts: local onboarding state must remain owned by Local Host");
  }
  if (/export function (?:buildGoalBoardWebView|cachedGoalBoardWebView)/u.test(read("apps/local-host/src/web-request.ts"))) {
    errors.push("apps/local-host/src/web-request.ts: Goal read projection and cache must remain outside HTTP routing");
  }
  const artifactHttp = read("apps/local-host/src/artifact-native-plugin-http.ts");
  if (!artifactHttp.includes("createLocalArtifactHttp") || artifactHttp.includes("@adeptify/goalboard-app-desktop")) {
    errors.push("Artifact HTTP composition must receive Desktop bootstrap through its Host factory");
  }

  const pluginPath = "plugins/native/artifacts/src/index.ts";
  const nativePlugin = read(pluginPath);
  for (const required of [
    'contract: "@adeptify/goalboard-contracts/platform/plugin"',
    '"goal-reorg-ar1"',
    '"goal-reorg-ar3"',
  ]) {
    if (!nativePlugin.includes(required)) {
      errors.push(`${pluginPath}: protected Artifact Plugin boundary is missing ${required}`);
    }
  }
  if (/modules\/artifacts|ArtifactsModule|ArtifactRepository/u.test(nativePlugin)) {
    errors.push(`${pluginPath}: Native Plugin entrypoint must not own Artifact facts or construct its Repository`);
  }

  const store = read("src/sdk-store.ts");
  const coordinator = read("apps/local-host/src/goal-project-application.ts");
  const projectMigrations = read("apps/local-host/src/project-migrations.ts");
  if (!read("apps/local-host/src/project-database.ts").includes("migrateLocalProjectDatabase") || !projectMigrations.includes("ARTIFACTS_SCHEMA_SQL") || !projectMigrations.includes("migrateArtifactsSchema")) {
    errors.push("src/sdk-store.ts: root storage must compose the Artifact owner schema and migration");
  }
  if (!coordinator.includes("ArtifactsModule") || !coordinator.includes("readonly artifacts: ArtifactsApplicationApi")) {
    errors.push("apps/local-host/src/goal-project-application.ts: compatibility composition must expose the public Artifacts API");
  }
  const directArtifactSql = /\b(?:CREATE TABLE(?: IF NOT EXISTS)?|FROM|INTO|UPDATE|DELETE FROM)\s+(artifacts|artifact_versions)\b/giu;
  for (const relativePath of ["apps/local-host/src/goal-project-application.ts", "src/sdk-store.ts", "src/sdk-types.ts"]) {
    const source = read(relativePath);
    for (const match of source.matchAll(directArtifactSql)) {
      errors.push(`${relativePath}: direct ${match[1]} SQL must stay inside modules/artifacts`);
    }
  }

  const testPath = "tests/artifacts-module.test.ts";
  const test = read(testPath);
  for (const required of [
    "opaque content, scope and producer binding",
    "artifact.version_not_increasing",
    "artifact.producer_mismatch",
    "artifact.hash_mismatch",
    "artifact.team_share_not_authorized",
    "consumer_missing",
    "artifact_unavailable",
    "migrateArtifactsSchema",
  ]) {
    if (!test.includes(required)) {
      errors.push(`${testPath}: missing AR1 coverage for ${required}`);
    }
  }

  for (const relativePath of [
    contractPath,
    "modules/artifacts/src/repository.ts",
    "modules/artifacts/src/service.ts",
    pluginPath,
    testPath,
  ]) {
    const lineCount = read(relativePath).split(/\r?\n/u).length;
    if (lineCount > 500) {
      errors.push(`${relativePath}: ${lineCount} lines exceeds the AR1 owner limit; split by responsibility`);
    }
  }
  return { errors };
}

function checkPrivateWorkContextOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const requiredOwnerFiles = [
    "modules/private-work-context/src/content-store.ts",
    "modules/private-work-context/src/context-bindings.ts",
    "modules/private-work-context/src/session-events.ts",
    "modules/private-work-context/src/session-handoffs.ts",
    "modules/private-work-context/src/session-migration.ts",
    "modules/private-work-context/src/session-records.ts",
    "modules/private-work-context/src/session-registry.ts",
    "modules/private-work-context/src/session-schema.ts",
    "packages/contracts/src/modules/private-work-context.ts",
    "tests/private-work-context-module.test.ts",
  ];
  for (const relativePath of requiredOwnerFiles) {
    if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: missing Private Work Context owner boundary`);
    }
  }

  const contract = read("packages/contracts/src/modules/private-work-context.ts");
  for (const required of [
    'maturity: "partial"',
    "WorkSessionRecord",
    "RuntimeContextBindingRecord",
    "WorkSessionHandoffRecord",
    "PrivateWorkContextApplicationApi",
  ]) {
    if (!contract.includes(required)) {
      errors.push(`packages/contracts/src/modules/private-work-context.ts: missing ${required}`);
    }
  }

  const entry = read("modules/private-work-context/src/index.ts");
  for (const required of [
    "GoalBoardSessionRegistry",
    "RuntimeContextBindingRepository",
    'maturity: "partial"',
    '"runtime-context-bindings"',
  ]) {
    if (!entry.includes(required)) {
      errors.push(`modules/private-work-context/src/index.ts: missing ${required}`);
    }
  }

  for (const retired of ["src/sessions/registry.ts","src/sessions/content-store.ts"]) {
    if (fs.existsSync(path.join(repositoryRoot, retired))) {
      errors.push(`${retired}: retired after WK3 caller cutover; use the public owner entrypoint`);
    }
  }
  for (const retired of ["src/sessions/types.ts", "src/sessions/compatibility.ts"]) {
    if (fs.existsSync(path.join(repositoryRoot, retired))) errors.push(`${retired}: retired; use the public Session owner`);
  }

  const catalog = read("apps/local-host/src/project-catalog.ts");
  if (!catalog.includes("RuntimeContextBindingRepository")) {
    errors.push("apps/local-host/src/project-catalog.ts: Runtime binding composition must use the Private Work Context public entrypoint");
  }
  const directContextSql = /\b(?:CREATE TABLE(?: IF NOT EXISTS)?|FROM|INTO|UPDATE|DELETE FROM)\s+(runtime_context_bindings|runtime_context_binding_events|runtime_context_setup_requests|runtime_context_suggestion_rejections)\b/giu;
  for (const match of catalog.matchAll(directContextSql)) {
    errors.push(`apps/local-host/src/project-catalog.ts: direct ${match[1]} SQL must stay inside modules/private-work-context`);
  }

  for (const relativePath of requiredOwnerFiles.filter((file) => file.endsWith(".ts"))) {
    const lineCount = read(relativePath).split(/\r?\n/u).length;
    if (lineCount > 500) {
      errors.push(`${relativePath}: ${lineCount} lines exceeds the WK1 owner limit; split by responsibility`);
    }
  }
  return { errors };
}

function checkRuntimeHostOwnership(repositoryRoot) {
  const errors = [];
  const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const ownerFiles = [
    "horizontal/runtime-host/src/runtime-router.ts",
    "horizontal/runtime-host/src/adapters/codex-session.ts",
    "horizontal/runtime-host/src/adapters/codex-app-server.ts",
    "horizontal/runtime-host/src/adapters/terminal-pty.ts",
  ];
  for (const relativePath of [
    ...ownerFiles,
    "packages/contracts/src/services/runtime-host.ts",
    "tests/runtime-host.test.ts",
  ]) {
    if (!fs.existsSync(path.join(repositoryRoot, relativePath))) {
      errors.push(`${relativePath}: missing Runtime Host owner boundary`);
    }
  }
  if (errors.length > 0) return { errors };

  const contract = read("packages/contracts/src/services/runtime-host.ts");
  for (const required of [
    'maturity: "partial"',
    "RuntimeHostApi",
    "RuntimeSessionAdapter",
    "RuntimeSessionAdapterResult",
    "PtySpawnRequest",
  ]) {
    if (!contract.includes(required)) {
      errors.push(`packages/contracts/src/services/runtime-host.ts: missing ${required}`);
    }
  }

  const entry = read("horizontal/runtime-host/src/index.ts");
  for (const required of [
    "RuntimeHostRouter",
    "CodexAppServerTransport",
    "CodexRuntimeSessionAdapter",
    "GoalBoardPtyHost",
    'maturity: "partial"',
    '"runtime.host.v1"',
    '"runtime.codex.v1"',
    '"runtime.terminal-pty.v1"',
  ]) {
    if (!entry.includes(required)) errors.push(`horizontal/runtime-host/src/index.ts: missing ${required}`);
  }

  const ownerSource = ownerFiles.map(read).join("\n");
  for (const forbidden of [
    "GoalBoardSessionRegistry",
    "@adeptify/goalboard-module-private-work-context",
    "@adeptify/goalboard-module-execution",
    "better-sqlite3",
    "SqliteGoalBoardStore",
    "src/web/server",
  ]) {
    if (ownerSource.includes(forbidden)) {
      errors.push(`horizontal/runtime-host: ${forbidden} belongs to a business owner or caller`);
    }
  }

  for (const retired of ["src/sessions/adapters.ts", "src/sessions/codex-transport.ts", "src/web/pty-host.ts", "src/web/desktop-shell.ts", "src/web/visual-foundation.ts", "src/web/pty-socket.ts", "src/web/capsule.ts"]) {
    if (fs.existsSync(path.join(repositoryRoot, retired))) {
      errors.push(`${retired}: retired after WK3 caller cutover; use the public owner entrypoint`);
    }
  }
  if (!read("apps/local-host/src/web-request.ts").includes('from "@adeptify/goalboard-service-runtime-host"')) {
    errors.push("apps/local-host/src/web-request.ts: Runtime composition must consume the public Runtime Host entrypoint");
  }
  if (!read("apps/local-host/src/pty-socket.ts").includes('from "@adeptify/goalboard-service-runtime-host"')) {
    errors.push("apps/local-host/src/pty-socket.ts: PTY socket must consume the public Runtime Host entrypoint");
  }
  if (read("horizontal/runtime-host/src/runtime-router.ts").includes("RegistryFallbackSessionAdapter")) {
    errors.push("horizontal/runtime-host: Session registry fallback must remain with Private Work Context composition");
  }

  for (const relativePath of ownerFiles) {
    const lineCount = read(relativePath).split(/\r?\n/u).length;
    if (lineCount > 500) {
      errors.push(`${relativePath}: ${lineCount} lines exceeds the WK2 owner limit; split by responsibility`);
    }
  }
  return { errors };
}

export function checkGoalReadOwnerSql(source) {
  return /\b(?:FROM|JOIN|UPDATE|INTO)\s+["`\[]?(?:goals|goal_relations|goal_risks|risks|policy_bindings|goal_contract_revisions|project_guidance_entries|project_guidance_revisions|planning_method_packs|coverage_items|coverage_contract_revisions|acceptance_criteria|goal_trash_records|goal_trash_relation_records)\b/iu.test(source)
    ? ["Goal-owned fact SQL must remain behind the public Goals Query/Command API"] : [];
}

export function checkGoalStorageOwnership(source) {
  const tables = "(?:goals|goal_relations|goal_risks|risks|policy_bindings|goal_contract_revisions|project_guidance_entries|project_guidance_revisions|planning_method_packs|coverage_items|coverage_contract_revisions|acceptance_criteria|goal_trash_records|goal_trash_relation_records|input_bindings|impact_bindings)";
  const ddl = new RegExp(`\\b(?:CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?|ALTER\\s+TABLE\\s+|DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?)["\x60\\[]?${tables}\\b`, "iu");
  const index = new RegExp(`\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?\\S+\\s+ON\\s+["\x60\\[]?${tables}\\b`, "iu");
  return [...checkGoalReadOwnerSql(source), ...(ddl.test(source) || index.test(source)
    ? ["Goal schema and migration SQL must remain in the Goals owner; Host only composes public migrations"] : [])];
}

export function checkDraftProposalOwnerSql(goalCommands) {
  return /\b(?:FROM|INTO|UPDATE)\s+contract_proposals\b/iu.test(goalCommands)
    ? ["modules/goals/src/goal-commands.ts: Draft proposal supersession must call Governance records, not its table"]
    : [];
}

export function checkDraftDialogueOwnership(coordinator, host, application) {
  const errors = [];
  for (const method of ["startDraftDialogue", "recordDraftDialogueTurn", "resumeDraftDialogue"]) {
    if (new RegExp(`^  ${method}\\(`, "m").test(coordinator)) {
      errors.push(`apps/local-host/src/goal-project-application.ts: DD1 forbids legacy ${method} implementation or facade`);
    }
    if (host.includes(`coordinator.${method}(`)) {
      errors.push(`apps/local-host/src/project-capabilities.ts: ${method} must use the public draftDialogue application`);
    }
  }
  if (/\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\s+(?:clarification_sessions|clarification_turns|goals|claims|runs)\b/iu.test(application)) {
    errors.push("plugins/native/goals/src/draft-dialogue-application.ts: persistence belongs to public Module owners");
  }
  return errors;
}

export function checkGoalTreeApplicationOwnership(coordinator, host, application, method = "submitGoalTreeProposal", port = "goalTreeSubmission") {
  const errors = [];
  if (new RegExp(`^  ${method}\\(`, "mu").test(coordinator)) {
    errors.push(`apps/local-host/src/goal-project-application.ts: DD2 forbids legacy ${method} implementation or facade`);
  }
  if (host.includes(`coordinator.${method}(`)
      || !host.includes(`coordinator.${port}.${method}(`)) {
    errors.push(`apps/local-host/src/project-capabilities.ts: ${method} must use the public ${port} application`);
  }
  if (/\b(?:store|repository|coordinator)\s*[.:]|\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/u.test(application)) {
    errors.push(`plugins/native/goals: ${method} must compose Module owners without SQL or legacy callbacks`);
  }
  return errors;
}

export function checkProposalUiOwnership(renderer, workbench, proposalMount, legacyMount, clientDispatch) {
  const errors = [];
  for (const name of ["proposedGoalName", "goalTreeProposalItemCopy", "goalTreeDecompositionIssueCopy", "renderGoalTreeProposalDecision", "renderRewireDecision", "renderContractProposal", "renderCandidateDecision", "buildDecisionGroups", "recentDecisionResults"]) {
    if (new RegExp(`function\\s+${name}\\s*\\(`, "u").test(renderer)) errors.push(`apps/workbench/src/renderer.ts: DD2 ${name} belongs to the Goals contribution`);
  }
  for (const name of ["goalsProposalUiContribution", "goalsLegacyProposalUiContribution", "goalsDecisionResultsUiContribution"]) {
    if (!workbench.includes(`host.register(${name})`)) errors.push(`apps/workbench: DD2 ${name} must be registered with UiHost`);
  }
  if (!proposalMount.includes("host.mount(") || !legacyMount.includes("host.mount(")) errors.push("apps/workbench: proposal renderers must mount the native contributions");
  if (/const (?:goalTreeDecisionForm|contractDecisionForm|candidateDecisionForm|rewireDecisionForm) =/u.test(clientDispatch)
      || !clientDispatch.includes("handleGoalProposalSubmit(submittedForm, event)")) errors.push("apps/workbench: proposal submission behavior belongs to the Goals client factory");
  return errors;
}

export function checkPackageBoundaries(repositoryRoot) {
  const inventory = checkWorkspacePackages(repositoryRoot);
  const packages = packageInfos(repositoryRoot);
  const sourceImports = checkSourceImports(repositoryRoot, packages);
  const dependencyGraph = checkDependencyGraph(packages);
  const compatibility = checkCompatibilityAllowlist(repositoryRoot);
  const migratedFeedOwnership = checkMigratedFeedOwnership(repositoryRoot);
  const migratedIntegrationOwnership = checkMigratedIntegrationOwnership(repositoryRoot);
  const migratedFeedUiOwnership = checkMigratedFeedUiOwnership(repositoryRoot);
  const migratedGoalsCommandOwnership = checkMigratedGoalsCommandOwnership(repositoryRoot);
  const migratedGovernanceOwnership = checkMigratedGovernanceOwnership(repositoryRoot);
  const executionValidationOwnership = checkExecutionValidationOwnership(repositoryRoot);
  const artifactsOwnership = checkArtifactsOwnership(repositoryRoot);
  const privateWorkContextOwnership = checkPrivateWorkContextOwnership(repositoryRoot);
  const runtimeHostOwnership = checkRuntimeHostOwnership(repositoryRoot);
  const dialogueOwnership = checkDraftDialogueOwnership(...[
    "apps/local-host/src/goal-project-application.ts", "apps/local-host/src/project-capabilities.ts", "plugins/native/goals/src/draft-dialogue-application.ts",
  ].map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8")));
  const submissionOwnership = checkGoalTreeApplicationOwnership(...[
    "apps/local-host/src/goal-project-application.ts", "apps/local-host/src/project-capabilities.ts", "plugins/native/goals/src/goal-tree-submission.ts",
  ].map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8")));
  const proposalCheckOwnership = checkGoalTreeApplicationOwnership(...[
    "apps/local-host/src/goal-project-application.ts", "apps/local-host/src/project-capabilities.ts", "plugins/native/goals/src/goal-tree-check.ts",
  ].map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8")), "checkGoalTreeProposal", "goalTreeCheck");
  const errors = [
    ...checkProposalUiOwnership(...["apps/workbench/src/renderer.ts", "apps/workbench/src/index.ts", "apps/workbench/src/goals-proposal-ui.ts", "apps/workbench/src/goals-legacy-proposal-ui.ts", "apps/workbench/src/scripts/client/events-accessibility.ts"]
      .map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8") + (file === "apps/workbench/src/index.ts" ? fs.readFileSync(path.join(repositoryRoot, "apps/workbench/src/ui-composition.ts"), "utf8") : ""))).map(message => `[proposal-ui-owner] ${message}`),
    ...proposalCheckOwnership.map(message => `[proposal-check-owner] ${message}`),
    ...[
      ["decideGoalTreeProposal", "goalTreeDecision", "goal-tree-decision"],
      ["decideContractProposal", "legacyContractDecision", "legacy-contract-decision"],
      ["decideCandidate", "legacyCandidateDecision", "legacy-candidate-decision"],
      ["confirmRewire", "legacyRewireDecision", "legacy-rewire-decision"],
      ["submitContractProposal", "legacyProposalSubmission", "legacy-proposal-submission"],
      ["submitCandidate", "legacyProposalSubmission", "legacy-proposal-submission"],
      ["submitDependencyProposal", "legacyProposalSubmission", "legacy-proposal-submission"],
    ].flatMap(([method, port, file]) => checkGoalTreeApplicationOwnership(...[
      "apps/local-host/src/goal-project-application.ts", "apps/local-host/src/project-capabilities.ts", `plugins/native/goals/src/${file}.ts`,
    ].map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8")), method, port)
      .map(message => `[proposal-decision-owner] ${message}`)),
    ...submissionOwnership.map(message => `[proposal-submission-owner] ${message}`),
    ...inventory.errors.map((message) => `[workspace-inventory] ${message}`),
    ...sourceImports.errors,
    ...dependencyGraph.errors,
    ...compatibility.errors.map((message) => `[legacy-compatibility] ${message}`),
    ...migratedFeedOwnership.errors.map((message) => `[feed-owner] ${message}`),
    ...migratedIntegrationOwnership.errors.map((message) => `[integration-owner] ${message}`),
    ...migratedFeedUiOwnership.errors.map((message) => `[feed-ui-owner] ${message}`),
    ...migratedGoalsCommandOwnership.errors.map((message) => `[goals-command-owner] ${message}`),
    ...migratedGovernanceOwnership.errors.map((message) => `[governance-owner] ${message}`),
    ...executionValidationOwnership.errors.map((message) => `[execution-validation-owner] ${message}`),
    ...artifactsOwnership.errors.map((message) => `[artifacts-owner] ${message}`),
    ...privateWorkContextOwnership.errors.map((message) => `[private-work-context-owner] ${message}`),
    ...runtimeHostOwnership.errors.map((message) => `[runtime-host-owner] ${message}`),
    ...dialogueOwnership.map(message => `[draft-dialogue-owner] ${message}`),
  ];

  return {
    packageCount: packages.length,
    sourceFileCount: sourceImports.sourceFileCount,
    importCount: sourceImports.importCount,
    dependencyEdgeCount: dependencyGraph.edgeCount,
    contractSubpaths: inventory.contractSubpaths,
    compatibilityAllowlistEntries: compatibility.entryCount,
    legacyHugeFiles: compatibility.hugeFileCount,
    errors,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = checkPackageBoundaries(repositoryRoot);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) process.exitCode = 1;
}
