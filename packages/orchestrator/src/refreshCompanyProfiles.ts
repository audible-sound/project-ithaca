import { isCompanyPageText, parseStoredCompanyPage } from "@ithaca/agents";
import { companySizeBands, fillCompanyProfiles, listCompanyProfileSources } from "@ithaca/db";
import type { CompanyProfileFill, CompanyProfileSource, CompanySizeBand } from "@ithaca/db";

function pageText(rawSnippet: unknown): string | undefined {
  if (typeof rawSnippet !== "string") {
    return undefined;
  }

  const trimmed = rawSnippet.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function blank(value: string | null): boolean {
  return value === null || value.trim() === "";
}

function acceptedSizeBand(value: string | undefined): CompanySizeBand | undefined {
  if (value === undefined) {
    return undefined;
  }

  for (const band of companySizeBands) {
    if (band === value) {
      return band;
    }
  }

  return undefined;
}

function nextDescription(
  current: string | null,
  parsed: string | undefined,
): string | null | undefined {
  const raw = current !== null && isCompanyPageText(current);
  if (!blank(current) && !raw) {
    return undefined;
  }
  if (parsed !== undefined) {
    return current === parsed ? undefined : parsed;
  }
  if (raw) {
    return null;
  }

  return undefined;
}

function companyFill(source: CompanyProfileSource): CompanyProfileFill | undefined {
  const text = pageText(source.rawSnippet);
  if (text === undefined) {
    return undefined;
  }

  const facts = parseStoredCompanyPage({ text });
  const fill: CompanyProfileFill = { companyId: source.companyId };
  let changed = false;

  if (blank(source.website) && facts.homepage !== undefined) {
    fill.website = facts.homepage;
    changed = true;
  }
  if (source.industry === null && facts.industry !== undefined) {
    fill.industry = facts.industry;
    changed = true;
  }
  if (source.location === null && facts.location !== undefined) {
    fill.location = facts.location;
    changed = true;
  }
  const sizeBand = acceptedSizeBand(facts.companySizeBand);
  if (source.sizeBand === null && sizeBand !== undefined) {
    fill.sizeBand = sizeBand;
    changed = true;
  }
  const description = nextDescription(source.description, facts.description);
  if (description !== undefined) {
    fill.description = description;
    changed = true;
  }
  if (source.email === null && facts.email !== undefined) {
    fill.email = facts.email;
    changed = true;
  }
  if (source.phone === null && facts.phone !== undefined) {
    fill.phone = facts.phone;
    changed = true;
  }
  if (source.linkedinUrl === null && facts.linkedinUrl !== undefined) {
    fill.linkedinUrl = facts.linkedinUrl;
    changed = true;
  }

  return changed ? fill : undefined;
}

/**
 * Fills empty company facts from Exa pages already stored on the lead (source references table).
 * Does not call Exa again.
 * @returns How many companies were updated.
 */
export async function refreshStoredCompanyProfiles(): Promise<number> {
  const sources = await listCompanyProfileSources();
  const fills: CompanyProfileFill[] = [];
  for (const source of sources) {
    const fill = companyFill(source);
    if (fill !== undefined) {
      fills.push(fill);
    }
  }

  await fillCompanyProfiles(fills);
  return fills.length;
}
