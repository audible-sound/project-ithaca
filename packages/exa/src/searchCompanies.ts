export interface CompanySearchQuery {
  industries?: string[];
  locations?: string[];
  keywords?: string[];
  limit?: number;
}

export interface CompanySearchResult {
  name: string;
  website?: string;
  snippet?: string;
  sourceUrl?: string;
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

function buildCompanyQuery(query: CompanySearchQuery): string {
  const parts = ["Companies"];
  const industries = clauseValues(query.industries);
  const locations = clauseValues(query.locations);
  const keywords = clauseValues(query.keywords);

  if (industries.length > 0) {
    parts.push(`in ${industries.join(", ")}`);
  }
  if (locations.length > 0) {
    parts.push(`located in ${locations.join(", ")}`);
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

function readSnippet(highlights: unknown, text: unknown): string | undefined {
  if (Array.isArray(highlights)) {
    for (const highlight of highlights) {
      if (typeof highlight !== "string") {
        continue;
      }

      const trimmed = highlight.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  if (typeof text === "string") {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return undefined;
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
  const url = entry.url;
  if (typeof url === "string") {
    const trimmedUrl = url.trim();
    if (trimmedUrl.length > 0) {
      result.website = trimmedUrl;
      result.sourceUrl = trimmedUrl;
    }
  }

  const snippet = readSnippet(entry.highlights, entry.text);
  if (snippet !== undefined) {
    result.snippet = snippet;
  }

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
