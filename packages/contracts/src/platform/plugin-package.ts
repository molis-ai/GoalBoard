import type { PluginManifest } from "./plugin.js";

export interface PluginPackageFile {
  path: string;
  content_base64: string;
}

export interface PluginPackagePayload {
  schema_version: 1;
  manifest: PluginManifest;
  files: PluginPackageFile[];
}

export interface PluginPackageBundle {
  payload: PluginPackagePayload;
  signature: null | { algorithm: "ed25519"; value_base64: string };
}

/** Implemented by the trusted publishing environment, never by Plugin application code. */
export interface PluginPackageSigner {
  readonly publisher_identity: string;
  sign(payload: Uint8Array): Uint8Array;
}
