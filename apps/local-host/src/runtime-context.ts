import fs from "node:fs";
import path from "node:path";
import type { RuntimeWorkContext, RuntimeProjectSuggestionClue, RuntimeSessionHostSignals } from "@adeptify/goalboard-contracts/modules/private-work-context";
import type { GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";
export type { GoalBoardRuntimeContextHost } from "@adeptify/goalboard-contracts/platform/app-host";



export function runtimeContextHostFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  currentWorkingDirectory: string = process.cwd(),
): GoalBoardRuntimeContextHost | null {
  const signals = runtimeSessionHostSignalsFromEnvironment(environment, currentWorkingDirectory);
  if (!signals) return null;
  return {
    homeDirectory: environment.GOALBOARD_HOME,
    runtimeContext: signals.runtime_context,
    webBaseUrl: environment.GOALBOARD_WEB_URL ?? "http://127.0.0.1:4173",
    goalBoardSessionId: signals.goalboard_session_id,
    nativeRuntimeSessionId: signals.native_runtime_session_id,
    legacyWorkContextId: signals.legacy_work_context_id,
    goalId: signals.goal_id,
    panelId: signals.surface_id,
    projectSuggestionClues: signals.project_suggestion_clues,
  };
}

export function runtimeSessionHostSignalsFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  currentWorkingDirectory: string = process.cwd(),
): RuntimeSessionHostSignals | null {
  const runtimeId = environment.GOALBOARD_RUNTIME_ID?.trim() || null;
  if (!runtimeId) return null;
  const goalBoardSessionId = environment.GOALBOARD_SESSION_ID?.trim() || null;
  const legacyWorkContextId = environment.GOALBOARD_WORK_CONTEXT_ID?.trim() || null;
  const nativeRuntimeSessionId = stableRuntimeSessionId(runtimeId, environment);
  const projectSuggestionClues: RuntimeProjectSuggestionClue[] = [];
  const workspace = environment.PWD?.trim() || currentWorkingDirectory.trim();
  if (workspace && path.isAbsolute(workspace)) {
    projectSuggestionClues.push({ kind: "workspace", value: workspace });
  }
  const sessionTitle = environment.CLAUDE_CODE_SESSION_NAME?.trim();
  if (sessionTitle) projectSuggestionClues.push({ kind: "session_title", value: sessionTitle });
  return {
    runtime_id: runtimeId,
    goalboard_session_id: goalBoardSessionId,
    native_runtime_session_id: nativeRuntimeSessionId,
    legacy_work_context_id: legacyWorkContextId,
    surface_id: environment.GOALBOARD_PANEL_ID?.trim() || null,
    goal_id: environment.GOALBOARD_GOAL_ID?.trim() || null,
    runtime_context: {
      runtime_id: runtimeId,
      // Preserve legacy project-routing behavior while the Session Registry is
      // additive. Native identity is carried separately above.
      stable_work_context_id: legacyWorkContextId ?? nativeRuntimeSessionId,
      host_declares_stable: legacyWorkContextId
        ? environment.GOALBOARD_WORK_CONTEXT_STABLE === "true"
        : nativeRuntimeSessionId != null,
      workspace: workspace && path.isAbsolute(workspace) ? canonicalWorkspaceContext(workspace) : null,
    },
    project_suggestion_clues: projectSuggestionClues,
  };
}

export function sessionSignalsForHost(host: GoalBoardRuntimeContextHost): RuntimeSessionHostSignals {
  const stableId = host.runtimeContext.stable_work_context_id?.trim() || null;
  const legacyWorkContextId = host.legacyWorkContextId?.trim()
    || (host.panelId && stableId === host.panelId ? stableId : null);
  return {
    runtime_id: host.runtimeContext.runtime_id,
    goalboard_session_id: host.goalBoardSessionId?.trim() || null,
    native_runtime_session_id: host.nativeRuntimeSessionId?.trim()
      || (legacyWorkContextId ? null : stableId),
    legacy_work_context_id: legacyWorkContextId,
    surface_id: host.panelId?.trim() || null,
    goal_id: host.goalId?.trim() || null,
    runtime_context: host.runtimeContext,
    project_suggestion_clues: [...(host.projectSuggestionClues ?? [])],
  };
}

function stableRuntimeSessionId(runtimeId: string, environment: NodeJS.ProcessEnv): string | null {
  if (runtimeId === "codex") return environment.CODEX_THREAD_ID?.trim() || null;
  if (runtimeId === "claude-code") {
    return environment.CLAUDE_CODE_SESSION_ID?.trim()
      || environment.CLAUDE_SESSION_ID?.trim()
      || null;
  }
  return null;
}

function canonicalWorkspaceContext(workspace: string): NonNullable<RuntimeWorkContext["workspace"]> {
  const normalized = path.resolve(workspace);
  try {
    return { canonical_path: fs.realpathSync.native(normalized), realpath_verified: true };
  } catch {
    return { canonical_path: normalized, realpath_verified: false };
  }
}
