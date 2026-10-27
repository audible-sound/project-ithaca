import { exaHeaders, readEstimatedCost, readExaApiKey, readExaJson, readRecord } from "./exaApi.js";
import { pickCompanyContact } from "./pickCompanyContact.js";
import type { CompanyContact } from "./pickCompanyContact.js";

export interface PeopleSearchQuery {
  companyName: string;
  location?: string;
}

export interface PeopleSearchResponse {
  contact?: CompanyContact;
  estimatedCost?: number;
}

const peopleSearchFailed = "Exa people search failed.";

function buildPeopleQuery(query: PeopleSearchQuery): string {
  const name = query.companyName.trim();
  const location = query.location?.trim() ?? "";
  if (location.length > 0) {
    return `Founder, owner, or managing director at ${name} in ${location}`;
  }

  return `Founder, owner, or managing director at ${name}`;
}

function readResults(body: unknown): unknown[] {
  const record = readRecord(body);
  if (record === undefined || !Array.isArray(record.results)) {
    throw new Error(peopleSearchFailed);
  }

  return record.results;
}

/**
 * Searches Exa for one current person at a company.
 * Uses `category: "people"` and `type: "lite"`. Page summaries are not requested.
 * @param query - The company name, and its location when known.
 * @returns The matched person, when one is current at that company, and the search cost.
 */
export async function searchPeople(query: PeopleSearchQuery): Promise<PeopleSearchResponse> {
  const companyName = query.companyName.trim();
  if (companyName.length === 0) {
    return {};
  }

  const apiKey = readExaApiKey();
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: exaHeaders(apiKey),
    body: JSON.stringify({
      query: buildPeopleQuery({ companyName, ...(query.location === undefined ? {} : { location: query.location }) }),
      type: "lite",
      category: "people",
      numResults: 5,
    }),
  });
  const body = await readExaJson(response, peopleSearchFailed);
  const contact = pickCompanyContact(companyName, readResults(body));
  const searchResponse: PeopleSearchResponse = {};
  if (contact !== undefined) {
    searchResponse.contact = contact;
  }
  const estimatedCost = readEstimatedCost(body);
  if (estimatedCost !== undefined) {
    searchResponse.estimatedCost = estimatedCost;
  }

  return searchResponse;
}
