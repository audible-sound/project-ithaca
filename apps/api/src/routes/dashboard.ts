import {
  listLeadsWithDetails,
  listTokenUsageByWorkflowRunIds,
} from "@ithaca/db";
import type { DashboardResponse } from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import { mapDashboardLead } from "../lib/mapLead.js";

export const dashboardRouter = Router();

// Desk facts for the home dashboard. Any signed-in user sees every owner.
dashboardRouter.get("/", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  try {
    const rows = await listLeadsWithDetails();
    const leads = rows.map(mapDashboardLead);
    const workflowRunIds = [
      ...new Set(
        leads
          .map((lead) => lead.workflowRunId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const usageRows = await listTokenUsageByWorkflowRunIds(workflowRunIds);
    const response: DashboardResponse = {
      leads,
      usage: usageRows.map((row) => {
        const estimatedCost = Number(row.estimatedCost);
        return {
          workflowRunId: row.workflowRunId,
          promptTokens: row.promptTokens,
          completionTokens: row.completionTokens,
          estimatedCost: Number.isNaN(estimatedCost) ? 0 : estimatedCost,
        };
      }),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});
