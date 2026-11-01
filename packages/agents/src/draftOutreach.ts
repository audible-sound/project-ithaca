import { generateJson } from "@ithaca/ai-model";
import type { JsonModelRequest, JsonModelResponse } from "@ithaca/ai-model";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  WorkflowLeadContact,
  WorkflowLeadContext,
  WorkflowLeadOutreachDraft,
  WorkflowLeadOutreachFailure,
} from "@ithaca/shared";

const personalisedDraftMessage =
  "A personalised outreach draft is generated for the lead.";
const noLeadsMessage = "Outreach draft completed with no leads.";
const defaultTone = "professional";

const draftSystem = [
  "You write a personalised outreach email for one B2B sales lead.",
  "Return a JSON object for that lead only.",
  "subject is a short email subject that names the company or contact when known.",
  "body is the email body that uses the stored company and contact facts.",
  "leadId must be the lead id from the prompt.",
  "Use the outreach tone and any message constraints from the prompt.",
  "If a prompt line says Missing., that fact is absent.",
  "Do not invent a website, industry, location, size, description, contact, email, phone, or LinkedIn.",
  "The subject and body must each include at least one of the lead's non-blank stored facts,",
  "or together they must include at least one of those facts.",
].join(" ");

const draftResponseSchema = {
  type: "OBJECT",
  properties: {
    leadId: { type: "STRING" },
    subject: { type: "STRING" },
    body: { type: "STRING" },
  },
  required: ["leadId", "subject", "body"],
};

type DraftGenerate = (
  request: JsonModelRequest,
) => Promise<JsonModelResponse>;

const missingFact = "Missing.";

function present(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? missingFact : trimmed;
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

/** Company lines for an outreach prompt. An absent field is `Missing.` */
export function companyFacts(lead: WorkflowLeadContext): string {
  return [
    `Company: ${lead.companyName}`,
    `Website: ${present(lead.website)}`,
    `Industry: ${present(lead.industry)}`,
    `Location: ${present(lead.location)}`,
    `Company size band: ${present(lead.companySizeBand)}`,
    `Description: ${present(lead.description)}`,
  ].join("\n");
}

/** Contact lines for an outreach prompt. An absent field is `Missing.` */
export function contactFacts(lead: WorkflowLeadContext): string {
  return [
    `Contact: ${contactName(lead.contact)}`,
    `Email: ${present(lead.contact?.email)}`,
    `Phone: ${present(lead.contact?.phone)}`,
    `LinkedIn: ${present(lead.contact?.linkedinUrl)}`,
  ].join("\n");
}

/** Source lines for an outreach prompt. An absent field is `Missing.` */
export function sourceFacts(lead: WorkflowLeadContext): string {
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

/**
 * Non-blank facts a draft must reuse so the message is personalised.
 * Company name alone is not enough for a usable lead.
 */
function personalisationFacts(lead: WorkflowLeadContext): string[] {
  const facts: string[] = [];
  const company = lead.companyName.trim();
  if (company.length > 0) {
    facts.push(company);
  }

  const contact = lead.contact?.fullName.trim() ?? "";
  if (contact.length > 0) {
    facts.push(contact);
  }

  for (const value of [
    lead.description,
    lead.industry,
    lead.website,
    lead.location,
  ]) {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length > 0) {
      facts.push(trimmed);
    }
  }

  return facts;
}

/**
 * A lead is usable when the company name is non-blank and at least one of
 * contact name, description, industry, website, or location is non-blank.
 */
export function leadHasUsableInformation(
  lead: WorkflowLeadContext,
): boolean {
  if (lead.companyName.trim().length === 0) {
    return false;
  }

  const contact = lead.contact?.fullName.trim() ?? "";
  if (contact.length > 0) {
    return true;
  }

  for (const value of [
    lead.description,
    lead.industry,
    lead.website,
    lead.location,
  ]) {
    if ((value?.trim() ?? "").length > 0) {
      return true;
    }
  }

  return false;
}

function noUsableInformationMessage(lead: WorkflowLeadContext): string {
  const company = lead.companyName.trim();
  const name = company.length > 0 ? company : lead.leadId;
  return `Lead ${name} has no usable information.`;
}

function draftPrompt(
  icp: IdealCustomerProfileInput,
  lead: WorkflowLeadContext,
): string {
  const tone = icp.outreachTone?.trim() || defaultTone;
  const lines = [
    `Lead id: ${lead.leadId}`,
    companyFacts(lead),
    contactFacts(lead),
    sourceFacts(lead),
    `Ideal customer profile: ${icp.name}`,
    `Outreach tone: ${tone}`,
  ];

  const constraints = icp.messageConstraints?.trim() ?? "";
  if (constraints.length > 0) {
    lines.push(`Message constraints: ${constraints}`);
  }

  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includesFact(text: string, fact: string): boolean {
  return text.toLowerCase().includes(fact.toLowerCase());
}

function draftUsesLeadFacts(
  subject: string,
  body: string,
  facts: readonly string[],
): boolean {
  const combined = `${subject}\n${body}`;
  return facts.some((fact) => includesFact(combined, fact));
}

function parseDraft(
  lead: WorkflowLeadContext,
  text: string,
): WorkflowLeadOutreachDraft {
  const leadId = lead.leadId;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Lead ${leadId} outreach draft was not valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Lead ${leadId} outreach draft was not valid JSON.`);
  }

  if (parsed.leadId !== leadId) {
    throw new Error(`Lead ${leadId} outreach draft did not match the lead.`);
  }

  const subject =
    typeof parsed.subject === "string" ? parsed.subject.trim() : "";
  const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
  if (subject.length === 0 || body.length === 0) {
    throw new Error(`Lead ${leadId} outreach draft subject or body is missing.`);
  }

  const facts = personalisationFacts(lead);
  if (!draftUsesLeadFacts(subject, body, facts)) {
    throw new Error(
      `Lead ${leadId} outreach draft does not use the lead information.`,
    );
  }

  return {
    leadId,
    subject,
    body,
    status: "draft",
  };
}

/**
 * Drafts a personalised outreach email for each usable lead.
 * An unusable lead produces no draft. The stage does not send mail.
 */
export async function draftOutreach(
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[] = [],
  generate: DraftGenerate = generateJson,
): Promise<AgentStageResult> {
  if (leads.length === 0) {
    return {
      stage: "draft",
      status: "completed",
      message: noLeadsMessage,
      outreachDrafts: [],
    };
  }

  const outreachDrafts: WorkflowLeadOutreachDraft[] = [];
  const outreachFailures: WorkflowLeadOutreachFailure[] = [];
  let modelName = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;
  let calledModel = false;

  for (const lead of leads) {
    if (!leadHasUsableInformation(lead)) {
      outreachFailures.push({
        leadId: lead.leadId,
        message: noUsableInformationMessage(lead),
      });
      continue;
    }

    try {
      const response = await generate({
        system: draftSystem,
        prompt: draftPrompt(icp, lead),
        responseSchema: draftResponseSchema,
      });
      calledModel = true;
      modelName = response.modelName;
      promptTokens += response.promptTokens;
      completionTokens += response.completionTokens;
      cost += response.estimatedCost;
      outreachDrafts.push(parseDraft(lead, response.text));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Lead ${lead.leadId} outreach draft failed.`;
      outreachFailures.push({
        leadId: lead.leadId,
        message,
      });
    }
  }

  if (outreachDrafts.length === 0) {
    const message =
      outreachFailures[0]?.message ??
      "Outreach draft failed for every lead.";
    return {
      stage: "draft",
      status: "failed",
      message,
      outreachDrafts: [],
      outreachFailures,
    };
  }

  const result: AgentStageResult = {
    stage: "draft",
    status: "completed",
    message: personalisedDraftMessage,
    outreachDrafts,
  };

  if (outreachFailures.length > 0) {
    result.outreachFailures = outreachFailures;
  }

  if (calledModel) {
    result.usage = {
      modelName,
      promptTokens,
      completionTokens,
      estimatedCost: Math.round(cost * 100_000_000) / 100_000_000,
    };
  }

  return result;
}
