import type { SqliteDatabase } from "@adeptify/goalboard-storage";
import { createGoalReadServices } from "@adeptify/goalboard-module-goals";
import type { GoalInputBindingsApi } from "@adeptify/goalboard-contracts/modules/goals";
import { promoteFeedItemToGoal, type FeedGoalPromotionInput, type FeedApplication } from "@adeptify/goalboard-plugin-feed";
import type { GoalEventApplication } from "@adeptify/goalboard-plugin-goals";
import { createLocalFeedApplication } from "./feed-application.js";
import { hydrateFeedItemContent } from "./feed-content.js";

export function createLocalFeedGoalPromotion(db: SqliteDatabase,
  createIntent: GoalEventApplication["createIntent"],
  goalInputs: Pick<GoalInputBindingsApi, "register">,
  feed: FeedApplication = createLocalFeedApplication(db),
) {
  const ports = { feed, createIntent, goalInputs, goalQuery: createGoalReadServices(db).query,
    hydrateItem: hydrateFeedItemContent, transaction: <T>(operation: () => T): T => db.transaction(operation).immediate() };
  return (input: FeedGoalPromotionInput) => promoteFeedItemToGoal(ports, input);
}
