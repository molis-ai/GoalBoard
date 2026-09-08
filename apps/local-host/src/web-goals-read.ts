import type { IncomingMessage, ServerResponse } from "node:http";
import { renderWorkbenchGoalsReadRequest, renderWorkbenchGoalsPageRequest, type GoalBoardWebView } from "@adeptify/goalboard-app-workbench";
import { createContextLedger } from "@adeptify/goalboard-module-context-ledger";
import type { GoalProjectApplication } from "./goal-project-application.js";
import type { LocalProjectDatabase } from "./project-database.js";
import { renderGoalArtifactContext } from "./artifact-native-plugin-http.js";
import type { WebViewOptions } from "./web-view.js";
import type { LocalWebCatalogRunner } from "./web-project-settings.js";
import type { createLocalHostWorkbenchRenderer } from "./workbench-renderer.js";
import type { SessionRuntimeResources, createSessionProjectOperations } from "./web-session.js";
import { sendLocalWebJson as sendJson } from "./web-http.js";

export function createLocalGoalsReadHttp(ports: {
  withCatalog: LocalWebCatalogRunner;
  renderer: Pick<ReturnType<typeof createLocalHostWorkbenchRenderer>, "renderGoalBoardMomentumFragment" | "renderGoalBoardProjectGuidanceSettings" | "renderGoalBoardProjectSettings" | "renderGoalBoardRefreshFragment" | "renderGoalBoardWeb" | "renderGoalDocumentFragment" | "renderGoalPanelFragment" | "renderGoalQuickRecordFragment" | "renderGoalRecordEventsFragment" | "renderGoalRecordsFragment">;
  isDesktopShellRequest(request: IncomingMessage, url: URL): boolean;
  pageCsp: string;
  sessionProjectOperationsData: ReturnType<typeof createSessionProjectOperations>;
}) {
  const { withCatalog: withGoalBoardProjectCatalog, isDesktopShellRequest, pageCsp: PAGE_CSP, sessionProjectOperationsData } = ports;
  const { renderGoalBoardMomentumFragment, renderGoalBoardProjectGuidanceSettings, renderGoalBoardProjectSettings, renderGoalBoardRefreshFragment, renderGoalBoardWeb, renderGoalDocumentFragment, renderGoalPanelFragment, renderGoalQuickRecordFragment, renderGoalRecordEventsFragment, renderGoalRecordsFragment } = ports.renderer;
  function settings(request: IncomingMessage, response: ServerResponse, url: URL, boardId: string,
    readWebView: () => GoalBoardWebView, coordinator: GoalProjectApplication, controlToken: string,
  ): boolean {
    if (request.method === "GET" && url.pathname === "/settings/guidance") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": PAGE_CSP,
      });
      response.end(renderGoalBoardProjectGuidanceSettings(
        readWebView(),
        coordinator.goalQueries.readProjectGuidance(boardId),
        controlToken,
        isDesktopShellRequest(request, url),
      ));
      return true;
    }
    if (request.method === "GET" && url.pathname === "/settings/rules") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": PAGE_CSP,
      });
      response.end(renderGoalBoardProjectSettings(
        readWebView(),
        controlToken,
        isDesktopShellRequest(request, url),
      ));
      return true;
    }
    return false;
  }
  function fragments(request: IncomingMessage, response: ServerResponse, url: URL, boardId: string,
    store: LocalProjectDatabase, coordinator: GoalProjectApplication, readWebView: () => GoalBoardWebView,
  ): boolean {
    const renderedGoalsRead = renderWorkbenchGoalsReadRequest(request.method, url.pathname, url.searchParams, () => {
      const view = readWebView();
      return {
        refresh: (goalId, collection) => renderGoalBoardRefreshFragment(view, goalId, collection === "archive", collection === "trash"),
        momentum: (goalId, collection) => renderGoalBoardMomentumFragment(view, goalId, collection),
        document: (goalId, collection) => renderGoalDocumentFragment(view, goalId, collection),
        records: (goalId, collection) => renderGoalRecordsFragment(view, goalId, collection),
        recordEvents: (goalId, collection, offset) => renderGoalRecordEventsFragment(view, goalId, collection, offset),
        quickRecord: (goalId, collection) => renderGoalQuickRecordFragment(view, goalId, collection),
        panel: (goalId, panel, collection) => {
          const visibleGoals = collection === "archive" ? view.archived_goals : view.goals;
          const artifactContext = panel === "completion" && collection !== "trash"
            && visibleGoals.some((item) => item.goal.goal_id === goalId)
            ? renderGoalArtifactContext({ boardId: boardId, goalId, artifacts: coordinator.artifacts.query,
                ledger: createContextLedger(store.db, {
                  authorize: (access, operation) => operation === "read" && access.scope.kind === "personal" && access.scope.id === boardId,
                }).query }) : "";
          return renderGoalPanelFragment(view, goalId, panel, collection, artifactContext);
        },
      };
    });
    if (renderedGoalsRead) {
      if ("error" in renderedGoalsRead) {
        sendJson(response, renderedGoalsRead.status, { error: renderedGoalsRead.error });
        return true;
      }
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(renderedGoalsRead.html);
      return true;
    }
    return false;
  }
  async function page(request: IncomingMessage, response: ServerResponse, url: URL, options: WebViewOptions,
    homeDirectory: string | undefined, readWebView: () => GoalBoardWebView, sessionResources: Promise<SessionRuntimeResources>, controlToken: string,
  ): Promise<boolean> {
    const renderedGoalsPage = await renderWorkbenchGoalsPageRequest(
      request.method, url.pathname, readWebView,
      async (view, { goalId: requestedGoalId, archiveView, trashView, decisionView }) => {
        const desktopShell = isDesktopShellRequest(request, url);
        const operations = options.project
          ? sessionProjectOperationsData(
              await sessionResources,
              options.project.project_id,
              view,
              options.projects,
              await withGoalBoardProjectCatalog(
                { homeDirectory: homeDirectory },
                (catalog) => catalog.listWorkspaceDirectory(options.project!.project_id),
              ),
            )
          : { sessions: [], workspaces: [] };
        return renderGoalBoardWeb(
          view,
          requestedGoalId,
          archiveView,
          decisionView,
          trashView,
          controlToken,
          desktopShell,
          {},
          operations,
        );
    });
    if (renderedGoalsPage) {
      if ("error" in renderedGoalsPage) {
        sendJson(response, renderedGoalsPage.status, { error: renderedGoalsPage.error });
        return true;
      }
      const headers: Record<string, string> = {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": PAGE_CSP,
      };
      response.writeHead(200, headers);
      response.end(renderedGoalsPage.html);
      return true;
    }
    return false;
  }
  return { settings, fragments, page };
}
