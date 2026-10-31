import {
  deleteIdealCustomerProfile,
  findIdealCustomerProfileById,
  findWorkflowRunByIcpId,
  insertIdealCustomerProfile,
  listIdealCustomerProfilesByUser,
  updateIdealCustomerProfile,
  updateIdealCustomerProfileActive,
  type IdealCustomerProfileCriteria,
} from "@ithaca/db";
import type {
  CreateIdealCustomerProfileResponse,
  DeleteIdealCustomerProfileResponse,
  ListIdealCustomerProfilesResponse,
  UpdateIdealCustomerProfileActiveResponse,
  UpdateIdealCustomerProfileResponse,
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
  profileDeletedMessage,
  profileInUseMessage,
  profileNameTakenMessage,
  profileUpdatedMessage,
} from "../lib/profileInput.js";

const profileNotFound = { message: "Ideal customer profile not found." };

function isCriteriaError(
  value: IdealCustomerProfileCriteria | { message: string },
): value is { message: string } {
  return "message" in value;
}

function readProfileCriteria(
  body: Record<string, unknown>,
): IdealCustomerProfileCriteria | { message: string } {
  const name = readText(body.name);
  if (!name) {
    return { message: "Name is required." };
  }

  const companySizeMin = requireWholeNumber(
    body.companySizeMin,
    "Company size must be a whole number.",
  );
  if (isFieldError(companySizeMin)) {
    return companySizeMin;
  }

  const companySizeMax = requireWholeNumber(
    body.companySizeMax,
    "Company size must be a whole number.",
  );
  if (isFieldError(companySizeMax)) {
    return companySizeMax;
  }

  if (
    companySizeMin !== null &&
    companySizeMax !== null &&
    companySizeMin > companySizeMax
  ) {
    return { message: "Company size minimum cannot exceed the maximum." };
  }

  const budgetMin = requireWholeNumber(
    body.budgetMin,
    "Budget must be a whole number.",
  );
  if (isFieldError(budgetMin)) {
    return budgetMin;
  }

  const budgetMax = requireWholeNumber(
    body.budgetMax,
    "Budget must be a whole number.",
  );
  if (isFieldError(budgetMax)) {
    return budgetMax;
  }

  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    return { message: "Budget minimum cannot exceed the maximum." };
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
    return { message: criteriaError };
  }

  return {
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
  };
}

export const profilesRouter = Router();

profilesRouter.post("/", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const body = asRecord(req.body);
  const criteria = readProfileCriteria(body);
  if (isCriteriaError(criteria)) {
    res.status(400).json(criteria);
    return;
  }

  try {
    const row = await insertIdealCustomerProfile({
      userId,
      ...criteria,
      isActive: body.isActive !== false,
    });
    const response: CreateIdealCustomerProfileResponse = {
      message: profileCreatedMessage,
      profile: mapProfile(row),
    };
    res.status(201).json(response);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ message: profileNameTakenMessage });
      return;
    }

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

profilesRouter.patch("/:icpId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const icpId = req.params.icpId;
  if (!isUuid(icpId)) {
    res.status(404).json({ message: "Ideal customer profile not found." });
    return;
  }

  const body = asRecord(req.body);
  if (typeof body.isActive !== "boolean") {
    res.status(400).json({ message: "Active must be true or false." });
    return;
  }

  try {
    const row = await updateIdealCustomerProfileActive(
      icpId,
      userId,
      body.isActive,
    );
    if (!row) {
      res.status(404).json({ message: "Ideal customer profile not found." });
      return;
    }

    const response: UpdateIdealCustomerProfileActiveResponse = {
      profile: mapProfile(row),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

profilesRouter.put("/:icpId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const icpId = req.params.icpId;
  if (!isUuid(icpId)) {
    res.status(404).json(profileNotFound);
    return;
  }

  const criteria = readProfileCriteria(asRecord(req.body));
  if (isCriteriaError(criteria)) {
    res.status(400).json(criteria);
    return;
  }

  try {
    const row = await updateIdealCustomerProfile(icpId, userId, criteria);
    if (!row) {
      res.status(404).json(profileNotFound);
      return;
    }

    const response: UpdateIdealCustomerProfileResponse = {
      message: profileUpdatedMessage,
      profile: mapProfile(row),
    };
    res.status(200).json(response);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ message: profileNameTakenMessage });
      return;
    }

    sendFailure(res, err);
  }
});

function postgresErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) {
    return undefined;
  }

  return typeof err.code === "string" ? err.code : undefined;
}

function isPostgresError(err: unknown, code: string): boolean {
  if (postgresErrorCode(err) === code) {
    return true;
  }

  if (typeof err === "object" && err !== null && "cause" in err) {
    return postgresErrorCode(err.cause) === code;
  }

  return false;
}

function isForeignKeyViolation(err: unknown): boolean {
  return isPostgresError(err, "23503");
}

function isUniqueViolation(err: unknown): boolean {
  return isPostgresError(err, "23505");
}

profilesRouter.delete("/:icpId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const icpId = req.params.icpId;
  if (!isUuid(icpId)) {
    res.status(404).json(profileNotFound);
    return;
  }

  try {
    const row = await findIdealCustomerProfileById(icpId, userId);
    if (!row) {
      res.status(404).json(profileNotFound);
      return;
    }

    const run = await findWorkflowRunByIcpId(icpId);
    if (run) {
      res.status(409).json({ message: profileInUseMessage });
      return;
    }

    const deleted = await deleteIdealCustomerProfile(icpId, userId);
    if (!deleted) {
      res.status(404).json(profileNotFound);
      return;
    }

    const response: DeleteIdealCustomerProfileResponse = {
      message: profileDeletedMessage,
    };
    res.status(200).json(response);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      res.status(409).json({ message: profileInUseMessage });
      return;
    }

    sendFailure(res, err);
  }
});
