import {
  deleteLead,
  findLatestOutreachByLeadId,
  findLeadDetailById,
  insertManualLead,
  listLeadsByUser,
  listLeadsWithDetails,
  listSourceReferencesByLeadId,
  listWorkflowRunLeadsByLeadId,
  updateLeadFacts,
} from "@ithaca/db";
import type {
  CreateLeadResponse,
  DeleteLeadResponse,
  LeadDetail,
  ListLeadListResponse,
  ListLeadsResponse,
  UpdateLeadResponse,
} from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import {
  isManualLeadError,
  leadDeletedMessage,
  leadStoredMessage,
  leadUpdatedMessage,
  readManualLead,
} from "../lib/leadInput.js";
import { mapLead, mapLeadDetail, mapLeadListItem } from "../lib/mapLead.js";
import { asRecord, isUuid } from "../lib/parse.js";

export const leadsRouter = Router();

const leadNotFound = { message: "Lead not found." };

async function storedLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const row = await findLeadDetailById(leadId);
  if (!row) {
    return null;
  }

  const [sources, runLeads, outreachRow] = await Promise.all([
    listSourceReferencesByLeadId(row.leadId, row.companyId, row.primaryContactId),
    listWorkflowRunLeadsByLeadId(row.leadId),
    findLatestOutreachByLeadId(row.leadId),
  ]);

  return mapLeadDetail({ row, sources, runLeads, outreachRow });
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

// Get lead detail by ID.
leadsRouter.get("/:leadId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  try {
    const response = await storedLeadDetail(leadId);
    if (!response) {
      res.status(404).json(leadNotFound);
      return;
    }

    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Store a lead entered by the signed-in user.
leadsRouter.post("/", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const facts = readManualLead(asRecord(req.body));
  if (isManualLeadError(facts)) {
    res.status(400).json(facts);
    return;
  }

  try {
    const leadId = await insertManualLead(userId, facts);
    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Lead was not created.");
    }

    const response: CreateLeadResponse = {
      message: leadStoredMessage,
      lead,
    };
    res.status(201).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Replace company and contact facts on a lead owned by the signed-in user.
leadsRouter.put("/:leadId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  const facts = readManualLead(asRecord(req.body));
  if (isManualLeadError(facts)) {
    res.status(400).json(facts);
    return;
  }

  try {
    const updatedId = await updateLeadFacts(leadId, userId, facts);
    if (!updatedId) {
      res.status(404).json(leadNotFound);
      return;
    }

    const lead = await storedLeadDetail(updatedId);
    if (!lead) {
      throw new Error("Lead was not updated.");
    }

    const response: UpdateLeadResponse = {
      message: leadUpdatedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Soft-delete a lead owned by the signed-in user.
leadsRouter.delete("/:leadId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  try {
    const deleted = await deleteLead(leadId, userId);
    if (!deleted) {
      res.status(404).json(leadNotFound);
      return;
    }

    const response: DeleteLeadResponse = {
      message: leadDeletedMessage,
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
