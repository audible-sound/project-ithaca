import { and, desc, eq, isNull, notInArray } from "drizzle-orm";
import { requireDb } from "../client.js";
import { contacts, leads } from "../schema/leads.js";
import { emailDeliveries, outreachDrafts } from "../schema/outreach.js";
import { workflowRunLeads } from "../schema/workflows.js";

export type LatestOutreachRow = {
  outreachDraftId: string;
  leadId: string;
  workflowRunId: string;
  subject: string | null;
  body: string | null;
  generatedSubject: string | null;
  generatedBody: string | null;
  status: string;
  isUserEdited: boolean;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  deliveryStatus: string | null;
  sentAt: Date | null;
  repliedAt: Date | null;
  followUpDueAt: Date | null;
};

export type OutreachDraftInsert = {
  leadId: string;
  workflowRunId: string;
  subject: string;
  body: string;
};

export type OutreachDraftEdit = {
  subject: string;
  body: string;
};

export type OutreachDraftUpdateResult =
  | "updated"
  | "not_found"
  | "not_drafted"
  | "not_editable";

export type OutreachDraftDecisionResult =
  | "updated"
  | "not_found"
  | "not_drafted"
  | "not_reviewable";

export type OutreachDraftSendPrepareResult =
  | {
      status: "queued";
      emailDeliveryId: string;
      subject: string;
      body: string;
      contactEmail: string;
    }
  | { status: "not_found" }
  | { status: "not_drafted" }
  | { status: "not_approved" }
  | { status: "already_sent" }
  | { status: "already_done" }
  | { status: "no_recipient" }
  | { status: "blank_message" };

export type OutreachDraftSendCompleteResult =
  | "updated"
  | "not_found";

export type OutreachDraftDoneResult =
  | "updated"
  | "not_found"
  | "not_drafted"
  | "not_approved"
  | "already_sent"
  | "already_done";

const preservedLifecycleStatuses = [
  "outreach_sent",
  "needs_follow_up",
  "closed",
] as const;

const editableDraftStatuses = ["draft", "edited", "rejected"] as const;
const reviewableDraftStatuses = [
  "draft",
  "edited",
  "approved",
  "rejected",
] as const;

export async function findLatestOutreachByLeadId(
  leadId: string,
): Promise<LatestOutreachRow | null> {
  const rows = await requireDb()
    .select({
      outreachDraftId: outreachDrafts.outreachDraftId,
      leadId: outreachDrafts.leadId,
      workflowRunId: outreachDrafts.workflowRunId,
      subject: outreachDrafts.subject,
      body: outreachDrafts.body,
      generatedSubject: outreachDrafts.generatedSubject,
      generatedBody: outreachDrafts.generatedBody,
      status: outreachDrafts.status,
      isUserEdited: outreachDrafts.isUserEdited,
      approvedAt: outreachDrafts.approvedAt,
      rejectedAt: outreachDrafts.rejectedAt,
      createdAt: outreachDrafts.createdAt,
      updatedAt: outreachDrafts.updatedAt,
      deliveryStatus: emailDeliveries.deliveryStatus,
      sentAt: emailDeliveries.sentAt,
      repliedAt: emailDeliveries.repliedAt,
      followUpDueAt: emailDeliveries.followUpDueAt,
    })
    .from(outreachDrafts)
    .leftJoin(
      emailDeliveries,
      eq(emailDeliveries.outreachDraftId, outreachDrafts.outreachDraftId),
    )
    .where(eq(outreachDrafts.leadId, leadId))
    .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Saves one unapproved outreach draft for a lead.
 * Does not create an email delivery. Leaves a lead that was already sent,
 * needs follow-up, or is closed unchanged.
 * @param draft - Subject and body for one lead in a workflow run.
 */
export async function insertOutreachDraft(
  draft: OutreachDraftInsert,
): Promise<void> {
  const now = new Date();

  await requireDb().transaction(async (tx) => {
    await tx.insert(outreachDrafts).values({
      leadId: draft.leadId,
      workflowRunId: draft.workflowRunId,
      subject: draft.subject,
      body: draft.body,
      generatedSubject: draft.subject,
      generatedBody: draft.body,
      status: "draft",
      isUserEdited: false,
      approvedByUserId: null,
      approvedAt: null,
      rejectedByUserId: null,
      rejectedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await tx
      .update(leads)
      .set({ lifecycleStatus: "outreach_drafted", updatedAt: now })
      .where(
        and(
          eq(leads.leadId, draft.leadId),
          notInArray(leads.lifecycleStatus, [...preservedLifecycleStatuses]),
        ),
      );
  });
}

/**
 * Replaces the subject and body on the latest editable draft for a lead
 * owned by the user. Clears the decision. On the first edit of a row with
 * no generated text, copies the current subject and body into the
 * generated columns.
 * @param leadId - The lead whose draft is edited.
 * @param userId - The user who must own the lead.
 * @param edit - The subject and body, already trimmed.
 * @returns Whether the row was updated, the lead is missing, it has no draft,
 *   or the latest draft cannot be edited.
 */
export async function updateOutreachDraft(
  leadId: string,
  userId: string,
  edit: OutreachDraftEdit,
): Promise<OutreachDraftUpdateResult> {
  const now = new Date();

  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select({ leadId: leads.leadId })
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0] === undefined) {
      return "not_found";
    }

    const current = await tx
      .select({
        outreachDraftId: outreachDrafts.outreachDraftId,
        subject: outreachDrafts.subject,
        body: outreachDrafts.body,
        generatedSubject: outreachDrafts.generatedSubject,
        generatedBody: outreachDrafts.generatedBody,
        status: outreachDrafts.status,
      })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
      .limit(1);

    const draft = current[0];
    if (draft === undefined) {
      return "not_drafted";
    }

    if (
      !editableDraftStatuses.includes(
        draft.status as (typeof editableDraftStatuses)[number],
      )
    ) {
      return "not_editable";
    }

    const generatedSubject =
      draft.generatedSubject ?? draft.subject ?? edit.subject;
    const generatedBody = draft.generatedBody ?? draft.body ?? edit.body;

    const rows = await tx
      .update(outreachDrafts)
      .set({
        subject: edit.subject,
        body: edit.body,
        generatedSubject,
        generatedBody,
        status: "edited",
        isUserEdited: true,
        approvedByUserId: null,
        approvedAt: null,
        rejectedByUserId: null,
        rejectedAt: null,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.outreachDraftId, draft.outreachDraftId))
      .returning({ outreachDraftId: outreachDrafts.outreachDraftId });

    if (rows[0] === undefined) {
      return "not_drafted";
    }

    return "updated";
  });
}

/**
 * Approves the latest reviewable draft for a lead owned by the user.
 * Clears any prior rejection.
 */
export async function approveOutreachDraft(
  leadId: string,
  userId: string,
): Promise<OutreachDraftDecisionResult> {
  const now = new Date();

  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select({ leadId: leads.leadId })
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0] === undefined) {
      return "not_found";
    }

    const current = await tx
      .select({
        outreachDraftId: outreachDrafts.outreachDraftId,
        status: outreachDrafts.status,
      })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
      .limit(1);

    const draft = current[0];
    if (draft === undefined) {
      return "not_drafted";
    }

    if (
      !reviewableDraftStatuses.includes(
        draft.status as (typeof reviewableDraftStatuses)[number],
      )
    ) {
      return "not_reviewable";
    }

    const rows = await tx
      .update(outreachDrafts)
      .set({
        status: "approved",
        approvedByUserId: userId,
        approvedAt: now,
        rejectedByUserId: null,
        rejectedAt: null,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.outreachDraftId, draft.outreachDraftId))
      .returning({ outreachDraftId: outreachDrafts.outreachDraftId });

    if (rows[0] === undefined) {
      return "not_drafted";
    }

    return "updated";
  });
}

/**
 * Rejects the latest reviewable draft for a lead owned by the user.
 * Clears any prior approval.
 */
export async function rejectOutreachDraft(
  leadId: string,
  userId: string,
): Promise<OutreachDraftDecisionResult> {
  const now = new Date();

  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select({ leadId: leads.leadId })
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0] === undefined) {
      return "not_found";
    }

    const current = await tx
      .select({
        outreachDraftId: outreachDrafts.outreachDraftId,
        status: outreachDrafts.status,
      })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
      .limit(1);

    const draft = current[0];
    if (draft === undefined) {
      return "not_drafted";
    }

    if (
      !reviewableDraftStatuses.includes(
        draft.status as (typeof reviewableDraftStatuses)[number],
      )
    ) {
      return "not_reviewable";
    }

    const rows = await tx
      .update(outreachDrafts)
      .set({
        status: "rejected",
        rejectedByUserId: userId,
        rejectedAt: now,
        approvedByUserId: null,
        approvedAt: null,
        updatedAt: now,
      })
      .where(eq(outreachDrafts.outreachDraftId, draft.outreachDraftId))
      .returning({ outreachDraftId: outreachDrafts.outreachDraftId });

    if (rows[0] === undefined) {
      return "not_drafted";
    }

    return "updated";
  });
}

/**
 * Queues a delivery for the latest approved draft owned by the user.
 * The caller sends the mail, then completes or cancels this queue.
 */
export async function prepareOutreachDraftSend(
  leadId: string,
  userId: string,
): Promise<OutreachDraftSendPrepareResult> {
  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select({
        leadId: leads.leadId,
        primaryContactId: leads.primaryContactId,
      })
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    const lead = existing[0];
    if (lead === undefined) {
      return { status: "not_found" };
    }

    const current = await tx
      .select({
        outreachDraftId: outreachDrafts.outreachDraftId,
        subject: outreachDrafts.subject,
        body: outreachDrafts.body,
        status: outreachDrafts.status,
        deliveryStatus: emailDeliveries.deliveryStatus,
      })
      .from(outreachDrafts)
      .leftJoin(
        emailDeliveries,
        eq(emailDeliveries.outreachDraftId, outreachDrafts.outreachDraftId),
      )
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
      .limit(1);

    const draft = current[0];
    if (draft === undefined) {
      return { status: "not_drafted" };
    }

    if (draft.status === "sent") {
      if (draft.deliveryStatus !== null) {
        return { status: "already_sent" };
      }
      return { status: "already_done" };
    }

    if (draft.status !== "approved") {
      return { status: "not_approved" };
    }

    const subject = draft.subject?.trim() ?? "";
    const body = draft.body?.trim() ?? "";
    if (subject.length === 0 || body.length === 0) {
      return { status: "blank_message" };
    }

    if (lead.primaryContactId === null) {
      return { status: "no_recipient" };
    }

    const contactRows = await tx
      .select({ email: contacts.email })
      .from(contacts)
      .where(eq(contacts.contactId, lead.primaryContactId))
      .limit(1);

    const contactEmail = contactRows[0]?.email?.trim() ?? "";
    if (contactEmail.length === 0) {
      return { status: "no_recipient" };
    }

    const deliveryRows = await tx
      .insert(emailDeliveries)
      .values({
        outreachDraftId: draft.outreachDraftId,
        provider: "gmail",
        providerMessageId: null,
        deliveryStatus: "queued",
        errorMessage: null,
        sentAt: null,
        openedAt: null,
        repliedAt: null,
        followUpDueAt: null,
      })
      .returning({ emailDeliveryId: emailDeliveries.emailDeliveryId });

    const delivery = deliveryRows[0];
    if (delivery === undefined) {
      return { status: "not_drafted" };
    }

    return {
      status: "queued",
      emailDeliveryId: delivery.emailDeliveryId,
      subject,
      body,
      contactEmail,
    };
  });
}

/**
 * Marks a queued delivery as sent and advances the draft and lead.
 */
export async function completeOutreachDraftSend(
  leadId: string,
  userId: string,
  emailDeliveryId: string,
  providerMessageId: string | undefined,
): Promise<OutreachDraftSendCompleteResult> {
  const now = new Date();

  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select({ leadId: leads.leadId })
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0] === undefined) {
      return "not_found";
    }

    const current = await tx
      .select({
        outreachDraftId: outreachDrafts.outreachDraftId,
        workflowRunId: outreachDrafts.workflowRunId,
        status: outreachDrafts.status,
      })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
      .limit(1);

    const draft = current[0];
    if (draft === undefined) {
      return "not_found";
    }

    const deliveryRows = await tx
      .update(emailDeliveries)
      .set({
        deliveryStatus: "sent",
        providerMessageId: providerMessageId ?? null,
        sentAt: now,
        errorMessage: null,
      })
      .where(
        and(
          eq(emailDeliveries.emailDeliveryId, emailDeliveryId),
          eq(emailDeliveries.outreachDraftId, draft.outreachDraftId),
        ),
      )
      .returning({ emailDeliveryId: emailDeliveries.emailDeliveryId });

    if (deliveryRows[0] === undefined) {
      return "not_found";
    }

    await tx
      .update(outreachDrafts)
      .set({
        status: "sent",
        updatedAt: now,
      })
      .where(eq(outreachDrafts.outreachDraftId, draft.outreachDraftId));

    await tx
      .update(leads)
      .set({ lifecycleStatus: "outreach_sent", updatedAt: now })
      .where(
        and(
          eq(leads.leadId, leadId),
          notInArray(leads.lifecycleStatus, ["needs_follow_up", "closed"]),
        ),
      );

    await tx
      .update(workflowRunLeads)
      .set({ currentStage: "done" })
      .where(
        and(
          eq(workflowRunLeads.workflowRunId, draft.workflowRunId),
          eq(workflowRunLeads.leadId, leadId),
        ),
      );

    return "updated";
  });
}

/**
 * Removes a queued delivery after a failed send. Leaves the draft approved.
 */
export async function cancelOutreachDraftSend(
  emailDeliveryId: string,
): Promise<void> {
  await requireDb()
    .delete(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.emailDeliveryId, emailDeliveryId),
        eq(emailDeliveries.deliveryStatus, "queued"),
      ),
    );
}

/**
 * Marks an approved draft done without sending mail or creating a delivery.
 */
export async function markOutreachDraftDone(
  leadId: string,
  userId: string,
): Promise<OutreachDraftDoneResult> {
  const now = new Date();

  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select({ leadId: leads.leadId })
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    if (existing[0] === undefined) {
      return "not_found";
    }

    const current = await tx
      .select({
        outreachDraftId: outreachDrafts.outreachDraftId,
        workflowRunId: outreachDrafts.workflowRunId,
        status: outreachDrafts.status,
        deliveryStatus: emailDeliveries.deliveryStatus,
      })
      .from(outreachDrafts)
      .leftJoin(
        emailDeliveries,
        eq(emailDeliveries.outreachDraftId, outreachDrafts.outreachDraftId),
      )
      .where(eq(outreachDrafts.leadId, leadId))
      .orderBy(desc(outreachDrafts.createdAt), desc(outreachDrafts.outreachDraftId))
      .limit(1);

    const draft = current[0];
    if (draft === undefined) {
      return "not_drafted";
    }

    if (draft.status === "sent") {
      if (draft.deliveryStatus !== null) {
        return "already_sent";
      }
      return "already_done";
    }

    if (draft.status !== "approved") {
      return "not_approved";
    }

    if (draft.deliveryStatus !== null) {
      return "already_sent";
    }

    const rows = await tx
      .update(outreachDrafts)
      .set({
        status: "sent",
        updatedAt: now,
      })
      .where(eq(outreachDrafts.outreachDraftId, draft.outreachDraftId))
      .returning({ outreachDraftId: outreachDrafts.outreachDraftId });

    if (rows[0] === undefined) {
      return "not_drafted";
    }

    await tx
      .update(leads)
      .set({ lifecycleStatus: "outreach_sent", updatedAt: now })
      .where(
        and(
          eq(leads.leadId, leadId),
          notInArray(leads.lifecycleStatus, ["needs_follow_up", "closed"]),
        ),
      );

    await tx
      .update(workflowRunLeads)
      .set({ currentStage: "done" })
      .where(
        and(
          eq(workflowRunLeads.workflowRunId, draft.workflowRunId),
          eq(workflowRunLeads.leadId, leadId),
        ),
      );

    return "updated";
  });
}
