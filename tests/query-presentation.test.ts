import assert from "node:assert/strict";
import test from "node:test";
import { draftDialogueHistoryOptions, draftDialogueResponse, type McpPresentationErrorFactory } from "@adeptify/goalboard-app-mcp";
import { GoalBoardV1Error } from "@adeptify/goalboard-plugin-goals";

const createError: McpPresentationErrorFactory = (code, message, details) => new GoalBoardV1Error(code, message, details);

test("MCP history summary and cursor pages preserve complete turns, metadata and original order", () => {
  const first = { turn_index: 1, turn_id: "first", user_message: "最初的要求" };
  const second = { turn_index: 2, turn_id: "second", user_message: "修正边界" };
  const third = { turn_index: 3, turn_id: "third", user_message: "确认当前理解" };
  const result = {
    dialogue: { session_id: "dialogue", current_understanding: "保留功能" },
    turns: [third, first, second], observed_event_cursor: 42, replayed: true,
    goal: { goal_id: "goal" },
  };
  const before = structuredClone(result);
  const compact = draftDialogueResponse(result, draftDialogueHistoryOptions({}, createError));
  assert.equal(Object.hasOwn(compact, "turns"), false);
  assert.equal(compact.latest_turn, third);
  assert.deepEqual(compact.dialogue, result.dialogue);
  assert.equal(compact.observed_event_cursor, 42);
  assert.equal(compact.replayed, true);
  assert.deepEqual(compact.history, { included: false, returned_count: 0, total_count: 3, has_more: true, next_before_turn_index: 4 });
  const page = draftDialogueResponse(result, draftDialogueHistoryOptions({
    include_history: true, history_limit: 1, history_before_turn_index: 3,
  }, createError));
  assert.deepEqual(page.turns, [second]);
  assert.equal(page.latest_turn, third, "latest checkpoint is not replaced by the older page");
  assert.equal(page.history.next_before_turn_index, 2);
  assert.equal(page.history.has_more, true);
  const last = draftDialogueResponse(result, draftDialogueHistoryOptions({
    include_history: true, history_limit: 1, history_before_turn_index: page.history.next_before_turn_index,
  }, createError));
  assert.deepEqual(last.turns, [first]);
  assert.equal(last.history.has_more, false);
  assert.equal(last.history.next_before_turn_index, null);
  assert.deepEqual(result, before, "sorting and slicing must not mutate the owner's result");
});

test("MCP history preserves host error types, codes, details and established numeric conversion", () => {
  assert.deepEqual(draftDialogueHistoryOptions({ include_history: true, history_limit: "2", history_before_turn_index: "3" }, createError), {
    includeHistory: true, historyLimit: 2, beforeTurnIndex: 3,
  });
  const cases = [
    { input: { history_limit: 2 }, code: "draft_dialogue.history_not_requested", details: { next_action: "set_include_history_true" } },
    { input: { include_history: true, history_limit: 101 }, code: "draft_dialogue.history_limit_invalid",
      details: { field_path: "history_limit", received_value: 101, minimum: 1, maximum: 100 } },
    { input: { include_history: true, history_before_turn_index: 0 }, code: "draft_dialogue.history_cursor_invalid",
      details: { field_path: "history_before_turn_index", received_value: 0, minimum: 1 } },
  ];
  for (const { input, code, details } of cases) {
    assert.throws(() => draftDialogueHistoryOptions(input, createError), (error: unknown) => {
      assert.ok(error instanceof GoalBoardV1Error);
      assert.equal(error.code, code);
      assert.deepEqual(error.details, details);
      return true;
    });
  }
});
