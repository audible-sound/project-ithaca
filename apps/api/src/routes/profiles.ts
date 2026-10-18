import {
  findIdealCustomerProfileById,
  insertIdealCustomerProfile,
  listIdealCustomerProfilesByUser,
} from "@ithaca/db";
import type { IdealCustomerProfile as IdealCustomerProfileRow } from "@ithaca/db";
import type {
  CreateIdealCustomerProfileResponse,
  IdealCustomerProfile,
  ListIdealCustomerProfilesResponse,
} from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import {
  asRecord,
  isFieldError,
  readOptionalText,
  readStringList,
  readText,
  requireWholeNumber,
  toIso,
} from "../lib/parse.js";
import {
  normalizedBudgetCurrency,
  profileCreatedMessage,
  profileCriteriaError,
} from "../lib/profileInput.js";

export const profilesRouter = Router();

const icpIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readAmount(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function firstText(value: unknown, fallback: string): string {
  const items = readStringList(value);
  return items[0] ?? fallback;
}

function mapProfile(row: IdealCustomerProfileRow): IdealCustomerProfile {
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

profilesRouter.post("/", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const body = asRecord(req.body);
  const name = readText(body.name);
  if (!name) {
    res.status(400).json({ message: "Name is required." });
    return;
  }

  const companySizeMin = requireWholeNumber(
    body.companySizeMin,
    "Company size must be a whole number.",
  );
  if (isFieldError(companySizeMin)) {
    res.status(400).json(companySizeMin);
    return;
  }

  const companySizeMax = requireWholeNumber(
    body.companySizeMax,
    "Company size must be a whole number.",
  );
  if (isFieldError(companySizeMax)) {
    res.status(400).json(companySizeMax);
    return;
  }

  if (
    companySizeMin !== null &&
    companySizeMax !== null &&
    companySizeMin > companySizeMax
  ) {
    res.status(400).json({
      message: "Company size minimum cannot exceed the maximum.",
    });
    return;
  }

  const budgetMin = requireWholeNumber(
    body.budgetMin,
    "Budget must be a whole number.",
  );
  if (isFieldError(budgetMin)) {
    res.status(400).json(budgetMin);
    return;
  }

  const budgetMax = requireWholeNumber(
    body.budgetMax,
    "Budget must be a whole number.",
  );
  if (isFieldError(budgetMax)) {
    res.status(400).json(budgetMax);
    return;
  }

  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    res.status(400).json({
      message: "Budget minimum cannot exceed the maximum.",
    });
    return;
  }

  const industriesInclude = readStringList(body.industries);
  const industriesExclude = readStringList(body.industriesExclude);
  const country = readText(body.country);
  const region = readText(body.region);
  const city = readText(body.city);
  const budgetCurrency = readText(body.budgetCurrency);
  const budgetNotes = readText(body.budgetNotes);
  const criteriaError = profileCriteriaError({
    name,
    industries: industriesInclude,
    industriesExclude,
    country,
    region,
    city,
    companySizeMin,
    companySizeMax,
    budgetCurrency,
    budgetMin,
    budgetMax,
    budgetNotes,
  });
  if (criteriaError) {
    res.status(400).json({ message: criteriaError });
    return;
  }

  try {
    const row = await insertIdealCustomerProfile({
      userId,
      name,
      industriesInclude,
      industriesExclude,
      country,
      region,
      city,
      locations: readStringList(body.locations),
      companySizeMin,
      companySizeMax,
      budgetCurrency: normalizedBudgetCurrency(budgetCurrency),
      budgetMin,
      budgetMax,
      budgetNotes,
      businessNeedKeywords: readStringList(body.businessNeedKeywords),
      businessNeedDescription: readText(body.businessNeedDescription),
      outreachTone: readOptionalText(body.outreachTone),
      messageConstraints: readOptionalText(body.messageConstraints),
      isActive: body.isActive !== false,
    });
    const response: CreateIdealCustomerProfileResponse = {
      message: profileCreatedMessage,
      profile: mapProfile(row),
    };
    res.status(201).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

profilesRouter.get("/", async (req, res) => {

  // Get the user ID from the authentication token
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  try {
    // Fetch all ideal customer profiles for the user
    const rows = await listIdealCustomerProfilesByUser(userId);
    const response: ListIdealCustomerProfilesResponse = {
      profiles: rows.map(mapProfile),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

profilesRouter.get("/:icpId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  // Validate the ICP ID
  const icpId = req.params.icpId;
  if (!icpIdPattern.test(icpId)) {
    res.status(404).json({ message: "Ideal customer profile not found." });
    return;
  }

  try {
    // Fetch the ideal customer profile by ID
    const row = await findIdealCustomerProfileById(icpId, userId);
    if (!row) {
      res.status(404).json({ message: "Ideal customer profile not found." });
      return;
    }

    res.status(200).json(mapProfile(row));
  } catch (err) {
    sendFailure(res, err);
  }
});
