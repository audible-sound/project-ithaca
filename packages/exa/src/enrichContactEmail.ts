import { exaHeaders, readEstimatedCost, readExaApiKey, readExaJson, readRecord } from "./exaApi.js";

export interface EmailEnrichmentRequest {
  personName: string;
  companyName: string;
  profileUrl?: string;
}

export interface EmailEnrichmentResponse {
  email?: string;
  estimatedCost?: number;
}

const emailLookupFailed = "Exa email lookup failed.";
const emailLookupTimeoutMs = 60_000;
const emailLookupPollMs = 1_000;

const outputSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
  },
  additionalProperties: false,
};

function emailQuery(request: EmailEnrichmentRequest): string {
  const parts = [`Find the work email for ${request.personName.trim()} at ${request.companyName.trim()}.`];
  const profileUrl = request.profileUrl?.trim() ?? "";
  if (profileUrl.length > 0) {
    parts.push(`Profile: ${profileUrl}`);
  }

  return parts.join(" ");
}

function readEmail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function readStatus(body: Record<string, unknown>): string | undefined {
  return typeof body.status === "string" ? body.status : undefined;
}

function isTerminal(status: string | undefined): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "error"
  );
}

function readStructuredEmail(body: Record<string, unknown>): string | undefined {
  const output = readRecord(body.output);
  if (output === undefined) {
    return undefined;
  }

  const structured = readRecord(output.structured);
  if (structured === undefined) {
    return undefined;
  }

  return readEmail(structured.email);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Asks Exa Agent for one work email. Effort is `minimal` and the schema has only `email`.
 * Polls until the run finishes or 60 seconds pass. A miss, failure, or timeout returns no email.
 * @param request - The person, their company, and a profile URL when one is known.
 * @returns The work email when Agent returns one, and the run cost when Exa reports it.
 */
export async function enrichContactEmail(
  request: EmailEnrichmentRequest,
): Promise<EmailEnrichmentResponse> {
  const personName = request.personName.trim();
  const companyName = request.companyName.trim();
  if (personName.length === 0 || companyName.length === 0) {
    return {};
  }

  const apiKey = readExaApiKey();
  const created = await fetch("https://api.exa.ai/agent/runs", {
    method: "POST",
    headers: exaHeaders(apiKey),
    body: JSON.stringify({
      query: emailQuery({
        personName,
        companyName,
        ...(request.profileUrl === undefined ? {} : { profileUrl: request.profileUrl }),
      }),
      effort: "minimal",
      outputSchema,
    }),
  });
  const createdBody = readRecord(await readExaJson(created, emailLookupFailed));
  const runId = createdBody === undefined ? undefined : createdBody.id;
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error(emailLookupFailed);
  }

  const deadline = Date.now() + emailLookupTimeoutMs;
  let latest: Record<string, unknown> | undefined;
  while (Date.now() < deadline) {
    const polled = await fetch(`https://api.exa.ai/agent/runs/${encodeURIComponent(runId)}`, {
      headers: { "x-api-key": apiKey },
    });
    latest = readRecord(await readExaJson(polled, emailLookupFailed));
    if (latest !== undefined && isTerminal(readStatus(latest))) {
      break;
    }

    await delay(emailLookupPollMs);
  }

  const result: EmailEnrichmentResponse = {};
  if (latest !== undefined && readStatus(latest) === "completed") {
    const email = readStructuredEmail(latest);
    if (email !== undefined) {
      result.email = email;
    }
  }
  const estimatedCost = latest === undefined ? undefined : readEstimatedCost(latest);
  if (estimatedCost !== undefined) {
    result.estimatedCost = estimatedCost;
  }

  return result;
}
