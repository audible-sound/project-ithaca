import {
  leadLifecycleStatuses,
  leadSourceTypes,
  listLeadsByUser,
  listLeadsWithDetails,
} from "@ithaca/db";
import type { LeadListDetailRow, LeadListRow } from "@ithaca/db";
import {
  leadPriorities,
  workflowStages,
} from "@ithaca/shared";
import type {
  LeadListItem,
  LeadListStage,
  LeadPriority,
  LeadSummary,
  ListLeadListResponse,
  ListLeadsResponse,
} from "@ithaca/shared";
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

function leadPriority(value: string | null): LeadPriority | null {
  if (value === null) {
    return null;
  }

  if (includesValue(leadPriorities, value)) {
    return value;
  }

  throw new Error(`Unexpected lead priority "${value}".`);
}

function leadListStage(row: LeadListDetailRow): LeadListStage {
  if (!includesValue(leadLifecycleStatuses, row.lifecycleStatus)) {
    throw new Error(
      `Unexpected lead lifecycle status "${row.lifecycleStatus}".`,
    );
  }

  if (row.lifecycleStatus === "needs_follow_up") {
    return "follow_up";
  }

  if (row.lifecycleStatus === "closed") {
    return "closed";
  }

  if (row.latestStage !== null) {
    if (includesValue(workflowStages, row.latestStage)) {
      return row.latestStage;
    }

    throw new Error(`Unexpected lead stage "${row.latestStage}".`);
  }

  switch (row.lifecycleStatus) {
    case "new":
      return "not_started";
    case "identified":
      return "identify";
    case "qualified":
      return "qualify";
    case "summarized":
      return "summarize";
    case "outreach_drafted":
      return "draft";
    case "outreach_sent":
      return "follow_up";
    default:
      throw new Error(
        `Unexpected lead lifecycle status "${row.lifecycleStatus}".`,
      );
  }
}

function mapLeadListItem(row: LeadListDetailRow): LeadListItem {
  let score: number | null = null;
  if (row.score !== null) {
    score = Number(row.score);
    if (Number.isNaN(score)) {
      throw new Error(`Unexpected lead score "${row.score}".`);
    }
  }

  return {
    leadId: row.leadId,
    companyName: row.companyName,
    ownerId: row.createdByUserId,
    ownerName: row.ownerName,
    contactName: row.contactName,
    sourceType: leadSourceType(row.sourceType),
    score,
    priority: leadPriority(row.priorityLabel),
    stage: leadListStage(row),
    followUpDue:
      row.lifecycleStatus === "needs_follow_up" ||
      (row.followUpDueAt !== null && row.followUpDueAt <= new Date()),
  };
}

// List leads from all owners for the lead list.
leadsRouter.get("/all", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  try {
    const rows = await listLeadsWithDetails();
    const response: ListLeadListResponse = {
      leads: rows.map(mapLeadListItem),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

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
