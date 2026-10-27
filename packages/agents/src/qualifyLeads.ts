import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  LeadPriority,
  LeadQualificationCriterion,
  QualificationFitLabel,
  WorkflowLeadContext,
  WorkflowLeadQualification,
} from "@ithaca/shared";

const suitabilityScoreMessage = "A suitability score is produced for the lead.";
const noLeadsMessage = "Lead qualification completed with no leads.";
const rankedBySuitabilityMessage =
  "Leads ranked by suitability, highest score first.";
const explanationIntro =
  "Explanation of how the suitability score was measured, with supporting evidence.";

/**
 * Inclusive employee counts for each stored size band.
 * `1000+` starts at 1001 so it matches the company profile parser.
 */
const companySizeRanges = [
  { band: "1-10", min: 1, max: 10 },
  { band: "11-50", min: 11, max: 50 },
  { band: "51-200", min: 51, max: 200 },
  { band: "201-1000", min: 201, max: 1000 },
  { band: "1000+", min: 1001, max: Number.POSITIVE_INFINITY },
] as const;

export interface RankedLeadScore {
  leadId: string;
  score: number;
  priorityRank: number;
}

export interface RankLeadsResult {
  message: string;
  ranked: RankedLeadScore[];
}

interface ScoredCriterion {
  name: string;
  result: string;
  score: number;
  detail: string;
  evidence: string[];
}

type ScoredQualification = Omit<WorkflowLeadQualification, "priorityRank">;

function listed(values: readonly string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function textOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function matchesText(left: string, right: string): boolean {
  const haystack = left.trim().toLowerCase();
  const needle = right.trim().toLowerCase();
  if (haystack.length === 0 || needle.length === 0) {
    return false;
  }

  return haystack.includes(needle) || needle.includes(haystack);
}

function quotedList(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

function criterion(
  name: string,
  score: number,
  detail: string,
  evidence: string[],
): ScoredCriterion {
  return {
    name,
    result: String(score),
    score,
    detail,
    evidence,
  };
}

function scoreIndustry(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): ScoredCriterion | undefined {
  const included = listed(icp.industries);
  const excluded = listed(icp.industriesExclude);
  if (included.length === 0 && excluded.length === 0) {
    return undefined;
  }

  const industry = textOrUndefined(lead.industry);
  if (industry === undefined) {
    return criterion(
      "Industry",
      0,
      "Industry scored 0 because the company industry was not found.",
      ["Company industry was not found."],
    );
  }

  const excludedMatch = excluded.find((option) => matchesText(industry, option));
  if (excludedMatch !== undefined) {
    return criterion(
      "Industry",
      0,
      `Industry scored 0 because company industry "${industry}" matches excluded industry "${excludedMatch}".`,
      [industry],
    );
  }

  if (included.length === 0) {
    return criterion(
      "Industry",
      100,
      `Industry scored 100 because company industry "${industry}" does not match an excluded industry.`,
      [industry],
    );
  }

  const includedMatch = included.find((option) => matchesText(industry, option));
  if (includedMatch !== undefined) {
    return criterion(
      "Industry",
      100,
      `Industry scored 100 because company industry "${industry}" matches included industry "${includedMatch}".`,
      [industry],
    );
  }

  const label = included.length === 1 ? "industry" : "industries";
  return criterion(
    "Industry",
    0,
    `Industry scored 0 because company industry "${industry}" does not match included ${label} ${quotedList(included)}.`,
    [industry],
  );
}

function scoreLocation(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): ScoredCriterion | undefined {
  const locations = listed(icp.locations);
  if (locations.length === 0) {
    return undefined;
  }

  const location = textOrUndefined(lead.location);
  if (location === undefined) {
    return criterion(
      "Location",
      0,
      "Location scored 0 because the company location was not found.",
      ["Company location was not found."],
    );
  }

  const match = locations.find((option) => matchesText(location, option));
  if (match !== undefined) {
    return criterion(
      "Location",
      100,
      `Location scored 100 because company location "${location}" matches location "${match}".`,
      [location],
    );
  }

  const label = locations.length === 1 ? "location" : "locations";
  return criterion(
    "Location",
    0,
    `Location scored 0 because company location "${location}" does not match ${label} ${quotedList(locations)}.`,
    [location],
  );
}

function formatSizeTarget(
  minimum: number | undefined,
  maximum: number | undefined,
): string {
  if (minimum !== undefined && maximum !== undefined) {
    return `${minimum}–${maximum}`;
  }

  if (minimum !== undefined) {
    return `${minimum} or more`;
  }

  if (maximum !== undefined) {
    return `up to ${maximum}`;
  }

  return "the requested company size";
}

function scoreCompanySize(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): ScoredCriterion | undefined {
  const minimum = icp.companySizeMin;
  const maximum = icp.companySizeMax;
  if (minimum === undefined && maximum === undefined) {
    return undefined;
  }

  const band = textOrUndefined(lead.companySizeBand);
  const range =
    band === undefined
      ? undefined
      : companySizeRanges.find((entry) => entry.band === band);
  if (band === undefined || range === undefined) {
    return criterion(
      "Company size",
      0,
      "Company size scored 0 because the size was not found.",
      ["Company size was not found."],
    );
  }

  const criteriaMin = minimum ?? Number.NEGATIVE_INFINITY;
  const criteriaMax = maximum ?? Number.POSITIVE_INFINITY;
  const overlaps = range.min <= criteriaMax && range.max >= criteriaMin;
  const target = formatSizeTarget(minimum, maximum);
  if (overlaps) {
    return criterion(
      "Company size",
      100,
      `Company size scored 100 because company size band "${band}" overlaps ${target}.`,
      [band],
    );
  }

  return criterion(
    "Company size",
    0,
    `Company size scored 0 because company size band "${band}" does not overlap ${target}.`,
    [band],
  );
}

function scoreBusinessNeed(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): ScoredCriterion | undefined {
  const keywords = listed(icp.businessNeedKeywords);
  if (keywords.length === 0) {
    return undefined;
  }

  const companyName = lead.companyName.trim();
  const description = textOrUndefined(lead.description);
  const haystack = `${companyName}\n${description ?? ""}`.toLowerCase();
  const matched = keywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );
  const score = Math.round((matched.length / keywords.length) * 100);
  const fields =
    description === undefined
      ? `company name "${companyName}"`
      : `company name "${companyName}" and company description "${description}"`;
  const matchedText =
    matched.length === 0
      ? ""
      : ` (${matched.map((keyword) => `"${keyword}"`).join(", ")})`;

  return criterion(
    "Business need",
    score,
    `Business need scored ${score} because ${matched.length} of ${keywords.length} keywords${matchedText} matched ${fields}.`,
    description === undefined ? [companyName] : [companyName, description],
  );
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

function averageScore(scores: readonly number[]): number {
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

function scoreLead(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): ScoredQualification {
  const criteria = [
    scoreIndustry(icp, lead),
    scoreLocation(icp, lead),
    scoreCompanySize(icp, lead),
    scoreBusinessNeed(icp, lead),
  ].filter((item): item is ScoredCriterion => item !== undefined);
  const score =
    criteria.length === 0 ? 0 : averageScore(criteria.map((item) => item.score));
  const labels = priorityForScore(score);
  const explanation =
    criteria.length === 0
      ? `${explanationIntro} No qualification criteria were set.`
      : `${explanationIntro} Suitability score ${score} is the rounded average of the criterion scores. ${criteria
          .map((item) => item.detail)
          .join(" ")}`;
  const criteriaBreakdown: LeadQualificationCriterion[] = criteria.map(
    (item) => ({
      name: item.name,
      result: item.result,
    }),
  );

  return {
    leadId: lead.leadId,
    score,
    priorityLabel: labels.priorityLabel,
    fitLabel: labels.fitLabel,
    explanation,
    evidence: criteria.flatMap((item) => item.evidence),
    criteriaBreakdown,
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
): Promise<AgentStageResult> {
  if (leads.length === 0) {
    return {
      stage: "qualify",
      status: "completed",
      message: noLeadsMessage,
      qualifications: [],
    };
  }

  const scored = leads.map((lead) => scoreLead(icp, lead));
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
  };
}
