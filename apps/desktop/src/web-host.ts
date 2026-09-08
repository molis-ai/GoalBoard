import { desktopAdvancePrompt } from "./advance-prompt.js";
import { createLocalWebServerFactory } from "@adeptify/goalboard-app-local-host";
import { isPtyCommandAvailable } from "@adeptify/goalboard-service-runtime-host";
import { withGoalBoardProjectCatalog } from "./project-catalog.js";
import { desktopLaunchSpec, desktopPanelEnv, desktopRuntimeTitle, isDesktopRuntimeKind } from "./launch.js";
import { desktopWorkbenchRendererPorts } from "./shell.js";
import { isDesktopShellRequest, NATIVE_DESKTOP_BOOTSTRAP_SCRIPT } from "./shell.js";
import { renderDesktopCapsuleShell } from "./capsule-shell.js";

function desktopRuntimeAvailability(): Record<string, boolean> {
  return {
    "claude-code": isPtyCommandAvailable("claude"),
    codex: isPtyCommandAvailable("codex"),
    opencode: isPtyCommandAvailable("opencode"),
    "pi-agent": isPtyCommandAvailable("pi"),
    "grok-build": isPtyCommandAvailable("grok"),
  };
}

export function createDesktopWebHost(assets: { ptyClientFilePath(): string }) {
  return createLocalWebServerFactory({
    withCatalog: withGoalBoardProjectCatalog,
    desktopRenderer: desktopWorkbenchRendererPorts,
    panel: { panelEnv: desktopPanelEnv, isRuntimeKind: isDesktopRuntimeKind, launchSpec: desktopLaunchSpec, advancePrompt: desktopAdvancePrompt },
    runtimeTitle: desktopRuntimeTitle, cliAvailability: desktopRuntimeAvailability,
    isDesktopShellRequest, nativeDesktopBootstrapScript: NATIVE_DESKTOP_BOOTSTRAP_SCRIPT,
    renderDesktopCapsuleShell, ptyClientFilePath: assets.ptyClientFilePath,
  });
}
