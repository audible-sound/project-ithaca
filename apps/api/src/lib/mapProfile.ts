import type { IdealCustomerProfile as IdealCustomerProfileRow } from "@ithaca/db";
import type { IdealCustomerProfile } from "@ithaca/shared";
import { asRecord, readStringList, readText, toIso } from "./parse.js";

function readAmount(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function firstText(value: unknown, fallback: string): string {
  const items = readStringList(value);
  return items[0] ?? fallback;
}

export function mapProfile(row: IdealCustomerProfileRow): IdealCustomerProfile {
  const industryRecord = asRecord(row.industries);
  const industries = Array.isArray(row.industries)
    ? readStringList(row.industries)
    : readStringList(industryRecord.include);
  const industriesExclude = Array.isArray(row.industries)
    ? []
    : readStringList(industryRecord.exclude);

  const locationRecord = asRecord(row.locations);
  const storedLocations = Array.isArray(row.locations)
    ? readStringList(row.locations)
    : [];
  const countries = readStringList(locationRecord.countries);
  const regions = readStringList(locationRecord.regions);
  const cities = readStringList(locationRecord.cities);
  const legacyCountry = Array.isArray(row.locations)
    ? ""
    : readText(locationRecord.country);
  const legacyRegion = Array.isArray(row.locations)
    ? ""
    : readText(locationRecord.region);
  const legacyCity = Array.isArray(row.locations) ? "" : readText(locationRecord.city);
  const country = firstText(locationRecord.countries, legacyCountry);
  const region = firstText(locationRecord.regions, legacyRegion);
  const city = firstText(locationRecord.cities, legacyCity);
  const structuredLocations = [...countries, ...regions, ...cities];
  const singularLocations = [legacyCountry, legacyRegion, legacyCity].filter(
    (part) => part.length > 0,
  );
  const locations =
    storedLocations.length > 0
      ? storedLocations
      : structuredLocations.length > 0
        ? structuredLocations
        : singularLocations;

  const budget = asRecord(row.budget);
  const otherCriteria = asRecord(row.otherCriteria);
  const budgetMin =
    readAmount(budget, "minAmount") ?? readAmount(budget, "min");
  const budgetMax =
    readAmount(budget, "maxAmount") ?? readAmount(budget, "max");
  const needRecord = asRecord(row.businessNeedKeywords);
  const businessNeedKeywords = Array.isArray(row.businessNeedKeywords)
    ? readStringList(row.businessNeedKeywords)
    : readStringList(needRecord.keywords);
  const storedDescription = Array.isArray(row.businessNeedKeywords)
    ? ""
    : readText(needRecord.description);
  const businessNeedDescription =
    storedDescription || readText(otherCriteria.businessNeedDescription);

  return {
    icpId: row.icpId,
    name: row.name,
    industries,
    industriesExclude,
    locations,
    country,
    region,
    city,
    companySizeMin: row.companySizeMin,
    companySizeMax: row.companySizeMax,
    budgetCurrency: readText(budget.currency),
    budgetMin,
    budgetMax,
    budgetNotes: readText(budget.notes),
    businessNeedKeywords,
    businessNeedDescription,
    outreachTone: row.outreachTone,
    messageConstraints: row.messageConstraints,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}
