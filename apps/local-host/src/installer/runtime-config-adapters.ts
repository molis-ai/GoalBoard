import path from "node:path";
import { RuntimeIntegrationError } from "./runtime-integration-contract.js";
import type { RuntimeAdapter, SupportedRuntimeId, DesiredConnection, ConfigInspection } from "./runtime-integration-contract.js";
import { tomlString, extractTomlFamily, normalizeBlock, digest, replaceTomlFamily, parseJsonObject, objectOrEmpty, canonicalJson, replaceTopLevelJsonProperty, parseJsoncObject } from "./runtime-config-text.js";

export const CODEX_ADAPTER: RuntimeAdapter = {
  id: "codex",
  displayName: "Codex",
  executableNames: ["codex"],
  detectionPaths: (userHome) => [path.join(userHome, ".codex")],
  configPath: (userHome) => path.join(userHome, ".codex", "config.toml"),
  skillPath: (userHome) => path.join(userHome, ".codex", "skills", "goal-advance"),
  desiredConnection: (artifacts, goalboardHome) => ({
    runtimeId: "codex",
    launcherPath: artifacts.launcherPath,
    goalboardHome,
  }),
  inspectConfig: inspectCodexConfig,
  connectConfig: connectCodexConfig,
  removeConfig: removeCodexConfig,
  restartInstructions: restartInstructionsFor("Codex"),
};

export const CLAUDE_CODE_ADAPTER: RuntimeAdapter = {
  id: "claude-code",
  displayName: "Claude Code",
  executableNames: ["claude"],
  detectionPaths: (userHome) => [path.join(userHome, ".claude"), path.join(userHome, ".claude.json")],
  configPath: (userHome) => path.join(userHome, ".claude.json"),
  skillPath: (userHome) => path.join(userHome, ".claude", "skills", "goal-advance"),
  desiredConnection: (artifacts, goalboardHome) => ({
    runtimeId: "claude-code",
    launcherPath: artifacts.launcherPath,
    goalboardHome,
  }),
  inspectConfig: inspectClaudeConfig,
  connectConfig: connectClaudeConfig,
  removeConfig: removeClaudeConfig,
  restartInstructions: restartInstructionsFor("Claude Code"),
};

export const OPENCODE_ADAPTER: RuntimeAdapter = {
  id: "opencode",
  displayName: "OpenCode",
  executableNames: ["opencode"],
  detectionPaths: (userHome) => [
    path.join(userHome, ".config", "opencode"),
    path.join(userHome, ".opencode"),
  ],
  configPath: (userHome) => path.join(userHome, ".config", "opencode", "opencode.json"),
  skillPath: (userHome) => path.join(userHome, ".config", "opencode", "skills", "goal-advance"),
  desiredConnection: (artifacts, goalboardHome) => ({
    runtimeId: "opencode",
    launcherPath: artifacts.launcherPath,
    goalboardHome,
  }),
  inspectConfig: inspectOpenCodeConfig,
  connectConfig: connectOpenCodeConfig,
  removeConfig: removeOpenCodeConfig,
  restartInstructions: restartInstructionsFor("OpenCode"),
};

export const PI_AGENT_ADAPTER: RuntimeAdapter = {
  id: "pi-agent",
  displayName: "Pi Agent",
  executableNames: ["pi"],
  detectionPaths: (userHome) => [path.join(userHome, ".pi"), path.join(userHome, ".pi", "agent")],
  configPath: (userHome) => path.join(userHome, ".pi", "agent", "mcp.json"),
  skillPath: (userHome) => path.join(userHome, ".pi", "agent", "skills", "goal-advance"),
  desiredConnection: (artifacts, goalboardHome) => ({
    runtimeId: "pi-agent",
    launcherPath: artifacts.launcherPath,
    goalboardHome,
  }),
  inspectConfig: inspectPiConfig,
  connectConfig: connectPiConfig,
  removeConfig: removePiConfig,
  restartInstructions: [
    ...restartInstructionsFor("Pi Agent"),
    "Pi 本体不内置 MCP。GoalBoard 会写入 ~/.pi/agent/mcp.json，供 pi-mcp-adapter 读取。若新 Session 里看不到 GoalBoard 工具，先运行 `pi install npm:pi-mcp-adapter` 再开新会话。Skill 不依赖 adapter，可用 /skill:goal-advance。",
  ],
};

export const GROK_BUILD_ADAPTER: RuntimeAdapter = {
  id: "grok-build",
  displayName: "Grok Build",
  executableNames: ["grok"],
  detectionPaths: (userHome) => [path.join(userHome, ".grok")],
  configPath: (userHome) => path.join(userHome, ".grok", "config.toml"),
  skillPath: (userHome) => path.join(userHome, ".grok", "skills", "goal-advance"),
  desiredConnection: (artifacts, goalboardHome) => ({
    runtimeId: "grok-build",
    launcherPath: artifacts.launcherPath,
    goalboardHome,
  }),
  inspectConfig: inspectCodexConfig,
  connectConfig: connectCodexConfig,
  removeConfig: removeCodexConfig,
  restartInstructions: restartInstructionsFor("Grok Build"),
};

export const ADAPTERS: readonly RuntimeAdapter[] = [
  CODEX_ADAPTER,
  CLAUDE_CODE_ADAPTER,
  OPENCODE_ADAPTER,
  PI_AGENT_ADAPTER,
  GROK_BUILD_ADAPTER,
];

export function restartInstructionsFor(displayName: string): readonly string[] {
  return [
    `请新开一个 ${displayName} Session：${displayName} 只在 Session 启动时读取 MCP 与 Skill 清单，所以当前对话不会动态出现 GoalBoard 工具。`,
    "新 Session 可直接复制这句继续：「继续用 GoalBoard」。GoalBoard 会列出当前目录以前用过的项目；每个 Session 都要由你确认关联哪个项目，不会保存目录默认项目。",
  ];
}

export function adapterFor(runtimeId: SupportedRuntimeId): RuntimeAdapter {
  const adapter = ADAPTERS.find((candidate) => candidate.id === runtimeId);
  if (!adapter) throw new RuntimeIntegrationError("runtime.unsupported", `尚未支持 Runtime: ${runtimeId}`);
  return adapter;
}

export function desiredCodexFamily(desired: DesiredConnection): string {
  return [
    "[mcp_servers.goalboard]",
    `command = ${tomlString(desired.launcherPath)}`,
    "",
    "[mcp_servers.goalboard.env]",
    `GOALBOARD_HOME = ${tomlString(desired.goalboardHome)}`,
    `GOALBOARD_MCP_AUDIENCE = ${tomlString("runtime")}`,
    `GOALBOARD_RUNTIME_ID = ${tomlString(desired.runtimeId)}`,
  ].join("\n");
}

export function inspectCodexConfig(contents: string | null, desired: DesiredConnection): ConfigInspection {
  if (contents == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const family = extractTomlFamily(contents, "mcp_servers.goalboard");
  if (!family) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const expected = desiredCodexFamily(desired);
  if (normalizeBlock(family.text) === normalizeBlock(expected)) {
    return { state: "current", summary: "当前 GoalBoard MCP 配置", entryFingerprint: digest(normalizeBlock(expected)) };
  }
  const familyBody = family.text.replace(/^\s*\[[^\]\r\n]+\]\s*(?:#.*)?$/gm, "");
  if (/GOALBOARD_|(?:command|args)\s*=.*goalboard/i.test(familyBody)) {
    return { state: "legacy", summary: "旧版 GoalBoard MCP 配置", entryFingerprint: digest(normalizeBlock(family.text)) };
  }
  return { state: "conflict", summary: "同名 MCP entry 不属于 GoalBoard", entryFingerprint: digest(normalizeBlock(family.text)) };
}

export function connectCodexConfig(contents: string | null, desired: DesiredConnection): string {
  return replaceTomlFamily(contents ?? "", "mcp_servers.goalboard", desiredCodexFamily(desired));
}

export function removeCodexConfig(contents: string | null): string | null {
  if (contents == null) return null;
  return replaceTomlFamily(contents, "mcp_servers.goalboard", null);
}

export function desiredClaudeEntry(desired: DesiredConnection): Record<string, unknown> {
  return {
    type: "stdio",
    command: desired.launcherPath,
    args: [],
    env: {
      GOALBOARD_HOME: desired.goalboardHome,
      GOALBOARD_MCP_AUDIENCE: "runtime",
      GOALBOARD_RUNTIME_ID: desired.runtimeId,
    },
  };
}

export function inspectClaudeConfig(contents: string | null, desired: DesiredConnection): ConfigInspection {
  if (contents == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const root = parseJsonObject(contents, "Claude Code 用户配置");
  const servers = objectOrEmpty(root.mcpServers);
  const entry = servers.goalboard;
  if (entry == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const expected = desiredClaudeEntry(desired);
  if (canonicalJson(entry) === canonicalJson(expected)) {
    return { state: "current", summary: "当前 GoalBoard MCP 配置", entryFingerprint: digest(canonicalJson(expected)) };
  }
  if (/goalboard|GOALBOARD_/i.test(canonicalJson(entry))) {
    return { state: "legacy", summary: "旧版 GoalBoard MCP 配置", entryFingerprint: digest(canonicalJson(entry)) };
  }
  return { state: "conflict", summary: "同名 MCP entry 不属于 GoalBoard", entryFingerprint: digest(canonicalJson(entry)) };
}

export function connectClaudeConfig(contents: string | null, desired: DesiredConnection): string {
  const root = contents == null ? {} : parseJsonObject(contents, "Claude Code 用户配置");
  const servers = { ...objectOrEmpty(root.mcpServers), goalboard: desiredClaudeEntry(desired) };
  return replaceTopLevelJsonProperty(contents, root, "mcpServers", servers);
}

export function removeClaudeConfig(contents: string | null): string | null {
  if (contents == null) return null;
  const root = parseJsonObject(contents, "Claude Code 用户配置");
  const servers = { ...objectOrEmpty(root.mcpServers) };
  delete servers.goalboard;
  return replaceTopLevelJsonProperty(contents, root, "mcpServers", servers);
}

export function desiredOpenCodeEntry(desired: DesiredConnection): Record<string, unknown> {
  return {
    type: "local",
    command: [desired.launcherPath],
    enabled: true,
    environment: {
      GOALBOARD_HOME: desired.goalboardHome,
      GOALBOARD_MCP_AUDIENCE: "runtime",
      GOALBOARD_RUNTIME_ID: desired.runtimeId,
    },
  };
}

export function inspectOpenCodeConfig(contents: string | null, desired: DesiredConnection): ConfigInspection {
  if (contents == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const root = parseJsoncObject(contents, "OpenCode 用户配置");
  const entry = objectOrEmpty(root.mcp).goalboard;
  if (entry == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const expected = desiredOpenCodeEntry(desired);
  if (canonicalJson(entry) === canonicalJson(expected)) {
    return { state: "current", summary: "当前 GoalBoard MCP 配置", entryFingerprint: digest(canonicalJson(expected)) };
  }
  if (/goalboard|GOALBOARD_/i.test(canonicalJson(entry))) {
    return { state: "legacy", summary: "旧版 GoalBoard MCP 配置", entryFingerprint: digest(canonicalJson(entry)) };
  }
  return { state: "conflict", summary: "同名 MCP entry 不属于 GoalBoard", entryFingerprint: digest(canonicalJson(entry)) };
}

export function connectOpenCodeConfig(contents: string | null, desired: DesiredConnection): string {
  const root = contents == null
    ? { $schema: "https://opencode.ai/config.json" }
    : parseJsoncObject(contents, "OpenCode 用户配置");
  const mcp = { ...objectOrEmpty(root.mcp), goalboard: desiredOpenCodeEntry(desired) };
  return replaceTopLevelJsonProperty(contents, root, "mcp", mcp);
}

export function removeOpenCodeConfig(contents: string | null): string | null {
  if (contents == null) return null;
  const root = parseJsoncObject(contents, "OpenCode 用户配置");
  const mcp = { ...objectOrEmpty(root.mcp) };
  delete mcp.goalboard;
  return replaceTopLevelJsonProperty(contents, root, "mcp", mcp);
}

export function desiredPiEntry(desired: DesiredConnection): Record<string, unknown> {
  return {
    command: desired.launcherPath,
    args: [],
    env: {
      GOALBOARD_HOME: desired.goalboardHome,
      GOALBOARD_MCP_AUDIENCE: "runtime",
      GOALBOARD_RUNTIME_ID: desired.runtimeId,
    },
    lifecycle: "eager",
  };
}

export function inspectPiConfig(contents: string | null, desired: DesiredConnection): ConfigInspection {
  if (contents == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const root = parseJsonObject(contents, "Pi Agent MCP 配置");
  const servers = objectOrEmpty(root.mcpServers);
  const entry = servers.goalboard;
  if (entry == null) return { state: "absent", summary: "未配置 GoalBoard MCP", entryFingerprint: null };
  const expected = desiredPiEntry(desired);
  if (canonicalJson(entry) === canonicalJson(expected)) {
    return { state: "current", summary: "当前 GoalBoard MCP 配置", entryFingerprint: digest(canonicalJson(expected)) };
  }
  if (/goalboard|GOALBOARD_/i.test(canonicalJson(entry))) {
    return { state: "legacy", summary: "旧版 GoalBoard MCP 配置", entryFingerprint: digest(canonicalJson(entry)) };
  }
  return { state: "conflict", summary: "同名 MCP entry 不属于 GoalBoard", entryFingerprint: digest(canonicalJson(entry)) };
}

export function connectPiConfig(contents: string | null, desired: DesiredConnection): string {
  const root = contents == null ? {} : parseJsonObject(contents, "Pi Agent MCP 配置");
  const servers = { ...objectOrEmpty(root.mcpServers), goalboard: desiredPiEntry(desired) };
  return replaceTopLevelJsonProperty(contents, root, "mcpServers", servers);
}

export function removePiConfig(contents: string | null): string | null {
  if (contents == null) return null;
  const root = parseJsonObject(contents, "Pi Agent MCP 配置");
  const servers = { ...objectOrEmpty(root.mcpServers) };
  delete servers.goalboard;
  return replaceTopLevelJsonProperty(contents, root, "mcpServers", servers);
}

