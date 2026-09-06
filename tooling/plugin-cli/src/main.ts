#!/usr/bin/env node
import { runPluginCli } from "./cli.js";

process.exitCode = await runPluginCli(process.argv.slice(2), {
  stdout: value => process.stdout.write(value),
  stderr: value => process.stderr.write(value),
});
