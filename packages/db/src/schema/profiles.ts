import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const idealCustomerProfiles = pgTable(
  "ideal_customer_profiles",
  {
    icpId: uuid("icp_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "restrict" }),
    name: text("name").notNull(),
    industries: jsonb("industries").default(sql`'{}'::jsonb`),
    companySizeMin: integer("company_size_min"),
    companySizeMax: integer("company_size_max"),
    locations: jsonb("locations").default(sql`'{}'::jsonb`),
    budget: jsonb("budget").default(sql`'{}'::jsonb`),
    businessNeedKeywords: jsonb("business_need_keywords").default(
      sql`'{}'::jsonb`,
    ),
    outreachTone: text("outreach_tone"),
    messageConstraints: text("message_constraints"),
    otherCriteria: jsonb("other_criteria").default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "ideal_customer_profiles_company_size_range",
      sql`${table.companySizeMin} IS NULL OR ${table.companySizeMax} IS NULL OR ${table.companySizeMin} <= ${table.companySizeMax}`,
    ),
  ],
);

export type IdealCustomerProfile = typeof idealCustomerProfiles.$inferSelect;
export type NewIdealCustomerProfile =
  typeof idealCustomerProfiles.$inferInsert;
