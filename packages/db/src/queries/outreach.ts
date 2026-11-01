import { and, desc, eq, notInArray } from "drizzle-orm";
import { requireDb } from "../client.js";
import { leads } from "../schema/leads.js";
import { emailDeliveries, outreachDrafts } from "../schema/outreach.js";

export type LatestOutreachRow = {
  outreachDraftId: string;
  leadId: string;
  workflowRunId: string;
  subject: string | null;
  body: string | null;
  status: string;
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

const preservedLifecycleStatuses = [
  "outreach_sent",
  "needs_follow_up",
  "closed",
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
      status: outreachDrafts.status,
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
