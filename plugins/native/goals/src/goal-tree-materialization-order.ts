import type { GoalsQueryApi } from "@adeptify/goalboard-contracts/modules/goals";
import type { GoalTreeProposalItemRecord } from "@adeptify/goalboard-contracts/modules/governance-collaboration";

/** Parent closure consumes the real child relations created in the same transaction.
 * Validation still runs when each item is applied; ordering never grants approval.
 */
export function goalTreeMaterializationGroups(
  boardId: string,
  items: readonly GoalTreeProposalItemRecord[],
  goals: Pick<GoalsQueryApi, "getGoal">,
): GoalTreeProposalItemRecord[][] {
  const groups: GoalTreeProposalItemRecord[][] = [[], [], [], []];
  for (const item of items) {
    if (item.kind === "goal" || item.kind === "contract" || item.kind === "candidate") {
      const payload = item.payload;
      const raw = payload.goal ?? payload.proposed_goal ?? payload;
      const record = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw as Record<string, unknown> : null;
      const closesAcceptedParent = item.kind !== "candidate" && item.operation === "update" &&
        record?.decomposition_state === "closed_compound" &&
        goals.getGoal(boardId, String(payload.goal_id ?? record.goal_id ?? "").trim())?.definition_state === "accepted";
      groups[closesAcceptedParent ? 3 : 0]!.push(item);
    } else if (item.kind === "policy" || item.kind === "risk") {
      groups[1]!.push(item);
    } else {
      groups[2]!.push(item);
    }
  }
  return groups;
}
