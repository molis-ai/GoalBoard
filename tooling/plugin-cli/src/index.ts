export { runPluginCli } from "./cli.js";
export type { PluginCliOutput, PluginCliHost } from "./cli.js";
export { validatePluginManifestFile } from "./validate.js";
export { createPluginProject } from "./create.js";
export type { CreatePluginProjectInput } from "./create.js";
export { packPluginProject, readPluginPackageFile } from "./package-files.js";
export { readPublisherIdentity, signPluginPackageFile, verifyPluginPackageFile } from "./package-signing.js";

export const packageDescriptor = {
  packageName: "@adeptify/goalboard-plugin-cli",
  packagePath: "tooling/plugin-cli",
  kind: "tooling",
  maturity: "partial",
  contract: "@adeptify/goalboard-contracts/platform/tooling",
  migrationGoals: ["goal-reorg-f2","goal-reorg-dv3"],
  ssot: "docs/SSOT-MATRIX.md",
  capabilities: ["plugin.manifest.validate.v1"],
} as const;

export type GoalBoardPackageDescriptor = typeof packageDescriptor;
