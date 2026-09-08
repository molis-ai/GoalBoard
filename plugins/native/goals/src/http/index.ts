import type { GoalsHttpContext } from "./types.js";
import { handleGoalCreateHttp } from "./create.js";
import { handleGoalDraftHttp } from "./draft.js";
import { handleGoalRelationsHttp } from "./relations.js";
import { handleGoalRiskImpactHttp } from "./risk-impact.js";
import { handleGoalPolicyGuidanceHttp } from "./policy-guidance.js";
import { handleGoalVerificationHttp } from "./verification.js";
import { handleGoalLifecycleHttp } from "./lifecycle.js";
import { handleGoalDecisionsHttp } from "./decisions.js";

export async function handleGoalsWebHttp(context: GoalsHttpContext): Promise<boolean> {
  return await handleGoalCreateHttp(context)
    || await handleGoalDraftHttp(context)
    || await handleGoalRelationsHttp(context)
    || await handleGoalRiskImpactHttp(context)
    || await handleGoalPolicyGuidanceHttp(context)
    || await handleGoalVerificationHttp(context)
    || await handleGoalLifecycleHttp(context)
    || await handleGoalDecisionsHttp(context);
}
