import type {
  WorkflowLeadStatus,
  WorkflowRunStatus,
  WorkflowStage,
  WorkflowStepStatus,
  WorkflowStepType,
} from "@ithaca/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "../client.js";
import type {
  TokenUsage,
  TokenUsageAgentType,
  WorkflowRun,
  WorkflowRunLead,
  WorkflowStep,
} from "../schema/workflows.js";
import {
  tokenUsages,
  workflowRunLeads,
  workflowRuns,
  workflowSteps,
} from "../schema/workflows.js";

export type WorkflowRunDraft = {
  userId: string;
  icpId: string;
  status: WorkflowRunStatus;
};

export type WorkflowStepDraft = {
  workflowRunId: string;
  stepType: WorkflowStepType;
  status: WorkflowStepStatus;
  attemptCount: number;
};

export type WorkflowRunLeadDraft = {
  workflowRunId: string;
  leadId: string;
  currentStage: WorkflowStage;
  status: WorkflowLeadStatus;
};

export type TokenUsageDraft = {
  workflowRunId: string;
  workflowStepId: string;
  agentType: TokenUsageAgentType;
  modelName: string;
  estimatedCost: string;
};

export type WorkflowRunStatusPatch = {
  status: WorkflowRunStatus;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export type WorkflowStepStatusPatch = {
  status: WorkflowStepStatus;
  attemptCount?: number;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
};

export type WorkflowRunLeadStatusPatch = {
  currentStage?: WorkflowStage;
  status?: WorkflowLeadStatus;
  errorMessage?: string | null;
};

export async function findWorkflowRunById(
  workflowRunId: string,
  userId: string,
): Promise<WorkflowRun | null> {
  const rows = await requireDb()
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.workflowRunId, workflowRunId),
        eq(workflowRuns.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Lists workflow runs by a user's ID.
 * @param userId - The ID of the user who owns the workflow runs.
 * @returns The workflow runs if found, otherwise an empty array.
 */
export async function listWorkflowRunsByUser(
  userId: string,
): Promise<WorkflowRun[]> {
  return requireDb()
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.userId, userId))
    .orderBy(desc(workflowRuns.startedAt), desc(workflowRuns.workflowRunId));
}

/**
 * Lists workflow steps by a workflow run's ID.
 * @param workflowRunId - The ID of the workflow run to list steps for.
 * @returns The workflow steps if found, otherwise an empty array.
 */
export async function listWorkflowStepsByRunId(
  workflowRunId: string,
): Promise<WorkflowStep[]> {
  return requireDb()
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowRunId, workflowRunId))
    .orderBy(
      sql`CASE ${workflowSteps.stepType}
        WHEN 'identify' THEN 1
        WHEN 'qualify' THEN 2
        WHEN 'summarize' THEN 3
        WHEN 'draft' THEN 4
        ELSE 5
      END`,
      asc(workflowSteps.workflowStepId),
    );
}

/**
 * Lists workflow run leads by a workflow run's ID.
 * @param workflowRunId - The ID of the workflow run to list leads for.
 * @returns The workflow run leads if found, otherwise an empty array.
 */
export async function listWorkflowRunLeadsByRunId(
  workflowRunId: string,
): Promise<WorkflowRunLead[]> {
  return requireDb()
    .select()
    .from(workflowRunLeads)
    .where(eq(workflowRunLeads.workflowRunId, workflowRunId))
    .orderBy(asc(workflowRunLeads.leadId));
}

export type WorkflowRunLeadByLeadRow = WorkflowRunLead & {
  runStatus: string;
  runStartedAt: Date | null;
};


/**
 * Find the workflow run stages for a lead.
 * @param leadId - The ID of the lead to list workflow run leads for.
 * @returns The workflow run leads if found, otherwise an empty array.
 */
export async function listWorkflowRunLeadsByLeadId(
  leadId: string,
): Promise<WorkflowRunLeadByLeadRow[]> {
  const rows = await requireDb()
    .select({
      workflowRunId: workflowRunLeads.workflowRunId,
      leadId: workflowRunLeads.leadId,
      currentStage: workflowRunLeads.currentStage,
      status: workflowRunLeads.status,
      errorMessage: workflowRunLeads.errorMessage,
      runStatus: workflowRuns.status,
      runStartedAt: workflowRuns.startedAt,
    })
    .from(workflowRunLeads)
    .innerJoin(
      workflowRuns,
      eq(workflowRunLeads.workflowRunId, workflowRuns.workflowRunId),
    )
    .where(eq(workflowRunLeads.leadId, leadId))
    .orderBy(
      sql`${workflowRuns.startedAt} DESC NULLS LAST`,
      desc(workflowRuns.workflowRunId),
    );

  return rows;
}

export async function insertWorkflowRun(
  draft: WorkflowRunDraft,
): Promise<WorkflowRun> {
  const rows = await requireDb()
    .insert(workflowRuns)
    .values({
      userId: draft.userId,
      icpId: draft.icpId,
      status: draft.status,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Workflow run was not created.");
  }

  return row;
}

/**
 * Inserts workflow steps for a workflow run.
 * @param drafts - The workflow steps to insert.
 * @returns The workflow steps if inserted, otherwise an empty array.
 */
export async function insertWorkflowSteps(
  drafts: WorkflowStepDraft[],
): Promise<WorkflowStep[]> {
  if (drafts.length === 0) {
    return [];
  }

  const rows = await requireDb()
    .insert(workflowSteps)
    .values(
      drafts.map((draft) => ({
        workflowRunId: draft.workflowRunId,
        stepType: draft.stepType,
        status: draft.status,
        attemptCount: draft.attemptCount,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      })),
    )
    .returning();

  if (rows.length !== drafts.length) {
    throw new Error("Workflow steps were not created.");
  }

  return rows;
}

/**
 * Inserts workflow run leads for a workflow run.
 * @param drafts - The workflow run leads to insert.
 * @returns The workflow run leads if inserted, otherwise an empty array.
 */
export async function insertWorkflowRunLeads(
  drafts: WorkflowRunLeadDraft[],
): Promise<WorkflowRunLead[]> {
  if (drafts.length === 0) {
    return [];
  }

  const rows = await requireDb()
    .insert(workflowRunLeads)
    .values(
      drafts.map((draft) => ({
        workflowRunId: draft.workflowRunId,
        leadId: draft.leadId,
        currentStage: draft.currentStage,
        status: draft.status,
        errorMessage: null,
      })),
    )
    .returning();

  if (rows.length !== drafts.length) {
    throw new Error("Workflow run leads were not created.");
  }

  return rows;
}

export async function insertTokenUsage(
  draft: TokenUsageDraft,
): Promise<TokenUsage> {
  const rows = await requireDb()
    .insert(tokenUsages)
    .values({
      workflowRunId: draft.workflowRunId,
      workflowStepId: draft.workflowStepId,
      agentType: draft.agentType,
      modelName: draft.modelName,
      promptTokens: null,
      completionTokens: null,
      estimatedCost: draft.estimatedCost,
      createdAt: new Date(),
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Token usage was not created.");
  }

  return row;
}

/**
 * Updates the status of a workflow run.
 * @param workflowRunId - The ID of the workflow run to update.
 * @param patch - The status patch to apply.
 * @returns The workflow run if updated, otherwise null.
 */
export async function updateWorkflowRunStatus(
  workflowRunId: string,
  patch: WorkflowRunStatusPatch,
): Promise<WorkflowRun> {
  const rows = await requireDb()
    .update(workflowRuns)
    .set(patch)
    .where(eq(workflowRuns.workflowRunId, workflowRunId))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Workflow run was not updated.");
  }

  return row;
}

/**
 * Updates the status of a workflow step.
 * @param workflowStepId - The ID of the workflow step to update.
 * @param patch - The status patch to apply.
 * @returns The workflow step if updated, otherwise null.
 */
export async function updateWorkflowStepStatus(
  workflowStepId: string,
  patch: WorkflowStepStatusPatch,
): Promise<WorkflowStep> {
  const rows = await requireDb()
    .update(workflowSteps)
    .set(patch)
    .where(eq(workflowSteps.workflowStepId, workflowStepId))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Workflow step was not updated.");
  }

  return row;
}

/**
 * Updates the status of a workflow run lead.
 * @param workflowRunId - The ID of the workflow run to update.
 * @param leadId - The ID of the lead to update.
 * @param patch - The status patch to apply.
 * @returns The workflow run lead if updated, otherwise null.
 */
export async function updateWorkflowRunLeadStatus(
  workflowRunId: string,
  leadId: string,
  patch: WorkflowRunLeadStatusPatch,
): Promise<WorkflowRunLead> {
  const rows = await requireDb()
    .update(workflowRunLeads)
    .set(patch)
    .where(
      and(
        eq(workflowRunLeads.workflowRunId, workflowRunId),
        eq(workflowRunLeads.leadId, leadId),
      ),
    )
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Workflow run lead was not updated.");
  }

  return row;
}
