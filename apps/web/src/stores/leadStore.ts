import type {
  CreateLeadRequest,
  CreateLeadResponse,
  DeleteLeadResponse,
  LeadDetail,
  LeadListItem,
  ListLeadListResponse,
  OverrideLeadQualificationResponse,
  UpdateLeadResponse,
} from "@ithaca/shared";
import { create } from "zustand";
import { apiUrl, authToken, readJson } from "./api";
import type { RequestStatus } from "./api";

export type LeadFormValues = {
  companyName: string;
  website: string;
  industry: string;
  location: string;
  companySizeBand: string;
  description: string;
  companyEmail: string;
  companyPhone: string;
  companyLinkedinUrl: string;
  contactName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactLinkedinUrl: string;
};

const emailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const companySizeBands = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emailMessage(value: string | null, message: string): string | null {
  if (value === null || emailAddress.test(value)) {
    return null;
  }

  return message;
}

function httpUrlMessage(value: string | null, message: string): string | null {
  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return null;
    }
  } catch {
    return message;
  }

  return message;
}

function leadRequest(
  values: LeadFormValues,
): { message: string } | { body: CreateLeadRequest } {
  const companyName = values.companyName.trim();
  if (companyName.length === 0) {
    return { message: "Company name is required." };
  }

  const contactName = optionalText(values.contactName);
  const contactJobTitle = optionalText(values.contactJobTitle);
  const contactEmail = optionalText(values.contactEmail);
  const contactPhone = optionalText(values.contactPhone);
  const contactLinkedinUrl = optionalText(values.contactLinkedinUrl);
  if (
    contactName === null &&
    (contactJobTitle !== null ||
      contactEmail !== null ||
      contactPhone !== null ||
      contactLinkedinUrl !== null)
  ) {
    return { message: "Contact name is required." };
  }

  const companyEmail = optionalText(values.companyEmail);
  const companyEmailError = emailMessage(
    companyEmail,
    "Company email must be a valid address.",
  );
  if (companyEmailError) {
    return { message: companyEmailError };
  }

  const contactEmailError = emailMessage(
    contactEmail,
    "Contact email must be a valid address.",
  );
  if (contactEmailError) {
    return { message: contactEmailError };
  }

  const website = optionalText(values.website);
  const websiteError = httpUrlMessage(
    website,
    "Website must be an http or https URL.",
  );
  if (websiteError) {
    return { message: websiteError };
  }

  const companyLinkedinUrl = optionalText(values.companyLinkedinUrl);
  const companyLinkedinError = httpUrlMessage(
    companyLinkedinUrl,
    "Company LinkedIn must be an http or https URL.",
  );
  if (companyLinkedinError) {
    return { message: companyLinkedinError };
  }

  const contactLinkedinError = httpUrlMessage(
    contactLinkedinUrl,
    "Contact LinkedIn must be an http or https URL.",
  );
  if (contactLinkedinError) {
    return { message: contactLinkedinError };
  }

  const companySizeBand = optionalText(values.companySizeBand);
  if (
    companySizeBand !== null &&
    !companySizeBands.some((band) => band === companySizeBand)
  ) {
    return { message: "Company size must be a listed band." };
  }

  return {
    body: {
      companyName,
      website,
      industry: optionalText(values.industry),
      location: optionalText(values.location),
      companySizeBand,
      description: optionalText(values.description),
      companyEmail,
      companyPhone: optionalText(values.companyPhone),
      companyLinkedinUrl,
      contactName,
      contactJobTitle,
      contactEmail,
      contactPhone,
      contactLinkedinUrl,
    },
  };
}

type LeadStore = {
  leads: LeadListItem[];
  listStatus: RequestStatus;
  listMessage: string | null;
  lead: LeadDetail | null;
  detailStatus: RequestStatus;
  detailMessage: string | null;
  formStatus: RequestStatus;
  formMessage: string | null;
  deleteMessage: string | null;
  overrideMessage: string | null;
  loadLeads: () => Promise<void>;
  loadLead: (leadId: string) => Promise<void>;
  createLead: (values: LeadFormValues) => Promise<string | null>;
  updateLead: (leadId: string, values: LeadFormValues) => Promise<boolean>;
  deleteLead: (leadId: string) => Promise<boolean>;
  overrideQualification: (
    leadId: string,
    score: unknown,
    reason: string,
  ) => Promise<boolean>;
  clearForm: () => void;
  clearOverride: () => void;
};

export const useLeadStore = create<LeadStore>()((set, get) => ({
  leads: [],
  listStatus: "idle",
  listMessage: null,
  lead: null,
  detailStatus: "idle",
  detailMessage: null,
  formStatus: "idle",
  formMessage: null,
  deleteMessage: null,
  overrideMessage: null,
  clearForm: () => {
    set({ formStatus: "idle", formMessage: null });
  },
  clearOverride: () => {
    set({ overrideMessage: null });
  },
  loadLead: async (leadId) => {
    const token = authToken();
    if (!token) {
      set({
        lead: null,
        detailStatus: "error",
        detailMessage: "Authentication required.",
      });
      return;
    }

    // If the lead is already being loaded, don't load it again.
    const sameLead = get().lead?.leadId === leadId;
    if (!sameLead) {
      set({ lead: null, detailStatus: "loading", detailMessage: null });
    }

    try {
      const res = await fetch(`${apiUrl}/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<LeadDetail & { message?: string }>(res);
      if (!res.ok || !("leadId" in data) || !data.leadId) {
        set({
          lead: sameLead ? get().lead : null,
          detailMessage: data.message ?? "Failed to reach API",
          detailStatus: "error",
        });
        return;
      }

      set({ lead: data, detailStatus: "ready", detailMessage: null });
    } catch (err) {
      set({
        lead: sameLead ? get().lead : null,
        detailMessage:
          err instanceof Error ? err.message : "Failed to reach API",
        detailStatus: "error",
      });
    }
  },
  loadLeads: async () => {
    const token = authToken();
    if (!token) {
      set({ listStatus: "error", listMessage: "Authentication required." });
      return;
    }

    set({ listStatus: "loading", listMessage: null });

    try {
      const res = await fetch(`${apiUrl}/leads/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<
        Partial<ListLeadListResponse> & { message?: string }
      >(res);
      if (!res.ok || !("leads" in data)) {
        set({
          listMessage: data.message ?? "Failed to reach API",
          listStatus: "error",
        });
        return;
      }

      set({
        leads: data.leads ?? [],
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
  createLead: async (values) => {
    const request = leadRequest(values);
    if ("message" in request) {
      set({ formStatus: "error", formMessage: request.message });
      return null;
    }

    const token = authToken();
    if (!token) {
      set({ formStatus: "error", formMessage: "Authentication required." });
      return null;
    }

    set({ formStatus: "loading", formMessage: null });

    try {
      const res = await fetch(`${apiUrl}/leads`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.body),
      });
      const data = await readJson<Partial<CreateLeadResponse>>(res);
      if (!res.ok || !("lead" in data) || !data.lead) {
        set({
          formMessage: data.message ?? "Failed to reach API",
          formStatus: "error",
        });
        return null;
      }

      set({
        lead: data.lead,
        detailStatus: "ready",
        detailMessage: null,
        formStatus: "idle",
        formMessage: null,
      });
      return data.lead.leadId;
    } catch (err) {
      set({
        formMessage: err instanceof Error ? err.message : "Failed to reach API",
        formStatus: "error",
      });
      return null;
    }
  },
  updateLead: async (leadId, values) => {
    const request = leadRequest(values);
    if ("message" in request) {
      set({ formStatus: "error", formMessage: request.message });
      return false;
    }

    const token = authToken();
    if (!token) {
      set({ formStatus: "error", formMessage: "Authentication required." });
      return false;
    }

    set({ formStatus: "loading", formMessage: null });

    try {
      const res = await fetch(`${apiUrl}/leads/${leadId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.body),
      });
      const data = await readJson<Partial<UpdateLeadResponse>>(res);
      if (!res.ok || !("lead" in data) || !data.lead) {
        set({
          formMessage: data.message ?? "Failed to reach API",
          formStatus: "error",
        });
        return false;
      }

      set({
        lead: data.lead,
        detailStatus: "ready",
        detailMessage: null,
        formStatus: "idle",
        formMessage: null,
      });
      return true;
    } catch (err) {
      set({
        formMessage: err instanceof Error ? err.message : "Failed to reach API",
        formStatus: "error",
      });
      return false;
    }
  },
  overrideQualification: async (leadId, score, reason) => {
    const token = authToken();
    if (!token) {
      set({ overrideMessage: "Authentication required." });
      return false;
    }

    set({ overrideMessage: null });

    try {
      const res = await fetch(`${apiUrl}/leads/${leadId}/qualification`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ score, reason }),
      });
      const data = await readJson<Partial<OverrideLeadQualificationResponse>>(
        res,
      );
      if (!res.ok || !("lead" in data) || !data.lead) {
        set({ overrideMessage: data.message ?? "Failed to reach API" });
        return false;
      }

      set({
        lead: data.lead,
        detailStatus: "ready",
        detailMessage: null,
        overrideMessage: null,
      });
      void get().loadLeads();
      return true;
    } catch (err) {
      set({
        overrideMessage:
          err instanceof Error ? err.message : "Failed to reach API",
      });
      return false;
    }
  },
  deleteLead: async (leadId) => {
    const token = authToken();
    if (!token) {
      set({ deleteMessage: "Authentication required." });
      return false;
    }

    set({ deleteMessage: null });

    try {
      const res = await fetch(`${apiUrl}/leads/${leadId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<Partial<DeleteLeadResponse>>(res);
      if (res.ok) {
        const detail = get().lead;
        set({
          leads: get().leads.filter((lead) => lead.leadId !== leadId),
          lead: detail?.leadId === leadId ? null : detail,
          deleteMessage: null,
        });
        return true;
      }

      set({ deleteMessage: data.message ?? "Failed to reach API" });
      return false;
    } catch (err) {
      set({
        deleteMessage:
          err instanceof Error ? err.message : "Failed to reach API",
      });
      return false;
    }
  },
}));
