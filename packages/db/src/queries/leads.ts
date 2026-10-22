import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb } from "../client.js";
import type { Lead } from "../schema/leads.js";
import { companies, contacts, leads, sourceReferences } from "../schema/leads.js";
import { emailDeliveries, outreachDrafts } from "../schema/outreach.js";
import { leadQualifications } from "../schema/reviews.js";
import { users } from "../schema/users.js";
import { workflowRunLeads, workflowRuns } from "../schema/workflows.js";

export type LeadListRow = Lead & {
  companyName: string;
};

export type LeadListDetailRow = Lead & {
  companyName: string;
  ownerName: string | null;
  contactName: string | null;
  score: string | null;
  priorityLabel: string | null;
  latestStage: string | null;
  followUpDueAt: Date | null;
};

export type IdentifiedLeadDraft = {
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
};

export type InsertIdentifiedLeadResult = {
  leadId: string;
  storedContact: boolean;
};

/**
 * Trims a string and returns undefined if it is empty.
 * @param value - The string to trim.
 * @returns The trimmed string if it is not empty, otherwise undefined.
 */
function trimmedOrAbsent(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Finds a lead by its ID for a specific user.
 * @param leadId - The ID of the lead to find.
 * @param userId - The ID of the user who owns the lead.
 * @returns The lead if found, otherwise null.
 */
export async function findLeadById(
  leadId: string,
  userId: string,
): Promise<Lead | null> {
  const rows = await requireDb()
    .select()
    .from(leads)
    .where(and(eq(leads.leadId, leadId), eq(leads.createdByUserId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Checks if a user owns a lead by its ID.
 * @param leadIds - The IDs of the leads to list.
 * @param userId - The ID of the user who owns the leads.
 * @returns The leads if found, otherwise an empty array.
 */
export async function listLeadsByIdsForUser(
  leadIds: string[],
  userId: string,
): Promise<Lead[]> {
  if (leadIds.length === 0) {
    return [];
  }

  return requireDb()
    .select()
    .from(leads)
    .where(
      and(inArray(leads.leadId, leadIds), eq(leads.createdByUserId, userId)),
    );
}

/**
 * Lists a user's leads with the company name, newest first.
 * @param userId - The ID of the user who owns the leads.
 * @returns The leads if found, otherwise an empty array.
 */
export async function listLeadsByUser(userId: string): Promise<LeadListRow[]> {
  return requireDb()
    .select({
      leadId: leads.leadId,
      companyId: leads.companyId,
      primaryContactId: leads.primaryContactId,
      createdByUserId: leads.createdByUserId,
      sourceType: leads.sourceType,
      lifecycleStatus: leads.lifecycleStatus,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      companyName: companies.name,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.companyId))
    .where(eq(leads.createdByUserId, userId))
    .orderBy(desc(leads.createdAt), desc(leads.leadId));
}

/**
 * Lists leads from all owners with company, contact, owner, qualification,
 * latest workflow stage, and earliest follow-up due date, ranked by score.
 * @returns One row per lead, highest score first and unscored leads last.
 */
export async function listLeadsWithDetails(): Promise<LeadListDetailRow[]> {
  const db = requireDb();
  const rows = await db
    .select({
      leadId: leads.leadId,
      companyId: leads.companyId,
      primaryContactId: leads.primaryContactId,
      createdByUserId: leads.createdByUserId,
      sourceType: leads.sourceType,
      lifecycleStatus: leads.lifecycleStatus,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      companyName: companies.name,
      ownerName: users.fullName,
      contactName: contacts.fullName,
      score: leadQualifications.score,
      priorityLabel: leadQualifications.priorityLabel,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.companyId))
    .leftJoin(contacts, eq(leads.primaryContactId, contacts.contactId))
    .leftJoin(users, eq(leads.createdByUserId, users.userId))
    .leftJoin(
      leadQualifications,
      eq(leadQualifications.leadId, leads.leadId),
    )
    .orderBy(
      sql`${leadQualifications.score} DESC NULLS LAST`,
      desc(leads.createdAt),
      desc(leads.leadId),
    );

  if (rows.length === 0) {
    return [];
  }

  const leadIds = rows.map((row) => row.leadId);

  const stageRows = await db
    .select({
      leadId: workflowRunLeads.leadId,
      currentStage: workflowRunLeads.currentStage,
    })
    .from(workflowRunLeads)
    .innerJoin(
      workflowRuns,
      eq(workflowRunLeads.workflowRunId, workflowRuns.workflowRunId),
    )
    .where(inArray(workflowRunLeads.leadId, leadIds))
    .orderBy(
      sql`${workflowRuns.startedAt} DESC NULLS LAST`,
      desc(workflowRuns.workflowRunId),
    );

  const latestStageByLeadId = new Map<string, string>();
  for (const row of stageRows) {
    if (!latestStageByLeadId.has(row.leadId)) {
      latestStageByLeadId.set(row.leadId, row.currentStage);
    }
  }

  const followUpRows = await db
    .select({
      leadId: outreachDrafts.leadId,
      followUpDueAt: emailDeliveries.followUpDueAt,
    })
    .from(outreachDrafts)
    .innerJoin(
      emailDeliveries,
      eq(emailDeliveries.outreachDraftId, outreachDrafts.outreachDraftId),
    )
    .where(inArray(outreachDrafts.leadId, leadIds));

  const followUpDueAtByLeadId = new Map<string, Date>();
  for (const row of followUpRows) {
    if (row.followUpDueAt === null) {
      continue;
    }

    const current = followUpDueAtByLeadId.get(row.leadId);
    if (current === undefined || row.followUpDueAt < current) {
      followUpDueAtByLeadId.set(row.leadId, row.followUpDueAt);
    }
  }

  return rows.map((row) => ({
    ...row,
    latestStage: latestStageByLeadId.get(row.leadId) ?? null,
    followUpDueAt: followUpDueAtByLeadId.get(row.leadId) ?? null,
  }));
}

/**
 * Stores one identified company, optional contact, lead, and Exa source.
 * Reuses this user's lead when the trimmed website matches, ignoring case.
 * @param input - The signed-in user and the identified lead fields.
 * @returns The lead id, and whether this call wrote a contact row.
 */
export async function insertIdentifiedLead(
  input: IdentifiedLeadDraft & { userId: string },
): Promise<InsertIdentifiedLeadResult> {
  const companyName = trimmedOrAbsent(input.companyName);
  if (companyName === undefined) {
    throw new Error("Company name is required.");
  }

  const website = trimmedOrAbsent(input.website);
  const description = trimmedOrAbsent(input.description);
  const contactName = trimmedOrAbsent(input.contactName);
  const jobTitle = trimmedOrAbsent(input.jobTitle);
  const email = trimmedOrAbsent(input.email);
  const phone = trimmedOrAbsent(input.phone);
  const linkedinUrl = trimmedOrAbsent(input.linkedinUrl);
  const sourceUrl = trimmedOrAbsent(input.sourceUrl);
  const sourceTitle = trimmedOrAbsent(input.sourceTitle);
  const rawSnippet = trimmedOrAbsent(input.rawSnippet);
  const websiteKey = website?.toLowerCase();

  return requireDb().transaction(async (tx) => {
    const now = new Date();
    let existing: { leadId: string; companyId: string } | undefined;

    if (websiteKey !== undefined) {
      const matches = await tx
        .select({
          leadId: leads.leadId,
          companyId: leads.companyId,
        })
        .from(leads)
        .innerJoin(companies, eq(leads.companyId, companies.companyId))
        .where(
          and(
            eq(leads.createdByUserId, input.userId),
            sql`lower(trim(${companies.website})) = ${websiteKey}`,
          ),
        )
        .orderBy(desc(leads.createdAt), desc(leads.leadId))
        .limit(1);

      existing = matches[0];
    }

    let leadId: string;
    let companyId: string;
    let contactId: string | null = null;
    let storedContact = false;

    if (existing) {
      leadId = existing.leadId;
      companyId = existing.companyId;
    } else {
      const companyRows = await tx
        .insert(companies)
        .values({
          name: companyName,
          website: website ?? null,
          industry: null,
          sizeBand: null,
          location: null,
          description: description ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const company = companyRows[0];
      if (!company) {
        throw new Error("Company was not created.");
      }

      companyId = company.companyId;

      if (contactName !== undefined) {
        const contactRows = await tx
          .insert(contacts)
          .values({
            companyId,
            fullName: contactName,
            jobTitle: jobTitle ?? null,
            email: email ?? null,
            phone: phone ?? null,
            linkedinUrl: linkedinUrl ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const contact = contactRows[0];
        if (!contact) {
          throw new Error("Contact was not created.");
        }

        contactId = contact.contactId;
        storedContact = true;
      }

      const leadRows = await tx
        .insert(leads)
        .values({
          companyId,
          primaryContactId: contactId,
          createdByUserId: input.userId,
          sourceType: "identified",
          lifecycleStatus: "identified",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const lead = leadRows[0];
      if (!lead) {
        throw new Error("Lead was not created.");
      }

      leadId = lead.leadId;
    }

    const sourceRows = await tx
      .insert(sourceReferences)
      .values({
        companyId,
        contactId,
        leadId,
        sourceProvider: "exa",
        sourceUrl: sourceUrl ?? null,
        sourceTitle: sourceTitle ?? null,
        retrievedAt: now,
        rawSnippet: rawSnippet ?? null,
      })
      .returning();

    if (!sourceRows[0]) {
      throw new Error("Source reference was not created.");
    }

    return { leadId, storedContact };
  });
}
