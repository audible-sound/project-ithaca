import { generateJson } from "@ithaca/ai-model";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  LeadPriority,
  LeadQualificationCriterion,
  QualificationFitLabel,
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
  "criteria lists each profile check you applied. name is the check. result is the short outcome.",
  "leadId must be the lead id from the prompt.",
].join(" ");

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
  return [
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
  ].join("\n");
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

function parseQualification(
  leadId: string,
  text: string,
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

  const labels = priorityForScore(parsed.score);
  return {
    leadId,
    score: parsed.score,
    priorityLabel: labels.priorityLabel,
    fitLabel: labels.fitLabel,
    explanation: parsed.explanation.trim(),
    evidence: readEvidence(leadId, parsed.evidence),
    criteriaBreakdown: readCriteria(leadId, parsed.criteria),
    isUserOverride: false,
  };
}

function priorityForScore(score: number): {
  priorityLabel: LeadPriority;
  fitLabel: QualificationFitLabel;
} {
  if (score >= 70) {
    return { priorityLabel: "high", fitLabel: "Strong fit" };
  }

  if (score >= 40) {
    return { priorityLabel: "medium", fitLabel: "Partial fit" };
  }

  return { priorityLabel: "low", fitLabel: "Weak fit" };
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

  for (const lead of leads) {
    const response = await generateJson({
      system: qualificationSystem,
      prompt: qualificationPrompt(icp, lead),
      responseSchema: qualificationResponseSchema,
    });
    modelName = response.modelName;
    promptTokens += response.promptTokens;
    completionTokens += response.completionTokens;
    cost += response.estimatedCost;
    scored.push(parseQualification(lead.leadId, response.text));
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
