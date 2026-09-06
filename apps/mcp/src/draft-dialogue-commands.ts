import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { DraftDialogueApplicationApi } from "@adeptify/goalboard-plugin-goals";
import { draftDialogueHistoryOptions, draftDialogueResponse, type McpPresentationErrorFactory } from "./query-presentation.js";

/** Wire conversion only; authority is supplied by the host before dispatch. */
export function createMcpDraftDialogueHandlers(application: DraftDialogueApplicationApi | AsyncApplicationMethods<DraftDialogueApplicationApi>, createError: McpPresentationErrorFactory) {
  return {
    goalboard_v1_draft_dialogue_start: async (args: Record<string, unknown>) =>
      application.startDraftDialogue(args as unknown as Parameters<DraftDialogueApplicationApi["startDraftDialogue"]>[0]),
    goalboard_v1_draft_dialogue_turn: async (args: Record<string, unknown>) => {
      const history = draftDialogueHistoryOptions(args, createError);
      return draftDialogueResponse(await application.recordDraftDialogueTurn(args as unknown as Parameters<DraftDialogueApplicationApi["recordDraftDialogueTurn"]>[0]), history);
    },
    goalboard_v1_draft_dialogue_resume: async (args: Record<string, unknown>) => {
      const history = draftDialogueHistoryOptions(args, createError);
      return draftDialogueResponse(await application.resumeDraftDialogue(args as unknown as Parameters<DraftDialogueApplicationApi["resumeDraftDialogue"]>[0]), history);
    },
  };
}
