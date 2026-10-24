/**
 * Turns database rows into the lead shapes the web app expects.
 *
 * The database tracks progress with a lifecycle status such as "new",
 * "qualified", or "outreach_sent". The UI use a shorter list:
 * identify, qualify, summarize, draft, and follow-up. This file
 * translates between the two and fills in the list and detail payloads.
 */
import type {
  LeadDetailRow,
  LeadLifecycleStatus,
  LeadListDetailRow,
  LeadListRow,
  LatestOutreachRow,
  SourceReference,
  WorkflowRunLeadByLeadRow,
} from "@ithaca/db";
import { leadLifecycleStatuses, leadSourceTypes } from "@ithaca/db";
import {
  leadPipelineStages,
  leadPriorities,
  workflowStages,
} from "@ithaca/shared";
import type {
  LeadDetail,
  LeadListItem,
  LeadListStage,
  LeadPipelineStage,
  LeadPipelineStageStatus,
  LeadPriority,
  LeadQualificationCriterion,
  LeadSummary,
  WorkflowStage,
} from "@ithaca/shared";
import { asRecord, readOptionalText, toIso } from "./parse.js";

/** True when the text is one of the allowed values. */
function includesValue<T extends string>(
  allowed: readonly T[],
  value: string,
): value is T {
  return allowed.some((item) => item === value);
}

/**
 * Stage to show on the leads table when there is no workflow run to read.
 * "new" has not started. A sent email, a due follow-up, and a closed
 * lead all sit past drafting, so they become follow-up or closed.
 */
const lifecycleListStage: Record<LeadLifecycleStatus, LeadListStage> = {
  new: "not_started",
  identified: "identify",
  qualified: "qualify",
  summarized: "summarize",
  outreach_drafted: "draft",
  outreach_sent: "follow_up",
  needs_follow_up: "follow_up",
  closed: "closed",
};

/**
 * Order of the agent steps, as a number from 0 to 4.
 * "done" shares the last slot with follow-up on the detail page.
 */
const runStageIndex: Record<WorkflowStage, number> = {
  identify: 0,
  qualify: 1,
  summarize: 2,
  draft: 3,
  done: 4,
};

/**
 * Same 0-to-4 order, read from the lifecycle status when no workflow
 * run is available. Sent, follow-up, and closed all count as the last step.
 */
const lifecycleStageIndex: Record<LeadLifecycleStatus, number> = {
  new: 0,
  identified: 0,
  qualified: 1,
  summarized: 2,
  outreach_drafted: 3,
  outreach_sent: 4,
  needs_follow_up: 4,
  closed: 4,
};

/** "manual" was typed in by a person. "identified" was found by the identify agent. */
function leadSourceType(value: string): LeadSummary["sourceType"] {
  if (includesValue(leadSourceTypes, value)) {
    return value;
  }

  throw new Error(`Unexpected lead source type "${value}".`);
}

/** "high", "medium", or "low". Empty until the lead has been scored. */
function leadPriority(value: string | null): LeadPriority | null {
  if (value === null) {
    return null;
  }

  if (includesValue(leadPriorities, value)) {
    return value;
  }

  throw new Error(`Unexpected lead priority "${value}".`);
}

/**
 * Stage label for the leads table.
 * A running workflow's current step wins, except when the lead needs
 * a follow-up or is already closed. Those come from the lifecycle status.
 */
function leadListStageFrom(
  lifecycleStatus: string,
  latestStage: string | null,
): LeadListStage {
  if (!includesValue(leadLifecycleStatuses, lifecycleStatus)) {
    throw new Error(`Unexpected lead lifecycle status "${lifecycleStatus}".`);
  }

  if (
    lifecycleStatus !== "needs_follow_up" &&
    lifecycleStatus !== "closed" &&
    latestStage !== null
  ) {
    if (!includesValue(workflowStages, latestStage)) {
      throw new Error(`Unexpected lead stage "${latestStage}".`);
    }

    return latestStage;
  }

  return lifecycleListStage[lifecycleStatus];
}

/** Which pipeline step a workflow run is on. An unknown stage counts as the first step. */
function stageIndexFromRunStage(stage: string): number {
  if (!includesValue(workflowStages, stage)) {
    return 0;
  }

  return runStageIndex[stage];
}

/** Which pipeline step a lifecycle status points at. An unknown status counts as the first step. */
function stageIndexFromLifecycle(lifecycleStatus: string): number {
  if (!includesValue(leadLifecycleStatuses, lifecycleStatus)) {
    return 0;
  }

  return lifecycleStageIndex[lifecycleStatus];
}

/** True when the lead is marked for follow-up, or the reply date has already passed. */
function isFollowUpDue(lifecycleStatus: string, dueAt: Date | null): boolean {
  return (
    lifecycleStatus === "needs_follow_up" ||
    (dueAt !== null && dueAt <= new Date())
  );
}

/**
 * True when the email has moved past a draft: it was sent, a follow-up
 * was scheduled, a delivery status was recorded, or they replied.
 */
function hasOutreachActivity(row: LatestOutreachRow | null): boolean {
  return (
    row !== null &&
    (row.deliveryStatus !== null ||
      row.sentAt !== null ||
      row.followUpDueAt !== null ||
      row.repliedAt !== null)
  );
}

/** First non-empty text among several possible field names. Stored JSON is not always spelled the same way. */
function readNamedText(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const text = readOptionalText(record[key]);
    if (text !== null) {
      return text;
    }
  }

  return null;
}

/**
 * Pulls the qualify checks, such as industry or company size, out of stored JSON.
 * Each check needs a name and a result. Items missing either one are skipped.
 */
function parseCriteria(value: unknown): LeadQualificationCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const criteria: LeadQualificationCriterion[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const name = readNamedText(record, ["name", "criterion", "key"]);
    const result = readNamedText(record, ["result", "outcome", "status"]);
    if (name !== null && result !== null) {
      criteria.push({ name, result });
    }
  }

  return criteria;
}

/**
 * Pulls the qualify evidence lines out of stored JSON.
 * A line can be a plain string, or an object with a text field.
 */
function parseEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const evidence: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (item.trim().length > 0) {
        evidence.push(item);
      }
      continue;
    }

    const text = readNamedText(asRecord(item), [
      "text",
      "evidence",
      "description",
    ]);
    if (text !== null) {
      evidence.push(text);
    }
  }

  return evidence;
}

/** The four labeled parts of a company write-up, when the summary was saved that way. */
type StructuredReport = {
  snapshot: string | null;
  whyItFits: string | null;
  gap: string | null;
  nextStep: string | null;
};

/** Reads those four parts. Accepts either camelCase or snake_case field names. */
function parseStructuredReport(value: unknown): StructuredReport {
  const record = asRecord(value);
  return {
    snapshot: readNamedText(record, ["snapshot"]),
    whyItFits: readNamedText(record, ["whyItFits", "why_it_fits"]),
    gap: readNamedText(record, ["gap"]),
    nextStep: readNamedText(record, ["nextStep", "next_step"]),
  };
}

/**
 * Label for the step the lead is on right now.
 * Follow-up has no agent run, so it stays "current".
 * A failed or still-running workflow is shown as such.
 * Anything else on this step counts as finished or still waiting.
 */
function currentStageStatus(
  stage: (typeof leadPipelineStages)[number],
  latestRunLead: WorkflowRunLeadByLeadRow | null,
): LeadPipelineStageStatus {
  if (stage === "follow_up") {
    return "current";
  }

  if (latestRunLead === null) {
    return "completed";
  }

  if (latestRunLead.status === "failed") {
    return "failed";
  }

  if (latestRunLead.status === "running") {
    return "running";
  }

  if (latestRunLead.status === "completed") {
    return "completed";
  }

  return "waiting";
}

/**
 * Builds the five-step progress bar on the lead detail page.
 *
 * A brand-new lead, with no workflow run, shows identify as not started
 * and the later steps as waiting.
 *
 * Otherwise a step is completed when its output is already saved, or
 * when the lead has moved past it. The step they are on shows the live
 * run status. Later steps stay waiting. Follow-up counts as done once
 * they reply, or the lead is closed.
 */
function computePipeline(input: {
  row: LeadDetailRow;
  latestRunLead: WorkflowRunLeadByLeadRow | null;
  hasQualification: boolean;
  hasSummary: boolean;
  hasOutreach: boolean;
  outreachRow: LatestOutreachRow | null;
}): LeadPipelineStage[] {
  const {
    row,
    latestRunLead,
    hasQualification,
    hasSummary,
    hasOutreach,
    outreachRow,
  } = input;
  const isClosed = row.lifecycleStatus === "closed";
  const isFollowUpStage =
    row.lifecycleStatus === "needs_follow_up" ||
    row.lifecycleStatus === "outreach_sent" ||
    hasOutreachActivity(outreachRow);

  if (latestRunLead === null && row.lifecycleStatus === "new") {
    return leadPipelineStages.map((stage, index) => ({
      stage,
      status: index === 0 ? "not_started" : "waiting",
    }));
  }

  // Follow-up and closed leads are on the last step.
  // Otherwise prefer the workflow run, then the lifecycle status.
  let currentIndex: number;
  if (isFollowUpStage || isClosed) {
    currentIndex = 4;
  } else if (latestRunLead !== null) {
    currentIndex = stageIndexFromRunStage(latestRunLead.currentStage);
  } else {
    currentIndex = stageIndexFromLifecycle(row.lifecycleStatus);
  }

  // A step is done when we already have its saved output.
  const completedByStage: Record<(typeof leadPipelineStages)[number], boolean> =
    {
      identify: true,
      qualify: hasQualification,
      summarize: hasSummary,
      draft: hasOutreach,
      follow_up: (outreachRow?.repliedAt ?? null) !== null || isClosed,
    };

  return leadPipelineStages.map((stage, index) => {
    if (completedByStage[stage] || index < currentIndex) {
      return { stage, status: "completed" };
    }

    if (index === currentIndex) {
      return { stage, status: currentStageStatus(stage, latestRunLead) };
    }

    return { stage, status: "waiting" };
  });
}

/** Short lead used when picking companies for a workflow run. */
export function mapLead(row: LeadListRow): LeadSummary {
  return {
    leadId: row.leadId,
    companyName: row.companyName,
    sourceType: leadSourceType(row.sourceType),
  };
}

/** One row on the Leads page: owner, score, stage, and whether a reply is overdue. */
export function mapLeadListItem(row: LeadListDetailRow): LeadListItem {
  let score: number | null = null;
  if (row.score !== null) {
    score = Number(row.score);
    if (Number.isNaN(score)) {
      throw new Error(`Unexpected lead score "${row.score}".`);
    }
  }

  return {
    leadId: row.leadId,
    companyName: row.companyName,
    ownerId: row.createdByUserId,
    ownerName: row.ownerName,
    contactName: row.contactName,
    sourceType: leadSourceType(row.sourceType),
    score,
    priority: leadPriority(row.priorityLabel),
    stage: leadListStageFrom(row.lifecycleStatus, row.latestStage),
    followUpDue: isFollowUpDue(row.lifecycleStatus, row.followUpDueAt),
  };
}

/**
 * Full lead for the detail page. Each section stays empty until that
 * stage has produced something: a contact, a score, a write-up, a
 * draft email, or a sent message.
 */
export function mapLeadDetail(input: {
  row: LeadDetailRow;
  sources: SourceReference[];
  runLeads: WorkflowRunLeadByLeadRow[];
  outreachRow: LatestOutreachRow | null;
}): LeadDetail {
  const { row, sources, runLeads, outreachRow } = input;
  const latestRunLead = runLeads[0] ?? null;

  let score: number | null = null;
  if (row.qualificationScore !== null) {
    const parsed = Number(row.qualificationScore);
    score = Number.isNaN(parsed) ? null : parsed;
  }

  // A score, priority, fit label, explanation, or a hand edit all count as qualified.
  const hasQualification =
    row.qualificationScore !== null ||
    row.qualificationPriorityLabel !== null ||
    row.qualificationFitLabel !== null ||
    row.qualificationExplanation !== null ||
    row.qualificationIsUserOverride !== null;

  const structured = parseStructuredReport(row.summaryStructuredReport);
  const hasSummary = row.summaryText !== null;
  // A draft row is enough for the outreach section. Activity means it was sent or replied to.
  const hasOutreach = outreachRow !== null;
  const activeOutreach = hasOutreachActivity(outreachRow);

  return {
    leadId: row.leadId,
    companyName: row.companyName,
    website: row.website,
    industry: row.industry,
    location: row.location,
    companySizeBand: row.companySizeBand,
    description: row.description,
    ownerId: row.createdByUserId,
    ownerName: row.ownerName,
    sourceType: leadSourceType(row.sourceType),
    stage: leadListStageFrom(
      row.lifecycleStatus,
      latestRunLead?.currentStage ?? null,
    ),
    followUpDue: isFollowUpDue(
      row.lifecycleStatus,
      outreachRow?.followUpDueAt ?? null,
    ),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    contact:
      row.contactFullName !== null
        ? {
            fullName: row.contactFullName,
            jobTitle: row.contactJobTitle,
            email: row.contactEmail,
            phone: row.contactPhone,
            linkedinUrl: row.contactLinkedinUrl,
          }
        : null,
    sources: sources.map((source) => ({
      sourceProvider: source.sourceProvider,
      sourceTitle: source.sourceTitle,
      sourceUrl: source.sourceUrl,
      retrievedAt: toIso(source.retrievedAt),
    })),
    qualification: hasQualification
      ? {
          score,
          priority: leadPriority(row.qualificationPriorityLabel),
          fitLabel: row.qualificationFitLabel,
          explanation: row.qualificationExplanation,
          criteria: parseCriteria(row.qualificationCriteriaBreakdown),
          evidence: parseEvidence(row.qualificationEvidence),
          isUserOverride: row.qualificationIsUserOverride ?? false,
        }
      : null,
    summary: hasSummary
      ? {
          summaryText: row.summaryText as string,
          snapshot: structured.snapshot,
          whyItFits: structured.whyItFits,
          gap: structured.gap,
          nextStep: structured.nextStep,
          isUserOverride: row.summaryIsUserOverride ?? false,
        }
      : null,
    outreach: outreachRow
      ? {
          subject: outreachRow.subject,
          status: outreachRow.status,
          workflowRunId: outreachRow.workflowRunId,
        }
      : null,
    followUp:
      activeOutreach && outreachRow
        ? {
            sentAt: toIso(outreachRow.sentAt),
            dueAt: toIso(outreachRow.followUpDueAt),
            repliedAt: toIso(outreachRow.repliedAt),
            deliveryStatus: outreachRow.deliveryStatus,
          }
        : null,
    pipeline: computePipeline({
      row,
      latestRunLead,
      hasQualification,
      hasSummary,
      hasOutreach,
      outreachRow,
    }),
  };
}
