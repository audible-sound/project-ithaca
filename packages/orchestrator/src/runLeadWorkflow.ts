import {
  draftOutreach,
  identifyLeads,
  qualifyLeads,
  summarizeLeads,
} from "@ithaca/agents";
import {
  insertIdentifiedLead,
  insertTokenUsage,
  insertWorkflowRunLeads,
  listLeadContextsByIds,
  listWorkflowRunLeadsByRunId,
  listWorkflowStepsByRunId,
  updateWorkflowRunLeadStatus,
  updateWorkflowRunStatus,
  updateWorkflowStepStatus,
  upsertLeadQualification,
  upsertLeadSummary,
} from "@ithaca/db";
import type {
  IdentifiedLeadDraft,
  InsertIdentifiedLeadResult,
  LeadQualificationDraft,
  LeadSummaryDraft,
  TokenUsageDraft,
  WorkflowRunLead as WorkflowRunLeadRow,
  WorkflowRunLeadDraft,
  WorkflowRunLeadStatusPatch,
  WorkflowRunStatusPatch,
  WorkflowStep as WorkflowStepRow,
  WorkflowStepStatusPatch,
} from "@ithaca/db";
import { workflowStepTypes } from "@ithaca/shared";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  LeadWorkflowInput,
  LeadWorkflowResult,
  WorkflowLeadContext,
  WorkflowLeadQualification,
  WorkflowLeadStatus,
  WorkflowStepType,
} from "@ithaca/shared";
import { refreshStoredCompanyProfiles } from "./refreshCompanyProfiles.js";

export type RunLeadWorkflowInput = LeadWorkflowInput & {
  workflowRunId: string;
  userId: string;
};

type WorkflowStageAgent = (
  icp: IdealCustomerProfileInput,
) => Promise<AgentStageResult>;

type WorkflowAgents = Record<WorkflowStepType, WorkflowStageAgent>;

type WorkflowPersistence = {
  listSteps: (workflowRunId: string) => Promise<WorkflowStepRow[]>;
  listRunLeads: (workflowRunId: string) => Promise<WorkflowRunLeadRow[]>;
  updateRun: (
    workflowRunId: string,
    patch: WorkflowRunStatusPatch,
  ) => Promise<void>;
  updateStep: (
    workflowStepId: string,
    patch: WorkflowStepStatusPatch,
  ) => Promise<void>;
  updateRunLead: (
    workflowRunId: string,
    leadId: string,
    patch: WorkflowRunLeadStatusPatch,
  ) => Promise<void>;
  insertIdentifiedLead: (
    input: IdentifiedLeadDraft & { userId: string },
  ) => Promise<InsertIdentifiedLeadResult>;
  refreshStoredCompanies: () => Promise<void>;
  insertRunLeads: (
    drafts: WorkflowRunLeadDraft[],
  ) => Promise<WorkflowRunLeadRow[]>;
  insertTokenUsage: (draft: TokenUsageDraft) => Promise<void>;
  listLeadContexts: (leadIds: string[]) => Promise<WorkflowLeadContext[]>;
  upsertLeadQualification: (draft: LeadQualificationDraft) => Promise<void>;
  upsertLeadSummary: (draft: LeadSummaryDraft) => Promise<void>;
};

const defaultAgents: WorkflowAgents = {
  identify: identifyLeads,
  qualify: () => {
    throw new Error("Lead qualification requires the workflow leads.");
  },
  summarize: () => {
    throw new Error("Lead summary requires the workflow leads.");
  },
  draft: draftOutreach,
};

const defaultPersistence: WorkflowPersistence = {
  listSteps: listWorkflowStepsByRunId,
  listRunLeads: listWorkflowRunLeadsByRunId,
  async updateRun(workflowRunId, patch) {
    await updateWorkflowRunStatus(workflowRunId, patch);
  },
  async updateStep(workflowStepId, patch) {
    await updateWorkflowStepStatus(workflowStepId, patch);
  },
  async updateRunLead(workflowRunId, leadId, patch) {
    await updateWorkflowRunLeadStatus(workflowRunId, leadId, patch);
  },
  insertIdentifiedLead,
  async refreshStoredCompanies() {
    await refreshStoredCompanyProfiles();
  },
  insertRunLeads: insertWorkflowRunLeads,
  async insertTokenUsage(draft) {
    await insertTokenUsage(draft);
  },
  listLeadContexts: listLeadContextsByIds,
  upsertLeadQualification,
  upsertLeadSummary,
};

function databaseUnavailable(error: unknown): boolean {
  return (
    error instanceof Error && error.message === "Database is unavailable."
  );
}

function thrownMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Workflow stage failed.";
}

function elapsedMs(startedAt: Date, completedAt: Date): number {
  return Math.round(completedAt.getTime() - startedAt.getTime());
}

/**
 * Runs identify, qualify, summarize, and draft in order.
 */
export async function runLeadWorkflow(
  input: RunLeadWorkflowInput,
): Promise<LeadWorkflowResult> {
  return runPersisted(
    input.workflowRunId,
    input.userId,
    input.icp,
    defaultAgents,
    defaultPersistence,
  );
}

async function runPersisted(
  workflowRunId: string,
  userId: string,
  icp: IdealCustomerProfileInput,
  agents: WorkflowAgents,
  persistence: WorkflowPersistence,
): Promise<LeadWorkflowResult> {
  // Runs one saved workflow and records progress. 
  await persistence.updateRun(workflowRunId, {
    status: "running",
    startedAt: new Date(),
    errorMessage: null,
  });

  const steps = await persistence.listSteps(workflowRunId);
  let leads = await persistence.listRunLeads(workflowRunId);
  let qualifications: WorkflowLeadQualification[] = [];
  const stages: AgentStageResult[] = [];

  // Identify, qualify, summarize, and draft run in that order. A failure stops here.
  for (const stepType of workflowStepTypes) {
    const step = steps.find((row) => row.stepType === stepType);
    if (!step) {
      // The run is marked failed and the function returns. Later stages stay pending.
      await persistence.updateRun(workflowRunId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: `Workflow step "${stepType}" was not found.`,
      });
      return { status: "failed", stages };
    }

    // The stage and every lead are marked running.
    await persistence.updateStep(step.workflowStepId, {
      status: "running",
      attemptCount: 1,
      startedAt: new Date(),
      errorMessage: null,
      completedAt: null,
      durationMs: null,
    });

    const runningLeads = await markLeads(persistence, workflowRunId, leads, {
      currentStage: stepType,
      status: "running",
      errorMessage: null,
    });
    if (!runningLeads.ok) {
      // A lead save failed, so the run stops. Duration is 0 because the agent did not run.
      await failStage(
        persistence,
        workflowRunId,
        step,
        leads,
        stepType,
        runningLeads.message,
        0,
      );
      stages.push({
        stage: stepType,
        status: "failed",
        message: runningLeads.message,
      });
      return { status: "failed", stages };
    }

    // Only the agent call is timed. A throw or a failed result stops the run.
    const agentStartedAt = new Date();
    let result: AgentStageResult;
    try {
      if (stepType === "identify") {
        await persistence.refreshStoredCompanies();
      }
      if (stepType === "identify" && leads.length > 0) {
        result = {
          stage: "identify",
          status: "completed",
          message:
            "Selected leads were already attached. Lead identification did not search for companies.",
        };
      } else if (stepType === "qualify") {
        const contexts = await persistence.listLeadContexts(
          leads.map((lead) => lead.leadId),
        );
        result = await qualifyLeads(icp, contexts);
      } else if (stepType === "summarize") {
        const contexts = await persistence.listLeadContexts(
          leads.map((lead) => lead.leadId),
        );
        result = await summarizeLeads(icp, contexts, qualifications);
      } else {
        result = await agents[stepType](icp);
      }
    } catch (error) {
      const message = thrownMessage(error);
      await failStage(
        persistence,
        workflowRunId,
        step,
        leads,
        stepType,
        message,
        elapsedMs(agentStartedAt, new Date()),
      );
      stages.push({ stage: stepType, status: "failed", message });
      return { status: "failed", stages };
    }

    const durationMs = elapsedMs(agentStartedAt, new Date());
    if (result.status === "failed") {
      await failStage(
        persistence,
        workflowRunId,
        step,
        leads,
        stepType,
        result.message,
        durationMs,
      );
      stages.push(result);
      return { status: "failed", stages };
    }

    if (
      stepType === "identify" &&
      result.status === "completed" &&
      result.estimatedCost !== undefined
    ) {
      try {
        await persistence.insertTokenUsage({
          workflowRunId,
          workflowStepId: step.workflowStepId,
          agentType: "identification",
          modelName: "exa",
          estimatedCost: String(result.estimatedCost),
        });
      } catch (error) {
        const message = thrownMessage(error);
        await failStage(
          persistence,
          workflowRunId,
          step,
          leads,
          stepType,
          message,
          durationMs,
        );
        stages.push({ stage: stepType, status: "failed", message });
        return { status: "failed", stages };
      }
    }

    if (
      stepType === "identify" &&
      result.status === "completed" &&
      result.candidates !== undefined &&
      result.candidates.length > 0
    ) {
      const seen = new Set(leads.map((lead) => lead.leadId));
      const drafts: WorkflowRunLeadDraft[] = [];
      let leadsForFailure = leads;

      try {
        for (const candidate of result.candidates) {
          const stored = await persistence.insertIdentifiedLead({
            userId,
            ...candidate,
          });
          if (seen.has(stored.leadId)) {
            continue;
          }
          seen.add(stored.leadId);
          drafts.push({
            workflowRunId,
            leadId: stored.leadId,
            currentStage: "identify",
            status: "pending",
          });
        }

        const inserted = await persistence.insertRunLeads(drafts);
        leadsForFailure = inserted;
        // Reload so later stages update the new rows. The pre-identify list would leave them pending.
        leads = await persistence.listRunLeads(workflowRunId);
      } catch (error) {
        const message = thrownMessage(error);
        await failStage(
          persistence,
          workflowRunId,
          step,
          leadsForFailure,
          stepType,
          message,
          durationMs,
        );
        stages.push({ stage: stepType, status: "failed", message });
        return { status: "failed", stages };
      }
    }

    if (stepType === "qualify" && result.status === "completed") {
      qualifications = result.qualifications ?? [];
    }

    if (
      stepType === "qualify" &&
      result.status === "completed" &&
      result.qualifications !== undefined &&
      result.qualifications.length > 0
    ) {
      try {
        for (const qualification of result.qualifications) {
          await persistence.upsertLeadQualification({
            leadId: qualification.leadId,
            workflowRunId,
            score: qualification.score,
            priorityRank: qualification.priorityRank,
            priorityLabel: qualification.priorityLabel,
            fitLabel: qualification.fitLabel,
            explanation: qualification.explanation,
            evidence: qualification.evidence,
            criteriaBreakdown: qualification.criteriaBreakdown,
          });
        }

        if (result.usage !== undefined) {
          await persistence.insertTokenUsage({
            workflowRunId,
            workflowStepId: step.workflowStepId,
            agentType: "qualification",
            modelName: result.usage.modelName,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            estimatedCost: String(result.usage.estimatedCost),
          });
        }
      } catch (error) {
        const message = thrownMessage(error);
        await failStage(
          persistence,
          workflowRunId,
          step,
          leads,
          stepType,
          message,
          durationMs,
        );
        stages.push({ stage: stepType, status: "failed", message });
        return { status: "failed", stages };
      }
    }

    if (
      stepType === "summarize" &&
      result.status === "completed" &&
      result.summaries !== undefined &&
      result.summaries.length > 0
    ) {
      try {
        for (const summary of result.summaries) {
          await persistence.upsertLeadSummary({
            leadId: summary.leadId,
            workflowRunId,
            summaryText: summary.summaryText,
            structuredReport: summary.structuredReport,
          });
        }

        if (result.usage !== undefined) {
          await persistence.insertTokenUsage({
            workflowRunId,
            workflowStepId: step.workflowStepId,
            agentType: "summary",
            modelName: result.usage.modelName,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            estimatedCost: String(result.usage.estimatedCost),
          });
        }
      } catch (error) {
        const message = thrownMessage(error);
        await failStage(
          persistence,
          workflowRunId,
          step,
          leads,
          stepType,
          message,
          durationMs,
        );
        stages.push({ stage: stepType, status: "failed", message });
        return { status: "failed", stages };
      }
    }

    // The stage is marked completed and its duration is saved.
    const completedAt = new Date();
    await persistence.updateStep(step.workflowStepId, {
      status: "completed",
      completedAt,
      durationMs,
      errorMessage: null,
    });

    // Leads are completed, or skipped. A completed draft moves them to done.
    const leadStatus: WorkflowLeadStatus =
      result.status === "skipped" ? "skipped" : "completed";
    const currentStage =
      result.status === "completed" && stepType === "draft" ? "done" : stepType;
    const updatedLeads = await markLeads(persistence, workflowRunId, leads, {
      currentStage,
      status: leadStatus,
      errorMessage: null,
    });
    if (!updatedLeads.ok) {
      // Saving the lead updates failed, so the run stops.
      await failStage(
        persistence,
        workflowRunId,
        step,
        leads,
        stepType,
        updatedLeads.message,
        durationMs,
      );
      stages.push({
        stage: stepType,
        status: "failed",
        message: updatedLeads.message,
      });
      return { status: "failed", stages };
    }

    stages.push(result);
  }

  // All four stages finished, so the run is marked completed.
  await persistence.updateRun(workflowRunId, {
    status: "completed",
    completedAt: new Date(),
    errorMessage: null,
  });

  return { status: "completed", stages };
}

type LeadUpdateResult =
  | { ok: true }
  | { ok: false; message: string };

// Used to update the status of multiple leads for a specific workflow run.
async function markLeads(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  leads: WorkflowRunLeadRow[],
  patch: WorkflowRunLeadStatusPatch,
): Promise<LeadUpdateResult> {
  for (const lead of leads) {
    const marked = await markLead(
      persistence,
      workflowRunId,
      lead.leadId,
      patch,
    );
    if (!marked.ok) {
      return marked;
    }
  }

  return { ok: true };
}

// Used to update the status of a lead for a specific workflow run.
async function markLead(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  leadId: string,
  patch: WorkflowRunLeadStatusPatch,
): Promise<LeadUpdateResult> {
  try {
    await persistence.updateRunLead(workflowRunId, leadId, patch);
    return { ok: true };
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }

    return { ok: false, message: thrownMessage(error) };
  }
}

// If at any point, a step in the workflow fails, i.e. identify fails, then the workflow fails.
async function failStage(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  step: WorkflowStepRow,
  leads: WorkflowRunLeadRow[],
  stepType: WorkflowStepType,
  errorMessage: string,
  durationMs: number,
): Promise<void> {
  const completedAt = new Date();
  await persistence.updateStep(step.workflowStepId, {
    status: "failed",
    errorMessage,
    completedAt,
    durationMs,
  });

  for (const lead of leads) {
    await markLead(persistence, workflowRunId, lead.leadId, {
      currentStage: stepType,
      status: "failed",
      errorMessage,
    });
  }

  await persistence.updateRun(workflowRunId, {
    status: "failed",
    completedAt,
    errorMessage,
  });
}
