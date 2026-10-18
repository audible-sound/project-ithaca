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

export type { IdealCustomerProfileInput };

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
