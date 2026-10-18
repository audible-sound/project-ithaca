export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function readWholeNumber(
  value: unknown,
): number | null | "invalid" | "absent" {
  if (value === undefined) {
    return "absent";
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return "invalid";
  }

  return value;
}

export function readOptionalText(value: unknown): string | null {
  const text = readText(value);
  return text.length > 0 ? text : null;
}

export function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function isFieldError(
  value: number | null | { message: string },
): value is { message: string } {
  return value !== null && typeof value === "object";
}

export function requireWholeNumber(
  value: unknown,
  invalidMessage: string,
): number | null | { message: string } {
  const parsed = readWholeNumber(value);
  if (parsed === "invalid") {
    return { message: invalidMessage };
  }

  if (parsed === "absent") {
    return null;
  }

  return parsed;
}
