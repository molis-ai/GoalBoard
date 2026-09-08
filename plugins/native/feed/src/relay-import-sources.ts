import { createHash } from "node:crypto";
import type { FeedApplication } from "./application.js";
import type { FeedSourceRecord } from "./projection.js";
import type { RelayImportData, RelayImportPorts, RelayImportResult, RelaySourceRow, RelayItemRow, RelayConnectorRow } from "./relay-import-types.js";
import { stableId } from "./source-input.js";
import { text, optionalText, parsedJson } from "./relay-import-values.js";

export function importRelaySources(target: FeedApplication, boardId: string, data: RelayImportData,
  ports: RelayImportPorts, existingSources: Map<string, FeedSourceRecord>,
  existingSourceIds: Set<string>, isRepeatOwnershipImport: boolean, result: RelayImportResult, now: string,
) {
  const { sources, connectorRows, cursorRows, gmailInstallations } = data;
  const sourceByDefinition = new Map<string, string>();
  const sourceById = new Map<string, string>();
  for (const row of sources) {
    const id = text(row.id);
    sourceById.set(id, id);
    sourceByDefinition.set(text(row.definition_id), id);
  }

  const sourceForImport = (incoming: FeedSourceRecord): FeedSourceRecord => {
    const existing = existingSources.get(incoming.source_id);
    if (!isRepeatOwnershipImport || !existing) return incoming;
    return {
      ...incoming,
      status: existing.status,
      enabled: existing.enabled,
      item_count: existing.item_count,
      cursor: existing.cursor,
      credential_ref: existing.credential_ref ?? incoming.credential_ref,
      account_label: existing.account_label ?? incoming.account_label,
      last_sync_at: existing.last_sync_at,
      last_outcome: existing.last_outcome,
      last_error_code: existing.last_error_code,
      imported_at: existing.imported_at,
      updated_at: existing.updated_at > incoming.updated_at
        ? existing.updated_at
        : incoming.updated_at,
    };
  };
  for (const row of sources) {
    const sourceId = text(row.id);
    const kind = text(row.kind);
    const config = sourceConfig(row);
    target.upsertSource(sourceForImport({
      board_id: boardId,
      source_id: sourceId,
      kind,
      definition_id: optionalText(row.definition_id),
      sync_kind: "public_source",
      name: text(row.name),
      description: text(row.description),
      status: relaySourceStatus(row),
      enabled: Number(row.enabled ?? 0) === 1,
      item_count: Number(row.item_count ?? 0),
      origin: "relay",
      config,
      schedule: { mode: "manual" },
      cursor: parsedJson(row.cursor_json, {}),
      credential_ref: null,
      account_label: null,
      last_sync_at: optionalText(row.last_sync_at),
      last_outcome: optionalText(row.last_outcome),
      last_error_code: optionalText(row.last_error_code),
      imported_at: now,
      updated_at: text(row.updated_at) || now,
    }));
    if (existingSourceIds.has(sourceId)) result.sources.updated += 1;
    else result.sources.created += 1;
  }

  const connectorSourceIds = new Map<string, string>();
  for (const kind of ["github", "gmail"] as const) {
    const meta = connectorRows.find((row) => text(row.type) === kind);
    const fallbackConnectorId = `conn-${kind}`;
    const cursor = cursorRows.find((row) => text(row.connector_id) === text(meta?.id ?? fallbackConnectorId));
    const hasCredential = [...ports.credentialRefs.values()].some((ref) =>
      ref === `connector:${kind}:token` || ref.startsWith(`connector:${kind}:inst:`)
    );
    if (!meta && !cursor && !hasCredential) continue;
    const sourceId = stableId("feed-source", `${boardId}\u0000connector\u0000${kind}`);
    connectorSourceIds.set(kind, sourceId);
    const existing = existingSourceIds.has(sourceId);
    target.upsertSource(sourceForImport({
      board_id: boardId,
      source_id: sourceId,
      kind,
      definition_id: kind,
      sync_kind: kind,
      name: text(meta?.name) || (kind === "github" ? "GitHub" : "Gmail"),
      description: text(meta?.description) || `从 Relay 迁移的 ${kind} 账号来源`,
      status: relayConnectorStatus(meta, ports.credentialRefs, kind),
      enabled: true,
      item_count: Number(meta?.item_count ?? 0),
      origin: "relay",
      config: {},
      schedule: { mode: "manual" },
      cursor: parsedJson(cursor?.cursor_json, {}),
      credential_ref: `connector:${kind}:token`,
      account_label: optionalText(meta?.account_label),
      last_sync_at: optionalText(meta?.last_sync_at),
      last_outcome: optionalText(meta?.last_sync_at) ? "completed" : null,
      last_error_code: null,
      imported_at: now,
      updated_at: now,
    }));
    if (cursor) result.cursors.migrated += 1;
    if (existing) result.sources.updated += 1;
    else result.sources.created += 1;
  }

  for (const installation of gmailInstallations) {
    const refs = ports.gmailInstallationSecretRefs(installation.id);
    const sourceId = stableId(
      "feed-source",
      `${boardId}\u0000connector\u0000gmail\u0000${installation.id}`,
    );
    const cursor = cursorRows.find((row) => text(row.connector_id) === installation.id);
    const hasCredential = ports.credentialRefs.has(refs.access)
      || ports.credentialRefs.has(refs.refresh);
    target.upsertSource(sourceForImport({
      board_id: boardId,
      source_id: sourceId,
      kind: "gmail",
      definition_id: "gmail",
      sync_kind: "gmail",
      name: `Gmail · ${installation.email || installation.id}`,
      description: "从 Relay 迁移的独立 Gmail 账号来源；凭据和游标不与其他账号共用。",
      status: installation.status === "error"
        ? "error"
        : hasCredential
          ? "active"
          : "disconnected",
      enabled: installation.status !== "disconnected",
      item_count: installation.itemCount,
      origin: "relay",
      config: { installation_id: installation.id, token_refs: refs },
      schedule: { mode: "manual" },
      cursor: parsedJson(cursor?.cursor_json, {}),
      credential_ref: refs.access,
      account_label: installation.email ?? null,
      last_sync_at: installation.lastSyncAt ?? null,
      last_outcome: installation.lastSyncAt ? "completed" : null,
      last_error_code: installation.status === "error" ? "relay_connector_error" : null,
      imported_at: now,
      updated_at: now,
    }));
    if (cursor) result.cursors.migrated += 1;
    if (existingSourceIds.has(sourceId)) result.sources.updated += 1;
    else result.sources.created += 1;
  }

  if (gmailInstallations.length > 0) {
    const legacyGmailId = connectorSourceIds.get("gmail");
    if (legacyGmailId) {
      const legacyGmail = target.getSource(boardId, legacyGmailId);
      target.upsertSource({
        ...legacyGmail,
        status: "paused",
        enabled: false,
        description: "Gmail 兼容入口；Relay 的账号已拆成独立来源，避免重复同步。",
        updated_at: now,
      });
    }
  }

  const sourceIdForItem = (row: RelayItemRow, tags: string[]): string => {
    const sourceTag = tags.find((tag) => tag.startsWith("inbox-source:"))?.slice("inbox-source:".length);
    if (sourceTag && sourceById.has(sourceTag)) return sourceById.get(sourceTag)!;
    if (sourceTag && sourceByDefinition.has(sourceTag)) return sourceByDefinition.get(sourceTag)!;
    const kind = text(row.source) || "manual";
    if (connectorSourceIds.has(kind)) return connectorSourceIds.get(kind)!;
    const label = text(row.source_label) || kind;
    const id = stableId("feed-source", `${boardId}\u0000relay-synthetic\u0000${kind}\u0000${label}`);
    if (!existingSourceIds.has(id)) {
      target.upsertSource({
        board_id: boardId,
        source_id: id,
        kind,
        definition_id: kind,
        sync_kind: "manual",
        name: label,
        description: "从 Relay Item 推导的本地来源；没有账号同步能力。",
        status: "imported",
        enabled: true,
        item_count: 0,
        origin: "relay",
        config: {},
        schedule: { mode: "manual" },
        cursor: {},
        credential_ref: null,
        account_label: null,
        last_sync_at: null,
        last_outcome: null,
        last_error_code: null,
        imported_at: now,
        updated_at: now,
      });
      existingSourceIds.add(id);
      result.sources.created += 1;
    }
    return id;
  };

  return { sourceById, sourceIdForItem };
}

function sourceConfig(row: RelaySourceRow): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (optionalText(row.query)) config.query = text(row.query);
  if (optionalText(row.channel_id)) config.channel_id = text(row.channel_id);
  if (optionalText(row.feed_url)) config.feed_url = text(row.feed_url);
  const fingerprint = optionalText(row.query_fingerprint)
    ?? createHash("sha256").update(JSON.stringify(config)).digest("hex");
  config.config_fingerprint = fingerprint;
  return config;
}

function relaySourceStatus(row: RelaySourceRow): "active" | "paused" | "error" {
  if (Number(row.enabled ?? 0) !== 1 || text(row.status) === "paused") return "paused";
  return text(row.status) === "error" ? "error" : "active";
}

function relayConnectorStatus(
  row: RelayConnectorRow | undefined,
  entries: ReadonlySet<string>,
  kind: "github" | "gmail",
): "active" | "error" | "disconnected" {
  if (entries.has(`connector:${kind}:token`)) return "active";
  return text(row?.status) === "error" ? "error" : "disconnected";
}
