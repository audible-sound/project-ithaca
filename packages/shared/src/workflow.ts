import type { IdealCustomerProfileInput } from "./profiles.js";

export type WorkflowStage =
  | "identify"
  | "qualify"
  | "summarize"
  | "draft"
  | "done";

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type WorkflowStepType = "identify" | "qualify" | "summarize" | "draft";

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

export type WorkflowLeadStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface LeadWorkflowInput {
  icp: IdealCustomerProfileInput;
  leadIds?: string[];
}

export interface AgentStageResult {
  stage: Exclude<WorkflowStage, "done">;
  status: "completed" | "failed" | "skipped";
  message: string;
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
