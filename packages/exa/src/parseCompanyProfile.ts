/**
 * Turns an Exa company result into the facts a lead can store.
 * Entity properties win. Labeled lines in the page text fill gaps.
 * A missing label or a null entity field stays absent.
 */

export const companyProfileSizeBands = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;

export type CompanyProfileSizeBand = (typeof companyProfileSizeBands)[number];

export interface ParsedCompanyProfile {
  description?: string;
  industry?: string;
  location?: string;
  companySizeBand?: CompanyProfileSizeBand;
  homepage?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

const labelNames = [
  "linkedin followers",
  "founded year",
  "company size",
  "headquarters",
  "industry",
  "homepage",
  "aliases",
  "linkedin",
  "emails",
  "offices",
  "phone",
  "type",
  "employees",
];

type LabelSpan = {
  label: string;
  value: string;
  start: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function positiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return undefined;
  }

  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds labeled lines in the page text.
 * @param text - The page text.
 * @returns Spans of labeled lines.
 */
function labelSpans(text: string): LabelSpan[] {
  const pattern = new RegExp(
    `(?:^|\\n|\\s-\\s)\\s*(?:[-*]\\s+)?(${labelNames.map(escapeRegExp).join("|")})\\s*:\\s*`,
    "gi",
  );
  const matches: { label: string; valueStart: number; start: number }[] = [];

  for (const match of text.matchAll(pattern)) {
    const label = match[1];
    const index = match.index;
    if (label === undefined || index === undefined) {
      continue;
    }

    matches.push({
      label: label.toLowerCase(),
      valueStart: index + match[0].length,
      start: index,
    });
  }

  const spans: LabelSpan[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    if (current === undefined) {
      continue;
    }

    const rest = text.slice(current.valueStart);
    const headingAt = rest.search(/\n##\s|\s##\s/);
    const headingEnd = headingAt === -1 ? text.length : current.valueStart + headingAt;
    const value = text
      .slice(current.valueStart, Math.min(next?.start ?? text.length, headingEnd))
      .replace(/\s+/g, " ")
      .trim();
    if (value.length === 0) {
      continue;
    }

    spans.push({ label: current.label, value, start: current.start });
  }

  return spans;
}

function firstLabel(text: string, label: string): string | undefined {
  for (const span of labelSpans(text)) {
    if (span.label === label) {
      return span.value;
    }
  }

  return undefined;
}

function boundedLabel(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return undefined;
  }
  if (/^[.\s…-]+$/.test(trimmed) || trimmed.includes("...") || trimmed.includes("…")) {
    return undefined;
  }

  return trimmed;
}

function companyProperties(entities: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(entities)) {
    return undefined;
  }

  for (const entity of entities) {
    if (!isRecord(entity) || !isRecord(entity.properties)) {
      continue;
    }
    if (entity.type === "person") {
      continue;
    }
    if (entity.type === "company" || entity.type === undefined) {
      return entity.properties;
    }
  }

  return undefined;
}

function headquartersLocation(
  properties: Record<string, unknown> | undefined,
): string | undefined {
  if (properties === undefined) {
    return undefined;
  }

  const headquarters = properties.headquarters;
  if (!isRecord(headquarters)) {
    return undefined;
  }

  const city = readString(headquarters.city);
  const country = readString(headquarters.country);
  if (city !== undefined && country !== undefined) {
    return `${city}, ${country}`;
  }

  return city ?? country;
}

function workforceTotal(
  properties: Record<string, unknown> | undefined,
): number | undefined {
  if (properties === undefined) {
    return undefined;
  }

  const workforce = properties.workforce;
  if (!isRecord(workforce)) {
    return undefined;
  }

  return positiveInteger(workforce.total);
}

function employeeCountFromText(text: string): number | undefined {
  const match = text.match(/\bemploys\s+([\d,]+)\s+people\b/i);
  const raw = match?.[1];
  if (raw === undefined) {
    return undefined;
  }

  const count = Number(raw.replace(/,/g, ""));
  return positiveInteger(count);
}

export function companySizeBand(count: number): CompanyProfileSizeBand | undefined {
  if (!Number.isInteger(count) || count < 1) {
    return undefined;
  }
  if (count <= 10) {
    return "1-10";
  }
  if (count <= 50) {
    return "11-50";
  }
  if (count <= 200) {
    return "51-200";
  }
  if (count <= 1000) {
    return "201-1000";
  }

  return "1000+";
}

function titleCasePlace(value: string): string {
  const stripped = value.replace(/\s*\([A-Za-z]{2}\)\s*$/, "").trim();
  return stripped
    .replace(/[A-Za-z][A-Za-z']*/g, (word) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

function homepageUrl(value: string): string | undefined {
  const token = value.trim().split(/\s+/)[0]?.replace(/[),.;]+$/g, "") ?? "";
  if (token.length === 0) {
    return undefined;
  }
  if (/^https?:\/\//i.test(token)) {
    return token;
  }
  if (
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+(?:\/[^\s]*)?$/i.test(
      token,
    )
  ) {
    return `https://${token}`;
  }

  return undefined;
}

function firstEmail(value: string): string | undefined {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

function phoneToken(value: string): string | undefined {
  const phone = value.trim().replace(/[\s().-]+$/g, "");
  if (phone.length === 0 || phone.length > 24) {
    return undefined;
  }

  const digits = digitCount(phone);
  if (digits < 8 || digits > 15) {
    return undefined;
  }

  const hasPlus = phone.startsWith("+");
  const hasSeparator = /[\s().-]/.test(phone);
  if (!hasPlus && !hasSeparator) {
    return undefined;
  }

  return phone;
}

function pickPhone(value: string): string | undefined {
  const matches = value.match(/\+?\d[\d\s().-]*\d/g) ?? [];
  const candidates: {
    phone: string;
    digits: number;
    hasPlus: boolean;
    index: number;
  }[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (match === undefined) {
      continue;
    }

    const phone = phoneToken(match);
    if (phone === undefined) {
      continue;
    }

    candidates.push({
      phone,
      digits: digitCount(phone),
      hasPlus: phone.startsWith("+"),
      index,
    });
  }

  candidates.sort((left, right) => {
    if (left.hasPlus !== right.hasPlus) {
      return left.hasPlus ? -1 : 1;
    }
    if (left.digits !== right.digits) {
      return right.digits - left.digits;
    }
    return left.index - right.index;
  });

  return candidates[0]?.phone;
}

function linkedinCompanyUrl(value: string): string | undefined {
  const match = value.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9._%-]+/i,
  );
  if (match === null) {
    return undefined;
  }

  const path = match[0].replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return `https://${path}`;
}

function aboutBody(text: string): string | undefined {
  const heading = /##\s*About\b/i.exec(text);
  if (heading === null || heading.index === undefined) {
    return undefined;
  }

  const rest = text.slice(heading.index + heading[0].length);
  const nextHeading = /##\s+[A-Za-z]/i.exec(rest);
  const section =
    nextHeading === null || nextHeading.index === undefined
      ? rest
      : rest.slice(0, nextHeading.index);
  const firstLabel = labelSpans(section)[0];
  const body = (firstLabel === undefined ? section : section.slice(0, firstLabel.start))
    .replace(/\r\n/g, "\n")
    .trim();
  if (body.length === 0) {
    return undefined;
  }

  return body.replace(/\n{3,}/g, "\n\n");
}

function assign(
  profile: ParsedCompanyProfile,
  key:
    | "description"
    | "industry"
    | "location"
    | "homepage"
    | "email"
    | "phone"
    | "linkedinUrl",
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }

  profile[key] = value;
}

/**
 * Reads a company entity and any labeled lines from the page text.
 * @param input - Exa `entities` and the result `text`, when present.
 * @returns Facts that were actually present. Omitted fields were not found.
 */
export function parseCompanyProfile(input: {
  text?: string;
  entities?: unknown;
}): ParsedCompanyProfile {
  const text = input.text?.trim() ?? "";
  const properties = companyProperties(input.entities);
  const profile: ParsedCompanyProfile = {};
  const description =
    readString(properties?.description) ?? (text.length === 0 ? undefined : aboutBody(text));
  assign(profile, "description", description);

  const industry = boundedLabel(
    text.length === 0 ? undefined : firstLabel(text, "industry"),
    160,
  );
  assign(profile, "industry", industry);

  const location =
    headquartersLocation(properties) ??
    boundedLabel(
      text.length === 0
        ? undefined
        : titleCasePlace(firstLabel(text, "headquarters") ?? ""),
      200,
    );
  assign(profile, "location", location === "" ? undefined : location);

  const employees =
    workforceTotal(properties) ??
    (text.length === 0 ? undefined : employeeCountFromText(text));
  if (employees !== undefined) {
    const band = companySizeBand(employees);
    if (band !== undefined) {
      profile.companySizeBand = band;
    }
  }

  const homepage =
    text.length === 0 ? undefined : homepageUrl(firstLabel(text, "homepage") ?? "");
  assign(profile, "homepage", homepage);

  const email =
    text.length === 0 ? undefined : firstEmail(firstLabel(text, "emails") ?? "");
  assign(profile, "email", email);

  const phone =
    text.length === 0 ? undefined : pickPhone(firstLabel(text, "phone") ?? "");
  assign(profile, "phone", phone);

  const linkedinUrl =
    text.length === 0
      ? undefined
      : linkedinCompanyUrl(firstLabel(text, "linkedin") ?? "");
  assign(profile, "linkedinUrl", linkedinUrl);

  return profile;
}

/**
 * True when stored description text is still an Exa company page dump.
 * @param value - The description currently saved on the company.
 * @returns Whether that text should be replaced by a parsed write-up.
 */
export function isCompanyPageText(value: string): boolean {
  const text = value.trim();
  if (text.startsWith("#")) {
    return true;
  }
  if (
    /##\s+(?:About|Categories|Locations|Company Details|Workforce|Social)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  return /(?:^|\n|\s-\s)\s*(?:[-*]\s+)?(?:Industry|Emails|Homepage|LinkedIn)\s*:/i.test(
    text,
  );
}
