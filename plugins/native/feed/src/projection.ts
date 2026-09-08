import { redactFeedContextSecrets } from "./context.js";
import type { FeedUiPreset } from "./ui.js";
import type { FeedItemRecord as CanonicalFeedItem, FeedMaterialRecord as CanonicalFeedMaterial, FeedImportReceiptRecord, FeedContractMigrationReceiptRecord } from "@adeptify/goalboard-contracts/modules/feed";
import type { SourceRecord, SourceSchedule, SourceSyncKind, SourceStatus } from "@adeptify/goalboard-contracts/modules/sources";
import type { AttentionEntryRecord, AttentionReason, AttentionStatus, AttentionSubjectType } from "@adeptify/goalboard-contracts/modules/attention-resumption";
import type { ListenerRunRecord } from "@adeptify/goalboard-contracts/services/listener-host";
export type { FeedItemDisposition, FeedImportReceiptRecord, FeedContractMigrationReceiptRecord } from "@adeptify/goalboard-contracts/modules/feed";
export type { SourceHistoryDecision } from "@adeptify/goalboard-contracts/modules/sources";

/** Existing local read projection. These are owner-derived views, never a second store. */
export type FeedItemType = FeedUiPreset;
export type FeedSourceSyncKind = SourceSyncKind;
export type FeedSourceStatus = SourceStatus;
export type FeedSourceSchedule = SourceSchedule;
export type FeedSourceRunPhase = ListenerRunRecord["phase"];
export type InboxEntrySubjectType = AttentionSubjectType;
export type InboxEntryReason = AttentionReason;
export type InboxEntryStatus = AttentionStatus;
export interface FeedSourceRecord extends Omit<SourceRecord, "project_id" | "connection_ref"> {
  board_id: string;
  item_count: number;
  cursor: unknown;
  credential_ref: string | null;
}
export interface FeedSourceRunRecord extends Omit<ListenerRunRecord, "project_id" | "connector_receipt"> {
  board_id: string;
  receipt: Record<string, unknown> | null;
}
export interface InboxEntryRecord extends Omit<AttentionEntryRecord, "project_id"> {
  board_id: string;
}
export interface FeedMaterialRecord extends Omit<CanonicalFeedMaterial, "project_id"> {
  board_id: string;
  /** Decrypted only for local detail/TUI display; never stored in SQLite. */
  content?: string | null;
}
export interface FeedItemRecord extends Omit<CanonicalFeedItem, "project_id" | "signal_id" | "signal_revision" | "materials"> {
  board_id: string;
  item_type: FeedItemType;
  materials: FeedMaterialRecord[];
}

export interface FeedSnapshot {
  sources: FeedSourceRecord[];
  /** Canonical external facts. Every record is a FeedItem, including items with Inbox references. */
  feed_items: FeedItemRecord[];
  /** Canonical attention state; entries reference facts or internal objects and never copy message bodies. */
  inbox_entries: InboxEntryRecord[];
  /** Temporary compatibility projection for the current combined Inbox/Feed Web workbench. */
  items: FeedItemRecord[];
  runs: FeedSourceRunRecord[];
  import_receipts: FeedImportReceiptRecord[];
  contract_migrations: FeedContractMigrationReceiptRecord[];
}

export interface RelayImportAvailability {
  path: string;
  available: boolean;
  source_count: number;
  item_count: number;
  material_count: number;
  error: string | null;
}

const FEED_SOURCE_KINDS = new Set([
  "rss",
  "web_query",
  "youtube_channel",
  "custom_rss",
]);

export function feedItemTypeForSource(sourceKind: string): FeedItemType {
  return FEED_SOURCE_KINDS.has(sourceKind) ? "feed" : "inbox_message";
}

function bounded(value: string, maximum: number): string {
  const normalized = value.trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1)}…` : normalized;
}

export function feedItemContext(item: FeedItemRecord): string {
  const materials = item.materials
    .filter((material) => material.selected_for_context || item.materials.length <= 4)
    .slice(0, 6)
    .map((material, index) => {
      const location = material.canonical_url ? `\n   链接：${material.canonical_url}` : "";
      const preview = material.preview ? `\n   摘要：${bounded(material.preview, 900)}` : "";
      const content = material.content ? `\n   正文：${bounded(material.content, 6_000)}` : "";
      return `${index + 1}. ${material.title || material.source_name}${location}${preview}${content}`;
    })
    .join("\n");
  return redactFeedContextSecrets([
    `来源类型：${item.item_type === "feed" ? "Feed" : "Inbox Message"}`,
    `来源：${item.source_label || item.source_kind}`,
    item.author ? `作者/发送者：${item.author}` : "",
    item.url ? `原链接：${item.url}` : "",
    `标题：${item.title}`,
    item.summary ? `摘要：${bounded(item.summary, 2_000)}` : "",
    item.body ? `正文：\n${bounded(item.body, 6_000)}` : "",
    materials ? `可引用资料：\n${materials}` : "",
  ].filter(Boolean).join("\n\n"));
}

export interface FeedSourceCatalogView {
  id: string;
  name: string;
  kind: "rss";
  feed_url: string;
  category: string;
  category_label: string;
  limitations: readonly string[];
}
