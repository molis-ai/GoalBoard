import {
  LocalSqliteJournal,
} from "@adeptify/goalboard-storage";
import {
  randomUUID,
} from "node:crypto";
import type { SqliteDatabase } from "@adeptify/goalboard-storage";
import {
  createContextLedger,
} from "@adeptify/goalboard-module-context-ledger";
import {
  createGoalReadServices,
} from "@adeptify/goalboard-module-goals";

import {
  AttentionModule,
} from "@adeptify/goalboard-module-attention-resumption";
import {
  FeedModule,
  FeedReceiptStore,
} from "@adeptify/goalboard-module-feed";

import {
  SourcesError,
  SourcesModule,
} from "@adeptify/goalboard-module-sources";
import {
  deleteListenerSourceState,
  getListenerRunByOperationId,
  listListenerRuns,
  migrateListenerHost,
  readListenerCheckpoint,
  recoverInterruptedListenerRuns,
  saveListenerRun,
  writeListenerCursor,
} from "@adeptify/goalboard-service-listener-host";
import { FeedApplication, type FeedApplicationPorts } from "@adeptify/goalboard-plugin-feed";

/** Assemble every Feed operation against the same local connection. */
export function createLocalFeedApplication(db: SqliteDatabase): FeedApplication {
  const sources = new SourcesModule(db);
  const receipts = new FeedReceiptStore(db);
  const journal = new LocalSqliteJournal(db);
  // Pre-reorg projects already applied Feed migrations 22–29, but those
  // releases did not have Listener storage. Initialize its owner before
  // recovery or cursor reads; the migration preserves existing checkpoints.
  migrateListenerHost(db);
  const goals = createGoalReadServices(db).query;
  let feedItems!: FeedModule;
  const attention = new AttentionModule(db, {
    exists: (projectId, subjectType, subjectId) => {
      if (subjectType === "feed_item") return feedItems.query.exists(projectId, subjectId);
      if (subjectType === "source_fault") {
        try {
          sources.query.get(projectId, subjectId);
          return true;
        } catch (error) {
          if (error instanceof SourcesError && error.code === "source_not_found") return false;
          throw error;
        }
      }
      return goals.getGoal(projectId, subjectId) !== null;
    },
  }, {
    eventSink: (event) => appendEvent(
      event.project_id,
      "inbox_entry",
      event.entry_id,
      event.type,
      event.reason,
      event.payload,
      event.at,
    ),
  });
  feedItems = new FeedModule(db, attention, {
    ledger: createContextLedger(db, { authorize: (access) => access.scope.kind === "personal" && access.actor_id === "module:feed" }),
    eventSink: (event) => appendEvent(
      event.project_id,
      "feed_item",
      event.item_id,
      event.type,
      event.reason,
      event.payload,
      event.at,
    ),
  });

  function appendEvent(...args: Parameters<FeedApplicationPorts["appendEvent"]>): void {
    const [boardId, objectType, objectId, type, reason, payload, at] = args;
    journal.appendEvent({ eventId: `event-${randomUUID()}`, boardId, actorId: "web-user",
      objectType, objectId, type, reason, payload, at });
  }
  return new FeedApplication({
    sources, feed: feedItems, attention, receipts, appendEvent,
    transaction: (operation) => db.transaction(operation).immediate(),
    listener: {
      listRuns: (boardId) => listListenerRuns(db, boardId),
      getRunByOperationId: (boardId, operationId) => getListenerRunByOperationId(db, boardId, operationId),
      saveRun: (run) => saveListenerRun(db, run),
      recoverInterruptedRuns: (boardId) => recoverInterruptedListenerRuns(db, boardId),
      checkpoint: (boardId, sourceId, at) => readListenerCheckpoint(db, boardId, sourceId, at),
      writeCursor: (boardId, sourceId, cursor, at) => writeListenerCursor(db, boardId, sourceId, cursor, at),
      deleteSourceState: (boardId, sourceId) => deleteListenerSourceState(db, boardId, sourceId),
    },
  });
}
