import type { WorkSessionHttpContext } from "./types.js";
import { publicSessionRecord } from "./public-records.js";

export async function handleSessionContentHttp(context: WorkSessionHttpContext): Promise<boolean> {
  const { method, pathname, respond, resourcesPromise, projectOptions } = context;
  const projectSessionApiMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/(content|resume)$/);
  if (projectSessionApiMatch) {
    let sessionId: string;
    try {
      sessionId = decodeURIComponent(projectSessionApiMatch[1]);
    } catch {
      respond( 400, { error: "Session ID 无效" });
      return true;
    }
    const resources = await resourcesPromise;
    let session;
    try {
      session = resources.registry.get(sessionId);
    } catch {
      respond( 404, { error: "找不到这条 Session" });
      return true;
    }
    if (session.project_id !== projectOptions.project?.project_id) {
      respond( 404, { error: "找不到这条 Session" });
      return true;
    }
    if (method === "GET" && projectSessionApiMatch[2] === "content") {
      const result = await resources.content.read(sessionId);
      respond( 200, {
        ...result,
        session: publicSessionRecord(result.session),
      });
      return true;
    }
    if (method === "POST" && projectSessionApiMatch[2] === "resume") {
      const result = await resources.content.resume(sessionId);
      respond( result.status === "ok" ? 200 : result.status === "unsupported" ? 409 : 503, result);
      return true;
    }
    respond( 405, { error: "Session 操作不支持这个请求方法" });
    return true;
  }
  if (method === "GET" && pathname === "/api/sessions") {
    const resources = await resourcesPromise;
    respond( 200, {
      sessions: resources.registry.list({ project_id: projectOptions.project?.project_id }).map(publicSessionRecord),
    });
    return true;
  }

  return false;
}
