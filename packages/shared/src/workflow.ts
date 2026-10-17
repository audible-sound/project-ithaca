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

export interface IdealCustomerProfileInput {
  name: string;
  industries?: string[];
  locations?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  businessNeedKeywords?: string[];
  outreachTone?: string;
  messageConstraints?: string;
}

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
