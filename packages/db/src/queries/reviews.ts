import type {
  LeadQualificationCriterion,
  LeadStructuredReport,
} from "@ithaca/shared";
import { eq } from "drizzle-orm";
import { requireDb } from "../client.js";
import { leads } from "../schema/leads.js";
import { leadQualifications, leadSummaries } from "../schema/reviews.js";

export type LeadQualificationDraft = {
  leadId: string;
  workflowRunId: string;
  score: number;
  priorityRank: number;
  priorityLabel: string;
  fitLabel: string;
  explanation: string;
  evidence: string[];
  criteriaBreakdown: LeadQualificationCriterion[];
};

/**
 * Saves the agent's qualification for a lead.
 * A row marked as a user override is left unchanged.
 * Otherwise the lead lifecycle becomes qualified.
 * @param draft - Score, rank, and explanation for one lead.
 */
export async function upsertLeadQualification(
  draft: LeadQualificationDraft,
): Promise<void> {
  const now = new Date();
  const written = {
    workflowRunId: draft.workflowRunId,
    score: String(draft.score),
    priorityRank: draft.priorityRank,
    priorityLabel: draft.priorityLabel,
    fitLabel: draft.fitLabel,
    explanation: draft.explanation,
    evidence: draft.evidence,
    criteriaBreakdown: draft.criteriaBreakdown,
    isUserOverride: false,
    updatedAt: now,
  };

  await requireDb().transaction(async (tx) => {
    const rows = await tx
      .insert(leadQualifications)
      .values({
        leadId: draft.leadId,
        createdAt: now,
        ...written,
      })
      .onConflictDoUpdate({
        target: leadQualifications.leadId,
        set: written,
        setWhere: eq(leadQualifications.isUserOverride, false),
      })
      .returning({ leadId: leadQualifications.leadId });

    if (rows[0] === undefined) {
      return;
    }

    await tx
      .update(leads)
      .set({ lifecycleStatus: "qualified", updatedAt: now })
      .where(eq(leads.leadId, draft.leadId));
  });
}

export type LeadSummaryDraft = {
  leadId: string;
  workflowRunId: string;
  summaryText: string;
  structuredReport: LeadStructuredReport;
};

/**
 * Saves the agent's summary for a lead.
 * A row marked as a user override is left unchanged.
 * Otherwise the lead lifecycle becomes summarized.
 * @param draft - Report text and the four labeled sections for one lead.
 */
export async function upsertLeadSummary(
  draft: LeadSummaryDraft,
): Promise<void> {
  const now = new Date();
  const written = {
    workflowRunId: draft.workflowRunId,
    summaryText: draft.summaryText,
    structuredReport: draft.structuredReport,
    isUserOverride: false,
    updatedAt: now,
  };

  await requireDb().transaction(async (tx) => {
    const rows = await tx
      .insert(leadSummaries)
      .values({
        leadId: draft.leadId,
        createdAt: now,
        ...written,
      })
      .onConflictDoUpdate({
        target: leadSummaries.leadId,
        set: written,
        setWhere: eq(leadSummaries.isUserOverride, false),
      })
      .returning({ leadId: leadSummaries.leadId });

    if (rows[0] === undefined) {
      return;
    }

    await tx
      .update(leads)
      .set({ lifecycleStatus: "summarized", updatedAt: now })
      .where(eq(leads.leadId, draft.leadId));
  });
}
