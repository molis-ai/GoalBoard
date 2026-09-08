import { randomUUID } from "node:crypto";
import type { GoalsHttpContext } from "./types.js";
import type { RiskRecord } from "@adeptify/goalboard-contracts/modules/goals";
import { webRiskFacts, webImpactFacts } from "./input.js";

export async function handleGoalRiskImpactHttp(context: GoalsHttpContext): Promise<boolean> {
  const goalRiskMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/risks$/);
  if (context.method === "POST" && goalRiskMatch) {
    const body = await context.readBody();
    const reason = String(body.reason ?? "").trim();
    try {
      if (!reason) throw new Error("Risk 必须填写登记原因");
      const result = context.commands.addRisk(
        context.options.boardId,
        webRiskFacts(body, decodeURIComponent(goalRiskMatch[1])),
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-risk-${randomUUID()}`),
          reason,
        },
      );
      context.respond( 201, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const riskUpdateMatch = context.pathname.match(/^\/api\/risks\/([^/]+)\/update$/);
  if (context.method === "POST" && riskUpdateMatch) {
    const body = await context.readBody();
    const reason = String(body.reason ?? "").trim();
    try {
      const result = context.commands.updateRisk(
        context.options.boardId,
        {
          risk_id: decodeURIComponent(riskUpdateMatch[1]),
          ...webRiskFacts(body),
        },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-risk-update-${randomUUID()}`),
          reason,
        },
      );
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const riskStateMatch = context.pathname.match(/^\/api\/risks\/([^/]+)\/state$/);
  if (context.method === "POST" && riskStateMatch) {
    const body = await context.readBody();
    const requestedState = String(body.state ?? "");
    const state = requestedState as RiskRecord["state"];
    const reason = String(body.reason ?? "").trim();
    const rawResolutionBasis = body.resolution_basis && typeof body.resolution_basis === "object" && !Array.isArray(body.resolution_basis)
      ? body.resolution_basis as Record<string, unknown>
      : null;
    try {
      const riskId = decodeURIComponent(riskStateMatch[1]);
      const idempotencyKey = String(body.idempotency_key ?? `web-risk-state-${randomUUID()}`);
      if (requestedState === "rejected") {
        const snapshot = context.snapshot();
        const currentRisk = snapshot.risks.find((risk) => risk.risk_id === riskId);
        if (!currentRisk) throw new Error("找不到这条 Risk");
        const goalIds = snapshot.goal_risks
          .filter((link) => link.risk_id === riskId)
          .map((link) => link.goal_id);
        const result = context.commands.updateRisk(
          context.options.boardId,
          {
            risk_id: riskId,
            goal_ids: goalIds,
            description: currentRisk.description,
            probability: currentRisk.probability,
            impact: currentRisk.impact,
            affected_surfaces: currentRisk.affected_surfaces,
            trigger: currentRisk.trigger,
            treatment: "mitigate",
            treatment_plan: currentRisk.treatment_plan || reason,
            blocking_mode: currentRisk.blocking_mode,
            revisit_condition: currentRisk.revisit_condition,
            owner: currentRisk.owner,
            action_goal_id: typeof body.goal_id === "string" ? body.goal_id : undefined,
            contract_revision: Number.isInteger(body.contract_revision) ? Number(body.contract_revision) : undefined,
            action_id: typeof body.action_id === "string" ? body.action_id : undefined,
            action_token: typeof body.action_token === "string" ? body.action_token : undefined,
          },
          { actor_id: "web-user", actor_kind: "user", idempotency_key: idempotencyKey, reason },
        );
        context.respond( 200, { ...result, decision: "rejected" });
      } else {
        const result = context.commands.setRiskState(
          context.options.boardId,
          {
            risk_id: riskId,
            state,
            reason,
            goal_id: typeof body.goal_id === "string" ? body.goal_id : undefined,
            contract_revision: Number.isInteger(body.contract_revision) ? Number(body.contract_revision) : undefined,
            action_id: typeof body.action_id === "string" ? body.action_id : undefined,
            action_token: typeof body.action_token === "string" ? body.action_token : undefined,
            ...(rawResolutionBasis == null
              ? {}
              : {
                  resolution_basis: {
                    summary: String(rawResolutionBasis.summary ?? ""),
                    evidence_refs: Array.isArray(rawResolutionBasis.evidence_refs)
                      ? rawResolutionBasis.evidence_refs.map(String)
                      : [],
                    residual_gaps: Array.isArray(rawResolutionBasis.residual_gaps)
                      ? rawResolutionBasis.residual_gaps.map(String)
                      : [],
                  },
                }),
          },
          { actor_id: "web-user", actor_kind: "user", idempotency_key: idempotencyKey },
        );
        context.respond( 200, result);
      }
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const goalImpactMatch = context.pathname.match(/^\/api\/goals\/([^/]+)\/impacts$/);
  if (context.method === "POST" && goalImpactMatch) {
    const body = await context.readBody();
    try {
      const result = context.impacts.add(
        context.options.boardId,
        webImpactFacts(body, decodeURIComponent(goalImpactMatch[1])),
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-impact-${randomUUID()}`),
        },
      );
      context.respond( 201, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const impactUpdateMatch = context.pathname.match(/^\/api\/impacts\/([^/]+)\/update$/);
  if (context.method === "POST" && impactUpdateMatch) {
    const body = await context.readBody();
    try {
      const result = context.impacts.update(
        context.options.boardId,
        {
          binding_id: decodeURIComponent(impactUpdateMatch[1]),
          ...webImpactFacts(body),
        },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-impact-update-${randomUUID()}`),
          reason: String(body.audit_reason ?? "").trim(),
        },
      );
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  const impactDeactivateMatch = context.pathname.match(/^\/api\/impacts\/([^/]+)\/deactivate$/);
  if (context.method === "POST" && impactDeactivateMatch) {
    const body = await context.readBody();
    try {
      const result = context.impacts.deactivate(
        context.options.boardId,
        {
          binding_id: decodeURIComponent(impactDeactivateMatch[1]),
          reason: String(body.reason ?? "").trim(),
        },
        {
          actor_id: "web-user",
          idempotency_key: String(body.idempotency_key ?? `web-impact-deactivate-${randomUUID()}`),
        },
      );
      context.respond( 200, result);
    } catch (error) {
      context.respond( 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
  return false;
}
