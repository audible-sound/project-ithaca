import { generateJson } from "@ithaca/ai-model";
import type { JsonModelRequest, JsonModelResponse } from "@ithaca/ai-model";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  WorkflowLeadContact,
  WorkflowLeadContext,
  WorkflowLeadQualification,
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

function textOrNone(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? "none" : trimmed;
}

function joined(values: readonly string[]): string {
  const items = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return items.length === 0 ? "none" : items.join(", ");
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

function summaryPrompt(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
  qualification: WorkflowLeadQualification,
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
    `Suitability score: ${qualification.score}`,
    `Fit: ${qualification.fitLabel}`,
    `Explanation: ${qualification.explanation}`,
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

function parseSummary(leadId: string, text: string): WorkflowLeadSummary {
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
    },
  };
}

export async function summarizeLeads(
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[],
  qualifications: readonly WorkflowLeadQualification[],
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
    summaries.push(parseSummary(lead.leadId, response.text));
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
