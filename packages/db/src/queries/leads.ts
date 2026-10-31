import type { WorkflowLeadContact, WorkflowLeadContext } from "@ithaca/shared";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
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
import { idealCustomerProfiles } from "../schema/profiles.js";
import { leadQualifications, leadSummaries } from "../schema/reviews.js";
import { users } from "../schema/users.js";
import { workflowRunLeads, workflowRuns } from "../schema/workflows.js";

export type LeadListRow = Lead & {
  companyName: string;
};

export type LeadListDetailIcp = {
  icpId: string;
  name: string;
};

export type LeadListDetailRow = Lead & {
  companyName: string;
  ownerName: string | null;
  contactName: string | null;
  score: string | null;
  priorityLabel: string | null;
  latestStage: string | null;
  followUpDueAt: Date | null;
  icps: LeadListDetailIcp[];
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
  /** Company mailbox from the company page. */
  email?: string;
  phone?: string;
  /** Company LinkedIn page. */
  linkedinUrl?: string;
  /** Work email for the contact. */
  contactEmail?: string;
  /** Public profile URL for the contact. */
  contactLinkedinUrl?: string;
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

/** Company and contact facts for a lead typed in by a person. */
export type ManualLeadFacts = {
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  companySizeBand: CompanySizeBand | null;
  description: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLinkedinUrl: string | null;
  contactName: string | null;
  contactJobTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedinUrl: string | null;
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

function sourceUrlKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function uniqueWebsiteKeys(
  website: string | undefined,
  sourceUrl: string | undefined,
): string[] {
  const keys: string[] = [];
  for (const value of [website, sourceUrl]) {
    const key = sourceUrlKey(value);
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

type LeadContextRow = {
  leadId: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  companySizeBand: string | null;
  description: string | null;
  contactFullName: string | null;
  contactJobTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedinUrl: string | null;
};

function toLeadContext(row: LeadContextRow): WorkflowLeadContext {
  const companyName = trimmedOrAbsent(row.companyName);
  if (companyName === undefined) {
    throw new Error(`Lead ${row.leadId} has no company name.`);
  }

  const context: WorkflowLeadContext = {
    leadId: row.leadId,
    companyName,
  };
  const website = trimmedOrAbsent(row.website ?? undefined);
  if (website !== undefined) {
    context.website = website;
  }

  const industry = trimmedOrAbsent(row.industry ?? undefined);
  if (industry !== undefined) {
    context.industry = industry;
  }

  const location = trimmedOrAbsent(row.location ?? undefined);
  if (location !== undefined) {
    context.location = location;
  }

  const companySizeBand = acceptedSizeBand(row.companySizeBand ?? undefined);
  if (companySizeBand !== undefined) {
    context.companySizeBand = companySizeBand;
  }

  const description = trimmedOrAbsent(row.description ?? undefined);
  if (description !== undefined) {
    context.description = description;
  }

  const fullName = trimmedOrAbsent(row.contactFullName ?? undefined);
  if (fullName !== undefined) {
    const contact: WorkflowLeadContact = { fullName };
    const jobTitle = trimmedOrAbsent(row.contactJobTitle ?? undefined);
    if (jobTitle !== undefined) {
      contact.jobTitle = jobTitle;
    }

    const email = trimmedOrAbsent(row.contactEmail ?? undefined);
    if (email !== undefined) {
      contact.email = email;
    }

    const phone = trimmedOrAbsent(row.contactPhone ?? undefined);
    if (phone !== undefined) {
      contact.phone = phone;
    }

    const linkedinUrl = trimmedOrAbsent(row.contactLinkedinUrl ?? undefined);
    if (linkedinUrl !== undefined) {
      contact.linkedinUrl = linkedinUrl;
    }

    context.contact = contact;
  }

  return context;
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
    .where(
      and(
        eq(leads.leadId, leadId),
        eq(leads.createdByUserId, userId),
        isNull(leads.deletedAt),
      ),
    )
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
    .where(and(eq(leads.leadId, leadId), isNull(leads.deletedAt)))
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
      and(
        inArray(leads.leadId, leadIds),
        eq(leads.createdByUserId, userId),
        isNull(leads.deletedAt),
      ),
    );
}

/**
 * Company and contact fields for qualification, in the order of `leadIds`.
 * @param leadIds - Lead ids from the workflow run.
 * @returns One context per id.
 * @throws When a lead id has no row.
 */
export async function listLeadContextsByIds(
  leadIds: string[],
): Promise<WorkflowLeadContext[]> {
  if (leadIds.length === 0) {
    return [];
  }

  const rows = await requireDb()
    .select({
      leadId: leads.leadId,
      companyName: companies.name,
      website: companies.website,
      industry: companies.industry,
      location: companies.location,
      companySizeBand: companies.sizeBand,
      description: companies.description,
      contactFullName: contacts.fullName,
      contactJobTitle: contacts.jobTitle,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      contactLinkedinUrl: contacts.linkedinUrl,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.companyId))
    .leftJoin(contacts, eq(leads.primaryContactId, contacts.contactId))
    .where(inArray(leads.leadId, leadIds));

  const byId = new Map(rows.map((row) => [row.leadId, row]));
  return leadIds.map((leadId) => {
    const row = byId.get(leadId);
    if (row === undefined) {
      throw new Error(`Lead ${leadId} was not found.`);
    }

    return toLeadContext(row);
  });
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
      deletedAt: leads.deletedAt,
      companyName: companies.name,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.companyId))
    .where(and(eq(leads.createdByUserId, userId), isNull(leads.deletedAt)))
    .orderBy(desc(leads.createdAt), desc(leads.leadId));
}

/**
 * Lists leads from all owners with company, contact, owner, qualification,
 * latest workflow stage, ideal customer profiles from workflow runs, and
 * earliest follow-up due date, ranked by score.
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
      deletedAt: leads.deletedAt,
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
    .where(isNull(leads.deletedAt))
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

  const icpRows = await db
    .select({
      leadId: workflowRunLeads.leadId,
      icpId: workflowRuns.icpId,
      name: idealCustomerProfiles.name,
    })
    .from(workflowRunLeads)
    .innerJoin(
      workflowRuns,
      eq(workflowRunLeads.workflowRunId, workflowRuns.workflowRunId),
    )
    .innerJoin(
      idealCustomerProfiles,
      eq(workflowRuns.icpId, idealCustomerProfiles.icpId),
    )
    .where(inArray(workflowRunLeads.leadId, leadIds));

  const icpsByLeadId = new Map<string, LeadListDetailIcp[]>();
  for (const row of icpRows) {
    const list = icpsByLeadId.get(row.leadId) ?? [];
    if (!list.some((icp) => icp.icpId === row.icpId)) {
      list.push({ icpId: row.icpId, name: row.name });
      icpsByLeadId.set(row.leadId, list);
    }
  }

  for (const list of icpsByLeadId.values()) {
    list.sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) {
        return byName;
      }

      return a.icpId.localeCompare(b.icpId);
    });
  }

  return rows.map((row) => ({
    ...row,
    latestStage: latestStageByLeadId.get(row.leadId) ?? null,
    followUpDueAt: followUpDueAtByLeadId.get(row.leadId) ?? null,
    icps: icpsByLeadId.get(row.leadId) ?? [],
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

  const rows = await requireDb()
    .select()
    .from(sourceReferences)
    .where(or(...conditions))
    .orderBy(desc(sourceReferences.retrievedAt), desc(sourceReferences.sourceReferenceId));

  const seen = new Set<string>();
  const sources: SourceReference[] = [];
  for (const row of rows) {
    const key = sourceUrlKey(row.sourceUrl);
    if (key.length === 0) {
      sources.push(row);
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sources.push(row);
  }

  return sources;
}

type StoredCompanyMatch = {
  leadId: string;
  companyId: string;
  primaryContactId: string | null;
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
 * A source URL already stored for this lead or company is not stored again.
 * The contact email and profile URL stay on the contact. The company mailbox
 * and company LinkedIn URL stay on the company. An existing primary contact
 * is left unchanged. A lead with no primary contact gets one when a name is present.
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
  const contactEmail = trimmedOrAbsent(input.contactEmail);
  const contactLinkedinUrl = trimmedOrAbsent(input.contactLinkedinUrl);
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
          primaryContactId: leads.primaryContactId,
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

    const insertContact = async (forCompanyId: string, fullName: string): Promise<string> => {
      const contactRows = await tx
        .insert(contacts)
        .values({
          companyId: forCompanyId,
          fullName,
          jobTitle: jobTitle ?? null,
          email: contactEmail ?? null,
          phone: null,
          linkedinUrl: contactLinkedinUrl ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const contact = contactRows[0];
      if (!contact) {
        throw new Error("Contact was not created.");
      }

      storedContact = true;
      return contact.contactId;
    };

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
      const leadPatch: {
        deletedAt: null;
        updatedAt: Date;
        primaryContactId?: string;
      } = { deletedAt: null, updatedAt: now };

      if (existing.primaryContactId === null && contactName !== undefined) {
        contactId = await insertContact(companyId, contactName);
        leadPatch.primaryContactId = contactId;
      }

      await tx
        .update(leads)
        .set(leadPatch)
        .where(eq(leads.leadId, leadId));
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
        contactId = await insertContact(companyId, contactName);
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

    if (sourceUrl !== undefined) {
      const storedSources = await tx
        .select({ sourceReferenceId: sourceReferences.sourceReferenceId })
        .from(sourceReferences)
        .where(
          and(
            or(
              eq(sourceReferences.leadId, leadId),
              eq(sourceReferences.companyId, companyId),
            ),
            sql`lower(trim(${sourceReferences.sourceUrl})) = ${sourceUrlKey(sourceUrl)}`,
          ),
        )
        .limit(1);

      if (storedSources[0]) {
        return { leadId, storedContact };
      }
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
 * Stores a company, optional contact, and lead entered by the signed-in user.
 * The lead starts as manual and new. A manual source row records the entry.
 * @param userId - The user who owns the lead.
 * @param input - Company and contact facts. Company name is required.
 * @returns The new lead id.
 */
export async function insertManualLead(
  userId: string,
  input: ManualLeadFacts,
): Promise<string> {
  const companyName = input.companyName.trim();
  if (companyName.length === 0) {
    throw new Error("Company name is required.");
  }

  return requireDb().transaction(async (tx) => {
    const now = new Date();
    const companyRows = await tx
      .insert(companies)
      .values({
        name: companyName,
        website: input.website,
        industry: input.industry,
        sizeBand: input.companySizeBand,
        location: input.location,
        description: input.description,
        email: input.companyEmail,
        phone: input.companyPhone,
        linkedinUrl: input.companyLinkedinUrl,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const company = companyRows[0];
    if (!company) {
      throw new Error("Company was not created.");
    }

    let contactId: string | null = null;
    if (input.contactName !== null) {
      const contactRows = await tx
        .insert(contacts)
        .values({
          companyId: company.companyId,
          fullName: input.contactName,
          jobTitle: input.contactJobTitle,
          email: input.contactEmail,
          phone: input.contactPhone,
          linkedinUrl: input.contactLinkedinUrl,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const contact = contactRows[0];
      if (!contact) {
        throw new Error("Contact was not created.");
      }

      contactId = contact.contactId;
    }

    const leadRows = await tx
      .insert(leads)
      .values({
        companyId: company.companyId,
        primaryContactId: contactId,
        createdByUserId: userId,
        sourceType: "manual",
        lifecycleStatus: "new",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const lead = leadRows[0];
    if (!lead) {
      throw new Error("Lead was not created.");
    }

    const sourceRows = await tx
      .insert(sourceReferences)
      .values({
        companyId: company.companyId,
        contactId,
        leadId: lead.leadId,
        sourceProvider: "manual",
        sourceUrl: null,
        sourceTitle: "Manual entry",
        retrievedAt: now,
        rawSnippet: null,
      })
      .returning();

    if (!sourceRows[0]) {
      throw new Error("Source reference was not created.");
    }

    return lead.leadId;
  });
}

/**
 * Rewrites company and contact facts on a lead owned by the user.
 * Source, lifecycle, and owner stay as they are. A contact name updates or
 * creates the primary contact. No contact name clears the primary contact.
 * @param leadId - The lead to update.
 * @param userId - The user who must own the lead.
 * @param input - Company and contact facts. Company name is required.
 * @returns The lead id, or null when the lead is missing or owned by someone else.
 */
export async function updateLeadFacts(
  leadId: string,
  userId: string,
  input: ManualLeadFacts,
): Promise<string | null> {
  const companyName = input.companyName.trim();
  if (companyName.length === 0) {
    throw new Error("Company name is required.");
  }

  return requireDb().transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.leadId, leadId),
          eq(leads.createdByUserId, userId),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);

    const lead = existing[0];
    if (!lead) {
      return null;
    }

    const now = new Date();
    await tx
      .update(companies)
      .set({
        name: companyName,
        website: input.website,
        industry: input.industry,
        sizeBand: input.companySizeBand,
        location: input.location,
        description: input.description,
        email: input.companyEmail,
        phone: input.companyPhone,
        linkedinUrl: input.companyLinkedinUrl,
        updatedAt: now,
      })
      .where(eq(companies.companyId, lead.companyId));

    let primaryContactId = lead.primaryContactId;
    if (input.contactName === null) {
      primaryContactId = null;
    } else if (primaryContactId !== null) {
      await tx
        .update(contacts)
        .set({
          fullName: input.contactName,
          jobTitle: input.contactJobTitle,
          email: input.contactEmail,
          phone: input.contactPhone,
          linkedinUrl: input.contactLinkedinUrl,
          updatedAt: now,
        })
        .where(eq(contacts.contactId, primaryContactId));
    } else {
      const contactRows = await tx
        .insert(contacts)
        .values({
          companyId: lead.companyId,
          fullName: input.contactName,
          jobTitle: input.contactJobTitle,
          email: input.contactEmail,
          phone: input.contactPhone,
          linkedinUrl: input.contactLinkedinUrl,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const contact = contactRows[0];
      if (!contact) {
        throw new Error("Contact was not created.");
      }

      primaryContactId = contact.contactId;
    }

    await tx
      .update(leads)
      .set({ primaryContactId, updatedAt: now })
      .where(eq(leads.leadId, leadId));

    return leadId;
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

/**
 * Marks a lead owned by the user as deleted.
 * Company, contact, sources, and workflow rows stay.
 * @param leadId - The lead to delete.
 * @param userId - The user who must own the lead.
 * @returns The lead, or null when it is missing, already deleted, or owned by someone else.
 */
export async function deleteLead(
  leadId: string,
  userId: string,
): Promise<Lead | null> {
  const rows = await requireDb()
    .update(leads)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(leads.leadId, leadId),
        eq(leads.createdByUserId, userId),
        isNull(leads.deletedAt),
      ),
    )
    .returning();

  return rows[0] ?? null;
}
