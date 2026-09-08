import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebSettingsProject } from "@adeptify/goalboard-app-workbench";
import { type GoalBoardProjectCatalog, type GoalBoardProjectCatalogOptions, GoalBoardProjectCatalogError } from "./project-catalog.js";
import { sendLocalWebJson as sendJson, readLocalWebBody as readBody } from "./web-http.js";
import { projectNavigation, settingsProject, installationDiagnostics } from "./web-project-presentation.js";

export type LocalWebCatalogRunner = <T>(options: GoalBoardProjectCatalogOptions, operation: (catalog: GoalBoardProjectCatalog) => T | Promise<T>) => Promise<T>;

function webMigrationRequest(body: Record<string, unknown>): {
  legacyDatabasePath: string;
  displayName?: string;
} {
  if (body.user_confirmed !== true) {
    throw new Error("请先明确确认要迁移这份已有 GoalBoard 数据");
  }
  const legacyDatabasePath = typeof body.legacy_database_path === "string"
    ? body.legacy_database_path.trim()
    : "";
  if (!legacyDatabasePath) throw new Error("请选择要迁移的已有 GoalBoard DB");
  if (legacyDatabasePath.length > 4_000) throw new Error("来源 DB 路径过长");
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (displayName.length > 160) throw new Error("迁移后项目名称过长");
  return {
    legacyDatabasePath,
    ...(displayName ? { displayName } : {}),
  };
}

export function createLocalProjectSettingsHttp(withGoalBoardProjectCatalog: LocalWebCatalogRunner) {
  async function settingsProjects(homeDirectory: string | undefined): Promise<WebSettingsProject[]> {
    return withGoalBoardProjectCatalog({ homeDirectory }, (catalog) => catalog.listProjects().map(settingsProject));
  }

  async function handle(request: IncomingMessage, response: ServerResponse, url: URL, homeDirectory: string | undefined, projectCount: number): Promise<boolean> {
    if (request.method === "GET" && url.pathname === "/api/settings/projects") {
      sendJson(response, 200, { projects: await settingsProjects(homeDirectory) });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/settings/projects") {
      const body = await readBody(request);
      const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
      if (body.user_confirmed !== true || !displayName) {
        sendJson(response, 400, { error: "请确认并填写项目名称" });
        return true;
      }
      try {
        await withGoalBoardProjectCatalog({ homeDirectory }, async (catalog) => {
          const project = await catalog.createProject({ display_name: displayName, actor_id: "web-user" });
          sendJson(response, 201, {
            project: settingsProject(project),
            project_path: `/projects/${encodeURIComponent(project.project_id)}/`,
          });
        });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/settings/demo") {
      const body = await readBody(request);
      const action = body.action === "create" || body.action === "reset" || body.action === "remove"
        ? body.action
        : null;
      if (!action || body.user_confirmed !== true) {
        sendJson(response, 400, { error: "请明确确认要创建、重建或删除演示数据" });
        return true;
      }
      try {
        await withGoalBoardProjectCatalog({ homeDirectory }, async (catalog) => {
          if (action === "create") {
            const result = await catalog.ensureDemoProject({ actor_id: "web-user", user_confirmed: true });
            sendJson(response, 200, {
              ...result,
              project: settingsProject(result.project),
              message: result.status === "existing" ? "示例项目已经存在" : "示例项目已创建",
            });
            return;
          }
          if (action === "reset") {
            const result = await catalog.resetDemoProject({ actor_id: "web-user", user_confirmed: true });
            sendJson(response, 200, {
              ...result,
              project: settingsProject(result.project),
              message: "示例项目已重建；用户项目未修改",
            });
            return;
          }
          const demo = catalog.listProjects().find((project) => project.data_class === "regenerable_demo");
          if (!demo) {
            sendJson(response, 404, { error: "示例项目已经不存在" });
            return;
          }
          const result = await catalog.removeDemoProject({
            project_id: demo.project_id,
            actor_id: "web-user",
            delete_confirmed: true,
            idempotency_key: `web-demo-remove-${randomBytes(16).toString("hex")}`,
          });
          sendJson(response, 200, { ...result, message: "可重建 demo 已删除；用户项目未修改" });
        });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
    const projectRenameMatch = url.pathname.match(/^\/api\/settings\/projects\/([^/]+)\/rename$/);
    if (request.method === "POST" && projectRenameMatch) {
      const body = await readBody(request);
      const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
      if (!displayName) {
        sendJson(response, 400, { error: "项目名称不能为空" });
        return true;
      }
      try {
        await withGoalBoardProjectCatalog({ homeDirectory }, (catalog) => {
          const project = catalog.renameProject(decodeURIComponent(projectRenameMatch[1]), displayName, "web-user");
          sendJson(response, 200, { project: settingsProject(project) });
        });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
    if (request.method === "GET" && url.pathname === "/api/settings/diagnostics") {
      sendJson(response, 200, installationDiagnostics(homeDirectory, projectCount));
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/projects/migrate") {
      try {
        const requestInput = webMigrationRequest(await readBody(request));
        await withGoalBoardProjectCatalog({ homeDirectory }, async (catalog) => {
          const project = await catalog.migrateLegacyDatabase({
            legacy_database_path: requestInput.legacyDatabasePath,
            ...(requestInput.displayName ? { display_name: requestInput.displayName } : {}),
            actor_id: "web-user",
          });
          sendJson(response, 201, {
            project: projectNavigation(project),
            project_path: `/projects/${encodeURIComponent(project.project_id)}/`,
          });
        });
      } catch (error) {
        const message = error instanceof GoalBoardProjectCatalogError
          ? error.message
          : error instanceof Error
            ? `迁移失败：${error.message}`
            : "迁移失败，请检查来源 DB 后重试";
        sendJson(response, 400, { error: message });
      }
      return true;
    }
    return false;
  }
  return { handle, settingsProjects };
}
