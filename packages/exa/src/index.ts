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

/**
 * Exa search client stub. Real Exa API calls will be wired later.
 */
export async function searchCompanies(
  query: CompanySearchQuery,
): Promise<CompanySearchResult[]> {
  void query;
  return [];
}
