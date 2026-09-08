import type { AttentionReason as ModuleAttentionReason, AttentionStatus as ModuleAttentionStatus, AttentionSubjectType as ModuleAttentionSubjectType } from "@adeptify/goalboard-contracts/modules/attention-resumption";
import type { FeedItemRecord as ModuleFeedItemRecord, ImportedFeedItemInput } from "@adeptify/goalboard-contracts/modules/feed";
import type { SourceRecord } from "@adeptify/goalboard-contracts/modules/sources";


import type { FeedItemDisposition, FeedItemRecord, FeedImportReceiptRecord, FeedMaterialRecord, FeedSnapshot, FeedSourceRunRecord, FeedSourceRecord, InboxEntryReason, InboxEntryRecord, InboxEntryStatus, InboxEntrySubjectType, SourceHistoryDecision } from "./projection.js";
import { SourcesError } from "@adeptify/goalboard-contracts/modules/sources";
import { FeedError } from "@adeptify/goalboard-contracts/modules/feed";
import { AttentionError } from "@adeptify/goalboard-contracts/modules/attention-resumption";
import { FeedStoreError, assertSourceHistoryDecision } from "./application-errors.js";
import { toLegacyAttentionEntry, toLegacyFeedItem, toLegacyFeedMaterial, compatibleRun, isActiveAttention } from "./application-projection.js";
import type { FeedApplicationPorts } from "./application-ports.js";

/** Product operations over module facts; connection and lifecycle are supplied by the host. */
export class FeedApplication {
  constructor(private readonly ports: FeedApplicationPorts) {}

  snapshot(boardId: string): FeedSnapshot {
    const sources = this.ports.sources.query.list(boardId).map((source) => this.compatibleSource(source));
    const feedItems = this.ports.feed.query.list(boardId).map(toLegacyFeedItem);
    const inboxEntries = this.ports.attention.query.list(boardId).map(toLegacyAttentionEntry);
    const activeInboxSubjects = new Set(inboxEntries
      .filter((entry) => entry.subject_type === "feed_item" && isActiveAttention(entry.status))
      .map((entry) => entry.subject_id));
    const items = feedItems.map((item) => activeInboxSubjects.has(item.item_id)
      ? { ...item, item_type: "inbox_message" as const }
      : item);
    const runs = this.ports.listener.listRuns(boardId).map(compatibleRun);
    const importReceipts = this.ports.receipts.listImports(boardId);
    const contractMigrations = this.ports.receipts.listContractMigrations();
    return {
      sources,
      feed_items: feedItems,
      inbox_entries: inboxEntries,
      items,
      runs,
      import_receipts: importReceipts,
      contract_migrations: contractMigrations,
    };
  }

  getItem(boardId: string, itemId: string): FeedItemRecord {
    return this.projectLegacyItem(
      boardId,
      this.callFeed(() => this.ports.feed.query.get(boardId, itemId)),
    );
  }

  getFeedItem(boardId: string, itemId: string): FeedItemRecord {
    return toLegacyFeedItem(this.callFeed(() => this.ports.feed.query.get(boardId, itemId)));
  }

  findLinkedGoalItem(boardId: string, goalId: string, itemId?: string): FeedItemRecord | null {
    const item = this.ports.feed.query.findByLinkedGoal(boardId, goalId, itemId);
    return item ? this.projectLegacyItem(boardId, item) : null;
  }

  listInboxEntries(boardId: string): InboxEntryRecord[] {
    return this.ports.attention.query.list(boardId).map(toLegacyAttentionEntry);
  }

  getInboxEntry(boardId: string, entryId: string): InboxEntryRecord {
    return toLegacyAttentionEntry(this.callAttention(
      () => this.ports.attention.query.get(boardId, entryId),
    ));
  }

  getSource(boardId: string, sourceId: string): FeedSourceRecord {
    try {
      return this.compatibleSource(this.ports.sources.query.get(boardId, sourceId));
    } catch (error) {
      if (error instanceof SourcesError && error.code === "source_not_found") {
        throw new FeedStoreError("feed_source_not_found", "找不到这个来源");
      }
      throw error;
    }
  }

  findSource(
    boardId: string,
    syncKind: FeedSourceRecord["sync_kind"],
    definitionId: string | null,
    configFingerprint?: string,
  ): FeedSourceRecord | null {
    const source = this.ports.sources.query.find(boardId, syncKind, definitionId, configFingerprint);
    return source ? this.compatibleSource(source) : null;
  }

  upsertSource(source: FeedSourceRecord): FeedSourceRecord {
    const saved = this.ports.sources.commands.save({
      project_id: source.board_id,
      source_id: source.source_id,
      kind: source.kind,
      definition_id: source.definition_id,
      sync_kind: source.sync_kind,
      name: source.name,
      description: source.description,
      status: source.status,
      enabled: source.enabled,
      origin: source.origin,
      config: source.config,
      schedule: source.schedule,
      connection_ref: source.credential_ref,
      account_label: source.account_label,
      last_sync_at: source.last_sync_at,
      last_outcome: source.last_outcome,
      last_error_code: source.last_error_code,
      imported_at: source.imported_at,
      updated_at: source.updated_at,
    });
    this.ports.listener.writeCursor(source.board_id, source.source_id, source.cursor, source.updated_at);
    return this.compatibleSource(saved);
  }

  setSourceEnabled(boardId: string, sourceId: string, enabled: boolean): FeedSourceRecord {
    try {
      return this.compatibleSource(this.ports.sources.commands.setEnabled(boardId, sourceId, enabled));
    } catch (error) {
      if (error instanceof SourcesError && error.code === "source_not_found") {
        throw new FeedStoreError("feed_source_not_found", "找不到这个来源");
      }
      throw error;
    }
  }

  retireSource(
    boardId: string,
    sourceId: string,
    historyDecision: SourceHistoryDecision,
  ): FeedSourceRecord {
    assertSourceHistoryDecision(historyDecision);
    return this.ports.transaction(() => {
      const now = new Date().toISOString();
      if (historyDecision === "delete_local_history") {
        this.ports.feed.commands.deleteBySource(boardId, sourceId);
        this.ports.attention.commands.deleteSubject(boardId, "source_fault", sourceId);
        this.ports.listener.deleteSourceState(boardId, sourceId);
      }
      const retired = this.compatibleSource(
        this.ports.sources.commands.retire(boardId, sourceId, historyDecision, now),
      );
      this.ports.appendEvent(
        boardId,
        "feed_source",
        sourceId,
        "feed_source.deleted",
        historyDecision === "delete_local_history"
          ? "来源及本地历史已删除"
          : "来源已删除，本地历史保留",
        { history_decision: historyDecision },
        now,
      );
      return retired;
    });
  }

  createInboxEntry(input: {
    boardId: string;
    subjectType: InboxEntrySubjectType;
    subjectId: string;
    reason: InboxEntryReason;
    detail?: Record<string, unknown>;
    entryId?: string;
    at?: string;
  }): { entry: InboxEntryRecord; created: boolean } {
    const result = this.callAttention(() => this.ports.attention.commands.create({
      project_id: input.boardId,
      subject_type: input.subjectType as ModuleAttentionSubjectType,
      subject_id: input.subjectId,
      reason: input.reason as ModuleAttentionReason,
      detail: input.detail,
      entry_id: input.entryId,
      at: input.at,
    }));
    return { entry: toLegacyAttentionEntry(result.entry), created: result.created };
  }

  ensureInboxEntryForFeedItem(
    boardId: string,
    itemId: string,
    reason: Extract<InboxEntryReason, "manual" | "source_rule">,
    detail: Record<string, unknown> = {},
  ): { entry: InboxEntryRecord; created: boolean } {
    const result = this.callAttention(
      () => this.ports.attention.commands.ensureFeedItem(boardId, itemId, reason, detail),
    );
    return { entry: toLegacyAttentionEntry(result.entry), created: result.created };
  }

  setInboxEntryStatus(
    boardId: string,
    entryId: string,
    status: InboxEntryStatus,
    expectedRevision?: number,
  ): InboxEntryRecord {
    return toLegacyAttentionEntry(this.callAttention(
      () => this.ports.attention.commands.setStatus(
        boardId,
        entryId,
        status as ModuleAttentionStatus,
        expectedRevision,
      ),
    ));
  }

  getSourceRunByOperationId(boardId: string, operationId: string): FeedSourceRunRecord | null {
    const run = this.ports.listener.getRunByOperationId(boardId, operationId);
    return run ? compatibleRun(run) : null;
  }

  upsertSourceRun(run: FeedSourceRunRecord): FeedSourceRunRecord {
    return compatibleRun(this.ports.listener.saveRun({
      project_id: run.board_id,
      run_id: run.run_id,
      operation_id: run.operation_id,
      source_id: run.source_id,
      phase: run.phase,
      outcome: run.outcome,
      empty: run.empty,
      error_code: run.error_code,
      connector_receipt: run.receipt,
      created_count: run.created_count,
      deduped_count: run.deduped_count,
      recovery_count: run.recovery_count,
      started_at: run.started_at,
      completed_at: run.completed_at,
      updated_at: run.updated_at,
    }));
  }

  recoverInterruptedSourceRuns(boardId: string): number {
    return this.ports.listener.recoverInterruptedRuns(boardId);
  }

  ingestItem(input: {
    source: FeedSourceRecord;
    externalId: string;
    signal?: { signal_id: string; revision: number };
    title: string;
    summary: string;
    body?: string | null;
    url?: string | null;
    kind?: string;
    priority?: string;
    tags?: string[];
    author?: string | null;
    occurredAt: string;
    attention?: false | {
      reason: Extract<InboxEntryReason, "manual" | "source_rule">;
      detail?: Record<string, unknown>;
    };
    material?: Omit<FeedMaterialRecord, "board_id" | "item_id" | "imported_at" | "updated_at">;
  }): { item: FeedItemRecord; created: boolean } {
    const result = this.callFeed(() => this.ports.feed.commands.ingest({
      project_id: input.source.board_id,
      source_id: input.source.source_id,
      source_kind: input.source.kind,
      source_label: input.source.name,
      external_id: input.externalId,
      signal: input.signal,
      title: input.title,
      summary: input.summary,
      body: input.body,
      url: input.url,
      kind: input.kind,
      priority: input.priority,
      tags: input.tags,
      author: input.author,
      occurred_at: input.occurredAt,
      attention: input.attention,
      material: input.material ? {
        ...input.material,
      } : undefined,
    }));
    return { item: this.projectLegacyItem(input.source.board_id, result.item), created: result.created };
  }

  upsertImportedItem(input: ImportedFeedItemInput): FeedItemRecord {
    return toLegacyFeedItem(this.callFeed(() => this.ports.feed.commands.upsertImportedItem(input)));
  }

  upsertMaterial(material: FeedMaterialRecord): FeedMaterialRecord {
    return toLegacyFeedMaterial(this.callFeed(() => this.ports.feed.commands.upsertMaterial({
      project_id: material.board_id,
      material_id: material.material_id,
      item_id: material.item_id,
      canonical_url: material.canonical_url,
      title: material.title,
      source_name: material.source_name,
      published_at: material.published_at,
      preview: material.preview,
      content_hash: material.content_hash,
      content_ref: material.content_ref,
      content_available: material.content_available,
      content_type: material.content_type,
      character_count: material.character_count,
      captured_at: material.captured_at,
      provenance: material.provenance,
      selected_for_context: material.selected_for_context,
      imported_at: material.imported_at,
      updated_at: material.updated_at,
    })));
  }

  importOwnershipBatch<T>(operation: () => { result: T; receipt: FeedImportReceiptRecord }): T {
    return this.ports.transaction(() => {
      const { result, receipt } = operation();
      this.ports.receipts.putImportReceipt(receipt);
      const { sources, items, materials, runs, credentials, content } = receipt.summary;
      this.ports.appendEvent(receipt.board_id, "board", receipt.board_id,
        "feed.relay_ownership_migrated", "用户把 Relay Feed 数据与可用本机所有权迁入 GoalBoard",
        { receipt_id: receipt.receipt_id, sources, items, materials, runs, credentials, content },
        receipt.completed_at);
      return result;
    });
  }

  setDisposition(
    boardId: string,
    itemId: string,
    disposition: FeedItemDisposition,
    expectedRevision?: number,
  ): FeedItemRecord {
    const item = this.callFeed(
      () => this.ports.feed.commands.setDisposition(boardId, itemId, disposition, expectedRevision),
    );
    return this.projectLegacyItem(boardId, item);
  }

  restoreToFeed(boardId: string, itemId: string, expectedRevision?: number): FeedItemRecord {
    return toLegacyFeedItem(this.callFeed(
      () => this.ports.feed.commands.restore(boardId, itemId, expectedRevision),
    ));
  }

  markRead(boardId: string, itemId: string): FeedItemRecord {
    const projected = this.getItem(boardId, itemId);
    return this.projectLegacyItem(boardId, this.callFeed(
      () => this.ports.feed.commands.markRead(boardId, itemId, projected.item_type),
    ));
  }

  linkGoal(
    boardId: string,
    itemId: string,
    goalId: string,
    disposition: "promoted" | "processing",
  ): FeedItemRecord {
    const item = this.callFeed(
      () => this.ports.feed.commands.linkGoal(boardId, itemId, goalId, disposition),
    );
    return this.projectLegacyItem(boardId, item);
  }

  private compatibleSource(source: SourceRecord): FeedSourceRecord {
    const checkpoint = this.ports.listener.checkpoint(source.project_id, source.source_id, source.updated_at);
    return {
      board_id: source.project_id,
      source_id: source.source_id,
      kind: source.kind,
      definition_id: source.definition_id,
      sync_kind: source.sync_kind,
      name: source.name,
      description: source.description,
      status: source.status,
      enabled: source.enabled,
      item_count: this.ports.feed.query.countBySource(source.project_id, source.source_id),
      origin: source.origin,
      config: source.config,
      schedule: source.schedule,
      cursor: checkpoint.cursor,
      credential_ref: source.connection_ref,
      account_label: source.account_label,
      last_sync_at: source.last_sync_at,
      last_outcome: source.last_outcome,
      last_error_code: source.last_error_code,
      imported_at: source.imported_at,
      updated_at: source.updated_at,
    };
  }

  private projectLegacyItem(boardId: string, item: ModuleFeedItemRecord): FeedItemRecord {
    const inbox = this.ports.attention.query.findActiveForSubject(boardId, "feed_item", item.item_id);
    const legacy = toLegacyFeedItem(item);
    return inbox ? { ...legacy, item_type: "inbox_message" } : legacy;
  }

  private callFeed<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof FeedError) {
        throw new FeedStoreError(error.code, error.message);
      }
      throw error;
    }
  }

  private callAttention<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof AttentionError) {
        const code = error.code === "attention_entry_not_found"
          ? "inbox_entry_not_found"
          : error.code === "attention_revision_conflict"
            ? "feed_revision_conflict"
            : "feed_invalid_transition";
        throw new FeedStoreError(code, error.message);
      }
      throw error;
    }
  }

}
