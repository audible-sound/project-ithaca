const maxCompanySize = 2_147_483_647;
const currencyCode = /^[A-Za-z]{3}$/;

export const profileCreatedMessage = "Ideal customer profile created.";
export const profileUpdatedMessage = "Profile updated with the modified criteria.";
export const profileDeletedMessage = "Ideal customer profile deleted.";
export const profileInUseMessage = "Ideal customer profile is in use.";
export const profileInactiveMessage = "Ideal customer profile is inactive.";
export const profileNameTakenMessage =
  "A profile with this name already exists.";

export type ProfileCriteria = {
  name: string;
  industries: string[];
  industriesExclude: string[];
  country: string;
  region: string;
  city: string;
  companySizeMin: number | null;
  companySizeMax: number | null;
  budgetCurrency: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetNotes: string;
};

function exceedsCompanySize(value: number | null): boolean {
  return value !== null && value > maxCompanySize;
}

function industriesOverlap(include: string[], exclude: string[]): boolean {
  const excluded = new Set(
    exclude
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  );

  return include.some((item) => {
    const name = item.trim().toLowerCase();
    return name.length > 0 && excluded.has(name);
  });
}

function budgetCurrencyError(input: ProfileCriteria): string | null {
  const code = input.budgetCurrency.trim();
  const budgetSpecified =
    input.budgetMin !== null ||
    input.budgetMax !== null ||
    input.budgetNotes.trim().length > 0;

  if (!budgetSpecified && code.length === 0) {
    return null;
  }

  if (!currencyCode.test(code)) {
    return "Budget currency must be a three-letter code.";
  }

  return null;
}

function locationError(input: ProfileCriteria): string | null {
  const country = input.country.trim();
  const region = input.region.trim();
  const city = input.city.trim();

  if ((region.length > 0 || city.length > 0) && country.length === 0) {
    return "Country is required when a region or city is set.";
  }

  return null;
}

export function profileCriteriaError(input: ProfileCriteria): string | null {
  if (input.name.trim().length === 0) {
    return "Name is required.";
  }

  if (
    exceedsCompanySize(input.companySizeMin) ||
    exceedsCompanySize(input.companySizeMax)
  ) {
    return "Company size cannot exceed 2,147,483,647.";
  }

  if (industriesOverlap(input.industries, input.industriesExclude)) {
    return "An industry cannot be both included and excluded.";
  }

  const currencyError = budgetCurrencyError(input);
  if (currencyError) {
    return currencyError;
  }

  return locationError(input);
}

export function normalizedBudgetCurrency(currency: string): string {
  const trimmed = currency.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : "";
}
