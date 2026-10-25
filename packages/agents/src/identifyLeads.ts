import { searchCompanies } from "@ithaca/exa";
import type { CompanySearchResult } from "@ithaca/exa";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  IdentifiedLeadCandidate,
} from "@ithaca/shared";

function assignCandidate(
  candidate: IdentifiedLeadCandidate,
  key:
    | "website"
    | "description"
    | "industry"
    | "location"
    | "companySizeBand"
    | "email"
    | "phone"
    | "linkedinUrl"
    | "sourceUrl"
    | "rawSnippet",
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }

  candidate[key] = value;
}

function toIdentifiedLeadCandidate(
  hit: CompanySearchResult,
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

  return candidate;
}

export async function identifyLeads(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  const search = await searchCompanies({
    industries: icp.industries,
    locations: icp.locations,
    keywords: icp.businessNeedKeywords,
  });

  const candidates = search.companies.map(toIdentifiedLeadCandidate);

  const result: AgentStageResult = {
    stage: "identify",
    status: "completed",
    message:
      candidates.length === 0
        ? "Lead identification completed with no matching companies."
        : "Potential B2B companies returned from publicly accessible sources that match the ideal customer profile.",
    candidates,
  };
  if (search.estimatedCost !== undefined) {
    result.estimatedCost = search.estimatedCost;
  }

  return result;
}
