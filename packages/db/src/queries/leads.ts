import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { requireDb } from "../client.js";
import type { CompanySizeBand, Lead, SourceReference } from "../schema/leads.js";
import {
  companies,
  companySizeBands,
  contacts,
  leads,
  sourceReferences,
} from "../schema/leads.js";
import { emailDeliveries, outreachDrafts } from "../schema/outreach.js";
import { leadQualifications, leadSummaries } from "../schema/reviews.js";
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

export type LeadDetailRow = {
  leadId: string;
  companyId: string;
  primaryContactId: string | null;
  createdByUserId: string | null;
  sourceType: string;
  lifecycleStatus: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  companySizeBand: string | null;
  description: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLinkedinUrl: string | null;
  ownerName: string | null;
  contactFullName: string | null;
  contactJobTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedinUrl: string | null;
  qualificationScore: string | null;
  qualificationPriorityLabel: string | null;
  qualificationFitLabel: string | null;
  qualificationExplanation: string | null;
  qualificationEvidence: unknown;
  qualificationCriteriaBreakdown: unknown;
  qualificationIsUserOverride: boolean | null;
  summaryText: string | null;
  summaryStructuredReport: unknown;
  summaryIsUserOverride: boolean | null;
};

export type IdentifiedLeadDraft = {
  companyName: string;
  website?: string;
  description?: string;
  industry?: string;
  location?: string;
  companySizeBand?: string;
  contactName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  rawSnippet?: string;
};

/** One identified company and the latest Exa page saved for it. */
export type CompanyProfileSource = {
  companyId: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  sizeBand: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  rawSnippet: unknown;
};

/** Fields to write onto a company. Only include a key when that column should change. */
export type CompanyProfileFill = {
  companyId: string;
  website?: string;
  industry?: string;
  location?: string;
  sizeBand?: CompanySizeBand;
  description?: string | null;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
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

function acceptedSizeBand(value: string | undefined): CompanySizeBand | undefined {
  const trimmed = trimmedOrAbsent(value);
  if (trimmed === undefined) {
    return undefined;
  }

  for (const band of companySizeBands) {
    if (band === trimmed) {
      return band;
    }
  }

  return undefined;
}

function uniqueWebsiteKeys(
  website: string | undefined,
  sourceUrl: string | undefined,
): string[] {
  const keys: string[] = [];
  for (const value of [website, sourceUrl]) {
    const key = value?.trim().toLowerCase() ?? "";
    if (key.length === 0 || keys.includes(key)) {
      continue;
    }
    keys.push(key);
  }
  return keys;
}

/**
 * True when the saved description is still an Exa company page.
 * @param value - The description currently stored on the company.
 * @returns Whether a parsed write-up should replace it.
 */
function isStoredCompanyPage(value: string): boolean {
  const text = value.trim();
  if (text.startsWith("#")) {
    return true;
  }
  if (
    /##\s+(?:About|Categories|Locations|Company Details|Workforce|Social)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  return /(?:^|\n|\s-\s)\s*(?:[-*]\s+)?(?:Industry|Emails|Homepage|LinkedIn)\s*:/i.test(
    text,
  );
}

/**
 * Description to store when the current one is empty or still the raw page.
 * @param current - The description saved today.
 * @param next - The parsed write-up, when one was found.
 * @returns The new description, null to clear a raw page, or undefined to leave it.
 */
function nextStoredDescription(
  current: string | null,
  next: string | undefined,
): string | null | undefined {
  const blank = current === null || current.trim() === "";
  const raw = current !== null && isStoredCompanyPage(current);
  if (!blank && !raw) {
    return undefined;
  }
  if (next !== undefined) {
    return current === next ? undefined : next;
  }
  if (raw) {
    return null;
  }

  return undefined;
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
 * Finds a lead detail by its ID.
 * @param leadId - The ID of the lead to find.
 * @returns The lead detail if found, otherwise null.
 */
export async function findLeadDetailById(
  leadId: string,
): Promise<LeadDetailRow | null> {
  const rows = await requireDb()
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
      website: companies.website,
      industry: companies.industry,
      location: companies.location,
      companySizeBand: companies.sizeBand,
      description: companies.description,
      companyEmail: companies.email,
      companyPhone: companies.phone,
      companyLinkedinUrl: companies.linkedinUrl,
      ownerName: users.fullName,
      contactFullName: contacts.fullName,
      contactJobTitle: contacts.jobTitle,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      contactLinkedinUrl: contacts.linkedinUrl,
      qualificationScore: leadQualifications.score,
      qualificationPriorityLabel: leadQualifications.priorityLabel,
      qualificationFitLabel: leadQualifications.fitLabel,
      qualificationExplanation: leadQualifications.explanation,
      qualificationEvidence: leadQualifications.evidence,
      qualificationCriteriaBreakdown: leadQualifications.criteriaBreakdown,
      qualificationIsUserOverride: leadQualifications.isUserOverride,
      summaryText: leadSummaries.summaryText,
      summaryStructuredReport: leadSummaries.structuredReport,
      summaryIsUserOverride: leadSummaries.isUserOverride,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.companyId))
    .leftJoin(contacts, eq(leads.primaryContactId, contacts.contactId))
    .leftJoin(users, eq(leads.createdByUserId, users.userId))
    .leftJoin(
      leadQualifications,
      eq(leadQualifications.leadId, leads.leadId),
    )
    .leftJoin(leadSummaries, eq(leadSummaries.leadId, leads.leadId))
    .where(eq(leads.leadId, leadId))
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

export async function listSourceReferencesByLeadId(
  leadId: string,
  companyId: string,
  contactId: string | null,
): Promise<SourceReference[]> {
  const conditions = [
    eq(sourceReferences.leadId, leadId),
    eq(sourceReferences.companyId, companyId),
  ];
  if (contactId !== null) {
    conditions.push(eq(sourceReferences.contactId, contactId));
  }

  return requireDb()
    .select()
    .from(sourceReferences)
    .where(or(...conditions))
    .orderBy(desc(sourceReferences.retrievedAt), desc(sourceReferences.sourceReferenceId));
}

type StoredCompanyMatch = {
  leadId: string;
  companyId: string;
  website: string | null;
  industry: string | null;
  sizeBand: string | null;
  location: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
};

/**
 * Stores one identified company, optional contact, lead, and Exa source.
 * Reuses this user's lead when the homepage or the result URL matches the
 * stored website, ignoring case. Empty company facts are filled on a match.
 * A description is replaced only when it is still the raw company page.
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
  const industry = trimmedOrAbsent(input.industry);
  const location = trimmedOrAbsent(input.location);
  const sizeBand = acceptedSizeBand(input.companySizeBand);
  const contactName = trimmedOrAbsent(input.contactName);
  const jobTitle = trimmedOrAbsent(input.jobTitle);
  const email = trimmedOrAbsent(input.email);
  const phone = trimmedOrAbsent(input.phone);
  const linkedinUrl = trimmedOrAbsent(input.linkedinUrl);
  const sourceUrl = trimmedOrAbsent(input.sourceUrl);
  const sourceTitle = trimmedOrAbsent(input.sourceTitle);
  const rawSnippet = trimmedOrAbsent(input.rawSnippet);
  const websiteKeys = uniqueWebsiteKeys(website, sourceUrl);

  return requireDb().transaction(async (tx) => {
    const now = new Date();
    let existing: StoredCompanyMatch | undefined;

    if (websiteKeys.length > 0) {
      const matches = await tx
        .select({
          leadId: leads.leadId,
          companyId: leads.companyId,
          website: companies.website,
          industry: companies.industry,
          sizeBand: companies.sizeBand,
          location: companies.location,
          description: companies.description,
          email: companies.email,
          phone: companies.phone,
          linkedinUrl: companies.linkedinUrl,
        })
        .from(leads)
        .innerJoin(companies, eq(leads.companyId, companies.companyId))
        .where(
          and(
            eq(leads.createdByUserId, input.userId),
            or(
              ...websiteKeys.map(
                (key) => sql`lower(trim(${companies.website})) = ${key}`,
              ),
            ),
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
      const descriptionUpdate = nextStoredDescription(
        existing.description,
        description,
      );
      const patch: {
        website?: string;
        industry?: string;
        sizeBand?: CompanySizeBand;
        location?: string;
        description?: string | null;
        email?: string;
        phone?: string;
        linkedinUrl?: string;
        updatedAt?: Date;
      } = {};
      if (
        (existing.website === null || existing.website.trim() === "") &&
        website !== undefined
      ) {
        patch.website = website;
      }
      if (existing.industry === null && industry !== undefined) {
        patch.industry = industry;
      }
      if (existing.sizeBand === null && sizeBand !== undefined) {
        patch.sizeBand = sizeBand;
      }
      if (existing.location === null && location !== undefined) {
        patch.location = location;
      }
      if (descriptionUpdate !== undefined) {
        patch.description = descriptionUpdate;
      }
      if (existing.email === null && email !== undefined) {
        patch.email = email;
      }
      if (existing.phone === null && phone !== undefined) {
        patch.phone = phone;
      }
      if (existing.linkedinUrl === null && linkedinUrl !== undefined) {
        patch.linkedinUrl = linkedinUrl;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        await tx
          .update(companies)
          .set(patch)
          .where(eq(companies.companyId, companyId));
      }
    } else {
      const companyRows = await tx
        .insert(companies)
        .values({
          name: companyName,
          website: website ?? null,
          industry: industry ?? null,
          sizeBand: sizeBand ?? null,
          location: location ?? null,
          description: description ?? null,
          email: email ?? null,
          phone: phone ?? null,
          linkedinUrl: linkedinUrl ?? null,
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

/**
 * Latest Exa page stored for each company.
 * @returns One row per company that has an Exa source snippet.
 */
export async function listCompanyProfileSources(): Promise<CompanyProfileSource[]> {
  const rows = await requireDb()
    .select({
      companyId: companies.companyId,
      website: companies.website,
      industry: companies.industry,
      location: companies.location,
      sizeBand: companies.sizeBand,
      description: companies.description,
      email: companies.email,
      phone: companies.phone,
      linkedinUrl: companies.linkedinUrl,
      rawSnippet: sourceReferences.rawSnippet,
    })
    .from(sourceReferences)
    .innerJoin(companies, eq(sourceReferences.companyId, companies.companyId))
    .where(eq(sourceReferences.sourceProvider, "exa"))
    .orderBy(desc(sourceReferences.retrievedAt), desc(sourceReferences.sourceReferenceId));

  const seen = new Set<string>();
  const sources: CompanyProfileSource[] = [];
  for (const row of rows) {
    if (seen.has(row.companyId)) {
      continue;
    }
    seen.add(row.companyId);
    sources.push(row);
  }

  return sources;
}

/**
 * Writes company facts that the caller has already decided should change.
 * @param fills - One patch per company. An empty list does nothing.
 */
export async function fillCompanyProfiles(fills: CompanyProfileFill[]): Promise<void> {
  if (fills.length === 0) {
    return;
  }

  const now = new Date();
  await requireDb().transaction(async (tx) => {
    for (const fill of fills) {
      const patch: {
        website?: string;
        industry?: string;
        location?: string;
        sizeBand?: CompanySizeBand;
        description?: string | null;
        email?: string;
        phone?: string;
        linkedinUrl?: string;
        updatedAt: Date;
      } = { updatedAt: now };

      if (fill.website !== undefined) {
        patch.website = fill.website;
      }
      if (fill.industry !== undefined) {
        patch.industry = fill.industry;
      }
      if (fill.location !== undefined) {
        patch.location = fill.location;
      }
      if (fill.sizeBand !== undefined) {
        patch.sizeBand = fill.sizeBand;
      }
      if (fill.description !== undefined) {
        patch.description = fill.description;
      }
      if (fill.email !== undefined) {
        patch.email = fill.email;
      }
      if (fill.phone !== undefined) {
        patch.phone = fill.phone;
      }
      if (fill.linkedinUrl !== undefined) {
        patch.linkedinUrl = fill.linkedinUrl;
      }

      await tx
        .update(companies)
        .set(patch)
        .where(eq(companies.companyId, fill.companyId));
    }
  });
}
