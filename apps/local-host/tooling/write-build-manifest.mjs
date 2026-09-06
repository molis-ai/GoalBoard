import path from "node:path";
import { writeGoalBoardBuildManifest } from "@adeptify/goalboard-app-local-host";

// Build invocation adapter; the installer owns the source-input and digest rules.
await writeGoalBoardBuildManifest(path.resolve(process.argv[2] ?? process.cwd()));
