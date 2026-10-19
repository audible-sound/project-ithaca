import { sql } from "drizzle-orm";
import {
  check,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads.js";
import { idealCustomerProfiles } from "./profiles.js";
import { users } from "./users.js";

export const tokenUsageAgentTypes = [
  "identification",
  "qualification",
  "outreach",
  "summary",
  "model_layer",
] as const;
export type TokenUsageAgentType = (typeof tokenUsageAgentTypes)[number];

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    workflowRunId: uuid("workflow_run_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "restrict" }),
    icpId: uuid("icp_id")
      .notNull()
      .references(() => idealCustomerProfiles.icpId, { onDelete: "restrict" }),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "workflow_runs_status",
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`,
    ),
  ],
);

export const workflowRunLeads = pgTable(
  "workflow_run_leads",
  {
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.workflowRunId, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.leadId, { onDelete: "restrict" }),
    currentStage: text("current_stage").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
  },
  (table) => [
    primaryKey({ columns: [table.workflowRunId, table.leadId] }),
    check(
      "workflow_run_leads_current_stage",
      sql`${table.currentStage} IN ('identify', 'qualify', 'summarize', 'draft', 'done')`,
    ),
    check(
      "workflow_run_leads_status",
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed', 'skipped')`,
    ),
  ],
);

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    workflowStepId: uuid("workflow_step_id").primaryKey().defaultRandom(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.workflowRunId, { onDelete: "restrict" }),
    stepType: text("step_type").notNull(),
    status: text("status").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    check(
      "workflow_steps_step_type",
      sql`${table.stepType} IN ('identify', 'qualify', 'summarize', 'draft')`,
    ),
    check(
      "workflow_steps_status",
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`,
    ),
  ],
);

export const tokenUsages = pgTable(
  "token_usages",
  {
    tokenUsageId: uuid("token_usage_id").primaryKey().defaultRandom(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.workflowRunId, { onDelete: "restrict" }),
    workflowStepId: uuid("workflow_step_id").references(
      () => workflowSteps.workflowStepId,
      { onDelete: "restrict" },
    ),
    agentType: text("agent_type").notNull(),
    modelName: text("model_name"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    estimatedCost: numeric("estimated_cost"),
    createdAt: timestamp("created_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "token_usages_agent_type",
      sql`${table.agentType} IN ('identification', 'qualification', 'outreach', 'summary', 'model_layer')`,
    ),
  ],
);

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
export type WorkflowRunLead = typeof workflowRunLeads.$inferSelect;
export type NewWorkflowRunLead = typeof workflowRunLeads.$inferInsert;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type NewWorkflowStep = typeof workflowSteps.$inferInsert;
export type TokenUsage = typeof tokenUsages.$inferSelect;
export type NewTokenUsage = typeof tokenUsages.$inferInsert;
