import type { FeedConnectorTokenRefs } from "./connector-account-ports.js";

/** Closed legacy SQLite fields accepted by the migration, including optional old columns. */
type RelayScalar = string | number | bigint | Uint8Array | null;
type RelayFields<K extends string> = { [P in K]?: RelayScalar };
export type RelaySourceRow = RelayFields<"id" | "definition_id" | "kind" | "name" | "description" | "status" | "enabled" | "item_count" | "query" | "channel_id" | "feed_url" | "query_fingerprint" | "cursor_json" | "last_sync_at" | "last_outcome" | "last_error_code" | "updated_at">;
export type RelayItemRow = RelayFields<"id" | "kind" | "title" | "summary" | "body" | "source" | "source_label" | "external_id" | "url" | "status" | "priority" | "tags_json" | "author" | "created_at" | "updated_at">;
export type RelayMaterialRow = RelayFields<"id" | "item_id" | "canonical_url" | "title" | "source_name" | "published_at" | "preview" | "content_hash" | "content_ref" | "content_type" | "character_count" | "captured_at" | "provenance_json" | "selected_for_context" | "last_seen_at">;
export type RelayRunRow = RelayFields<"id" | "inbox_source_id" | "operation_id" | "phase" | "outcome" | "empty" | "error_code" | "collection_receipt_json" | "recovery_count" | "started_at" | "completed_at" | "updated_at" | "created_at">;
export type RelayConnectorRow = RelayFields<"id" | "type" | "name" | "description" | "status" | "account_label" | "last_sync_at" | "item_count">;
export type RelayCursorRow = RelayFields<"connector_id" | "cursor_json">;
export interface RelayImportData {
  sources: RelaySourceRow[];
  items: RelayItemRow[];
  materials: RelayMaterialRow[];
  sourceRuns: RelayRunRow[];
  connectorRows: RelayConnectorRow[];
  cursorRows: RelayCursorRow[];
  gmailInstallations: Array<{ id: string; email?: string; status: "connected" | "error" | "disconnected" | "mock"; lastSyncAt?: string; itemCount: number }>;
}
export interface RelayImportPorts {
  path: string;
  migrateOwnership: boolean;
  credentialRefs: ReadonlySet<string>;
  credentials: RelayImportResult["credentials"];
  gmailInstallationSecretRefs(id: string): FeedConnectorTokenRefs;
  migrateContent(ref: string | null): { contentRef: string | null; available: boolean };
  sourceFingerprint(): string;
}

export interface RelayImportResult {
  path: string;
  receipt_id: string;
  sources: { created: number; updated: number };
  items: { created: number; updated: number };
  materials: { created: number; updated: number };
  runs: { created: number; updated: number };
  cursors: { migrated: number };
  credentials: { status: "migrated" | "unavailable" | "not_requested"; migrated: number };
  content: { status: "migrated" | "partial" | "unavailable" | "not_requested"; migrated: number; missing: number };
}
