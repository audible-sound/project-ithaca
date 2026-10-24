import type {
  LeadDetail,
  LeadListItem,
  ListLeadListResponse,
} from "@ithaca/shared";
import { create } from "zustand";
import { apiUrl, authToken, readJson } from "./api";
import type { RequestStatus } from "./api";

type LeadStore = {
  leads: LeadListItem[];
  listStatus: RequestStatus;
  listMessage: string | null;
  lead: LeadDetail | null;
  detailStatus: RequestStatus;
  detailMessage: string | null;
  loadLeads: () => Promise<void>;
  loadLead: (leadId: string) => Promise<void>;
};

export const useLeadStore = create<LeadStore>()((set, get) => ({
  leads: [],
  listStatus: "idle",
  listMessage: null,
  lead: null,
  detailStatus: "idle",
  detailMessage: null,
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
}));
