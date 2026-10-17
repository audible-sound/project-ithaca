import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads.js";
import { users } from "./users.js";
import { workflowRuns } from "./workflows.js";

export const outreachDraftStatuses = [
  "draft",
  "edited",
  "approved",
  "rejected",
  "sent",
] as const;
export type OutreachDraftStatus = (typeof outreachDraftStatuses)[number];

export const emailDeliveryProviders = ["gmail"] as const;
export type EmailDeliveryProvider = (typeof emailDeliveryProviders)[number];

export const emailDeliveryStatuses = ["queued", "sent", "failed"] as const;
export type EmailDeliveryStatus = (typeof emailDeliveryStatuses)[number];

export const outreachDrafts = pgTable(
  "outreach_drafts",
  {
    outreachDraftId: uuid("outreach_draft_id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.leadId, { onDelete: "restrict" }),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.workflowRunId, { onDelete: "restrict" }),
    subject: text("subject"),
    body: text("body"),
    status: text("status").notNull(),
    isUserEdited: boolean("is_user_edited").notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(
      () => users.userId,
      { onDelete: "restrict" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "outreach_drafts_status",
      sql`${table.status} IN ('draft', 'edited', 'approved', 'rejected', 'sent')`,
    ),
  ],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    emailDeliveryId: uuid("email_delivery_id").primaryKey().defaultRandom(),
    outreachDraftId: uuid("outreach_draft_id")
      .notNull()
      .unique()
      .references(() => outreachDrafts.outreachDraftId, {
        onDelete: "restrict",
      }),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    deliveryStatus: text("delivery_status").notNull(),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    followUpDueAt: timestamp("follow_up_due_at", { withTimezone: true }),
  },
  (table) => [
    check("email_deliveries_provider", sql`${table.provider} IN ('gmail')`),
    check(
      "email_deliveries_delivery_status",
      sql`${table.deliveryStatus} IN ('queued', 'sent', 'failed')`,
    ),
  ],
);

export type OutreachDraft = typeof outreachDrafts.$inferSelect;
export type NewOutreachDraft = typeof outreachDrafts.$inferInsert;
export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type NewEmailDelivery = typeof emailDeliveries.$inferInsert;
