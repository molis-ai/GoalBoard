import path from "node:path";
import { pathState } from "./home-files.js";

/** Source-side distribution assets, copied and fingerprinted by the same release owner. */
export async function releaseAssetPaths(sourceDirectory: string): Promise<string[]> {
  const assets: string[] = [];
  for (const entry of ["vendor", "LICENSE", "README.md", "README.zh.md"]) {
    if (await pathState(path.join(sourceDirectory, entry))) assets.push(entry);
  }
  return assets;
}
