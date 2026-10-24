import {
  findLatestOutreachByLeadId,
  findLeadDetailById,
  listLeadsByUser,
  listLeadsWithDetails,
  listSourceReferencesByLeadId,
  listWorkflowRunLeadsByLeadId,
} from "@ithaca/db";
import type {
  LeadDetail,
  ListLeadListResponse,
  ListLeadsResponse,
} from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import { mapLead, mapLeadDetail, mapLeadListItem } from "../lib/mapLead.js";
import { isUuid } from "../lib/parse.js";

export const leadsRouter = Router();

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

// Get lead detail by ID.
leadsRouter.get("/:leadId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json({ message: "Lead not found." });
    return;
  }

  try {
    const row = await findLeadDetailById(leadId);
    if (!row) {
      res.status(404).json({ message: "Lead not found." });
      return;
    }

    const [sources, runLeads, outreachRow] = await Promise.all([
      listSourceReferencesByLeadId(row.leadId, row.companyId, row.primaryContactId),
      listWorkflowRunLeadsByLeadId(row.leadId),
      findLatestOutreachByLeadId(row.leadId),
    ]);

    const response: LeadDetail = mapLeadDetail({ row, sources, runLeads, outreachRow });
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
