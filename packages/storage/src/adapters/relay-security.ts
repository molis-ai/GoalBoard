import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RELAY_CONTENT_KEY_REF = "system:evidence:content-key:v1";
const RELAY_CONTENT_REF = /^relay-evidence\/sha256\/([0-9a-f]{64})$/u;

export interface RelaySecuritySnapshot {
  entries: Map<string, string>;
  contentKey: Buffer | null;
  readable: boolean;
}

export function openRelaySecurity(dataDirectory: string): RelaySecuritySnapshot {
  const secretsPath = path.join(dataDirectory, "secrets.json");
  if (!fs.existsSync(secretsPath)) return { entries: new Map(), contentKey: null, readable: false };
  try {
    const raw = JSON.parse(fs.readFileSync(secretsPath, "utf8")) as unknown;
    const sealedEntries = extractSealedEntries(raw);
    const key = resolveRelayMasterKey(dataDirectory);
    if (!key) return { entries: new Map(), contentKey: null, readable: false };
    const entries = new Map<string, string>();
    for (const [authRef, sealed] of Object.entries(sealedEntries)) {
      const plaintext = openRelaySealed(sealed, key);
      if (plaintext != null) entries.set(authRef, plaintext);
    }
    const contentKeyRaw = entries.get(RELAY_CONTENT_KEY_REF);
    const contentKey = contentKeyRaw ? Buffer.from(contentKeyRaw, "base64") : null;
    return {
      entries,
      contentKey: contentKey?.length === 32 ? contentKey : null,
      readable: entries.size > 0 || Object.keys(sealedEntries).length === 0,
    };
  } catch {
    return { entries: new Map(), contentKey: null, readable: false };
  }
}

function extractSealedEntries(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid Relay secrets file");
  const record = value as Record<string, unknown>;
  const candidate = record.entries && typeof record.entries === "object" && !Array.isArray(record.entries)
    ? record.entries as Record<string, unknown>
    : record;
  const entries: Record<string, string> = {};
  for (const [key, sealed] of Object.entries(candidate)) {
    if (typeof sealed === "string") entries[key] = sealed;
  }
  return entries;
}

function resolveRelayMasterKey(dataDirectory: string): Buffer | null {
  const envValue = process.env.RELAY_ENCRYPTION_KEY?.trim();
  if (envValue) {
    if (/^[0-9a-fA-F]{64}$/u.test(envValue)) return Buffer.from(envValue, "hex");
    const base64 = Buffer.from(envValue, "base64");
    if (base64.length === 32) return base64;
    return scryptSync(envValue, "relay-secretstore-v2", 32);
  }
  if (process.platform === "darwin") {
    try {
      const value = execFileSync(
        "security",
        [
          "find-generic-password",
          "-a",
          "install-master-key",
          "-s",
          "com.relay.local.secretstore",
          "-w",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3_000 },
      ).trim();
      const key = Buffer.from(value, "base64");
      if (key.length === 32) return key;
    } catch {
      // Fall back to the install key file.
    }
  }
  const keyPath = path.join(dataDirectory, "secrets.key");
  if (!fs.existsSync(keyPath)) return null;
  const raw = fs.readFileSync(keyPath, "utf8").trim();
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;
  return /^[0-9a-fA-F]{64}$/u.test(raw) ? Buffer.from(raw, "hex") : null;
}

function openRelaySealed(sealed: string, key: Buffer): string | null {
  try {
    const payload = JSON.parse(Buffer.from(sealed, "base64").toString("utf8")) as Record<string, unknown>;
    if (payload.v === 2 && payload.alg === "aes-256-gcm") {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(String(payload.iv), "base64"));
      decipher.setAuthTag(Buffer.from(String(payload.tag), "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(String(payload.ct), "base64")),
        decipher.final(),
      ]).toString("utf8");
    }
    if (typeof payload.v === "string") return Buffer.from(payload.v, "base64").toString("utf8");
    return null;
  } catch {
    return null;
  }
}

export function readRelayContent(
  contentRef: string | null,
  dataDirectory: string,
  key: Buffer | null,
): string | null {
  if (!contentRef || !key) return null;
  const match = RELAY_CONTENT_REF.exec(contentRef);
  if (!match) return null;
  const sourcePath = path.join(dataDirectory, "evidence", "blobs", match[1]!.slice(0, 2), `${match[1]}.blob`);
  if (!fs.existsSync(sourcePath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as {
      v?: unknown;
      alg?: unknown;
      iv?: unknown;
      tag?: unknown;
      ct?: unknown;
    };
    if (
      payload.v !== 1 ||
      payload.alg !== "aes-256-gcm" ||
      typeof payload.iv !== "string" ||
      typeof payload.tag !== "string" ||
      typeof payload.ct !== "string"
    ) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAAD(Buffer.from(contentRef, "utf8"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ct, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const expected = match[1]!;
    if (createHash("sha256").update(plaintext).digest("hex") !== expected) {
      return null;
    }
    return plaintext;
  } catch {
    return null;
  }
}
