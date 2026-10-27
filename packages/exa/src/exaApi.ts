function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readExaApiKey(): string {
  const key = process.env.EXA_API_KEY?.trim() ?? "";
  if (key.length === 0) {
    throw new Error("EXA_API_KEY is required.");
  }

  return key;
}

export function exaHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

export function readEstimatedCost(body: unknown): number | undefined {
  if (!isRecord(body) || !isRecord(body.costDollars)) {
    return undefined;
  }

  const total = body.costDollars.total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    return undefined;
  }

  return total;
}

export async function readExaJson(response: Response, failure: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(failure);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(failure);
  }
}

export function readRecord(body: unknown): Record<string, unknown> | undefined {
  return isRecord(body) ? body : undefined;
}
