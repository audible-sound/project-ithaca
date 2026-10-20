import type {
  ListLeadsResponse,
  ListWorkflowRunsResponse,
  LeadSummary,
  StartWorkflowRunRequest,
  StartWorkflowRunResponse,
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "@ithaca/shared";
import { create } from "zustand";
import { apiUrl, authToken, readJson } from "./api";
import type { RequestStatus } from "./api";

type WorkflowStore = {
  runs: WorkflowRunSummary[];
  listStatus: RequestStatus;
  listMessage: string | null;
  run: WorkflowRunDetail | null;
  runStatus: RequestStatus;
  runMessage: string | null;
  leads: LeadSummary[];
  leadStatus: RequestStatus;
  leadMessage: string | null;
  startStatus: RequestStatus;
  startMessage: string | null;
  loadRuns: () => Promise<void>;
  loadRun: (workflowRunId: string) => Promise<void>;
  loadLeads: () => Promise<void>;
  startRun: (input: {
    icpId: string;
    leadIds: string[];
  }) => Promise<string | null>;
  clearStart: () => void;
};

export const useWorkflowStore = create<WorkflowStore>()((set, get) => ({
  runs: [],
  listStatus: "idle",
  listMessage: null,
  run: null,
  runStatus: "idle",
  runMessage: null,
  leads: [],
  leadStatus: "idle",
  leadMessage: null,
  startStatus: "idle",
  startMessage: null,
  clearStart: () => {
    set({ startStatus: "idle", startMessage: null });
  },
  loadRuns: async () => {
    const token = authToken();
    if (!token) {
      set({ listStatus: "error", listMessage: "Authentication required." });
      return;
    }

    set({ listStatus: "loading", listMessage: null });

    try {
      const res = await fetch(`${apiUrl}/workflow/runs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<
        Partial<ListWorkflowRunsResponse> & { message?: string }
      >(res);
      if (!res.ok || !("runs" in data)) {
        set({
          listMessage: data.message ?? "Failed to reach API",
          listStatus: "error",
        });
        return;
      }

      set({
        runs: data.runs ?? [],
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
  loadRun: async (workflowRunId) => {
    const token = authToken();
    if (!token) {
      set({
        run: null,
        runStatus: "error",
        runMessage: "Authentication required.",
      });
      return;
    }

    const sameRun = get().run?.workflowRunId === workflowRunId;
    if (!sameRun) {
      set({ run: null, runStatus: "loading", runMessage: null });
    }

    try {
      const res = await fetch(`${apiUrl}/workflow/runs/${workflowRunId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<WorkflowRunDetail & { message?: string }>(res);
      if (!res.ok || !("workflowRunId" in data) || !data.workflowRunId) {
        set({
          run: sameRun ? get().run : null,
          runMessage: data.message ?? "Failed to reach API",
          runStatus: "error",
        });
        return;
      }

      set({
        run: data,
        runStatus: "ready",
        runMessage: null,
      });
    } catch (err) {
      set({
        run: sameRun ? get().run : null,
        runMessage: err instanceof Error ? err.message : "Failed to reach API",
        runStatus: "error",
      });
    }
  },
  loadLeads: async () => {
    const token = authToken();
    if (!token) {
      set({ leadStatus: "error", leadMessage: "Authentication required." });
      return;
    }

    if (get().leadStatus !== "ready") {
      set({ leadStatus: "loading", leadMessage: null });
    }

    try {
      const res = await fetch(`${apiUrl}/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<Partial<ListLeadsResponse> & { message?: string }>(
        res,
      );
      if (!res.ok || !("leads" in data)) {
        set({
          leadMessage: data.message ?? "Failed to reach API",
          leadStatus: "error",
        });
        return;
      }

      set({
        leads: data.leads ?? [],
        leadStatus: "ready",
        leadMessage: null,
      });
    } catch (err) {
      set({
        leadMessage: err instanceof Error ? err.message : "Failed to reach API",
        leadStatus: "error",
      });
    }
  },
  startRun: async ({ icpId, leadIds }) => {
    const trimmedIcpId = icpId.trim();
    if (!trimmedIcpId) {
      set({ startStatus: "error", startMessage: "ICP is required." });
      return null;
    }

    const token = authToken();
    if (!token) {
      set({ startStatus: "error", startMessage: "Authentication required." });
      return null;
    }

    const body: StartWorkflowRunRequest = { icpId: trimmedIcpId };
    if (leadIds.length > 0) {
      body.leadIds = leadIds;
    }

    set({ startStatus: "loading", startMessage: null });

    try {
      const res = await fetch(`${apiUrl}/workflow/runs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await readJson<Partial<StartWorkflowRunResponse>>(res);
      if (!res.ok || !("workflowRunId" in data) || !data.workflowRunId) {
        set({
          startMessage: data.message ?? "Failed to reach API",
          startStatus: "error",
        });
        return null;
      }

      set({
        startMessage: data.message ?? null,
        startStatus: "ready",
      });
      return data.workflowRunId;
    } catch (err) {
      set({
        startMessage: err instanceof Error ? err.message : "Failed to reach API",
        startStatus: "error",
      });
      return null;
    }
  },
}));
