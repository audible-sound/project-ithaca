import {
  approveOutreachDraft,
  closeLeadFollowUp,
  failOutreachDraftSend,
  completeOutreachDraftSend,
  deleteLead,
  findLatestOutreachByLeadId,
  findLeadDetailById,
  insertManualLead,
  listLeadsByUser,
  listLeadsWithDetails,
  listSourceReferencesByLeadId,
  listWorkflowRunLeadsByLeadId,
  logLeadFollowUp,
  markOutreachDraftDone,
  prepareOutreachDraftSend,
  recordLeadFollowUpReply,
  rejectOutreachDraft,
  snoozeLeadFollowUp,
  updateLeadFacts,
  updateLeadQualificationOverride,
  updateLeadSummaryOverride,
  updateOutreachDraft,
} from "@ithaca/db";
import { sendEmail } from "@ithaca/email";
import { reviseOutreachDraft } from "@ithaca/orchestrator";
import type {
  ApproveLeadOutreachResponse,
  CloseLeadFollowUpResponse,
  CreateLeadResponse,
  DeleteLeadResponse,
  DoneLeadOutreachResponse,
  EditLeadOutreachResponse,
  EditLeadSummaryResponse,
  LeadDetail,
  ListLeadListResponse,
  ListLeadsResponse,
  LogLeadFollowUpResponse,
  OverrideLeadQualificationResponse,
  RecordLeadFollowUpReplyResponse,
  RejectLeadOutreachResponse,
  ReviseLeadOutreachResponse,
  SendLeadOutreachResponse,
  SnoozeLeadFollowUpResponse,
  UpdateLeadResponse,
} from "@ithaca/shared";
import { qualificationLabelsForScore } from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import {
  followUpAlreadyRepliedMessage,
  followUpClosedMessage,
  followUpLeadClosedMessage,
  followUpLoggedMessage,
  followUpReplyRecordedMessage,
  followUpSnoozedMessage,
  followUpUnavailableMessage,
  isManualLeadError,
  leadDeletedMessage,
  leadStoredMessage,
  leadUpdatedMessage,
  outreachAlreadyDoneMessage,
  outreachAlreadySentMessage,
  outreachApprovedMessage,
  outreachDoneMessage,
  outreachEditedMessage,
  outreachMissingDoneMessage,
  outreachMissingMessage,
  outreachMissingReviewMessage,
  outreachMissingSendMessage,
  outreachNotApprovedMessage,
  outreachNotEditableMessage,
  outreachNotReviewableMessage,
  outreachRecipientRequiredMessage,
  outreachRejectedMessage,
  outreachRequiredMessage,
  outreachSentMessage,
  qualificationMissingMessage,
  qualificationOverriddenMessage,
  readCloseReason,
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

// Approve an outreach draft owned by the signed-in user. Does not send mail.
leadsRouter.post("/:leadId/outreach/approve", async (req, res) => {
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
    const result = await approveOutreachDraft(leadId, userId);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result === "not_drafted") {
      res.status(409).json({ message: outreachMissingReviewMessage });
      return;
    }
    if (result === "not_reviewable") {
      res.status(409).json({ message: outreachNotReviewableMessage });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Outreach draft was not approved.");
    }

    const response: ApproveLeadOutreachResponse = {
      message: outreachApprovedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Reject an outreach draft owned by the signed-in user. Does not send mail.
leadsRouter.post("/:leadId/outreach/reject", async (req, res) => {
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
    const result = await rejectOutreachDraft(leadId, userId);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result === "not_drafted") {
      res.status(409).json({ message: outreachMissingReviewMessage });
      return;
    }
    if (result === "not_reviewable") {
      res.status(409).json({ message: outreachNotReviewableMessage });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Outreach draft was not rejected.");
    }

    const response: RejectLeadOutreachResponse = {
      message: outreachRejectedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Send an approved outreach draft owned by the signed-in user through SMTP.
leadsRouter.post("/:leadId/outreach/send", async (req, res) => {
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
    const prepared = await prepareOutreachDraftSend(leadId, userId);
    if (prepared.status === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (prepared.status === "not_drafted") {
      res.status(409).json({ message: outreachMissingSendMessage });
      return;
    }
    if (prepared.status === "not_approved") {
      res.status(409).json({ message: outreachNotApprovedMessage });
      return;
    }
    if (prepared.status === "already_sent") {
      res.status(409).json({ message: outreachAlreadySentMessage });
      return;
    }
    if (prepared.status === "already_done") {
      res.status(409).json({ message: outreachAlreadyDoneMessage });
      return;
    }
    if (prepared.status === "blank_message") {
      res.status(409).json({ message: outreachRequiredMessage });
      return;
    }
    if (prepared.status === "no_recipient") {
      res.status(409).json({ message: outreachRecipientRequiredMessage });
      return;
    }

    let mailResult;
    try {
      mailResult = await sendEmail({
        to: prepared.contactEmail,
        subject: prepared.subject,
        body: prepared.body,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "SMTP send failed.";
      await failOutreachDraftSend(prepared.emailDeliveryId, message);
      throw err;
    }

    if (mailResult.status !== "sent") {
      const message = mailResult.errorMessage ?? "SMTP send failed.";
      await failOutreachDraftSend(prepared.emailDeliveryId, message);
      res.status(502).json({
        message,
      });
      return;
    }

    const completed = await completeOutreachDraftSend(
      leadId,
      userId,
      prepared.emailDeliveryId,
      mailResult.providerMessageId,
    );
    if (completed === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Outreach message was not sent.");
    }

    const response: SendLeadOutreachResponse = {
      message: outreachSentMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Mark an approved outreach draft done without sending mail.
leadsRouter.post("/:leadId/outreach/done", async (req, res) => {
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
    const result = await markOutreachDraftDone(leadId, userId);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result === "not_drafted") {
      res.status(409).json({ message: outreachMissingDoneMessage });
      return;
    }
    if (result === "not_approved") {
      res.status(409).json({ message: outreachNotApprovedMessage });
      return;
    }
    if (result === "already_sent") {
      res.status(409).json({ message: outreachAlreadySentMessage });
      return;
    }
    if (result === "already_done") {
      res.status(409).json({ message: outreachAlreadyDoneMessage });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Outreach draft was not marked done.");
    }

    const response: DoneLeadOutreachResponse = {
      message: outreachDoneMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

function followUpConflictMessage(
  result: "no_delivery" | "closed" | "replied",
): string {
  if (result === "no_delivery") {
    return followUpUnavailableMessage;
  }
  if (result === "closed") {
    return followUpClosedMessage;
  }
  return followUpAlreadyRepliedMessage;
}

// Snooze the follow-up due date five calendar days for an owned send or Done delivery.
leadsRouter.post("/:leadId/follow-up/snooze", async (req, res) => {
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
    const result = await snoozeLeadFollowUp(leadId, userId);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result !== "updated") {
      res.status(409).json({ message: followUpConflictMessage(result) });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Follow-up was not snoozed.");
    }

    const response: SnoozeLeadFollowUpResponse = {
      message: followUpSnoozedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Log a follow-up and schedule the next due date five calendar days out.
leadsRouter.post("/:leadId/follow-up/log", async (req, res) => {
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
    const result = await logLeadFollowUp(leadId, userId);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result !== "updated") {
      res.status(409).json({ message: followUpConflictMessage(result) });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Follow-up was not logged.");
    }

    const response: LogLeadFollowUpResponse = {
      message: followUpLoggedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Record a reply on an owned send or Done delivery.
leadsRouter.post("/:leadId/follow-up/replied", async (req, res) => {
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
    const result = await recordLeadFollowUpReply(leadId, userId);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result !== "updated") {
      res.status(409).json({ message: followUpConflictMessage(result) });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Lead reply was not recorded.");
    }

    const response: RecordLeadFollowUpReplyResponse = {
      message: followUpReplyRecordedMessage,
      lead,
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Close an owned lead after a send or Done delivery. Optional reason.
leadsRouter.post("/:leadId/follow-up/close", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const leadId = req.params.leadId;
  if (!leadId || !isUuid(leadId)) {
    res.status(404).json(leadNotFound);
    return;
  }

  const reason = readCloseReason(asRecord(req.body));
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    res.status(400).json(reason);
    return;
  }

  try {
    const result = await closeLeadFollowUp(leadId, userId, reason);
    if (result === "not_found") {
      res.status(404).json(leadNotFound);
      return;
    }
    if (result !== "updated") {
      res.status(409).json({ message: followUpConflictMessage(result) });
      return;
    }

    const lead = await storedLeadDetail(leadId);
    if (!lead) {
      throw new Error("Lead was not closed.");
    }

    const response: CloseLeadFollowUpResponse = {
      message: followUpLeadClosedMessage,
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
