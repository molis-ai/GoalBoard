import fs from "node:fs";
import path from "node:path";

export interface LocalProjectStoragePreparation {
  databasePath: string;
  status: "prepared" | "missing";
}

/** Prepare a local storage location without opening a runtime or creating a database. */
export function prepareLocalProjectStorage(
  location: string,
  mode: "create" | "existing",
): LocalProjectStoragePreparation {
  const databasePath = path.resolve(location);
  if (mode === "create") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    return { databasePath, status: "prepared" };
  }
  return { databasePath, status: fs.existsSync(databasePath) ? "prepared" : "missing" };
}
