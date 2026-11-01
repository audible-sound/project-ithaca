import { generateJson } from "@ithaca/ai-model";
import type { JsonModelRequest, JsonModelResponse } from "@ithaca/ai-model";
import type {
  AgentStageUsage,
  IdealCustomerProfileInput,
  WorkflowLeadContext,
} from "@ithaca/shared";
import { companyFacts, contactFacts, sourceFacts } from "./draftOutreach.js";

const defaultTone = "professional";

const reviseSystem = [
  "You revise a personalised outreach email for one B2B sales lead.",
  "Return a JSON object with subject and body only.",
  "Apply the user's instruction to the current subject and body.",
  "When the instruction conflicts with outreach tone or message constraints, follow the instruction.",
  "If a prompt line says Missing., that fact is absent.",
  "Do not invent a website, industry, location, size, description, contact, email, phone, or LinkedIn.",
  "The revised subject and body may omit a stored fact when the instruction asks for that.",
].join(" ");

const reviseResponseSchema = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    body: { type: "STRING" },
  },
  required: ["subject", "body"],
};

type ReviseGenerate = (
  request: JsonModelRequest,
) => Promise<JsonModelResponse>;

export type ReviseOutreachInput = {
  icp: IdealCustomerProfileInput;
  lead: WorkflowLeadContext;
  subject: string;
  body: string;
  instruction: string;
};

export type ReviseOutreachResult = {
  subject: string;
  body: string;
  usage: AgentStageUsage;
};

function revisePrompt(input: ReviseOutreachInput): string {
  const tone = input.icp.outreachTone?.trim() || defaultTone;
  const lines = [
    `Lead id: ${input.lead.leadId}`,
    companyFacts(input.lead),
    contactFacts(input.lead),
    sourceFacts(input.lead),
    `Ideal customer profile: ${input.icp.name}`,
    `Outreach tone: ${tone}`,
  ];

  const constraints = input.icp.messageConstraints?.trim() ?? "";
  if (constraints.length > 0) {
    lines.push(`Message constraints: ${constraints}`);
  }

  lines.push(
    `Current subject: ${input.subject}`,
    `Current body: ${input.body}`,
    `Instruction: ${input.instruction}`,
  );

  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRevision(
  leadId: string,
  text: string,
): { subject: string; body: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Lead ${leadId} outreach revision was not valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Lead ${leadId} outreach revision was not valid JSON.`);
  }

  const subject =
    typeof parsed.subject === "string" ? parsed.subject.trim() : "";
  const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
  if (subject.length === 0 || body.length === 0) {
    throw new Error(
      `Lead ${leadId} outreach revision subject or body is missing.`,
    );
  }

  return { subject, body };
}

/**
 * Revises one outreach draft from a user instruction.
 * Does not write a draft and does not set a status.
 */
export async function reviseOutreach(
  input: ReviseOutreachInput,
  generate: ReviseGenerate = generateJson,
): Promise<ReviseOutreachResult> {
  const response = await generate({
    system: reviseSystem,
    prompt: revisePrompt(input),
    responseSchema: reviseResponseSchema,
  });

  const revised = parseRevision(input.lead.leadId, response.text);
  return {
    subject: revised.subject,
    body: revised.body,
    usage: {
      modelName: response.modelName,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      estimatedCost:
        Math.round(response.estimatedCost * 100_000_000) / 100_000_000,
    },
  };
}
