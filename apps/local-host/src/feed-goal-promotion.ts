import type { SqliteDatabase } from "@adeptify/goalboard-storage";
import { createGoalReadServices } from "@adeptify/goalboard-module-goals";
import type { GoalsCommandApi, GoalInputBindingsApi } from "@adeptify/goalboard-contracts/modules/goals";
import { promoteFeedItemToGoal, type FeedGoalPromotionInput, type FeedApplication } from "@adeptify/goalboard-plugin-feed";
import { createLocalFeedApplication } from "./feed-application.js";
import { hydrateFeedItemContent } from "./feed-content.js";

export function createLocalFeedGoalPromotion(db: SqliteDatabase,
  goalCommands: Pick<GoalsCommandApi, "createGoal">,
  goalInputs: Pick<GoalInputBindingsApi, "register">,
  feed: FeedApplication = createLocalFeedApplication(db),
) {
  const ports = { feed, goalCommands, goalInputs, goalQuery: createGoalReadServices(db).query,
    hydrateItem: hydrateFeedItemContent, transaction: <T>(operation: () => T): T => db.transaction(operation).immediate() };
  return (input: FeedGoalPromotionInput) => promoteFeedItemToGoal(ports, input);
}
