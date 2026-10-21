import { searchCompanies } from "@ithaca/exa";
import type { CompanySearchResult } from "@ithaca/exa";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  IdentifiedLeadCandidate,
} from "@ithaca/shared";

function toIdentifiedLeadCandidate(
  hit: CompanySearchResult,
): IdentifiedLeadCandidate {
  const candidate: IdentifiedLeadCandidate = { companyName: hit.name };

  if (hit.website !== undefined) {
    candidate.website = hit.website;
  }
  if (hit.snippet !== undefined) {
    candidate.description = hit.snippet;
    candidate.rawSnippet = hit.snippet;
  }
  if (hit.sourceUrl !== undefined) {
    candidate.sourceUrl = hit.sourceUrl;
  }

  return candidate;
}

export async function identifyLeads(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  const results = await searchCompanies({
    industries: icp.industries,
    locations: icp.locations,
    keywords: icp.businessNeedKeywords,
  });

  const candidates = results.map(toIdentifiedLeadCandidate);

  return {
    stage: "identify",
    status: "completed",
    message:
      candidates.length === 0
        ? "Lead identification completed with no matching companies."
        : "Potential B2B companies returned from publicly accessible sources that match the ideal customer profile.",
    candidates,
  };
}
