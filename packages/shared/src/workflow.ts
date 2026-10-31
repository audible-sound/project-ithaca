import type { LeadPriority, LeadQualificationCriterion } from "./leads.js";
import type { IdealCustomerProfileInput } from "./profiles.js";

/** Agent execution order is fixed. */
export const workflowStepTypes = [
  "identify",
  "qualify",
  "summarize",
  "draft",
] as const;
export type WorkflowStepType = (typeof workflowStepTypes)[number];

export const workflowStages = [
  "identify",
  "qualify",
  "summarize",
  "draft",
  "done",
] as const;
export type WorkflowStage = (typeof workflowStages)[number];

export const workflowRunStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];

export const workflowStepStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type WorkflowStepStatus = (typeof workflowStepStatuses)[number];

export const workflowLeadStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;
export type WorkflowLeadStatus = (typeof workflowLeadStatuses)[number];

export interface LeadWorkflowInput {
  icp: IdealCustomerProfileInput;
  leadIds?: string[];
}

export interface IdentifiedLeadCandidate {
  companyName: string;
  website?: string;
  description?: string;
  industry?: string;
  location?: string;
  /** One of `1-10`, `11-50`, `51-200`, `201-1000`, `1000+`. */
  companySizeBand?: string;
  contactName?: string;
  jobTitle?: string;
  /** Company mailbox from the company page. */
  email?: string;
  phone?: string;
  /** Company LinkedIn page. */
  linkedinUrl?: string;
  /** Work email for the contact. Absent when no person matched or enrichment found none. */
  contactEmail?: string;
  /** Public profile URL for the contact. */
  contactLinkedinUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  rawSnippet?: string;
}

/** Primary person at the company, when one is known. */
export interface WorkflowLeadContact {
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

/**
 * Company and contact passed into qualify and summarize.
 * Description is the stored write-up, not the raw source page.
 */
export interface WorkflowLeadContext {
  leadId: string;
  companyName: string;
  website?: string;
  industry?: string;
  location?: string;
  /** One of `1-10`, `11-50`, `51-200`, `201-1000`, `1000+`. */
  companySizeBand?: string;
  description?: string;
  contact?: WorkflowLeadContact;
}

export const qualificationFitLabels = [
  "Strong fit",
  "Partial fit",
  "Weak fit",
] as const;
export type QualificationFitLabel = (typeof qualificationFitLabels)[number];

/** Suitability score for one lead. `isUserOverride` stays false for agent output. */
export interface WorkflowLeadQualification {
  leadId: string;
  score: number;
  priorityRank: number;
  priorityLabel: LeadPriority;
  fitLabel: QualificationFitLabel;
  explanation: string;
  evidence: string[];
  criteriaBreakdown: LeadQualificationCriterion[];
  isUserOverride: false;
}

/** Written report sections stored on the lead summary. */
export interface LeadStructuredReport {
  snapshot: string;
  whyItFits: string;
  gap: string;
  nextStep: string;
}

/** Structured summary for one lead. */
export interface WorkflowLeadSummary {
  leadId: string;
  summaryText: string;
  structuredReport: LeadStructuredReport;
}

/** Token use and dollar cost for one model call in a stage. */
export interface AgentStageUsage {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface AgentStageResult {
  stage: Exclude<WorkflowStage, "done">;
  status: "completed" | "failed" | "skipped";
  message: string;
  /** Omitted means this stage did not search any companies. An empty array means identify found no companies. */
  candidates?: IdentifiedLeadCandidate[];
  /** Dollar cost reported by the external provider for this stage, when it returns one. */
  estimatedCost?: number;
  /** Omitted means this stage did not qualify leads. An empty array means qualify had no leads. */
  qualifications?: WorkflowLeadQualification[];
  /** Omitted means this stage did not summarize leads. An empty array means summarize had no leads. */
  summaries?: WorkflowLeadSummary[];
  /** Present when this stage called a model. */
  usage?: AgentStageUsage;
  data?: Record<string, unknown>;
}

export interface LeadWorkflowResult {
  status: WorkflowRunStatus;
  stages: AgentStageResult[];
}

export interface WorkflowStep {
  workflowStepId: string;
  stepType: WorkflowStepType;
  status: WorkflowStepStatus;
  attemptCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

export interface WorkflowRunLead {
  leadId: string;
  companyName: string;
  /** `manual` was entered by a user. `identified` was found by the identify agent. */
  sourceType: "manual" | "identified";
  currentStage: WorkflowStage;
  status: WorkflowLeadStatus;
  errorMessage: string | null;
}

export interface WorkflowRunSummary {
  workflowRunId: string;
  icpId: string;
  status: WorkflowRunStatus;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkflowRunDetail extends WorkflowRunSummary {
  steps: WorkflowStep[];
  leads: WorkflowRunLead[];
}

export interface StartWorkflowRunRequest {
  icpId: string;
  leadIds?: string[];
}

export interface StartWorkflowRunResponse {
  message: string;
  workflowRunId: string;
}

export interface ListWorkflowRunsResponse {
  runs: WorkflowRunSummary[];
}
