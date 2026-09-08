#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runLocalCli, runLocalPluginDevelopment } from "@adeptify/goalboard-app-local-host";
import { withGoalBoardProjectCatalog } from "@adeptify/goalboard-app-desktop";
import { runPluginCli } from "@adeptify/goalboard-plugin-cli";

export function main(args = process.argv.slice(2)): Promise<number> {
  return runLocalCli(args, {
    defaultSourceDirectory: () => fileURLToPath(new URL("../../", import.meta.url)),
    withCatalog: withGoalBoardProjectCatalog,
    runPlugin: (args) => runPluginCli(args, {
      stdout: value => process.stdout.write(value), stderr: value => process.stderr.write(value),
    }, { runDevelopment: runLocalPluginDevelopment }),
  });
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("cli/main.ts") ||
    process.argv[1].endsWith("cli/main.js") ||
    process.argv[1].endsWith("goalboard"));

if (isMain) {
  main().then((code) => process.exit(code));
}
