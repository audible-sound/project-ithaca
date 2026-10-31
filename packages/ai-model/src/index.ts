export interface ModelRequest {
  system?: string;
  prompt: string;
  modelName?: string;
}

export interface ModelResponse {
  text: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
}

export interface JsonModelRequest extends ModelRequest {
  responseSchema: Record<string, unknown>;
}

export interface JsonModelResponse extends ModelResponse {
  estimatedCost: number;
}

const geminiRequestFailed = "Gemini request failed.";
const defaultGeminiModel = "gemini-3.8-flash";
const gemini38StandardStarts = Date.parse("2027-01-01T00:00:00.000Z");

/**
 * Paid text rates for gemini-3.8-flash, USD per token.
 * Introductory rates apply through 2026-12-31. Output includes thinking tokens.
 * https://ai.google.dev/gemini-api/docs/pricing
 */
function geminiTextRates(
  modelName: string,
  now = new Date(),
): { inputPerToken: number; outputPerToken: number } | undefined {
  if (modelName !== defaultGeminiModel) {
    return undefined;
  }

  const introductory = now.getTime() < gemini38StandardStarts;
  return {
    inputPerToken: (introductory ? 0.75 : 1.5) / 1_000_000,
    outputPerToken: (introductory ? 3.75 : 7.5) / 1_000_000,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (key.length === 0) {
    throw new Error("GEMINI_API_KEY is required.");
  }

  return key;
}

function readGeminiModel(requested: string | undefined): string {
  const explicit = requested?.trim() ?? "";
  const fromEnv = process.env.GEMINI_MODEL?.trim() ?? "";
  let modelName = defaultGeminiModel;
  if (explicit.length > 0) {
    modelName = explicit;
  } else if (fromEnv.length > 0) {
    modelName = fromEnv;
  }

  if (geminiTextRates(modelName) === undefined) {
    throw new Error("Gemini model rates are not configured.");
  }

  return modelName;
}

function readTokenCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value);
}

function readUsage(body: Record<string, unknown>): {
  promptTokens: number;
  completionTokens: number;
} {
  if (!isRecord(body.usageMetadata)) {
    return { promptTokens: 0, completionTokens: 0 };
  }

  const usage = body.usageMetadata;
  return {
    promptTokens: readTokenCount(usage.promptTokenCount),
    completionTokens:
      readTokenCount(usage.candidatesTokenCount) +
      readTokenCount(usage.thoughtsTokenCount),
  };
}

function readCandidateText(body: Record<string, unknown>): string {
  if (!Array.isArray(body.candidates)) {
    throw new Error(geminiRequestFailed);
  }

  const candidate = body.candidates[0];
  if (
    !isRecord(candidate) ||
    !isRecord(candidate.content) ||
    !Array.isArray(candidate.content.parts)
  ) {
    throw new Error(geminiRequestFailed);
  }

  const texts: string[] = [];
  for (const part of candidate.content.parts) {
    if (!isRecord(part) || part.thought === true) {
      continue;
    }

    if (typeof part.text === "string" && part.text.length > 0) {
      texts.push(part.text);
    }
  }

  const text = texts.join("");
  if (text.length === 0) {
    throw new Error(geminiRequestFailed);
  }

  return text;
}

function estimatedCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = geminiTextRates(modelName);
  if (rates === undefined) {
    throw new Error("Gemini model rates are not configured.");
  }

  const dollars =
    promptTokens * rates.inputPerToken +
    completionTokens * rates.outputPerToken;
  return Math.round(dollars * 100_000_000) / 100_000_000;
}

/**
 * Calls Gemini and returns JSON text plus token use.
 * `generateText` stays a stub for draft.
 */
export async function generateJson(
  request: JsonModelRequest,
): Promise<JsonModelResponse> {
  const apiKey = readGeminiApiKey();
  const modelName = readGeminiModel(request.modelName);
  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: request.responseSchema,
    },
  };
  const system = request.system?.trim() ?? "";
  if (system.length > 0) {
    payload.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(geminiRequestFailed);
  }

  if (!response.ok) {
    throw new Error(geminiRequestFailed);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(geminiRequestFailed);
  }

  if (!isRecord(body)) {
    throw new Error(geminiRequestFailed);
  }

  const usage = readUsage(body);
  return {
    text: readCandidateText(body),
    modelName,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    estimatedCost: estimatedCost(
      modelName,
      usage.promptTokens,
      usage.completionTokens,
    ),
  };
}

/** Stub text call. Draft still uses this. */
export async function generateText(
  request: ModelRequest,
): Promise<ModelResponse> {
  const modelName = request.modelName ?? "stub-model";
  return {
    text: `[stub] No model call made. Prompt length: ${request.prompt.length}`,
    modelName,
    promptTokens: 0,
    completionTokens: 0,
  };
}
