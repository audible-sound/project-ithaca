import type {
  CreateIdealCustomerProfileRequest,
  CreateIdealCustomerProfileResponse,
  IdealCustomerProfile,
  ListIdealCustomerProfilesResponse,
} from "@ithaca/shared";
import { create } from "zustand";
import { apiUrl, authToken, readJson } from "./api";
import type { RequestStatus } from "./api";

export type IcpFormValues = {
  name: string;
  industriesInclude: string;
  industriesExclude: string;
  country: string;
  region: string;
  city: string;
  companySizeMin: string;
  companySizeMax: string;
  budgetCurrency: string;
  budgetMin: string;
  budgetMax: string;
  budgetNotes: string;
  businessNeedKeywords: string;
  businessNeedDescription: string;
  outreachTone: string;
  messageConstraints: string;
  isActive: boolean;
};

type IcpStore = {
  message: string | null;
  status: RequestStatus;
  profiles: IdealCustomerProfile[];
  listStatus: RequestStatus;
  listMessage: string | null;
  createProfile: (values: IcpFormValues) => Promise<void>;
  loadProfiles: () => Promise<void>;
};

const maxCompanySize = 2_147_483_647;
const currencyCode = /^[A-Za-z]{3}$/;

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function industriesOverlap(include: string[], exclude: string[]): boolean {
  const excluded = new Set(exclude.map((item) => item.toLowerCase()));
  return include.some((item) => excluded.has(item.toLowerCase()));
}

function budgetCurrencyMessage(
  currency: string,
  budgetMin: number | undefined,
  budgetMax: number | undefined,
  budgetNotes: string,
): string | null {
  const budgetSpecified =
    budgetMin !== undefined ||
    budgetMax !== undefined ||
    budgetNotes.length > 0;

  if (!budgetSpecified && currency.length === 0) {
    return null;
  }

  if (!currencyCode.test(currency)) {
    return "Budget currency must be a three-letter code.";
  }

  return null;
}

function readWholeNumber(value: string): number | undefined | "invalid" {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return "invalid";
  }

  return Number(trimmed);
}

function withNumber(
  body: CreateIdealCustomerProfileRequest,
  key: "companySizeMin" | "companySizeMax" | "budgetMin" | "budgetMax",
  value: number | undefined,
): void {
  if (value !== undefined) {
    body[key] = value;
  }
}

export const useIcpStore = create<IcpStore>()((set) => ({
  message: null,
  status: "idle",
  profiles: [],
  listStatus: "idle",
  listMessage: null,
  loadProfiles: async () => {
    const token = authToken();
    if (!token) {
      set({ listStatus: "error", listMessage: "Authentication required." });
      return;
    }

    set({ listStatus: "loading", listMessage: null });

    try {
      const res = await fetch(`${apiUrl}/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<
        Partial<ListIdealCustomerProfilesResponse> & { message?: string }
      >(res);
      if (!res.ok || !("profiles" in data)) {
        set({
          listMessage: data.message ?? "Failed to reach API",
          listStatus: "error",
        });
        return;
      }

      set({
        profiles: data.profiles ?? [],
        listStatus: "ready",
        listMessage: null,
      });
    } catch (err) {
      set({
        listMessage: err instanceof Error ? err.message : "Failed to reach API",
        listStatus: "error",
      });
    }
  },
  createProfile: async (values) => {
    const name = values.name.trim();
    if (!name) {
      set({ status: "error", message: "Name is required." });
      return;
    }

    const companySizeMin = readWholeNumber(values.companySizeMin);
    const companySizeMax = readWholeNumber(values.companySizeMax);
    if (companySizeMin === "invalid" || companySizeMax === "invalid") {
      set({
        status: "error",
        message: "Company size must be a whole number.",
      });
      return;
    }

    if (
      (companySizeMin !== undefined && companySizeMin > maxCompanySize) ||
      (companySizeMax !== undefined && companySizeMax > maxCompanySize)
    ) {
      set({
        status: "error",
        message: "Company size cannot exceed 2,147,483,647.",
      });
      return;
    }

    if (
      companySizeMin !== undefined &&
      companySizeMax !== undefined &&
      companySizeMin > companySizeMax
    ) {
      set({
        status: "error",
        message: "Company size minimum cannot exceed the maximum.",
      });
      return;
    }

    const budgetMin = readWholeNumber(values.budgetMin);
    const budgetMax = readWholeNumber(values.budgetMax);
    if (budgetMin === "invalid" || budgetMax === "invalid") {
      set({ status: "error", message: "Budget must be a whole number." });
      return;
    }

    if (
      budgetMin !== undefined &&
      budgetMax !== undefined &&
      budgetMin > budgetMax
    ) {
      set({
        status: "error",
        message: "Budget minimum cannot exceed the maximum.",
      });
      return;
    }

    const industries = splitList(values.industriesInclude);
    const industriesExclude = splitList(values.industriesExclude);
    if (industriesOverlap(industries, industriesExclude)) {
      set({
        status: "error",
        message: "An industry cannot be both included and excluded.",
      });
      return;
    }

    const country = values.country.trim();
    const region = values.region.trim();
    const city = values.city.trim();
    const budgetCurrency = values.budgetCurrency.trim();
    const budgetNotes = values.budgetNotes.trim();
    const currencyMessage = budgetCurrencyMessage(
      budgetCurrency,
      budgetMin,
      budgetMax,
      budgetNotes,
    );
    if (currencyMessage) {
      set({ status: "error", message: currencyMessage });
      return;
    }

    if ((region || city) && !country) {
      set({
        status: "error",
        message: "Country is required when a region or city is set.",
      });
      return;
    }

    const token = authToken();
    if (!token) {
      set({ status: "error", message: "Authentication required." });
      return;
    }

    const body: CreateIdealCustomerProfileRequest = {
      name,
      industries,
      industriesExclude,
      country,
      region,
      city,
      budgetCurrency: budgetCurrency.toUpperCase(),
      budgetNotes,
      businessNeedKeywords: splitList(values.businessNeedKeywords),
      businessNeedDescription: values.businessNeedDescription.trim(),
      outreachTone: values.outreachTone.trim(),
      messageConstraints: values.messageConstraints.trim(),
      isActive: values.isActive,
    };
    withNumber(body, "companySizeMin", companySizeMin);
    withNumber(body, "companySizeMax", companySizeMax);
    withNumber(body, "budgetMin", budgetMin);
    withNumber(body, "budgetMax", budgetMax);

    set({ status: "loading", message: null });

    try {
      const res = await fetch(`${apiUrl}/profiles`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await readJson<Partial<CreateIdealCustomerProfileResponse>>(
        res,
      );
      if (!res.ok || !("profile" in data) || !data.profile) {
        set({
          message: data.message ?? "Failed to reach API",
          status: "error",
        });
        return;
      }
      set({
        message: data.message ?? null,
        status: "ready",
      });
    } catch (err) {
      set({
        message: err instanceof Error ? err.message : "Failed to reach API",
        status: "error",
      });
    }
  },
}));
