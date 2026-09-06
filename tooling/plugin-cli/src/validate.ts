import { readFile } from "node:fs/promises";
import { parsePluginManifest } from "@adeptify/goalboard-contracts/platform/plugin";
import type { PluginManifest } from "@adeptify/goalboard-contracts/platform/plugin";

/** Read data only. Validation must never import or execute a Plugin entrypoint. */
export async function validatePluginManifestFile(filePath: string): Promise<PluginManifest> {
  return parsePluginManifest(JSON.parse(await readFile(filePath, "utf8")) as unknown);
}
