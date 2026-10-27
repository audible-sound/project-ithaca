export interface CompanyContact {
  name: string;
  jobTitle?: string;
  profileUrl?: string;
}

interface RankedContact {
  contact: CompanyContact;
  preferred: boolean;
}

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

function companyLabel(value: string): string {
  const pipe = value.split("|")[0] ?? value;
  const dash = pipe.split(/\s[-–—]\s/)[0] ?? pipe;
  return dash.trim();
}

function normalizeCompanyName(value: string): string {
  return companyLabel(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(incorporated|inc|ltd|limited|llc|plc|pte|corp|corporation|company|co|sdn|bhd|gmbh)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .replace(/^the /, "")
    .trim();
}

function sameCompany(candidate: string, employer: string): boolean {
  const left = normalizeCompanyName(candidate);
  const right = normalizeCompanyName(employer);
  return left.length > 0 && left === right;
}

function isCurrentRole(dates: unknown): boolean {
  return isRecord(dates) && dates.to === null;
}

function isPreferredTitle(title: string): boolean {
  return /\bfounder\b|\bowner\b|managing director|chief executive|\bceo\b/i.test(title);
}

function assignContact(
  contact: CompanyContact,
  key: "jobTitle" | "profileUrl",
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }

  contact[key] = value;
}

/**
 * Picks one current employee at the named company from Exa people results.
 * A current role has `dates.to` null. A founder, owner, managing director,
 * or chief executive is preferred. Someone at another company is ignored.
 * @param companyName - The company the person must currently work at.
 * @param results - Exa `results` entries, each with `url` and `entities`.
 * @returns The chosen person, or undefined when nobody at the company matches.
 */
export function pickCompanyContact(
  companyName: string,
  results: readonly unknown[],
): CompanyContact | undefined {
  const target = readString(companyName);
  if (target === undefined) {
    return undefined;
  }

  const matches: RankedContact[] = [];
  for (const result of results) {
    if (!isRecord(result) || !Array.isArray(result.entities)) {
      continue;
    }

    const profileUrl = readString(result.url);
    for (const entity of result.entities) {
      if (!isRecord(entity) || entity.type !== "person" || !isRecord(entity.properties)) {
        continue;
      }

      const name = readString(entity.properties.name);
      const history = entity.properties.workHistory;
      if (name === undefined || !Array.isArray(history)) {
        continue;
      }

      for (const role of history) {
        if (!isRecord(role) || !isCurrentRole(role.dates) || !isRecord(role.company)) {
          continue;
        }

        const employer = readString(role.company.name);
        if (employer === undefined || !sameCompany(target, employer)) {
          continue;
        }

        const title = readString(role.title);
        const contact: CompanyContact = { name };
        assignContact(contact, "jobTitle", title);
        assignContact(contact, "profileUrl", profileUrl);
        matches.push({
          contact,
          preferred: title !== undefined && isPreferredTitle(title),
        });
      }
    }
  }

  const preferred = matches.find((match) => match.preferred);
  return (preferred ?? matches[0])?.contact;
}
