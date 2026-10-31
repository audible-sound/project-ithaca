import { generateJson } from "@ithaca/ai-model";
import type { JsonModelRequest, JsonModelResponse } from "@ithaca/ai-model";
import { qualificationLabelsForScore } from "@ithaca/shared";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  LeadQualificationCriterion,
  WorkflowLeadContact,
  WorkflowLeadContext,
  WorkflowLeadQualification,
} from "@ithaca/shared";

const suitabilityScoreMessage = "A suitability score is produced for the lead.";
const noLeadsMessage = "Lead qualification completed with no leads.";
const rankedBySuitabilityMessage =
  "Leads ranked by suitability, highest score first.";
const qualificationSystem = [
  "You qualify one B2B sales lead against an ideal customer profile.",
  "Return a JSON object for that lead only.",
  "score is an integer from 0 to 100. 100 is a complete fit and 0 is no fit.",
  "explanation states how the score was measured.",
  "evidence lists the company facts that support the score.",
  "criteria lists each profile check from the prompt. name is the check name given there. result is the short outcome.",
  "leadId must be the lead id from the prompt.",
].join(" ");
const extraCriterionRule = [
  "Budget and the business-need description, when listed in the prompt, are extra checks.",
  "Judge them only from facts already in the prompt, mainly the company description.",
  "If the lead does not mention that budget or need, leave the score on the other criteria and do not add a failed check for the gap.",
  "Raise or lower the score only when a stated fact supports or contradicts the check.",
].join(" ");

const industryCheck = "Industry";
const excludedIndustriesCheck = "Excluded industries";
const locationCheck = "Location";
const companySizeCheck = "Company size";
const businessNeedKeywordsCheck = "Business need keywords";
const budgetCheck = "Budget";
const businessNeedDescriptionCheck = "Business-need description";
const noCriteriaContributed =
  "No ideal-customer criteria contributed to the score.";

const qualificationResponseSchema = {
  type: "OBJECT",
  properties: {
    leadId: { type: "STRING" },
    score: { type: "INTEGER", minimum: 0, maximum: 100 },
    explanation: { type: "STRING" },
    evidence: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    criteria: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          result: { type: "STRING" },
        },
        required: ["name", "result"],
      },
    },
  },
  required: ["leadId", "score", "explanation", "evidence", "criteria"],
};

export interface RankedLeadScore {
  leadId: string;
  score: number;
  priorityRank: number;
}

export interface RankLeadsResult {
  message: string;
  ranked: RankedLeadScore[];
}

type ScoredQualification = Omit<WorkflowLeadQualification, "priorityRank">;

type QualifyGenerate = (
  request: JsonModelRequest,
) => Promise<JsonModelResponse>;

type ProfileChecks = {
  required: string[];
  optional: string[];
};

function textOrNone(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? "none" : trimmed;
}

function joined(values: readonly string[] | undefined): string {
  if (values === undefined) {
    return "none";
  }

  const items = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return items.length === 0 ? "none" : items.join(", ");
}

function companySize(icp: IdealCustomerProfileInput): string {
  const minimum = icp.companySizeMin;
  const maximum = icp.companySizeMax;
  if (minimum === undefined && maximum === undefined) {
    return "none";
  }

  if (minimum !== undefined && maximum !== undefined) {
    return `${minimum}-${maximum}`;
  }

  if (minimum !== undefined) {
    return `${minimum} or more`;
  }

  if (maximum === undefined) {
    return "none";
  }

  return `up to ${maximum}`;
}

function budgetAmount(icp: IdealCustomerProfileInput): string | undefined {
  const minimum = icp.budgetMin;
  const maximum = icp.budgetMax;
  const currency = icp.budgetCurrency?.trim() ?? "";

  let range = "";
  if (minimum !== undefined && maximum !== undefined) {
    range = `${minimum}-${maximum}`;
  } else if (minimum !== undefined) {
    range = `${minimum} or more`;
  } else if (maximum !== undefined) {
    range = `up to ${maximum}`;
  }

  if (currency.length > 0 && range.length > 0) {
    return `${currency} ${range}`;
  }

  if (range.length > 0) {
    return range;
  }

  if (currency.length > 0) {
    return currency;
  }

  return undefined;
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? undefined : trimmed;
}

function hasText(values: readonly string[] | undefined): boolean {
  if (values === undefined) {
    return false;
  }

  return values.some((value) => value.trim().length > 0);
}

function hasCompanySize(icp: IdealCustomerProfileInput): boolean {
  return icp.companySizeMin !== undefined || icp.companySizeMax !== undefined;
}

function hasBudgetCheck(icp: IdealCustomerProfileInput): boolean {
  return (
    icp.budgetMin !== undefined ||
    icp.budgetMax !== undefined ||
    trimmedOrUndefined(icp.budgetNotes) !== undefined
  );
}

function profileChecks(icp: IdealCustomerProfileInput): ProfileChecks {
  const required: string[] = [];
  if (hasText(icp.industries)) {
    required.push(industryCheck);
  }
  if (hasText(icp.industriesExclude)) {
    required.push(excludedIndustriesCheck);
  }
  if (hasText(icp.locations)) {
    required.push(locationCheck);
  }
  if (hasCompanySize(icp)) {
    required.push(companySizeCheck);
  }
  if (hasText(icp.businessNeedKeywords)) {
    required.push(businessNeedKeywordsCheck);
  }

  const optional: string[] = [];
  if (hasBudgetCheck(icp)) {
    optional.push(budgetCheck);
  }
  if (trimmedOrUndefined(icp.businessNeedDescription) !== undefined) {
    optional.push(businessNeedDescriptionCheck);
  }

  return { required, optional };
}

function checkLines(icp: IdealCustomerProfileInput): string[] {
  const checks = profileChecks(icp);
  const lines = [
    checks.required.length === 0
      ? "Required checks: none."
      : `Required checks: ${checks.required.join(", ")}.`,
  ];

  if (checks.required.length > 0) {
    lines.push(
      "Each required check must appear once in criteria. name is that check. result is the short outcome.",
    );
  }

  if (checks.optional.length > 0) {
    lines.push(
      `Optional checks: ${checks.optional.join(", ")}. Include an optional check only when a stated fact supports or contradicts it.`,
    );
  }

  lines.push("Do not add a check that is not listed here.");
  return lines;
}

function hasExtraCriterion(icp: IdealCustomerProfileInput): boolean {
  return (
    budgetAmount(icp) !== undefined ||
    trimmedOrUndefined(icp.budgetNotes) !== undefined ||
    trimmedOrUndefined(icp.businessNeedDescription) !== undefined
  );
}

function qualificationSystemFor(icp: IdealCustomerProfileInput): string {
  if (!hasExtraCriterion(icp)) {
    return qualificationSystem;
  }

  return `${qualificationSystem} ${extraCriterionRule}`;
}

function contactText(contact: WorkflowLeadContact | undefined): string {
  if (contact === undefined) {
    return "none";
  }

  const title = contact.jobTitle?.trim() ?? "";
  if (title.length === 0) {
    return contact.fullName;
  }

  return `${contact.fullName}, ${title}`;
}

function qualificationPrompt(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): string {
  const lines = [
    `Lead id: ${lead.leadId}`,
    `Company: ${lead.companyName}`,
    `Website: ${textOrNone(lead.website)}`,
    `Industry: ${textOrNone(lead.industry)}`,
    `Location: ${textOrNone(lead.location)}`,
    `Company size band: ${textOrNone(lead.companySizeBand)}`,
    `Description: ${textOrNone(lead.description)}`,
    `Contact: ${contactText(lead.contact)}`,
    `Ideal customer profile: ${icp.name}`,
    `Included industries: ${joined(icp.industries)}`,
    `Excluded industries: ${joined(icp.industriesExclude)}`,
    `Locations: ${joined(icp.locations)}`,
    `Company size: ${companySize(icp)}`,
    `Business need keywords: ${joined(icp.businessNeedKeywords)}`,
  ];

  const amount = budgetAmount(icp);
  if (amount !== undefined) {
    lines.push(`Budget: ${amount}`);
  }

  const notes = trimmedOrUndefined(icp.budgetNotes);
  if (notes !== undefined) {
    lines.push(`Budget notes: ${notes}`);
  }

  const description = trimmedOrUndefined(icp.businessNeedDescription);
  if (description !== undefined) {
    lines.push(`Business-need description: ${description}`);
  }

  lines.push(...checkLines(icp));
  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEvidence(leadId: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Lead ${leadId} qualification evidence is missing.`);
  }

  return value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`Lead ${leadId} qualification evidence is invalid.`);
    }

    return item.trim();
  });
}

function readCriteria(
  leadId: string,
  value: unknown,
): LeadQualificationCriterion[] {
  if (!Array.isArray(value)) {
    throw new Error(`Lead ${leadId} qualification criteria are missing.`);
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.name !== "string" ||
      typeof item.result !== "string"
    ) {
      throw new Error(`Lead ${leadId} qualification criteria are invalid.`);
    }

    const name = item.name.trim();
    const result = item.result.trim();
    if (name.length === 0 || result.length === 0) {
      throw new Error(`Lead ${leadId} qualification criteria are invalid.`);
    }

    return { name, result };
  });
}

function criteriaContributedMessage(leadId: string): string {
  return `Lead ${leadId} qualification does not state which ideal-customer criteria contributed.`;
}

function acceptedCriteria(
  leadId: string,
  icp: IdealCustomerProfileInput,
  criteria: readonly LeadQualificationCriterion[],
): LeadQualificationCriterion[] {
  const checks = profileChecks(icp);
  const allowed = new Set([...checks.required, ...checks.optional]);
  const byName = new Map<string, LeadQualificationCriterion>();

  for (const criterion of criteria) {
    if (!allowed.has(criterion.name) || byName.has(criterion.name)) {
      throw new Error(criteriaContributedMessage(leadId));
    }

    byName.set(criterion.name, criterion);
  }

  for (const name of checks.required) {
    if (!byName.has(name)) {
      throw new Error(criteriaContributedMessage(leadId));
    }
  }

  const ordered: LeadQualificationCriterion[] = [];
  for (const name of [...checks.required, ...checks.optional]) {
    const criterion = byName.get(name);
    if (criterion !== undefined) {
      ordered.push(criterion);
    }
  }

  return ordered;
}

function explanationWithCriteria(
  modelExplanation: string,
  criteria: readonly LeadQualificationCriterion[],
): string {
  if (criteria.length === 0) {
    return `${modelExplanation} ${noCriteriaContributed}`;
  }

  const contributed = criteria
    .map((criterion) => `${criterion.name} (${criterion.result})`)
    .join(", ");
  return `${modelExplanation} Criteria that contributed: ${contributed}.`;
}

function parseQualification(
  leadId: string,
  text: string,
  icp: IdealCustomerProfileInput,
): ScoredQualification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Lead ${leadId} qualification was not valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Lead ${leadId} qualification was not valid JSON.`);
  }

  if (parsed.leadId !== leadId) {
    throw new Error(`Lead ${leadId} qualification did not match the lead.`);
  }

  if (
    typeof parsed.score !== "number" ||
    !Number.isInteger(parsed.score) ||
    parsed.score < 0 ||
    parsed.score > 100
  ) {
    throw new Error(`Lead ${leadId} qualification score is invalid.`);
  }

  if (
    typeof parsed.explanation !== "string" ||
    parsed.explanation.trim().length === 0
  ) {
    throw new Error(`Lead ${leadId} qualification explanation is missing.`);
  }

  const criteria = acceptedCriteria(
    leadId,
    icp,
    readCriteria(leadId, parsed.criteria),
  );
  const labels = qualificationLabelsForScore(parsed.score);
  return {
    leadId,
    score: parsed.score,
    priorityLabel: labels.priorityLabel,
    fitLabel: labels.fitLabel,
    explanation: explanationWithCriteria(parsed.explanation.trim(), criteria),
    evidence: readEvidence(leadId, parsed.evidence),
    criteriaBreakdown: criteria,
    isUserOverride: false,
  };
}

/**
 * Orders scores from highest to lowest.
 * Equal scores keep the order the lead ids were given.
 */
export function rankLeads(
  scores: readonly { leadId: string; score: number }[],
): RankLeadsResult {
  const ordered = scores
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.score !== right.entry.score) {
        return right.entry.score - left.entry.score;
      }

      return left.index - right.index;
    });

  return {
    message: rankedBySuitabilityMessage,
    ranked: ordered.map((item, index) => ({
      leadId: item.entry.leadId,
      score: item.entry.score,
      priorityRank: index + 1,
    })),
  };
}

export async function qualifyLeads(
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[],
  generate: QualifyGenerate = generateJson,
): Promise<AgentStageResult> {
  if (leads.length === 0) {
    return {
      stage: "qualify",
      status: "completed",
      message: noLeadsMessage,
      qualifications: [],
    };
  }

  const scored: ScoredQualification[] = [];
  let modelName = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;
  const system = qualificationSystemFor(icp);

  for (const lead of leads) {
    const response = await generate({
      system,
      prompt: qualificationPrompt(icp, lead),
      responseSchema: qualificationResponseSchema,
    });
    modelName = response.modelName;
    promptTokens += response.promptTokens;
    completionTokens += response.completionTokens;
    cost += response.estimatedCost;
    scored.push(parseQualification(lead.leadId, response.text, icp));
  }

  const ranking = rankLeads(
    scored.map((item) => ({ leadId: item.leadId, score: item.score })),
  );
  const pending = [...scored];
  const qualifications: WorkflowLeadQualification[] = [];

  for (const ranked of ranking.ranked) {
    const index = pending.findIndex(
      (item) => item.leadId === ranked.leadId && item.score === ranked.score,
    );
    const match = index >= 0 ? pending[index] : undefined;
    if (match === undefined) {
      throw new Error(`Lead ${ranked.leadId} was ranked without a score.`);
    }

    pending.splice(index, 1);
    qualifications.push({
      ...match,
      priorityRank: ranked.priorityRank,
    });
  }

  return {
    stage: "qualify",
    status: "completed",
    message: suitabilityScoreMessage,
    qualifications,
    usage: {
      modelName,
      promptTokens,
      completionTokens,
      estimatedCost: Math.round(cost * 100_000_000) / 100_000_000,
    },
  };
}
