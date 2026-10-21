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
  contactName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  rawSnippet?: string;
}

export interface AgentStageResult {
  stage: Exclude<WorkflowStage, "done">;
  status: "completed" | "failed" | "skipped";
  message: string;
  /** Omitted means this stage did not search any companies. An empty array means identify found no companies. */
  candidates?: IdentifiedLeadCandidate[];
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
