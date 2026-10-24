import { desc, eq } from "drizzle-orm";
import { requireDb } from "../client.js";
import { emailDeliveries, outreachDrafts } from "../schema/outreach.js";

export type LatestOutreachRow = {
  outreachDraftId: string;
  leadId: string;
  workflowRunId: string;
  subject: string | null;
  status: string;
  createdAt: Date | null;
  deliveryStatus: string | null;
  sentAt: Date | null;
  repliedAt: Date | null;
  followUpDueAt: Date | null;
};

export async function findLatestOutreachByLeadId(
  leadId: string,
): Promise<LatestOutreachRow | null> {
  const rows = await requireDb()
    .select({
      outreachDraftId: outreachDrafts.outreachDraftId,
      leadId: outreachDrafts.leadId,
      workflowRunId: outreachDrafts.workflowRunId,
      subject: outreachDrafts.subject,
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
