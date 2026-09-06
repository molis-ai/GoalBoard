/** Legacy root SDK name; all implementation and production composition live in Local Host. */
export { GoalProjectApplication as GoalBoardCoordinator } from "@adeptify/goalboard-app-local-host";
export { GoalBoardV1Error, projectGoalLifecycle } from "@adeptify/goalboard-plugin-goals";
export type {
  ExplainGoalResult, ReadyQuery, ReadyQueryResult, AvailableQuery, AvailableQueryResult,
  GoalTreeProposalListQuery, GoalTreeProposalListResult, GoalTreeProposalCheckResult,
  GoalTreeProposalDecisionResult, GoalTreeSemanticReview, ClaimReleaseHandoff, ClaimReleaseResult,
  ReportRunResult as RunReportResult,
} from "@adeptify/goalboard-plugin-goals";
export type { GoalBoardDatabase } from "@adeptify/goalboard-app-local-host";
