import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads.js";
import { users } from "./users.js";
import { workflowRuns } from "./workflows.js";

export const qualificationPriorityLabels = ["high", "medium", "low"] as const;
export type QualificationPriorityLabel =
  (typeof qualificationPriorityLabels)[number];

export const leadQualifications = pgTable(
  "lead_qualifications",
  {
    qualificationId: uuid("qualification_id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .unique()
      .references(() => leads.leadId, { onDelete: "restrict" }),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.workflowRunId, { onDelete: "restrict" }),
    score: numeric("score"),
    agentScore: numeric("agent_score"),
    priorityRank: integer("priority_rank"),
    priorityLabel: text("priority_label"),
    fitLabel: text("fit_label"),
    explanation: text("explanation"),
    agentExplanation: text("agent_explanation"),
    evidence: jsonb("evidence"),
    criteriaBreakdown: jsonb("criteria_breakdown"),
    isUserOverride: boolean("is_user_override").notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => users.userId,
      { onDelete: "restrict" },
    ),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    overrideReason: text("override_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "lead_qualifications_priority_label",
      sql`${table.priorityLabel} IS NULL OR ${table.priorityLabel} IN ('high', 'medium', 'low')`,
    ),
  ],
);

export const leadSummaries = pgTable("lead_summaries", {
  summaryId: uuid("summary_id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .unique()
    .references(() => leads.leadId, { onDelete: "restrict" }),
  workflowRunId: uuid("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.workflowRunId, { onDelete: "restrict" }),
  summaryText: text("summary_text").notNull(),
  structuredReport: jsonb("structured_report"),
  isUserOverride: boolean("is_user_override").notNull(),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.userId, {
    onDelete: "restrict",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type LeadQualification = typeof leadQualifications.$inferSelect;
export type NewLeadQualification = typeof leadQualifications.$inferInsert;
export type LeadSummary = typeof leadSummaries.$inferSelect;
export type NewLeadSummary = typeof leadSummaries.$inferInsert;
