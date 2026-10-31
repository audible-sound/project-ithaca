import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const companySizeBands = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;
export type CompanySizeBand = (typeof companySizeBands)[number];

export const leadSourceTypes = ["manual", "identified"] as const;
export type LeadSourceType = (typeof leadSourceTypes)[number];

export const leadLifecycleStatuses = [
  "new",
  "identified",
  "qualified",
  "summarized",
  "outreach_drafted",
  "outreach_sent",
  "needs_follow_up",
  "closed",
] as const;
export type LeadLifecycleStatus = (typeof leadLifecycleStatuses)[number];

export const sourceProviders = ["exa", "manual", "other"] as const;
export type SourceProvider = (typeof sourceProviders)[number];

export const companies = pgTable(
  "companies",
  {
    companyId: uuid("company_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    sizeBand: text("size_band"),
    location: text("location"),
    description: text("description"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "companies_size_band",
      sql`${table.sizeBand} IS NULL OR ${table.sizeBand} IN ('1-10', '11-50', '51-200', '201-1000', '1000+')`,
    ),
  ],
);

export const contacts = pgTable("contacts", {
  contactId: uuid("contact_id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.companyId, { onDelete: "restrict" }),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const leads = pgTable(
  "leads",
  {
    leadId: uuid("lead_id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.companyId, { onDelete: "restrict" }),
    primaryContactId: uuid("primary_contact_id").references(
      () => contacts.contactId,
      { onDelete: "restrict" },
    ),
    createdByUserId: uuid("created_by_user_id").references(() => users.userId, {
      onDelete: "restrict",
    }),
    sourceType: text("source_type").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "leads_source_type",
      sql`${table.sourceType} IN ('manual', 'identified')`,
    ),
    check(
      "leads_lifecycle_status",
      sql`${table.lifecycleStatus} IN ('new', 'identified', 'qualified', 'summarized', 'outreach_drafted', 'outreach_sent', 'needs_follow_up', 'closed')`,
    ),
  ],
);

export const sourceReferences = pgTable(
  "source_references",
  {
    sourceReferenceId: uuid("source_reference_id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.companyId, {
      onDelete: "restrict",
    }),
    contactId: uuid("contact_id").references(() => contacts.contactId, {
      onDelete: "restrict",
    }),
    leadId: uuid("lead_id").references(() => leads.leadId, {
      onDelete: "restrict",
    }),
    sourceProvider: text("source_provider").notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    rawSnippet: jsonb("raw_snippet"),
  },
  (table) => [
    check(
      "source_references_target",
      sql`${table.companyId} IS NOT NULL OR ${table.contactId} IS NOT NULL OR ${table.leadId} IS NOT NULL`,
    ),
    check(
      "source_references_source_provider",
      sql`${table.sourceProvider} IN ('exa', 'manual', 'other')`,
    ),
  ],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type SourceReference = typeof sourceReferences.$inferSelect;
export type NewSourceReference = typeof sourceReferences.$inferInsert;
