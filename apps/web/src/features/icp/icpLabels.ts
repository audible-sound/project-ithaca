import type { IdealCustomerProfile } from "@ithaca/shared";

const unrestricted = "Unrestricted";

export function industriesText(profile: IdealCustomerProfile): string {
  return profile.industries.length > 0
    ? profile.industries.join(", ")
    : unrestricted;
}

export function industriesExcludeText(profile: IdealCustomerProfile): string {
  return profile.industriesExclude.length > 0
    ? profile.industriesExclude.join(", ")
    : "None";
}

export function locationText(profile: IdealCustomerProfile): string {
  const parts = [profile.country, profile.region, profile.city].filter(
    (part) => part.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : unrestricted;
}

export function companySizeText(profile: IdealCustomerProfile): string {
  const { companySizeMin, companySizeMax } = profile;
  if (companySizeMin !== null && companySizeMax !== null) {
    return `${companySizeMin}–${companySizeMax}`;
  }

  if (companySizeMin !== null) {
    return `At least ${companySizeMin}`;
  }

  if (companySizeMax !== null) {
    return `At most ${companySizeMax}`;
  }

  return unrestricted;
}

export function budgetAmountText(profile: IdealCustomerProfile): string | null {
  const { budgetCurrency, budgetMin, budgetMax } = profile;
  const currency = budgetCurrency.length > 0 ? budgetCurrency : null;
  let range: string | null = null;

  if (budgetMin !== null && budgetMax !== null) {
    range = `${budgetMin}–${budgetMax}`;
  } else if (budgetMin !== null) {
    range = `At least ${budgetMin}`;
  } else if (budgetMax !== null) {
    range = `At most ${budgetMax}`;
  }

  if (currency && range) {
    return `${currency} ${range}`;
  }

  return range ?? currency;
}

export function businessNeedKeywordsText(
  profile: IdealCustomerProfile,
): string | null {
  return profile.businessNeedKeywords.length > 0
    ? profile.businessNeedKeywords.join(", ")
    : null;
}

export function businessNeedDescriptionText(
  profile: IdealCustomerProfile,
): string | null {
  return profile.businessNeedDescription.length > 0
    ? profile.businessNeedDescription
    : null;
}

export function outreachToneText(profile: IdealCustomerProfile): string {
  return profile.outreachTone && profile.outreachTone.length > 0
    ? profile.outreachTone
    : "—";
}

export function messageConstraintsText(profile: IdealCustomerProfile): string {
  return profile.messageConstraints && profile.messageConstraints.length > 0
    ? profile.messageConstraints
    : "—";
}
