import type {
  LeadQualificationCriterion,
  LeadStructuredReport,
} from "@ithaca/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireDb } from "../client.js";
import { leads } from "../schema/leads.js";
import { leadQualifications, leadSummaries } from "../schema/reviews.js";

/** Saved qualification used when a later stage must read the stored score. */
export type StoredLeadQualification = {
  leadId: string;
  score: string | null;
  fitLabel: string | null;
  explanation: string | null;
  agentExplanation: string | null;
  evidence: unknown;
  isUserOverride: boolean;
  overrideReason: string | null;
};

/**
 * Loads the saved qualification for each lead.
 * @param leadIds - Leads whose qualifications are needed.
 * @returns One row per saved qualification. Leads with no row are omitted.
 */
export async function listLeadQualificationsByLeadIds(
  leadIds: string[],
): Promise<StoredLeadQualification[]> {
  if (leadIds.length === 0) {
    return [];
  }

  return requireDb()
    .select({
      leadId: leadQualifications.leadId,
      score: leadQualifications.score,
      fitLabel: leadQualifications.fitLabel,
      explanation: leadQualifications.explanation,
      agentExplanation: leadQualifications.agentExplanation,
      evidence: leadQualifications.evidence,
      isUserOverride: leadQualifications.isUserOverride,
      overrideReason: leadQualifications.overrideReason,
    })
    .from(leadQualifications)
    .where(inArray(leadQualifications.leadId, leadIds));
}

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
 * This write does not set the user override reason.
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
    agentScore: String(draft.score),
    priorityRank: draft.priorityRank,
    priorityLabel: draft.priorityLabel,
    fitLabel: draft.fitLabel,
    explanation: draft.explanation,
    agentExplanation: draft.explanation,
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

export type QualificationOverrideResult =
  | "updated"
  | "not_found"
  | "not_qualified";

export type QualificationOverrideDecision = {
  score: number;
  priorityLabel: string;
  fitLabel: string;
  /** Trimmed before it is stored. Blank text is stored as null. */
  reason: string | null;
};

/**
 * Replaces the ranking score for a qualification owned by the user.
 * The agent score and explanation stay as they are.
 * The reason is stored trimmed, and blank text clears it.
 * @param leadId - The lead whose qualification is overridden.
 * @param userId - The user who must own the lead.
 * @param decision - The new score, the priority and fit derived from it, and the reason.
 * @returns Whether the row was updated, the lead is missing, or it has no qualification.
 */
export async function updateLeadQualificationOverride(
  leadId: string,
  userId: string,
  decision: QualificationOverrideDecision,
): Promise<QualificationOverrideResult> {
  const now = new Date();
  const trimmedReason = decision.reason?.trim() ?? "";
  const overrideReason = trimmedReason.length > 0 ? trimmedReason : null;

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

    const rows = await tx
      .update(leadQualifications)
      .set({
        agentScore: sql`coalesce(${leadQualifications.agentScore}, ${leadQualifications.score})`,
        agentExplanation: sql`coalesce(${leadQualifications.agentExplanation}, ${leadQualifications.explanation})`,
        score: String(decision.score),
        priorityLabel: decision.priorityLabel,
        fitLabel: decision.fitLabel,
        isUserOverride: true,
        reviewedByUserId: userId,
        overriddenAt: now,
        overrideReason,
        updatedAt: now,
      })
      .where(eq(leadQualifications.leadId, leadId))
      .returning({ leadId: leadQualifications.leadId });

    if (rows[0] === undefined) {
      return "not_qualified";
    }

    return "updated";
  });
}
