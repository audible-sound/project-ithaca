/**
 * A lead is one company moving through identify, qualify, summarize, draft, and follow-up.
 */

/** Short lead used when choosing companies for a workflow run (`GET /leads`). */
export interface LeadSummary {
  leadId: string;
  companyName: string;
  /** `manual` was entered by a user. `identified` was found by the identify agent. */
  sourceType: "manual" | "identified";
}

/** Body of `GET /leads`. */
export interface ListLeadsResponse {
  leads: LeadSummary[];
}

/**
 * Stage shown on the leads table.
 * Workflow progress (`identify` through `done`) plus lifecycle states
 */
export const leadListStages = [
  "not_started",
  "identify",
  "qualify",
  "summarize",
  "draft",
  "done",
  "follow_up",
  "closed",
] as const;
export type LeadListStage = (typeof leadListStages)[number];

/** Qualification priority. Null until the qualify stage has scored the lead. */
export const leadPriorities = ["high", "medium", "low"] as const;
export type LeadPriority = (typeof leadPriorities)[number];

/** One row on the Leads page (`GET /leads/all`). */
export interface LeadListItem {
  leadId: string;
  companyName: string;
  /** User who created the lead. Null when the lead has no owner. */
  ownerId: string | null;
  ownerName: string | null;
  /** Primary contact. Null until a contact is known. */
  contactName: string | null;
  sourceType: "manual" | "identified";
  /** Qualification score. Null until the lead is qualified. */
  score: number | null;
  priority: LeadPriority | null;
  stage: LeadListStage;
  /** True when a reply is overdue or the lead is marked as needing follow-up. */
  followUpDue: boolean;
}

/** Body of `GET /leads/all`. */
export interface ListLeadListResponse {
  leads: LeadListItem[];
}

/**
 * Steps drawn on the lead detail pipeline, in order.
 * Same agent steps as the list stages, with follow-up as the last step
 * and without `not_started`, `done`, and `closed`.
 */
export const leadPipelineStages = [
  "identify",
  "qualify",
  "summarize",
  "draft",
  "follow_up",
] as const;
export type LeadPipelineStageName = (typeof leadPipelineStages)[number];

/** Progress of one pipeline step on the lead detail page. */
export const leadPipelineStageStatuses = [
  "not_started",
  "waiting",
  "running",
  "completed",
  "failed",
  "current",
] as const;
export type LeadPipelineStageStatus =
  (typeof leadPipelineStageStatuses)[number];

/** One step in `LeadDetail.pipeline`. The array is always all five stages. */
export interface LeadPipelineStage {
  stage: LeadPipelineStageName;
  status: LeadPipelineStageStatus;
}

/** Primary person at the company. Absent on `LeadDetail` until a name is known. */
export interface LeadContactDetail {
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

/** A page or record the lead was taken from. Timestamps are ISO strings. */
export interface LeadSource {
  /** Provider name, such as `manual` or `exa`. */
  sourceProvider: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
}

/** One ideal-customer check from qualification, such as industry or company size. */
export interface LeadQualificationCriterion {
  name: string;
  result: string;
}

/**
 * Output of the qualify stage.
 * Null on `LeadDetail` until qualification exists.
 */
export interface LeadQualificationDetail {
  score: number | null;
  priority: LeadPriority | null;
  fitLabel: string | null;
  explanation: string | null;
  criteria: LeadQualificationCriterion[];
  evidence: string[];
  /** True when a person edited the agent's qualification. */
  isUserOverride: boolean;
}

/**
 * Written brief from the summarize stage.
 * This is the company write-up, not the short `LeadSummary` used in lists.
 * Null on `LeadDetail` until a summary exists.
 */
export interface LeadSummaryDetail {
  summaryText: string;
  snapshot: string | null;
  whyItFits: string | null;
  gap: string | null;
  nextStep: string | null;
  /** True when a person edited the agent's summary. */
  isUserOverride: boolean;
}

/**
 * Latest drafted outreach email.
 * Null on `LeadDetail` until the draft stage has produced one.
 */
export interface LeadOutreachDetail {
  subject: string | null;
  status: string;
  /** Run that produced this draft. */
  workflowRunId: string;
}

/**
 * Delivery and reply timing after outreach is sent.
 * Null on `LeadDetail` until the email has been sent or a follow-up is scheduled.
 * Timestamps are ISO strings.
 */
export interface LeadFollowUpDetail {
  sentAt: string | null;
  dueAt: string | null;
  repliedAt: string | null;
  deliveryStatus: string | null;
}

/** Full lead for the detail page (`GET /leads/:leadId`). Nested sections are null until that stage has run. */
export interface LeadDetail {
  leadId: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  companySizeBand: string | null;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  sourceType: "manual" | "identified";
  /** Same stage value as the leads table. */
  stage: LeadListStage;
  followUpDue: boolean;
  /** ISO timestamps. */
  createdAt: string | null;
  updatedAt: string | null;
  contact: LeadContactDetail | null;
  sources: LeadSource[];
  qualification: LeadQualificationDetail | null;
  summary: LeadSummaryDetail | null;
  outreach: LeadOutreachDetail | null;
  followUp: LeadFollowUpDetail | null;
  pipeline: LeadPipelineStage[];
}
