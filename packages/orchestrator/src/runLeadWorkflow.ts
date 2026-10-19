import {
  draftOutreach,
  identifyLeads,
  qualifyLeads,
  summarizeLeads,
} from "@ithaca/agents";
import {
  listWorkflowRunLeadsByRunId,
  listWorkflowStepsByRunId,
  updateWorkflowRunLeadStatus,
  updateWorkflowRunStatus,
  updateWorkflowStepStatus,
} from "@ithaca/db";
import type {
  WorkflowRunLead as WorkflowRunLeadRow,
  WorkflowRunLeadStatusPatch,
  WorkflowRunStatusPatch,
  WorkflowStep as WorkflowStepRow,
  WorkflowStepStatusPatch,
} from "@ithaca/db";
import type {
  AgentStageResult,
  IdealCustomerProfileInput,
  LeadWorkflowInput,
  LeadWorkflowResult,
  WorkflowLeadStatus,
  WorkflowStepType,
} from "@ithaca/shared";

export type RunLeadWorkflowInput = LeadWorkflowInput & {
  workflowRunId: string;
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
};

/** Agent order is fixed. */
const stepTypes = ["identify", "qualify", "summarize", "draft"] as const;

const defaultAgents: WorkflowAgents = {
  identify: identifyLeads,
  qualify: qualifyLeads,
  summarize: summarizeLeads,
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
    input.icp,
    defaultAgents,
    defaultPersistence,
  );
}

async function runPersisted(
  workflowRunId: string,
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
  const leads = await persistence.listRunLeads(workflowRunId);
  const stages: AgentStageResult[] = [];

  // Identify, qualify, summarize, and draft run in that order. A failure stops here.
  for (const stepType of stepTypes) {
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
      result = await agents[stepType](icp);
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
