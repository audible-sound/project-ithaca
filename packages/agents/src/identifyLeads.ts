import {
  enrichContactEmail,
  searchCompanies,
  searchPeople,
} from "@ithaca/exa";
import type {
  CompanySearchResult,
  EmailEnrichmentRequest,
  EmailEnrichmentResponse,
  PeopleSearchQuery,
  PeopleSearchResponse,
} from "@ithaca/exa";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  IdentifiedLeadCandidate,
} from "@ithaca/shared";

const contactLookupLimit = 3;

export interface AttachedCompanyContact {
  contactName?: string;
  jobTitle?: string;
  contactEmail?: string;
  contactLinkedinUrl?: string;
  estimatedCost?: number;
}

export interface CompanyContactClients {
  searchPeople: (query: PeopleSearchQuery) => Promise<PeopleSearchResponse>;
  enrichEmail: (request: EmailEnrichmentRequest) => Promise<EmailEnrichmentResponse>;
}

function assignCandidate(
  candidate: IdentifiedLeadCandidate,
  key:
    | "website"
    | "description"
    | "industry"
    | "location"
    | "companySizeBand"
    | "contactName"
    | "jobTitle"
    | "email"
    | "phone"
    | "linkedinUrl"
    | "contactEmail"
    | "contactLinkedinUrl"
    | "sourceUrl"
    | "rawSnippet",
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }

  candidate[key] = value;
}

/**
 * Sums Exa costs from the company search, people searches, and email runs.
 * @param parts - Provider totals. Missing or invalid parts are skipped.
 * @returns The rounded sum, or undefined when no part was present.
 */
export function identificationCost(
  parts: readonly (number | undefined)[],
): number | undefined {
  let total = 0;
  let seen = false;
  for (const part of parts) {
    if (part === undefined || !Number.isFinite(part) || part < 0) {
      continue;
    }

    total += part;
    seen = true;
  }

  if (!seen) {
    return undefined;
  }

  return Math.round(total * 1_000_000) / 1_000_000;
}

function assignAttached(
  attached: AttachedCompanyContact,
  key: "jobTitle" | "contactEmail" | "contactLinkedinUrl" | "estimatedCost",
  value: string | number | undefined,
): void {
  if (value === undefined) {
    return;
  }

  if (key === "estimatedCost") {
    if (typeof value === "number") {
      attached.estimatedCost = value;
    }
    return;
  }

  if (typeof value === "string") {
    attached[key] = value;
  }
}

/**
 * Finds one person at a company and, only when that person matches, asks for a work email.
 * A people-search failure leaves the company without a contact. An email failure keeps the person.
 * @param companyName - Company the person must currently work at.
 * @param location - Company location, when the company result has one.
 * @param clients - People search and email lookup. Email lookup runs only after a person matches.
 * @returns Contact fields to store, plus the Exa cost of the lookups that returned a total.
 */
export async function attachCompanyContact(
  companyName: string,
  location: string | undefined,
  clients: CompanyContactClients,
): Promise<AttachedCompanyContact> {
  let people: PeopleSearchResponse;
  try {
    people = await clients.searchPeople({
      companyName,
      ...(location === undefined ? {} : { location }),
    });
  } catch {
    return {};
  }

  const costs: (number | undefined)[] = [people.estimatedCost];
  const contact = people.contact;
  if (contact === undefined) {
    const attached: AttachedCompanyContact = {};
    assignAttached(attached, "estimatedCost", identificationCost(costs));
    return attached;
  }

  let email: EmailEnrichmentResponse = {};
  try {
    email = await clients.enrichEmail({
      personName: contact.name,
      companyName,
      ...(contact.profileUrl === undefined ? {} : { profileUrl: contact.profileUrl }),
    });
  } catch {
    email = {};
  }

  costs.push(email.estimatedCost);
  const attached: AttachedCompanyContact = { contactName: contact.name };
  assignAttached(attached, "jobTitle", contact.jobTitle);
  assignAttached(attached, "contactEmail", email.email);
  assignAttached(attached, "contactLinkedinUrl", contact.profileUrl);
  assignAttached(attached, "estimatedCost", identificationCost(costs));
  return attached;
}

function toIdentifiedLeadCandidate(
  hit: CompanySearchResult,
  contact: AttachedCompanyContact | undefined,
): IdentifiedLeadCandidate {
  const candidate: IdentifiedLeadCandidate = { companyName: hit.name };

  assignCandidate(candidate, "website", hit.website);
  assignCandidate(candidate, "description", hit.description);
  assignCandidate(candidate, "industry", hit.industry);
  assignCandidate(candidate, "location", hit.location);
  assignCandidate(candidate, "companySizeBand", hit.companySizeBand);
  assignCandidate(candidate, "email", hit.email);
  assignCandidate(candidate, "phone", hit.phone);
  assignCandidate(candidate, "linkedinUrl", hit.linkedinUrl);
  assignCandidate(candidate, "sourceUrl", hit.sourceUrl);
  assignCandidate(candidate, "rawSnippet", hit.rawText);
  assignCandidate(candidate, "contactName", contact?.contactName);
  assignCandidate(candidate, "jobTitle", contact?.jobTitle);
  assignCandidate(candidate, "contactEmail", contact?.contactEmail);
  assignCandidate(candidate, "contactLinkedinUrl", contact?.contactLinkedinUrl);

  return candidate;
}

async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }

      results[index] = await worker(item);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function identifyLeads(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  const search = await searchCompanies({
    industries: icp.industries,
    locations: icp.locations,
    keywords: icp.businessNeedKeywords,
  });
  const clients: CompanyContactClients = {
    searchPeople,
    enrichEmail: enrichContactEmail,
  };
  const contacts = await mapWithLimit(search.companies, contactLookupLimit, (company) =>
    attachCompanyContact(company.name, company.location, clients),
  );
  const candidates = search.companies.map((company, index) =>
    toIdentifiedLeadCandidate(company, contacts[index]),
  );
  const result: AgentStageResult = {
    stage: "identify",
    status: "completed",
    message:
      candidates.length === 0
        ? "Lead identification completed with no matching companies."
        : "Potential B2B companies returned from publicly accessible sources that match the ideal customer profile.",
    candidates,
  };
  const estimatedCost = identificationCost([
    search.estimatedCost,
    ...contacts.map((contact) => contact?.estimatedCost),
  ]);
  if (estimatedCost !== undefined) {
    result.estimatedCost = estimatedCost;
  }

  return result;
}
