import { generateJson } from "@ithaca/ai-model";
import type { JsonModelRequest, JsonModelResponse } from "@ithaca/ai-model";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  LeadStructuredReport,
  WorkflowLeadContact,
  WorkflowLeadContext,
  WorkflowLeadSummary,
} from "@ithaca/shared";

const structuredSummaryMessage =
  "A structured summary or report is generated for the lead.";
const noLeadsMessage = "Lead summary completed with no leads.";
const summarySystem = [
  "You write a structured report for one B2B sales lead.",
  "Return a JSON object for that lead only.",
  "summaryText is a short report of the company and why it was scored.",
  "snapshot states who the company is.",
  "whyItFits states why the score and evidence match the profile.",
  "gap states what is missing or weak.",
  "nextStep states the recommended sales action.",
  "leadId must be the lead id from the prompt.",
  "The agent explanation is how the score was measured, and the user reason is why a person replaced that score.",
  "The report must keep those as separate facts and must not treat the user reason as the agent's measurement.",
  "If a prompt line says Missing., that fact is absent.",
  "Do not invent a website, industry, location, size, description, contact, email, phone, LinkedIn, source title, or source URL.",
].join(" ");

const summaryResponseSchema = {
  type: "OBJECT",
  properties: {
    leadId: { type: "STRING" },
    summaryText: { type: "STRING" },
    snapshot: { type: "STRING" },
    whyItFits: { type: "STRING" },
    gap: { type: "STRING" },
    nextStep: { type: "STRING" },
  },
  required: [
    "leadId",
    "summaryText",
    "snapshot",
    "whyItFits",
    "gap",
    "nextStep",
  ],
};

type SummarizeGenerate = (
  request: JsonModelRequest,
) => Promise<JsonModelResponse>;

/**
 * Qualification facts the summary reads.
 * The user reason is separate from the agent's measurement.
 */
export type SummarizeLeadQualification = {
  leadId: string;
  score: number;
  fitLabel: string;
  evidence: string[];
  /** How the agent measured the score. */
  agentExplanation: string;
  /** Why a person replaced the score. Null when they did not write one. */
  userReason: string | null;
};

const missingFact = "Missing.";

function textOrNone(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? "none" : trimmed;
}

function present(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? missingFact : trimmed;
}

function joined(values: readonly string[]): string {
  const items = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return items.length === 0 ? "none" : items.join(", ");
}

function contactName(contact: WorkflowLeadContact | undefined): string {
  if (contact === undefined) {
    return missingFact;
  }

  const name = contact.fullName.trim();
  if (name.length === 0) {
    return missingFact;
  }

  const title = contact.jobTitle?.trim() ?? "";
  if (title.length === 0) {
    return name;
  }

  return `${name}, ${title}`;
}

function sourceLabel(
  sourceType: WorkflowLeadContext["sourceType"],
): string {
  if (sourceType === "manual") {
    return "Manual";
  }

  if (sourceType === "identified") {
    return "Identified";
  }

  return missingFact;
}

function companyFacts(lead: WorkflowLeadContext): string {
  return [
    `Company: ${lead.companyName}`,
    `Website: ${present(lead.website)}`,
    `Industry: ${present(lead.industry)}`,
    `Location: ${present(lead.location)}`,
    `Company size band: ${present(lead.companySizeBand)}`,
    `Description: ${present(lead.description)}`,
  ].join("\n");
}

function contactFacts(lead: WorkflowLeadContext): string {
  return [
    `Contact: ${contactName(lead.contact)}`,
    `Email: ${present(lead.contact?.email)}`,
    `Phone: ${present(lead.contact?.phone)}`,
    `LinkedIn: ${present(lead.contact?.linkedinUrl)}`,
  ].join("\n");
}

function sourceFacts(lead: WorkflowLeadContext): string {
  const titles: string[] = [];
  const urls: string[] = [];
  for (const source of lead.sources ?? []) {
    const title = source.sourceTitle?.trim() ?? "";
    const url = source.sourceUrl?.trim() ?? "";
    if (title.length === 0 && url.length === 0) {
      continue;
    }

    titles.push(title.length === 0 ? missingFact : title);
    urls.push(url.length === 0 ? missingFact : url);
  }

  return [
    `Source: ${sourceLabel(lead.sourceType)}`,
    `Source title: ${titles.length === 0 ? missingFact : titles.join("; ")}`,
    `Source URL: ${urls.length === 0 ? missingFact : urls.join("; ")}`,
  ].join("\n");
}

function qualificationFacts(
  qualification: SummarizeLeadQualification,
): string {
  const evidence = qualification.evidence
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [
    `Suitability score: ${qualification.score}`,
    `Fit: ${present(qualification.fitLabel)}`,
    `Agent explanation: ${present(qualification.agentExplanation)}`,
    `User reason: ${present(qualification.userReason ?? undefined)}`,
    `Evidence: ${evidence.length === 0 ? missingFact : evidence.join(", ")}`,
  ].join("\n");
}

function reportFacts(
  lead: WorkflowLeadContext,
  qualification: SummarizeLeadQualification,
): Pick<
  LeadStructuredReport,
  "company" | "contact" | "source" | "qualification"
> {
  return {
    company: companyFacts(lead),
    contact: contactFacts(lead),
    source: sourceFacts(lead),
    qualification: qualificationFacts(qualification),
  };
}

function summaryPrompt(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
  qualification: SummarizeLeadQualification,
): string {
  return [
    `Lead id: ${lead.leadId}`,
    companyFacts(lead),
    contactFacts(lead),
    sourceFacts(lead),
    `Suitability score: ${qualification.score}`,
    `Fit: ${textOrNone(qualification.fitLabel)}`,
    `Agent explanation: ${textOrNone(qualification.agentExplanation)}`,
    `User reason: ${textOrNone(qualification.userReason ?? undefined)}`,
    `Evidence: ${joined(qualification.evidence)}`,
    `Ideal customer profile: ${icp.name}`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSection(
  leadId: string,
  record: Record<string, unknown>,
  key: "summaryText" | "snapshot" | "whyItFits" | "gap" | "nextStep",
  label: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Lead ${leadId} summary ${label} is missing.`);
  }

  return value.trim();
}

function parseSummary(
  lead: WorkflowLeadContext,
  qualification: SummarizeLeadQualification,
  text: string,
): WorkflowLeadSummary {
  const leadId = lead.leadId;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Lead ${leadId} summary was not valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Lead ${leadId} summary was not valid JSON.`);
  }

  if (parsed.leadId !== leadId) {
    throw new Error(`Lead ${leadId} summary did not match the lead.`);
  }

  return {
    leadId,
    summaryText: readSection(leadId, parsed, "summaryText", "text"),
    structuredReport: {
      snapshot: readSection(leadId, parsed, "snapshot", "snapshot"),
      whyItFits: readSection(leadId, parsed, "whyItFits", "why it fits"),
      gap: readSection(leadId, parsed, "gap", "gap"),
      nextStep: readSection(leadId, parsed, "nextStep", "next step"),
      ...reportFacts(lead, qualification),
    },
  };
}

export async function summarizeLeads(
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[],
  qualifications: readonly SummarizeLeadQualification[],
  generate: SummarizeGenerate = generateJson,
): Promise<AgentStageResult> {
  if (leads.length === 0) {
    return {
      stage: "summarize",
      status: "completed",
      message: noLeadsMessage,
      summaries: [],
    };
  }

  const summaries: WorkflowLeadSummary[] = [];
  let modelName = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;

  for (const lead of leads) {
    const qualification = qualifications.find(
      (item) => item.leadId === lead.leadId,
    );
    if (qualification === undefined) {
      throw new Error(`Lead ${lead.leadId} has no qualification.`);
    }

    const response = await generate({
      system: summarySystem,
      prompt: summaryPrompt(icp, lead, qualification),
      responseSchema: summaryResponseSchema,
    });
    modelName = response.modelName;
    promptTokens += response.promptTokens;
    completionTokens += response.completionTokens;
    cost += response.estimatedCost;
    summaries.push(parseSummary(lead, qualification, response.text));
  }

  return {
    stage: "summarize",
    status: "completed",
    message: structuredSummaryMessage,
    summaries,
    usage: {
      modelName,
      promptTokens,
      completionTokens,
      estimatedCost: Math.round(cost * 100_000_000) / 100_000_000,
    },
  };
}
