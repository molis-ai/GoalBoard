import type { AsyncApplicationMethods } from "@adeptify/goalboard-contracts/platform/app-host";
import type { DraftDialogueApplicationApi } from "@adeptify/goalboard-plugin-goals";

/** Wire conversion only; the application retains validation and transaction ownership. */
export function createCliDraftDialogueHandlers(application: DraftDialogueApplicationApi | AsyncApplicationMethods<DraftDialogueApplicationApi>) {
  return {
    "draft-dialogue-start": async (input: Record<string, unknown>) =>
      application.startDraftDialogue(input as unknown as Parameters<DraftDialogueApplicationApi["startDraftDialogue"]>[0]),
    "draft-dialogue-turn": async (input: Record<string, unknown>) =>
      application.recordDraftDialogueTurn(input as unknown as Parameters<DraftDialogueApplicationApi["recordDraftDialogueTurn"]>[0]),
    "draft-dialogue-resume": async (input: Record<string, unknown>) =>
      application.resumeDraftDialogue(input as unknown as Parameters<DraftDialogueApplicationApi["resumeDraftDialogue"]>[0]),
  };
}
