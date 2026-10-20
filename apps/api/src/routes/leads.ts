import { leadSourceTypes, listLeadsByUser } from "@ithaca/db";
import type { LeadListRow } from "@ithaca/db";
import type { LeadSummary, ListLeadsResponse } from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";

export const leadsRouter = Router();

function includesValue<T extends string>(
  allowed: readonly T[],
  value: string,
): value is T {
  return allowed.some((item) => item === value);
}

function leadSourceType(value: string): LeadSummary["sourceType"] {
  if (includesValue(leadSourceTypes, value)) {
    return value;
  }

  throw new Error(`Unexpected lead source type "${value}".`);
}

function mapLead(row: LeadListRow): LeadSummary {
  return {
    leadId: row.leadId,
    companyName: row.companyName,
    sourceType: leadSourceType(row.sourceType),
  };
}

// List all leads for the signed in user.
leadsRouter.get("/", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  try {
    const rows = await listLeadsByUser(userId);
    const response: ListLeadsResponse = {
      leads: rows.map(mapLead),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});
