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
  updateLeadQualificationOverride,
  updateLeadSummaryOverride,
  updateOutreachDraft,
} from "@ithaca/db";
import { reviseOutreachDraft } from "@ithaca/orchestrator";
import type {
  CreateLeadResponse,
  DeleteLeadResponse,
  EditLeadOutreachResponse,
  EditLeadSummaryResponse,
  LeadDetail,
  ListLeadListResponse,
  ListLeadsResponse,
  OverrideLeadQualificationResponse,
  ReviseLeadOutreachResponse,
  UpdateLeadResponse,
} from "@ithaca/shared";
import { qualificationLabelsForScore } from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import {
  isManualLeadError,
  leadDeletedMessage,
  leadStoredMessage,
  leadUpdatedMessage,
  outreachEditedMessage,
  outreachMissingMessage,
  outreachNotEditableMessage,
  qualificationMissingMessage,
  qualificationOverriddenMessage,
  readManualLead,
  readOutreachEdit,
  readOutreachRevise,
  readQualificationOverride,
  readSummaryEdit,
  summaryEditedMessage,
  summaryMissingMessage,
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

// Replace the suitability score on a qualification owned by the signed-in user.
leadsRouter.put("/:leadId/qualification", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  const override = readQualificationOverride(asRecord(req.body));
  if ("message" in override) {
    res.status(400).json(override);
    return;
  }

  try {
    const labels = qualificationLabelsForScore(override.score);
    const result = await updateLeadQualificationOverride(leadId, userId, {
      score: override.score,
      priorityLabel: labels.priorityLabel,
      fitLabel: labels.fitLabel,
      reason: override.reason,
    });
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result === "not_qualified") {
      res.status(409).json({ message: qualificationMissingMessage });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Qualification was not overridden.");
    }

    const response: OverrideLeadQualificationResponse = {
      message: qualificationOverriddenMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Replace the written summary on a summary owned by the signed-in user.
leadsRouter.put("/:leadId/summary", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  const edit = readSummaryEdit(asRecord(req.body));
  if ("message" in edit) {
    res.status(400).json(edit);
    return;
  }

  try {
    const result = await updateLeadSummaryOverride(leadId, userId, edit);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result === "not_summarized") {
      res.status(409).json({ message: summaryMissingMessage });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Summary was not edited.");
    }

    const response: EditLeadSummaryResponse = {
      message: summaryEditedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Revise the subject and body on an outreach draft owned by the signed-in user.
// Returns the revision. Does not save the draft.
leadsRouter.post("/:leadId/outreach/revise", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  const revise = readOutreachRevise(asRecord(req.body));
  if ("message" in revise) {
    res.status(400).json(revise);
    return;
  }

  try {
    const result = await reviseOutreachDraft({
      leadId,
      userId,
      subject: revise.subject,
      body: revise.body,
      instruction: revise.instruction,
    });
    if (result.status === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result.status === "not_drafted") {
      res.status(409).json({ message: outreachMissingMessage });
      return;
    }
    if (result.status === "not_editable") {
      res.status(409).json({ message: outreachNotEditableMessage });
      return;
    }

    const response: ReviseLeadOutreachResponse = {
      subject: result.subject,
      body: result.body,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Replace the subject and body on an outreach draft owned by the signed-in user.
leadsRouter.put("/:leadId/outreach", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  const edit = readOutreachEdit(asRecord(req.body));
  if ("message" in edit) {
    res.status(400).json(edit);
    return;
  }

  try {
    const result = await updateOutreachDraft(leadId, userId, edit);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result === "not_drafted") {
      res.status(409).json({ message: outreachMissingMessage });
      return;
    }
    if (result === "not_editable") {
      res.status(409).json({ message: outreachNotEditableMessage });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Outreach draft was not edited.");
    }

    const response: EditLeadOutreachResponse = {
      message: outreachEditedMessage,
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
