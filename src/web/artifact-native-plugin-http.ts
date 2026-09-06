import type { IncomingMessage, ServerResponse } from "node:http";
import type { ArtifactsQueryApi } from "@adeptify/goalboard-contracts/modules/artifacts";
import type { ContextLedgerApi } from "@adeptify/goalboard-contracts/modules/context-ledger";
import {
  ArtifactBrowserError, exportArtifactVersion, matchArtifactBrowserRoute, readArtifactBrowser, readGoalArtifactEmbeds,
} from "@adeptify/goalboard-plugin-artifacts";
import { artifactWorkbench } from "@adeptify/goalboard-app-workbench";
import { THEME_BOOTSTRAP_SCRIPT } from "@adeptify/goalboard-design-system";
import { NATIVE_DESKTOP_BOOTSTRAP_SCRIPT } from "@adeptify/goalboard-app-desktop";
import { dateTimeLocale, htmlLang, L } from "./i18n.js";
import { icon, renderIconSprite } from "./icons.js";

interface ArtifactHttpContext {
  readonly boardId: string;
  readonly routePrefix: string;
  readonly projectTitle: string;
  readonly query: ArtifactsQueryApi;
  readonly desktopShell: boolean;
  readonly pageCsp: string;
}

function escape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const primitives = { escape, text: (value: string) => escape(L(value)), formatDate: (value: string) => new Date(value).toLocaleString(dateTimeLocale()) };

export function renderGoalArtifactContext(input: {
  boardId: string; goalId: string; ledger: ContextLedgerApi["query"]; artifacts: ArtifactsQueryApi;
}): string {
  // The containing Goal fragment applies its Project prefix once to every local link.
  return artifactWorkbench.goalContext(readGoalArtifactEmbeds(input), { routePrefix: "", primitives });
}

/** HTTP composition only: Artifact application owns routing and exact-version reads. */
export function handleArtifactNativePluginHttp(
  request: IncomingMessage, response: ServerResponse, pathname: string, context: ArtifactHttpContext,
): boolean {
  if (request.method !== "GET") return false;
  try {
    const route = matchArtifactBrowserRoute(pathname);
    if (!route) return false;
    if (route.kind === "export") {
      const content = exportArtifactVersion(context.query, context.boardId, route.reference);
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": `attachment; filename="artifact-v${route.reference.version}.json"`,
      });
      response.end(content);
      return true;
    }
    const view = readArtifactBrowser(context.query, context.boardId, route.reference);
    const html = artifactWorkbench.page({
      view, routePrefix: context.routePrefix, projectTitle: context.projectTitle,
      lang: htmlLang(), desktopShell: context.desktopShell,
      headHtml: `<script>${THEME_BOOTSTRAP_SCRIPT}${NATIVE_DESKTOP_BOOTSTRAP_SCRIPT}</script><link rel="stylesheet" href="/assets/goalboard-workbench.css">`,
      backIconHtml: icon("arrow"), iconSpriteHtml: renderIconSprite(),
      primitives,
    });
    response.writeHead(view.requested && !view.selected ? 404 : 200, {
      "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
      "content-security-policy": context.pageCsp,
    });
    response.end(html);
    return true;
  } catch (error) {
    if (!(error instanceof ArtifactBrowserError)) throw error;
    response.writeHead(error.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: L(error.message) }));
    return true;
  }
}
