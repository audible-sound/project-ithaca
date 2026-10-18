import type {
  CreateIdealCustomerProfileRequest,
  CreateIdealCustomerProfileResponse,
  IdealCustomerProfile,
  ListIdealCustomerProfilesResponse,
} from "@ithaca/shared";
import { create } from "zustand";
import { useAuthStore } from "../../stores/authStore";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type IcpStatus = "idle" | "loading" | "ready" | "error";

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
  status: IcpStatus;
  profiles: IdealCustomerProfile[];
  listStatus: IcpStatus;
  listMessage: string | null;
  createProfile: (values: IcpFormValues) => Promise<void>;
  loadProfiles: () => Promise<void>;
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ listStatus: "error", listMessage: "Authentication required." });
      return;
    }

    set({ listStatus: "loading", listMessage: null });

    try {
      const res = await fetch(`${apiUrl}/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: Partial<ListIdealCustomerProfilesResponse> & { message?: string };
      try {
        data = (await res.json()) as Partial<ListIdealCustomerProfilesResponse> & {
          message?: string;
        };
      } catch {
        set({ listMessage: "Failed to reach API", listStatus: "error" });
        return;
      }

      if (!res.ok) {
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

    const token = useAuthStore.getState().token;
    if (!token) {
      set({ status: "error", message: "Authentication required." });
      return;
    }

    const body: CreateIdealCustomerProfileRequest = {
      name: values.name,
      industries: splitList(values.industriesInclude),
      industriesExclude: splitList(values.industriesExclude),
      country: values.country.trim(),
      region: values.region.trim(),
      city: values.city.trim(),
      budgetCurrency: values.budgetCurrency.trim(),
      budgetNotes: values.budgetNotes.trim(),
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
      let data: Partial<CreateIdealCustomerProfileResponse>;
      try {
        data = (await res.json()) as Partial<CreateIdealCustomerProfileResponse>;
      } catch {
        set({ message: "Failed to reach API", status: "error" });
        return;
      }
      set({
        message: data.message ?? null,
        status: res.ok ? "ready" : "error",
      });
    } catch (err) {
      set({
        message: err instanceof Error ? err.message : "Failed to reach API",
        status: "error",
      });
    }
  },
}));
