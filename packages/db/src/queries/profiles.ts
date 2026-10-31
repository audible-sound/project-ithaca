import { and, asc, desc, eq } from "drizzle-orm";
import { requireDb } from "../client.js";
import type { IdealCustomerProfile } from "../schema/profiles.js";
import { idealCustomerProfiles } from "../schema/profiles.js";

export type IdealCustomerProfileDraft = {
  userId: string;
  name: string;
  industriesInclude: string[];
  industriesExclude: string[];
  country: string;
  region: string;
  city: string;
  locations: string[];
  companySizeMin: number | null;
  companySizeMax: number | null;
  budgetCurrency: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetNotes: string;
  businessNeedKeywords: string[];
  businessNeedDescription: string;
  outreachTone: string | null;
  messageConstraints: string | null;
  isActive: boolean;
};

function industriesValue(draft: IdealCustomerProfileDraft): {
  include: string[];
  exclude: string[];
} {
  return {
    include: draft.industriesInclude,
    exclude: draft.industriesExclude,
  };
}

function locationsValue(draft: IdealCustomerProfileDraft): {
  countries: string[];
  regions: string[];
  cities: string[];
} {
  if (draft.country || draft.region || draft.city) {
    return {
      countries: draft.country ? [draft.country] : [],
      regions: draft.region ? [draft.region] : [],
      cities: draft.city ? [draft.city] : [],
    };
  }

  return {
    countries: draft.locations,
    regions: [],
    cities: [],
  };
}

function budgetValue(draft: IdealCustomerProfileDraft): Record<string, unknown> {
  if (
    !draft.budgetCurrency &&
    draft.budgetMin === null &&
    draft.budgetMax === null &&
    !draft.budgetNotes
  ) {
    return {};
  }

  return {
    currency: draft.budgetCurrency || null,
    minAmount: draft.budgetMin,
    maxAmount: draft.budgetMax,
    notes: draft.budgetNotes || null,
  };
}

function businessNeedValue(
  draft: IdealCustomerProfileDraft,
): Record<string, unknown> {
  if (draft.businessNeedKeywords.length === 0 && !draft.businessNeedDescription) {
    return {};
  }

  return {
    keywords: draft.businessNeedKeywords,
    description: draft.businessNeedDescription || null,
  };
}

export async function findIdealCustomerProfileById(
  icpId: string,
  userId: string,
): Promise<IdealCustomerProfile | null> {
  const rows = await requireDb()
    .select()
    .from(idealCustomerProfiles)
    .where(
      and(
        eq(idealCustomerProfiles.icpId, icpId),
        eq(idealCustomerProfiles.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listIdealCustomerProfilesByUser(
  userId: string,
): Promise<IdealCustomerProfile[]> {
  return requireDb()
    .select()
    .from(idealCustomerProfiles)
    .where(eq(idealCustomerProfiles.userId, userId))
    .orderBy(
      desc(idealCustomerProfiles.createdAt),
      asc(idealCustomerProfiles.name),
    );
}

export async function insertIdealCustomerProfile(
  draft: IdealCustomerProfileDraft,
): Promise<IdealCustomerProfile> {
  const now = new Date();
  const rows = await requireDb()
    .insert(idealCustomerProfiles)
    .values({
      userId: draft.userId,
      name: draft.name,
      industries: industriesValue(draft),
      companySizeMin: draft.companySizeMin,
      companySizeMax: draft.companySizeMax,
      locations: locationsValue(draft),
      budget: budgetValue(draft),
      businessNeedKeywords: businessNeedValue(draft),
      outreachTone: draft.outreachTone,
      messageConstraints: draft.messageConstraints,
      otherCriteria: {},
      isActive: draft.isActive,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Ideal customer profile was not created.");
  }

  return row;
}

export async function updateIdealCustomerProfileActive(
  icpId: string,
  userId: string,
  isActive: boolean,
): Promise<IdealCustomerProfile | null> {
  const rows = await requireDb()
    .update(idealCustomerProfiles)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(idealCustomerProfiles.icpId, icpId),
        eq(idealCustomerProfiles.userId, userId),
      ),
    )
    .returning();

  return rows[0] ?? null;
}
