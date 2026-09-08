import { integerRevision, requireParam } from "./route-input.js";
import type { FeedPluginRouteHandler } from "./routes.js";
import type { FeedRouteHandlerPorts } from "./route-handler-ports.js";

export function createFeedItemRouteHandlers(options: FeedRouteHandlerPorts): Record<string, FeedPluginRouteHandler> {
  const feed = () => options.feed();
  const changed = () => options.changed();
  return {
    "feed.item.detail": ({ params, request }) => {
      const itemId = requireParam(params.item_id, "Feed Item 不存在");
      const store = feed();
      const preset = request.query.get("preset") === "inbox_message" ? "inbox_message" : "feed";
      const requestedEntry = request.query.get("entry");
      const inboxEntry = preset === "inbox_message" && requestedEntry
        ? store.getInboxEntry(options.boardId, requestedEntry)
        : null;
      if (inboxEntry && (inboxEntry.subject_type !== "feed_item" || inboxEntry.subject_id !== itemId)) {
        return { status: 404, body: { error: "Inbox 引用与原消息不匹配" } };
      }
      const projected = store.getItem(options.boardId, itemId);
      const item = options.hydrateItem({ ...store.getFeedItem(options.boardId, itemId), item_type: preset });
      return {
        status: 200,
        html: options.renderDetail(item, {
          entryId: preset === "inbox_message"
            ? inboxEntry ? `inbox:${inboxEntry.entry_id}` : `inbox:${itemId}`
            : itemId,
          inboxActive: inboxEntry
            ? inboxEntry.status === "open" || inboxEntry.status === "in_progress"
            : projected.item_type === "inbox_message",
          inboxEntry,
        }),
      };
    },
    "feed.attention.status": ({ params, request }) => {
      const status = request.body.status;
      const revision = integerRevision(request.body.expected_revision);
      if (!["open", "in_progress", "done", "dismissed"].includes(String(status))) {
        return { status: 400, body: { error: "不支持的 Inbox 状态" } };
      }
      if (revision == null) return { status: 400, body: { error: "请刷新 Inbox 后再操作" } };
      const entry = feed().setInboxEntryStatus(
        options.boardId,
        requireParam(params.entry_id, "Inbox Entry 不存在"),
        status as "open" | "in_progress" | "done" | "dismissed",
        revision,
      );
      changed();
      return { status: 200, body: { entry } };
    },
    "feed.item.action": ({ params, request }) => {
      const itemId = requireParam(params.item_id, "Feed Item 不存在");
      const action = requireParam(params.action, "Feed 动作不存在");
      const store = feed();
      if (action === "read") {
        const item = store.markRead(options.boardId, itemId);
        changed();
        return { status: 200, body: { item } };
      }
      const revision = integerRevision(request.body.expected_revision);
      if (revision == null) return { status: 400, body: { error: "请刷新 Item 后再操作" } };
      if (action === "restore" && request.body.restore_target === "feed") {
        const item = store.restoreToFeed(options.boardId, itemId, revision);
        changed();
        return { status: 200, body: { item } };
      }
      if (["inbox", "save", "archive", "restore"].includes(action)) {
        const disposition = action === "save" ? "saved" : action === "archive" ? "archived" : "inbox";
        const item = store.setDisposition(options.boardId, itemId, disposition, revision);
        changed();
        return { status: 200, body: { item } };
      }
      const result = options.promote(store, { boardId: options.boardId, routePrefix: options.routePrefix,
        itemId, startProcessing: action === "start", expectedRevision: revision });
      changed();
      return { status: 200, body: result };
    },
  };
}
