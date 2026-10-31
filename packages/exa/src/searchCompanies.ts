import { parseCompanyProfile } from "./parseCompanyProfile.js";

export interface CompanySearchQuery {
  industries?: string[];
  locations?: string[];
  keywords?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  limit?: number;
}

export interface CompanySearchResult {
  name: string;
  website?: string;
  sourceUrl?: string;
  /** Readable company write-up. Absent when the page has no entity description or About section. */
  description?: string;
  /** Full page text, kept as the source snippet. Not shown as the description. */
  rawText?: string;
  industry?: string;
  location?: string;
  companySizeBand?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface CompanySearchResponse {
  companies: CompanySearchResult[];
  estimatedCost?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clauseValues(values: string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  const trimmed: string[] = [];
  for (const value of values) {
    const next = value.trim();
    if (next.length > 0) {
      trimmed.push(next);
    }
  }
  return trimmed;
}

function finiteBound(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function companySizeClause(
  minimum: number | undefined,
  maximum: number | undefined,
): string | undefined {
  if (minimum !== undefined && maximum !== undefined) {
    return `with ${minimum} to ${maximum} employees`;
  }

  if (minimum !== undefined) {
    return `with at least ${minimum} employees`;
  }

  if (maximum !== undefined) {
    return `with at most ${maximum} employees`;
  }

  return undefined;
}

function buildCompanyQuery(query: CompanySearchQuery): string {
  const parts = ["Companies"];
  const industries = clauseValues(query.industries);
  const locations = clauseValues(query.locations);
  const keywords = clauseValues(query.keywords);
  const companySize = companySizeClause(
    finiteBound(query.companySizeMin),
    finiteBound(query.companySizeMax),
  );

  if (industries.length > 0) {
    parts.push(`in ${industries.join(", ")}`);
  }
  if (locations.length > 0) {
    parts.push(`located in ${locations.join(", ")}`);
  }
  if (companySize !== undefined) {
    parts.push(companySize);
  }
  if (keywords.length > 0) {
    parts.push(`needing ${keywords.join(", ")}`);
  }

  return parts.join(" ");
}

function resolveNumResults(limit: number | undefined): number {
  if (
    limit !== undefined &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= 100
  ) {
    return limit;
  }

  return 10;
}

function readExaApiKey(): string {
  const key = process.env.EXA_API_KEY?.trim() ?? "";
  if (key.length === 0) {
    throw new Error("EXA_API_KEY is required.");
  }

  return key;
}

function readUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readPageText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function assignFact(
  result: CompanySearchResult,
  key:
    | "description"
    | "industry"
    | "location"
    | "companySizeBand"
    | "email"
    | "phone"
    | "linkedinUrl",
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }

  result[key] = value;
}

function mapSearchHit(entry: unknown): CompanySearchResult | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const title = entry.title;
  if (typeof title !== "string") {
    return undefined;
  }

  const name = title.trim();
  if (name.length === 0) {
    return undefined;
  }

  const result: CompanySearchResult = { name };
  const sourceUrl = readUrl(entry.url);
  const pageText = readPageText(entry.text);
  const profile = parseCompanyProfile({
    ...(pageText === undefined ? {} : { text: pageText }),
    entities: entry.entities,
  });
  const website = profile.homepage ?? sourceUrl;

  if (sourceUrl !== undefined) {
    result.sourceUrl = sourceUrl;
  }
  if (website !== undefined) {
    result.website = website;
  }
  if (pageText !== undefined) {
    result.rawText = pageText;
  }

  assignFact(result, "description", profile.description);
  assignFact(result, "industry", profile.industry);
  assignFact(result, "location", profile.location);
  assignFact(result, "companySizeBand", profile.companySizeBand);
  assignFact(result, "email", profile.email);
  assignFact(result, "phone", profile.phone);
  assignFact(result, "linkedinUrl", profile.linkedinUrl);

  return result;
}

function readResults(body: unknown): unknown[] {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new Error("Exa search failed.");
  }

  return body.results;
}

function readEstimatedCost(body: unknown): number | undefined {
  if (!isRecord(body) || !isRecord(body.costDollars)) {
    return undefined;
  }

  const total = body.costDollars.total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    return undefined;
  }

  return total;
}

export async function searchCompanies(
  query: CompanySearchQuery,
): Promise<CompanySearchResponse> {
  const apiKey = readExaApiKey();
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: buildCompanyQuery(query),
      type: "auto",
      category: "company",
      numResults: resolveNumResults(query.limit),
      contents: { highlights: true, text: true },
    }),
  });

  if (!response.ok) {
    throw new Error("Exa search failed.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Exa search failed.");
  }

  const companies: CompanySearchResult[] = [];
  for (const entry of readResults(body)) {
    const company = mapSearchHit(entry);
    if (company !== undefined) {
      companies.push(company);
    }
  }

  const searchResponse: CompanySearchResponse = { companies };
  const estimatedCost = readEstimatedCost(body);
  if (estimatedCost !== undefined) {
    searchResponse.estimatedCost = estimatedCost;
  }

  return searchResponse;
}
