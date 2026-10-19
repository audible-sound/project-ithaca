import {
  findIdealCustomerProfileById,
  insertIdealCustomerProfile,
  listIdealCustomerProfilesByUser,
} from "@ithaca/db";
import type {
  CreateIdealCustomerProfileResponse,
  ListIdealCustomerProfilesResponse,
} from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import { mapProfile } from "../lib/mapProfile.js";
import {
  asRecord,
  isFieldError,
  isUuid,
  readOptionalText,
  readStringList,
  readText,
  requireWholeNumber,
} from "../lib/parse.js";
import {
  normalizedBudgetCurrency,
  profileCreatedMessage,
  profileCriteriaError,
} from "../lib/profileInput.js";

export const profilesRouter = Router();

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
  if (!isUuid(icpId)) {
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
