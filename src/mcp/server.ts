#!/usr/bin/env node
import readline from "node:readline";
import { GoalBoardServer } from "@adeptify/goalboard-app-desktop";
export { GoalBoardServer } from "@adeptify/goalboard-app-desktop";
export { runtimeContextHostFromEnvironment } from "@adeptify/goalboard-app-local-host";
export type { GoalBoardMcpAudience, GoalBoardMcpToolCallContext, GoalBoardRuntimeContextHost } from "@adeptify/goalboard-app-local-host";
export type { GoalBoardRuntimeConnection } from "@adeptify/goalboard-contracts/platform/app-host";
export { MCP_TOOLS as TOOLS, RUNTIME_MCP_TOOLS as RUNTIME_TOOLS, MCP_SERVER_INFO as SERVER_INFO } from "@adeptify/goalboard-app-mcp";

async function runStdio(): Promise<void> {
  const server = new GoalBoardServer();
  try {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      const response = await server.handleMessage(message);
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    }
  } finally {
    await server.close();
  }
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("mcp/server.ts") ||
    process.argv[1].endsWith("mcp/server.js"));

if (isMain) {
  runStdio().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
