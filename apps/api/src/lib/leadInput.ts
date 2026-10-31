import {
  companySizeBands,
  type CompanySizeBand,
  type ManualLeadFacts,
} from "@ithaca/db";
import { readOptionalText, readText, readWholeNumber } from "./parse.js";

const emailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const leadStoredMessage = "Lead stored from manual entry.";
export const leadUpdatedMessage = "Lead updated.";
export const leadDeletedMessage = "Lead deleted.";
export const qualificationOverriddenMessage = "Qualification overridden.";
export const qualificationScoreMessage =
  "Suitability score must be a whole number from 0 to 100.";
export const qualificationMissingMessage =
  "Lead has no qualification to override.";
export const qualificationReasonMessage = "Override reason must be text.";
export const summaryEditedMessage = "Summary edited.";
export const summaryRequiredMessage =
  "Summary, about the company, why it fits, gap, and next step are required.";
export const summaryMissingMessage = "Lead has no summary to edit.";

function emailMessage(value: string | null, message: string): string | null {
  if (value === null || emailAddress.test(value)) {
    return null;
  }

  return message;
}

function httpUrlMessage(value: string | null, message: string): string | null {
  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return null;
    }
  } catch {
    return message;
  }

  return message;
}

function sizeBand(value: string | null): CompanySizeBand | null | "invalid" {
  if (value === null) {
    return null;
  }

  for (const band of companySizeBands) {
    if (band === value) {
      return band;
    }
  }

  return "invalid";
}

export function isManualLeadError(
  value: ManualLeadFacts | { message: string },
): value is { message: string } {
  return "message" in value;
}

/** Reads a suitability override. Returns the score, or the error for a value outside 0 to 100. */
export function readQualificationScore(
  body: Record<string, unknown>,
): number | { message: string } {
  const parsed = readWholeNumber(body.score);
  if (
    parsed === "absent" ||
    parsed === null ||
    parsed === "invalid" ||
    parsed > 100
  ) {
    return { message: qualificationScoreMessage };
  }

  return parsed;
}

export type QualificationOverrideInput = {
  score: number;
  reason: string | null;
};

/**
 * Reads a suitability override and an optional reason.
 * A missing or blank reason is stored as none. Any other non-text reason is rejected.
 */
export function readQualificationOverride(
  body: Record<string, unknown>,
): QualificationOverrideInput | { message: string } {
  const score = readQualificationScore(body);
  if (typeof score !== "number") {
    return score;
  }

  if (
    "reason" in body &&
    body.reason !== undefined &&
    typeof body.reason !== "string"
  ) {
    return { message: qualificationReasonMessage };
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  return { score, reason: reason.length > 0 ? reason : null };
}

export type SummaryEditInput = {
  summaryText: string;
  snapshot: string;
  whyItFits: string;
  gap: string;
  nextStep: string;
};

function requiredSummaryText(
  body: Record<string, unknown>,
  field: keyof SummaryEditInput,
): string | { message: string } {
  const value = body[field];
  if (typeof value !== "string") {
    return { message: summaryRequiredMessage };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { message: summaryRequiredMessage };
  }

  return trimmed;
}

/**
 * Reads a summary edit.
 * Each written section must be non-empty text. About the company is `snapshot`.
 */
export function readSummaryEdit(
  body: Record<string, unknown>,
): SummaryEditInput | { message: string } {
  const summaryText = requiredSummaryText(body, "summaryText");
  if (typeof summaryText !== "string") {
    return summaryText;
  }

  const snapshot = requiredSummaryText(body, "snapshot");
  if (typeof snapshot !== "string") {
    return snapshot;
  }

  const whyItFits = requiredSummaryText(body, "whyItFits");
  if (typeof whyItFits !== "string") {
    return whyItFits;
  }

  const gap = requiredSummaryText(body, "gap");
  if (typeof gap !== "string") {
    return gap;
  }

  const nextStep = requiredSummaryText(body, "nextStep");
  if (typeof nextStep !== "string") {
    return nextStep;
  }

  return { summaryText, snapshot, whyItFits, gap, nextStep };
}

/** Reads and checks a manual lead body. Returns the facts, or the first error. */
export function readManualLead(
  body: Record<string, unknown>,
): ManualLeadFacts | { message: string } {
  const companyName = readText(body.companyName);
  if (companyName.length === 0) {
    return { message: "Company name is required." };
  }

  const contactName = readOptionalText(body.contactName);
  const contactJobTitle = readOptionalText(body.contactJobTitle);
  const contactEmail = readOptionalText(body.contactEmail);
  const contactPhone = readOptionalText(body.contactPhone);
  const contactLinkedinUrl = readOptionalText(body.contactLinkedinUrl);
  if (
    contactName === null &&
    (contactJobTitle !== null ||
      contactEmail !== null ||
      contactPhone !== null ||
      contactLinkedinUrl !== null)
  ) {
    return { message: "Contact name is required." };
  }

  const companyEmail = readOptionalText(body.companyEmail);
  const companyEmailError = emailMessage(
    companyEmail,
    "Company email must be a valid address.",
  );
  if (companyEmailError) {
    return { message: companyEmailError };
  }

  const contactEmailError = emailMessage(
    contactEmail,
    "Contact email must be a valid address.",
  );
  if (contactEmailError) {
    return { message: contactEmailError };
  }

  const website = readOptionalText(body.website);
  const websiteError = httpUrlMessage(
    website,
    "Website must be an http or https URL.",
  );
  if (websiteError) {
    return { message: websiteError };
  }

  const companyLinkedinUrl = readOptionalText(body.companyLinkedinUrl);
  const companyLinkedinError = httpUrlMessage(
    companyLinkedinUrl,
    "Company LinkedIn must be an http or https URL.",
  );
  if (companyLinkedinError) {
    return { message: companyLinkedinError };
  }

  const contactLinkedinError = httpUrlMessage(
    contactLinkedinUrl,
    "Contact LinkedIn must be an http or https URL.",
  );
  if (contactLinkedinError) {
    return { message: contactLinkedinError };
  }

  const companySizeBand = sizeBand(readOptionalText(body.companySizeBand));
  if (companySizeBand === "invalid") {
    return { message: "Company size must be a listed band." };
  }

  return {
    companyName,
    website,
    industry: readOptionalText(body.industry),
    location: readOptionalText(body.location),
    companySizeBand,
    description: readOptionalText(body.description),
    companyEmail,
    companyPhone: readOptionalText(body.companyPhone),
    companyLinkedinUrl,
    contactName,
    contactJobTitle,
    contactEmail,
    contactPhone,
    contactLinkedinUrl,
  };
}
