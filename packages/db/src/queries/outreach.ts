import { and, desc, eq, isNull, notInArray } from "drizzle-orm";
import { requireDb } from "../client.js";
import { leads } from "../schema/leads.js";
import { emailDeliveries, outreachDrafts } from "../schema/outreach.js";

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
  createdAt: Date | null;
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

const preservedLifecycleStatuses = [
  "outreach_sent",
  "needs_follow_up",
  "closed",
] as const;

const editableDraftStatuses = ["draft", "edited"] as const;

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
      createdAt: outreachDrafts.createdAt,
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
 * owned by the user. Leaves approval columns unchanged. On the first edit
 * of a row with no generated text, copies the current subject and body
 * into the generated columns.
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
