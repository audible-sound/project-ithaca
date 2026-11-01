import {
  draftOutreach,
  identifyLeads,
  qualifyLeads,
  rankLeads,
  summarizeLeads,
} from "@ithaca/agents";
import type {
  IdentifyLeadsOptions,
  SummarizeLeadQualification,
} from "@ithaca/agents";
import {
  insertIdentifiedLead,
  insertOutreachDraft,
  insertTokenUsage,
  insertWorkflowRunLeads,
  listLeadContextsByIds,
  listLeadQualificationsByLeadIds,
  listWorkflowRunLeadsByRunId,
  listWorkflowStepsByRunId,
  updateLeadQualificationRanks,
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
  LeadQualificationRankDraft,
  LeadSummaryDraft,
  OutreachDraftInsert,
  StoredLeadQualification,
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
  IdentifiedLeadCandidate,
  IdealCustomerProfileInput,
  LeadWorkflowInput,
  LeadWorkflowResult,
  WorkflowLeadContext,
  WorkflowLeadQualification,
  WorkflowStepType,
} from "@ithaca/shared";

export type RunLeadWorkflowInput = LeadWorkflowInput & {
  workflowRunId: string;
  userId: string;
};

type IdentifyStageRunner = (
  icp: IdealCustomerProfileInput,
  options?: IdentifyLeadsOptions,
) => Promise<AgentStageResult>;

type QualifyStageRunner = (
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[],
) => Promise<AgentStageResult>;

type SummarizeStageRunner = (
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[],
  qualifications: readonly SummarizeLeadQualification[],
) => Promise<AgentStageResult>;

type DraftStageRunner = (
  icp: IdealCustomerProfileInput,
  leads: readonly WorkflowLeadContext[],
) => Promise<AgentStageResult>;

export type WorkflowStageRunners = {
  identify: IdentifyStageRunner;
  qualify: QualifyStageRunner;
  summarize: SummarizeStageRunner;
  draft: DraftStageRunner;
};

type LeadPipelineStage = "qualify" | "summarize" | "draft";

export type WorkflowPersistence = {
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
  insertRunLeads: (
    drafts: WorkflowRunLeadDraft[],
  ) => Promise<WorkflowRunLeadRow[]>;
  insertTokenUsage: (draft: TokenUsageDraft) => Promise<void>;
  listLeadContexts: (leadIds: string[]) => Promise<WorkflowLeadContext[]>;
  listLeadQualifications: (
    leadIds: string[],
  ) => Promise<StoredLeadQualification[]>;
  upsertLeadQualification: (draft: LeadQualificationDraft) => Promise<void>;
  updateLeadQualificationRanks: (
    ranks: LeadQualificationRankDraft[],
  ) => Promise<void>;
  upsertLeadSummary: (draft: LeadSummaryDraft) => Promise<void>;
  insertOutreachDraft: (draft: OutreachDraftInsert) => Promise<void>;
};

const leadPipelineConcurrency = 3;

const defaultStageRunners: WorkflowStageRunners = {
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
  insertIdentifiedLead,
  insertRunLeads: insertWorkflowRunLeads,
  async insertTokenUsage(draft) {
    await insertTokenUsage(draft);
  },
  listLeadContexts: listLeadContextsByIds,
  listLeadQualifications: listLeadQualificationsByLeadIds,
  upsertLeadQualification,
  updateLeadQualificationRanks,
  upsertLeadSummary,
  insertOutreachDraft,
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
 * Calls an agent once, then once more when the first call fails.
 * `Database is unavailable.` is never retried.
 */
async function callAgentWithRetry(
  call: () => Promise<AgentStageResult>,
  isFailure: (result: AgentStageResult) => boolean,
  setAttempt: (attemptCount: number) => Promise<void>,
  firstAttemptCount: number,
): Promise<{ result: AgentStageResult; attemptCount: number }> {
  await setAttempt(firstAttemptCount);
  try {
    let result = await call();
    if (!isFailure(result)) {
      return { result, attemptCount: firstAttemptCount };
    }

    const secondAttemptCount = firstAttemptCount + 1;
    await setAttempt(secondAttemptCount);
    result = await call();
    return { result, attemptCount: secondAttemptCount };
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }

    const secondAttemptCount = firstAttemptCount + 1;
    await setAttempt(secondAttemptCount);
    try {
      const result = await call();
      return { result, attemptCount: secondAttemptCount };
    } catch (secondError) {
      if (databaseUnavailable(secondError)) {
        throw secondError;
      }
      throw secondError;
    }
  }
}

function includesWorkflowStepType(value: string): value is WorkflowStepType {
  return (workflowStepTypes as readonly string[]).includes(value);
}

function websiteKey(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function candidateWebsiteKeys(
  candidate: IdentifiedLeadCandidate,
): string[] {
  const keys: string[] = [];
  for (const value of [candidate.website, candidate.sourceUrl]) {
    const key = websiteKey(value);
    if (key.length === 0 || keys.includes(key)) {
      continue;
    }
    keys.push(key);
  }
  return keys;
}

/**
 * True when the candidate is a company already attached to this run.
 * Match is the company name, or the website / source URL against the attached website.
 */
function candidateMatchesAttached(
  candidate: IdentifiedLeadCandidate,
  attached: readonly WorkflowLeadContext[],
): boolean {
  const name = candidate.companyName.trim().toLowerCase();
  const keys = candidateWebsiteKeys(candidate);

  for (const lead of attached) {
    if (lead.companyName.trim().toLowerCase() === name) {
      return true;
    }

    const attachedWebsite = websiteKey(lead.website);
    if (attachedWebsite.length > 0 && keys.includes(attachedWebsite)) {
      return true;
    }
  }

  return false;
}

function createWriteLock(): <T>(fn: () => Promise<T>) => Promise<T> {
  let chain: Promise<void> = Promise.resolve();
  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = chain.then(fn, fn);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

async function mapWithLimit<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) {
          return;
        }
        await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

type StageRollup = {
  enter: (stage: LeadPipelineStage, leadId: string) => Promise<void>;
  succeed: (
    stage: LeadPipelineStage,
    leadId: string,
    currentStage: "qualify" | "summarize" | "draft" | "done",
  ) => Promise<void>;
  fail: (
    stage: LeadPipelineStage,
    leadId: string,
    message: string,
  ) => Promise<void>;
  seal: (stage: LeadPipelineStage) => Promise<void>;
  skipRemaining: () => Promise<void>;
};

function createStageRollup(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  stepsByType: Map<WorkflowStepType, WorkflowStepRow>,
  runExclusive: <T>(fn: () => Promise<T>) => Promise<T>,
): StageRollup {
  const entered: Record<LeadPipelineStage, Set<string>> = {
    qualify: new Set(),
    summarize: new Set(),
    draft: new Set(),
  };
  const finished: Record<LeadPipelineStage, Set<string>> = {
    qualify: new Set(),
    summarize: new Set(),
    draft: new Set(),
  };
  const sealed: Record<LeadPipelineStage, boolean> = {
    qualify: false,
    summarize: false,
    draft: false,
  };
  const stepStatus: Record<LeadPipelineStage, "pending" | "running" | "completed" | "skipped"> = {
    qualify: "pending",
    summarize: "pending",
    draft: "pending",
  };
  const startedAt: Partial<Record<LeadPipelineStage, Date>> = {};

  async function markStepRunning(stage: LeadPipelineStage): Promise<void> {
    const step = stepsByType.get(stage);
    if (!step) {
      throw new Error(`Workflow step "${stage}" was not found.`);
    }
    if (stepStatus[stage] !== "pending") {
      return;
    }
    const now = new Date();
    startedAt[stage] = now;
    stepStatus[stage] = "running";
    await persistence.updateStep(step.workflowStepId, {
      status: "running",
      attemptCount: 1,
      startedAt: now,
      errorMessage: null,
      completedAt: null,
      durationMs: null,
    });
  }

  async function completeStep(stage: LeadPipelineStage): Promise<void> {
    const step = stepsByType.get(stage);
    if (!step) {
      throw new Error(`Workflow step "${stage}" was not found.`);
    }
    if (stepStatus[stage] !== "running") {
      return;
    }
    const completedAt = new Date();
    const started = startedAt[stage] ?? completedAt;
    stepStatus[stage] = "completed";
    await persistence.updateStep(step.workflowStepId, {
      status: "completed",
      completedAt,
      durationMs: elapsedMs(started, completedAt),
      errorMessage: null,
    });
  }

  async function skipStep(stage: LeadPipelineStage): Promise<void> {
    const step = stepsByType.get(stage);
    if (!step) {
      throw new Error(`Workflow step "${stage}" was not found.`);
    }
    if (stepStatus[stage] !== "pending") {
      return;
    }
    stepStatus[stage] = "skipped";
    await persistence.updateStep(step.workflowStepId, {
      status: "skipped",
      completedAt: new Date(),
      durationMs: 0,
      errorMessage: null,
    });
  }

  async function maybeComplete(stage: LeadPipelineStage): Promise<void> {
    if (!sealed[stage]) {
      return;
    }
    if (entered[stage].size === 0) {
      await skipStep(stage);
      return;
    }
    if (finished[stage].size === entered[stage].size) {
      await completeStep(stage);
    }
  }

  return {
    async enter(stage, leadId) {
      await runExclusive(async () => {
        const wasEmpty = entered[stage].size === 0;
        entered[stage].add(leadId);
        if (wasEmpty) {
          await markStepRunning(stage);
        }
        await persistence.updateRunLead(workflowRunId, leadId, {
          currentStage: stage,
          status: "running",
          attemptCount: 1,
          errorMessage: null,
        });
      });
    },

    async succeed(stage, leadId, currentStage) {
      await runExclusive(async () => {
        finished[stage].add(leadId);
        await persistence.updateRunLead(workflowRunId, leadId, {
          currentStage,
          status: "completed",
          errorMessage: null,
        });
        await maybeComplete(stage);
      });
    },

    async fail(stage, leadId, message) {
      await runExclusive(async () => {
        finished[stage].add(leadId);
        await persistence.updateRunLead(workflowRunId, leadId, {
          currentStage: stage,
          status: "failed",
          errorMessage: message,
        });
        await maybeComplete(stage);
      });
    },

    async seal(stage) {
      await runExclusive(async () => {
        sealed[stage] = true;
        await maybeComplete(stage);
      });
    },

    async skipRemaining() {
      await runExclusive(async () => {
        for (const stage of ["qualify", "summarize", "draft"] as const) {
          sealed[stage] = true;
          await maybeComplete(stage);
        }
      });
    },
  };
}

function evidenceLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const evidence: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      evidence.push(item.trim());
    }
  }

  return evidence;
}

function storedScore(row: StoredLeadQualification): number {
  if (row.score === null) {
    throw new Error(
      `Lead ${row.leadId} stored qualification score is missing.`,
    );
  }

  const score = Number(row.score);
  if (!Number.isFinite(score)) {
    throw new Error(
      `Lead ${row.leadId} stored qualification score is missing.`,
    );
  }

  return score;
}

function storedAgentExplanation(row: StoredLeadQualification): string {
  const agentExplanation = row.agentExplanation?.trim() ?? "";
  if (agentExplanation.length > 0) {
    return agentExplanation;
  }

  return row.explanation?.trim() ?? "";
}

function toSummarizeQualification(
  leadId: string,
  fresh: WorkflowLeadQualification | undefined,
  stored: StoredLeadQualification | undefined,
): SummarizeLeadQualification {
  if (stored?.isUserOverride === true) {
    return {
      leadId,
      score: storedScore(stored),
      fitLabel: stored.fitLabel?.trim() ?? "",
      evidence: evidenceLines(stored.evidence),
      agentExplanation: storedAgentExplanation(stored),
      userReason: stored.overrideReason,
    };
  }

  if (fresh !== undefined) {
    return {
      leadId,
      score: fresh.score,
      fitLabel: fresh.fitLabel,
      evidence: fresh.evidence,
      agentExplanation: fresh.explanation,
      userReason: null,
    };
  }

  if (stored === undefined) {
    throw new Error(`Lead ${leadId} has no qualification.`);
  }

  return {
    leadId,
    score: storedScore(stored),
    fitLabel: stored.fitLabel?.trim() ?? "",
    evidence: evidenceLines(stored.evidence),
    agentExplanation: storedAgentExplanation(stored),
    userReason: null,
  };
}

type LeadUpdateResult =
  | { ok: true }
  | { ok: false; message: string };

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

async function failIdentify(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  step: WorkflowStepRow,
  leads: WorkflowRunLeadRow[],
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
      currentStage: "identify",
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

/**
 * Runs identify, then qualify, summarize, and draft for each lead on its own.
 */
export async function runLeadWorkflow(
  input: RunLeadWorkflowInput,
): Promise<LeadWorkflowResult> {
  return runPersisted(
    input.workflowRunId,
    input.userId,
    input.icp,
    defaultPersistence,
    defaultStageRunners,
    input.useSelectedLeadsOnly === true,
  );
}

/** Runs a saved workflow with injected persistence and stage runners. For tests. */
export async function runPersisted(
  workflowRunId: string,
  userId: string,
  icp: IdealCustomerProfileInput,
  persistence: WorkflowPersistence,
  stageRunners: WorkflowStageRunners = defaultStageRunners,
  useSelectedLeadsOnly = false,
): Promise<LeadWorkflowResult> {
  await persistence.updateRun(workflowRunId, {
    status: "running",
    startedAt: new Date(),
    errorMessage: null,
  });

  const steps = await persistence.listSteps(workflowRunId);
  const stepsByType = new Map<WorkflowStepType, WorkflowStepRow>();
  for (const step of steps) {
    if (!includesWorkflowStepType(step.stepType)) {
      continue;
    }
    stepsByType.set(step.stepType, step);
  }
  for (const stepType of workflowStepTypes) {
    if (!stepsByType.has(stepType)) {
      await persistence.updateRun(workflowRunId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: `Workflow step "${stepType}" was not found.`,
      });
      return { status: "failed", stages: [] };
    }
  }

  let leads = await persistence.listRunLeads(workflowRunId);
  const stages: AgentStageResult[] = [];
  const identifyStep = stepsByType.get("identify");
  if (!identifyStep) {
    await persistence.updateRun(workflowRunId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: 'Workflow step "identify" was not found.',
    });
    return { status: "failed", stages };
  }

  await persistence.updateStep(identifyStep.workflowStepId, {
    status: "running",
    attemptCount: 1,
    startedAt: new Date(),
    errorMessage: null,
    completedAt: null,
    durationMs: null,
  });

  const runningLeads = await markLeads(persistence, workflowRunId, leads, {
    currentStage: "identify",
    status: "running",
    errorMessage: null,
  });
  if (!runningLeads.ok) {
    await failIdentify(
      persistence,
      workflowRunId,
      identifyStep,
      leads,
      runningLeads.message,
      0,
    );
    stages.push({
      stage: "identify",
      status: "failed",
      message: runningLeads.message,
    });
    return { status: "failed", stages };
  }

  const agentStartedAt = new Date();
  let identifyResult: AgentStageResult | undefined;
  let identifyAttached: WorkflowLeadContext[] = [];
  let skipIdentifySearch = false;

  if (useSelectedLeadsOnly && leads.length > 0) {
    identifyResult = {
      stage: "identify",
      status: "completed",
      message:
        "Selected leads were already attached. Lead identification did not search for companies.",
    };
    skipIdentifySearch = true;
  } else if (leads.length > 0) {
    try {
      identifyAttached = await persistence.listLeadContexts(
        leads.map((lead) => lead.leadId),
      );
    } catch (error) {
      const message = thrownMessage(error);
      const durationMs = elapsedMs(agentStartedAt, new Date());
      await persistence.updateStep(identifyStep.workflowStepId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        durationMs,
      });
      identifyResult = { stage: "identify", status: "failed", message };
      skipIdentifySearch = true;
    }
  }

  if (!skipIdentifySearch) {
    const excludeWebsites = identifyAttached.flatMap((lead) =>
      lead.website === undefined || lead.website.trim().length === 0
        ? []
        : [lead.website],
    );
    const search =
      leads.length > 0
        ? () =>
            stageRunners.identify(icp, {
              excludeWebsites,
              excludeCompanyNames: identifyAttached.map(
                (lead) => lead.companyName,
              ),
            })
        : () => stageRunners.identify(icp);

    try {
      const attempted = await callAgentWithRetry(
        search,
        (result) => result.status === "failed",
        async (attemptCount) => {
          await persistence.updateStep(identifyStep.workflowStepId, {
            status: "running",
            attemptCount,
            errorMessage: null,
            completedAt: null,
            durationMs: null,
          });
        },
        1,
      );
      identifyResult = attempted.result;
    } catch (error) {
      const message = thrownMessage(error);
      const durationMs = elapsedMs(agentStartedAt, new Date());
      if (leads.length === 0) {
        await failIdentify(
          persistence,
          workflowRunId,
          identifyStep,
          leads,
          message,
          durationMs,
        );
        stages.push({ stage: "identify", status: "failed", message });
        return { status: "failed", stages };
      }

      await persistence.updateStep(identifyStep.workflowStepId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        durationMs,
      });
      identifyResult = { stage: "identify", status: "failed", message };
    }
  }

  const identifyDurationMs = elapsedMs(agentStartedAt, new Date());

  if (identifyResult === undefined) {
    const message = "Lead identification did not produce a result.";
    await failIdentify(
      persistence,
      workflowRunId,
      identifyStep,
      leads,
      message,
      identifyDurationMs,
    );
    stages.push({ stage: "identify", status: "failed", message });
    return { status: "failed", stages };
  }

  if (identifyResult.status === "failed" && leads.length === 0) {
    await failIdentify(
      persistence,
      workflowRunId,
      identifyStep,
      leads,
      identifyResult.message,
      identifyDurationMs,
    );
    stages.push(identifyResult);
    return { status: "failed", stages };
  }

  if (
    identifyResult.status === "completed" &&
    identifyResult.estimatedCost !== undefined
  ) {
    try {
      await persistence.insertTokenUsage({
        workflowRunId,
        workflowStepId: identifyStep.workflowStepId,
        agentType: "identification",
        modelName: "exa",
        estimatedCost: String(identifyResult.estimatedCost),
      });
    } catch (error) {
      const message = thrownMessage(error);
      if (leads.length === 0) {
        await failIdentify(
          persistence,
          workflowRunId,
          identifyStep,
          leads,
          message,
          identifyDurationMs,
        );
        stages.push({ stage: "identify", status: "failed", message });
        return { status: "failed", stages };
      }
      await persistence.updateStep(identifyStep.workflowStepId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        durationMs: identifyDurationMs,
      });
      identifyResult = { stage: "identify", status: "failed", message };
    }
  }

  if (
    identifyResult.status === "completed" &&
    identifyResult.candidates !== undefined &&
    identifyResult.candidates.length > 0
  ) {
    const seen = new Set(leads.map((lead) => lead.leadId));
    const drafts: WorkflowRunLeadDraft[] = [];
    const candidates = identifyResult.candidates.filter(
      (candidate) => !candidateMatchesAttached(candidate, identifyAttached),
    );

    try {
      for (const candidate of candidates) {
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

      await persistence.insertRunLeads(drafts);
      leads = await persistence.listRunLeads(workflowRunId);
    } catch (error) {
      const message = thrownMessage(error);
      if (leads.length === 0) {
        await failIdentify(
          persistence,
          workflowRunId,
          identifyStep,
          leads,
          message,
          identifyDurationMs,
        );
        stages.push({ stage: "identify", status: "failed", message });
        return { status: "failed", stages };
      }
      await persistence.updateStep(identifyStep.workflowStepId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        durationMs: identifyDurationMs,
      });
      identifyResult = { stage: "identify", status: "failed", message };
      leads = await persistence.listRunLeads(workflowRunId);
    }
  }

  if (identifyResult.status === "completed") {
    const completedAt = new Date();
    await persistence.updateStep(identifyStep.workflowStepId, {
      status: "completed",
      completedAt,
      durationMs: identifyDurationMs,
      errorMessage: null,
    });
  } else if (identifyResult.status === "failed" && leads.length > 0) {
    // Search failed, but attached leads continue through the pipeline.
    await persistence.updateStep(identifyStep.workflowStepId, {
      status: "failed",
      errorMessage: identifyResult.message,
      completedAt: new Date(),
      durationMs: identifyDurationMs,
    });
  }

  const identifyLeadStatus =
    identifyResult.status === "skipped" ? "skipped" : "completed";
  if (identifyResult.status !== "failed") {
    const updatedLeads = await markLeads(persistence, workflowRunId, leads, {
      currentStage: "identify",
      status: identifyLeadStatus,
      errorMessage: null,
    });
    if (!updatedLeads.ok && leads.length === 0) {
      await failIdentify(
        persistence,
        workflowRunId,
        identifyStep,
        leads,
        updatedLeads.message,
        identifyDurationMs,
      );
      stages.push({
        stage: "identify",
        status: "failed",
        message: updatedLeads.message,
      });
      return { status: "failed", stages };
    }
  }

  stages.push(identifyResult);

  if (leads.length === 0) {
    for (const stage of ["qualify", "summarize", "draft"] as const) {
      const step = stepsByType.get(stage);
      if (!step) {
        continue;
      }
      await persistence.updateStep(step.workflowStepId, {
        status: "skipped",
        completedAt: new Date(),
        durationMs: 0,
        errorMessage: null,
      });
    }
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages };
  }

  const pendingQualify = await markLeads(persistence, workflowRunId, leads, {
    currentStage: "qualify",
    status: "pending",
    errorMessage: null,
  });
  if (!pendingQualify.ok) {
    await persistence.updateRun(workflowRunId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: pendingQualify.message,
    });
    return { status: "failed", stages };
  }

  const runExclusive = createWriteLock();
  const rollup = createStageRollup(
    persistence,
    workflowRunId,
    stepsByType,
    runExclusive,
  );

  let qualifyRemaining = leads.length;
  const scoredForRank: { leadId: string; score: number }[] = [];
  let rankPass: Promise<void> = Promise.resolve();
  let summarizeScheduled = 0;
  let summarizeFinished = 0;

  async function noteQualifyFinished(
    scored: { leadId: string; score: number } | null,
  ): Promise<void> {
    if (scored !== null) {
      scoredForRank.push(scored);
    }
    qualifyRemaining -= 1;
    if (qualifyRemaining === 0) {
      await rollup.seal("qualify");
      rankPass = (async () => {
        if (scoredForRank.length === 0) {
          return;
        }
        const ranked = rankLeads(scoredForRank);
        await persistence.updateLeadQualificationRanks(
          ranked.ranked.map((item) => ({
            leadId: item.leadId,
            priorityRank: item.priorityRank,
          })),
        );
      })().catch((error: unknown) => {
        if (databaseUnavailable(error)) {
          throw error;
        }
      });
      await rollup.seal("summarize");
    }
  }

  async function noteSummarizeFinished(): Promise<void> {
    summarizeFinished += 1;
    if (summarizeFinished === summarizeScheduled) {
      await rollup.seal("draft");
    }
  }

  await mapWithLimit(leads, leadPipelineConcurrency, async (lead) => {
    await processLeadPipeline({
      leadId: lead.leadId,
      workflowRunId,
      icp,
      persistence,
      stageRunners,
      stepsByType,
      rollup,
      noteQualifyFinished,
      noteSummarizeScheduled: () => {
        summarizeScheduled += 1;
      },
      noteSummarizeFinished,
    });
  });

  if (summarizeScheduled === 0) {
    await rollup.seal("summarize");
    await rollup.seal("draft");
  } else if (summarizeFinished === summarizeScheduled) {
    await rollup.seal("draft");
  }
  await rollup.skipRemaining();
  await rankPass;

  await persistence.updateRun(workflowRunId, {
    status: "completed",
    completedAt: new Date(),
    errorMessage: null,
  });

  return { status: "completed", stages };
}

type ProcessLeadInput = {
  leadId: string;
  workflowRunId: string;
  icp: IdealCustomerProfileInput;
  persistence: WorkflowPersistence;
  stageRunners: WorkflowStageRunners;
  stepsByType: Map<WorkflowStepType, WorkflowStepRow>;
  rollup: StageRollup;
  noteQualifyFinished: (
    scored: { leadId: string; score: number } | null,
  ) => Promise<void>;
  noteSummarizeScheduled: () => void;
  noteSummarizeFinished: () => Promise<void>;
};

async function recordStageUsage(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  stepsByType: Map<WorkflowStepType, WorkflowStepRow>,
  stage: LeadPipelineStage,
  result: AgentStageResult,
): Promise<void> {
  if (result.usage === undefined) {
    return;
  }

  const step = stepsByType.get(stage);
  if (!step) {
    throw new Error(`Workflow step "${stage}" was not found.`);
  }

  const agentType =
    stage === "qualify"
      ? "qualification"
      : stage === "summarize"
        ? "summary"
        : "outreach";

  await persistence.insertTokenUsage({
    workflowRunId,
    workflowStepId: step.workflowStepId,
    agentType,
    modelName: result.usage.modelName,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    estimatedCost: String(result.usage.estimatedCost),
  });
}

async function processLeadPipeline(input: ProcessLeadInput): Promise<void> {
  const {
    leadId,
    workflowRunId,
    icp,
    persistence,
    stageRunners,
    stepsByType,
    rollup,
    noteQualifyFinished,
    noteSummarizeScheduled,
    noteSummarizeFinished,
  } = input;

  await rollup.enter("qualify", leadId);

  let contexts: WorkflowLeadContext[];
  try {
    contexts = await persistence.listLeadContexts([leadId]);
  } catch (error) {
    const message = thrownMessage(error);
    await rollup.fail("qualify", leadId, message);
    await noteQualifyFinished(null);
    return;
  }

  const context = contexts[0];
  if (context === undefined) {
    const message = `Lead ${leadId} was not found.`;
    await rollup.fail("qualify", leadId, message);
    await noteQualifyFinished(null);
    return;
  }

  function qualifyFailed(result: AgentStageResult): boolean {
    const qualification = result.qualifications?.[0];
    const failure = result.qualificationFailures?.find(
      (item) => item.leadId === leadId,
    );
    return failure !== undefined || qualification === undefined;
  }

  let qualifyResult: AgentStageResult;
  try {
    const attempted = await callAgentWithRetry(
      () => stageRunners.qualify(icp, [context]),
      qualifyFailed,
      async (attemptCount) => {
        await persistence.updateRunLead(workflowRunId, leadId, {
          attemptCount,
        });
      },
      1,
    );
    qualifyResult = attempted.result;
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }
    const message = thrownMessage(error);
    await rollup.fail("qualify", leadId, message);
    await noteQualifyFinished(null);
    return;
  }

  const qualification = qualifyResult.qualifications?.[0];
  const qualifyFailure =
    qualifyResult.qualificationFailures?.find(
      (failure) => failure.leadId === leadId,
    )?.message ??
    (qualification === undefined
      ? (qualifyResult.message || `Lead ${leadId} qualification failed.`)
      : undefined);

  if (qualifyFailure !== undefined || qualification === undefined) {
    await rollup.fail(
      "qualify",
      leadId,
      qualifyFailure ?? `Lead ${leadId} qualification failed.`,
    );
    await noteQualifyFinished(null);
    return;
  }

  try {
    await persistence.upsertLeadQualification({
      leadId: qualification.leadId,
      workflowRunId,
      score: qualification.score,
      priorityRank: null,
      priorityLabel: qualification.priorityLabel,
      fitLabel: qualification.fitLabel,
      explanation: qualification.explanation,
      evidence: qualification.evidence,
      criteriaBreakdown: qualification.criteriaBreakdown,
    });
    await recordStageUsage(
      persistence,
      workflowRunId,
      stepsByType,
      "qualify",
      qualifyResult,
    );
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }
    const message = thrownMessage(error);
    await rollup.fail("qualify", leadId, message);
    await noteQualifyFinished(null);
    return;
  }

  await rollup.succeed("qualify", leadId, "qualify");
  noteSummarizeScheduled();
  await rollup.enter("summarize", leadId);
  await noteQualifyFinished({
    leadId: qualification.leadId,
    score: qualification.score,
  });

  let storedQualifications: StoredLeadQualification[] = [];
  try {
    storedQualifications = await persistence.listLeadQualifications([leadId]);
  } catch (error) {
    const message = thrownMessage(error);
    await rollup.fail("summarize", leadId, message);
    await noteSummarizeFinished();
    return;
  }

  let summarizeQualification: SummarizeLeadQualification;
  try {
    summarizeQualification = toSummarizeQualification(
      leadId,
      qualification,
      storedQualifications[0],
    );
  } catch (error) {
    const message = thrownMessage(error);
    await rollup.fail("summarize", leadId, message);
    await noteSummarizeFinished();
    return;
  }

  function summarizeFailed(result: AgentStageResult): boolean {
    const summary = result.summaries?.[0];
    const failure = result.summaryFailures?.find(
      (item) => item.leadId === leadId,
    );
    return failure !== undefined || summary === undefined;
  }

  let summarizeResult: AgentStageResult;
  try {
    const attempted = await callAgentWithRetry(
      () =>
        stageRunners.summarize(icp, [context], [summarizeQualification]),
      summarizeFailed,
      async (attemptCount) => {
        await persistence.updateRunLead(workflowRunId, leadId, {
          attemptCount,
        });
      },
      1,
    );
    summarizeResult = attempted.result;
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }
    const message = thrownMessage(error);
    await rollup.fail("summarize", leadId, message);
    await noteSummarizeFinished();
    return;
  }

  const summary = summarizeResult.summaries?.[0];
  const summarizeFailure =
    summarizeResult.summaryFailures?.find(
      (failure) => failure.leadId === leadId,
    )?.message ??
    (summary === undefined
      ? (summarizeResult.message || `Lead ${leadId} summary failed.`)
      : undefined);

  if (summarizeFailure !== undefined || summary === undefined) {
    await rollup.fail(
      "summarize",
      leadId,
      summarizeFailure ?? `Lead ${leadId} summary failed.`,
    );
    await noteSummarizeFinished();
    return;
  }

  try {
    await persistence.upsertLeadSummary({
      leadId: summary.leadId,
      workflowRunId,
      summaryText: summary.summaryText,
      structuredReport: summary.structuredReport,
    });
    await recordStageUsage(
      persistence,
      workflowRunId,
      stepsByType,
      "summarize",
      summarizeResult,
    );
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }
    const message = thrownMessage(error);
    await rollup.fail("summarize", leadId, message);
    await noteSummarizeFinished();
    return;
  }

  await rollup.succeed("summarize", leadId, "summarize");
  await rollup.enter("draft", leadId);
  await noteSummarizeFinished();

  function draftFailed(result: AgentStageResult): boolean {
    const draft = result.outreachDrafts?.[0];
    const failure = result.outreachFailures?.find(
      (item) => item.leadId === leadId,
    );
    return failure !== undefined || draft === undefined;
  }

  let draftResult: AgentStageResult;
  try {
    const attempted = await callAgentWithRetry(
      () => stageRunners.draft(icp, [context]),
      draftFailed,
      async (attemptCount) => {
        await persistence.updateRunLead(workflowRunId, leadId, {
          attemptCount,
        });
      },
      1,
    );
    draftResult = attempted.result;
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }
    const message = thrownMessage(error);
    await rollup.fail("draft", leadId, message);
    return;
  }

  const draft = draftResult.outreachDrafts?.[0];
  const draftFailure =
    draftResult.outreachFailures?.find((failure) => failure.leadId === leadId)
      ?.message ??
    (draft === undefined
      ? (draftResult.message || `Lead ${leadId} outreach draft failed.`)
      : undefined);

  if (draftFailure !== undefined || draft === undefined) {
    await rollup.fail(
      "draft",
      leadId,
      draftFailure ?? `Lead ${leadId} outreach draft failed.`,
    );
    return;
  }

  try {
    await persistence.insertOutreachDraft({
      leadId: draft.leadId,
      workflowRunId,
      subject: draft.subject,
      body: draft.body,
    });
    await recordStageUsage(
      persistence,
      workflowRunId,
      stepsByType,
      "draft",
      draftResult,
    );
  } catch (error) {
    if (databaseUnavailable(error)) {
      throw error;
    }
    const message = thrownMessage(error);
    await rollup.fail("draft", leadId, message);
    return;
  }

  await rollup.succeed("draft", leadId, "done");
}

export type RetryFailedLeadInput = {
  workflowRunId: string;
  userId: string;
  icp: IdealCustomerProfileInput;
  leadId: string;
  /** Attempt count already set by the claim. */
  firstAttemptCount: number;
  startStage: LeadPipelineStage;
};

export type RetryFailedIdentifyInput = {
  workflowRunId: string;
  userId: string;
  icp: IdealCustomerProfileInput;
  /** Attempt count already set by the claim. */
  firstAttemptCount: number;
};

async function reopenStep(
  persistence: WorkflowPersistence,
  step: WorkflowStepRow,
  attemptCount: number,
): Promise<Date> {
  const now = new Date();
  await persistence.updateStep(step.workflowStepId, {
    status: "running",
    attemptCount,
    startedAt: now,
    errorMessage: null,
    completedAt: null,
    durationMs: null,
  });
  return now;
}

async function completeOpenedStep(
  persistence: WorkflowPersistence,
  step: WorkflowStepRow,
  startedAt: Date,
): Promise<void> {
  const completedAt = new Date();
  await persistence.updateStep(step.workflowStepId, {
    status: "completed",
    completedAt,
    durationMs: elapsedMs(startedAt, completedAt),
    errorMessage: null,
  });
}

async function recomputeQualificationRanks(
  persistence: WorkflowPersistence,
  workflowRunId: string,
): Promise<void> {
  const runLeads = await persistence.listRunLeads(workflowRunId);
  const leadIds = runLeads.map((lead) => lead.leadId);
  const stored = await persistence.listLeadQualifications(leadIds);
  const scored: { leadId: string; score: number }[] = [];
  for (const row of stored) {
    if (row.score === null) {
      continue;
    }
    const score = Number(row.score);
    if (!Number.isFinite(score)) {
      continue;
    }
    scored.push({ leadId: row.leadId, score });
  }
  if (scored.length === 0) {
    return;
  }
  const ranked = rankLeads(scored);
  await persistence.updateLeadQualificationRanks(
    ranked.ranked.map((item) => ({
      leadId: item.leadId,
      priorityRank: item.priorityRank,
    })),
  );
}

async function failLeadAtStage(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  leadId: string,
  stage: LeadPipelineStage,
  message: string,
): Promise<void> {
  await persistence.updateRunLead(workflowRunId, leadId, {
    currentStage: stage,
    status: "failed",
    errorMessage: message,
  });
}

async function succeedLeadAtStage(
  persistence: WorkflowPersistence,
  workflowRunId: string,
  leadId: string,
  currentStage: "qualify" | "summarize" | "draft" | "done",
): Promise<void> {
  await persistence.updateRunLead(workflowRunId, leadId, {
    currentStage,
    status: "completed",
    errorMessage: null,
  });
}

/**
 * Resumes one failed lead from its current stage through draft.
 * The lead must already be claimed as running.
 */
export async function retryFailedLead(
  input: RetryFailedLeadInput,
  persistence: WorkflowPersistence = defaultPersistence,
  stageRunners: WorkflowStageRunners = defaultStageRunners,
): Promise<LeadWorkflowResult> {
  const { workflowRunId, icp, leadId, firstAttemptCount, startStage } = input;

  await persistence.updateRun(workflowRunId, {
    status: "running",
    errorMessage: null,
    completedAt: null,
  });

  const steps = await persistence.listSteps(workflowRunId);
  const stepsByType = new Map<WorkflowStepType, WorkflowStepRow>();
  for (const step of steps) {
    if (!includesWorkflowStepType(step.stepType)) {
      continue;
    }
    stepsByType.set(step.stepType, step);
  }

  const startStep = stepsByType.get(startStage);
  if (!startStep) {
    const message = `Workflow step "${startStage}" was not found.`;
    await failLeadAtStage(persistence, workflowRunId, leadId, startStage, message);
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages: [] };
  }

  const startedAt = await reopenStep(
    persistence,
    startStep,
    startStep.attemptCount + 1,
  );

  let contexts: WorkflowLeadContext[];
  try {
    contexts = await persistence.listLeadContexts([leadId]);
  } catch (error) {
    const message = thrownMessage(error);
    await failLeadAtStage(persistence, workflowRunId, leadId, startStage, message);
    await completeOpenedStep(persistence, startStep, startedAt);
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages: [] };
  }

  const context = contexts[0];
  if (context === undefined) {
    const message = `Lead ${leadId} was not found.`;
    await failLeadAtStage(persistence, workflowRunId, leadId, startStage, message);
    await completeOpenedStep(persistence, startStep, startedAt);
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages: [] };
  }

  let qualification: WorkflowLeadQualification | undefined;
  let ranQualify = false;
  const opened = new Map<LeadPipelineStage, { step: WorkflowStepRow; startedAt: Date }>();
  opened.set(startStage, { step: startStep, startedAt });

  async function openStage(stage: LeadPipelineStage): Promise<void> {
    if (opened.has(stage)) {
      return;
    }
    const step = stepsByType.get(stage);
    if (!step) {
      throw new Error(`Workflow step "${stage}" was not found.`);
    }
    const stageStartedAt = await reopenStep(persistence, step, step.attemptCount + 1);
    opened.set(stage, { step, startedAt: stageStartedAt });
    await persistence.updateRunLead(workflowRunId, leadId, {
      currentStage: stage,
      status: "running",
      attemptCount: 1,
      errorMessage: null,
    });
  }

  if (startStage === "qualify") {
    await persistence.updateRunLead(workflowRunId, leadId, {
      currentStage: "qualify",
      status: "running",
      errorMessage: null,
    });

    function qualifyFailed(result: AgentStageResult): boolean {
      const row = result.qualifications?.[0];
      const failure = result.qualificationFailures?.find(
        (item) => item.leadId === leadId,
      );
      return failure !== undefined || row === undefined;
    }

    let qualifyResult: AgentStageResult;
    try {
      const attempted = await callAgentWithRetry(
        () => stageRunners.qualify(icp, [context]),
        qualifyFailed,
        async (attemptCount) => {
          await persistence.updateRunLead(workflowRunId, leadId, {
            attemptCount,
          });
        },
        firstAttemptCount,
      );
      qualifyResult = attempted.result;
    } catch (error) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "qualify",
        thrownMessage(error),
      );
      await completeOpenedStep(persistence, startStep, startedAt);
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    qualification = qualifyResult.qualifications?.[0];
    const qualifyFailure =
      qualifyResult.qualificationFailures?.find(
        (failure) => failure.leadId === leadId,
      )?.message ??
      (qualification === undefined
        ? (qualifyResult.message || `Lead ${leadId} qualification failed.`)
        : undefined);

    if (qualifyFailure !== undefined || qualification === undefined) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "qualify",
        qualifyFailure ?? `Lead ${leadId} qualification failed.`,
      );
      await completeOpenedStep(persistence, startStep, startedAt);
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    try {
      await persistence.upsertLeadQualification({
        leadId: qualification.leadId,
        workflowRunId,
        score: qualification.score,
        priorityRank: null,
        priorityLabel: qualification.priorityLabel,
        fitLabel: qualification.fitLabel,
        explanation: qualification.explanation,
        evidence: qualification.evidence,
        criteriaBreakdown: qualification.criteriaBreakdown,
      });
      await recordStageUsage(
        persistence,
        workflowRunId,
        stepsByType,
        "qualify",
        qualifyResult,
      );
    } catch (error) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "qualify",
        thrownMessage(error),
      );
      await completeOpenedStep(persistence, startStep, startedAt);
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    await succeedLeadAtStage(persistence, workflowRunId, leadId, "qualify");
    ranQualify = true;
    await openStage("summarize");
  }

  if (startStage === "qualify" || startStage === "summarize") {
    const summarizeFirstAttempt =
      startStage === "summarize" ? firstAttemptCount : 1;

    let storedQualifications: StoredLeadQualification[] = [];
    try {
      storedQualifications = await persistence.listLeadQualifications([leadId]);
    } catch (error) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "summarize",
        thrownMessage(error),
      );
      for (const openedStep of opened.values()) {
        await completeOpenedStep(
          persistence,
          openedStep.step,
          openedStep.startedAt,
        );
      }
      if (ranQualify) {
        await recomputeQualificationRanks(persistence, workflowRunId);
      }
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    let summarizeQualification: SummarizeLeadQualification;
    try {
      summarizeQualification = toSummarizeQualification(
        leadId,
        qualification,
        storedQualifications[0],
      );
    } catch (error) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "summarize",
        thrownMessage(error),
      );
      for (const openedStep of opened.values()) {
        await completeOpenedStep(
          persistence,
          openedStep.step,
          openedStep.startedAt,
        );
      }
      if (ranQualify) {
        await recomputeQualificationRanks(persistence, workflowRunId);
      }
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    function summarizeFailed(result: AgentStageResult): boolean {
      const summary = result.summaries?.[0];
      const failure = result.summaryFailures?.find(
        (item) => item.leadId === leadId,
      );
      return failure !== undefined || summary === undefined;
    }

    let summarizeResult: AgentStageResult;
    try {
      const attempted = await callAgentWithRetry(
        () =>
          stageRunners.summarize(icp, [context], [summarizeQualification]),
        summarizeFailed,
        async (attemptCount) => {
          await persistence.updateRunLead(workflowRunId, leadId, {
            attemptCount,
          });
        },
        summarizeFirstAttempt,
      );
      summarizeResult = attempted.result;
    } catch (error) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "summarize",
        thrownMessage(error),
      );
      for (const openedStep of opened.values()) {
        await completeOpenedStep(
          persistence,
          openedStep.step,
          openedStep.startedAt,
        );
      }
      if (ranQualify) {
        await recomputeQualificationRanks(persistence, workflowRunId);
      }
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    const summary = summarizeResult.summaries?.[0];
    const summarizeFailure =
      summarizeResult.summaryFailures?.find(
        (failure) => failure.leadId === leadId,
      )?.message ??
      (summary === undefined
        ? (summarizeResult.message || `Lead ${leadId} summary failed.`)
        : undefined);

    if (summarizeFailure !== undefined || summary === undefined) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "summarize",
        summarizeFailure ?? `Lead ${leadId} summary failed.`,
      );
      for (const openedStep of opened.values()) {
        await completeOpenedStep(
          persistence,
          openedStep.step,
          openedStep.startedAt,
        );
      }
      if (ranQualify) {
        await recomputeQualificationRanks(persistence, workflowRunId);
      }
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    try {
      await persistence.upsertLeadSummary({
        leadId: summary.leadId,
        workflowRunId,
        summaryText: summary.summaryText,
        structuredReport: summary.structuredReport,
      });
      await recordStageUsage(
        persistence,
        workflowRunId,
        stepsByType,
        "summarize",
        summarizeResult,
      );
    } catch (error) {
      await failLeadAtStage(
        persistence,
        workflowRunId,
        leadId,
        "summarize",
        thrownMessage(error),
      );
      for (const openedStep of opened.values()) {
        await completeOpenedStep(
          persistence,
          openedStep.step,
          openedStep.startedAt,
        );
      }
      if (ranQualify) {
        await recomputeQualificationRanks(persistence, workflowRunId);
      }
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return { status: "completed", stages: [] };
    }

    await succeedLeadAtStage(persistence, workflowRunId, leadId, "summarize");
    await openStage("draft");
  }

  const draftFirstAttempt = startStage === "draft" ? firstAttemptCount : 1;
  if (startStage === "draft") {
    await persistence.updateRunLead(workflowRunId, leadId, {
      currentStage: "draft",
      status: "running",
      errorMessage: null,
    });
  }

  function draftFailed(result: AgentStageResult): boolean {
    const draft = result.outreachDrafts?.[0];
    const failure = result.outreachFailures?.find(
      (item) => item.leadId === leadId,
    );
    return failure !== undefined || draft === undefined;
  }

  let draftResult: AgentStageResult;
  try {
    const attempted = await callAgentWithRetry(
      () => stageRunners.draft(icp, [context]),
      draftFailed,
      async (attemptCount) => {
        await persistence.updateRunLead(workflowRunId, leadId, {
          attemptCount,
        });
      },
      draftFirstAttempt,
    );
    draftResult = attempted.result;
  } catch (error) {
    await failLeadAtStage(
      persistence,
      workflowRunId,
      leadId,
      "draft",
      thrownMessage(error),
    );
    for (const openedStep of opened.values()) {
      await completeOpenedStep(
        persistence,
        openedStep.step,
        openedStep.startedAt,
      );
    }
    if (ranQualify) {
      await recomputeQualificationRanks(persistence, workflowRunId);
    }
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages: [] };
  }

  const draft = draftResult.outreachDrafts?.[0];
  const draftFailure =
    draftResult.outreachFailures?.find((failure) => failure.leadId === leadId)
      ?.message ??
    (draft === undefined
      ? (draftResult.message || `Lead ${leadId} outreach draft failed.`)
      : undefined);

  if (draftFailure !== undefined || draft === undefined) {
    await failLeadAtStage(
      persistence,
      workflowRunId,
      leadId,
      "draft",
      draftFailure ?? `Lead ${leadId} outreach draft failed.`,
    );
    for (const openedStep of opened.values()) {
      await completeOpenedStep(
        persistence,
        openedStep.step,
        openedStep.startedAt,
      );
    }
    if (ranQualify) {
      await recomputeQualificationRanks(persistence, workflowRunId);
    }
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages: [] };
  }

  try {
    await persistence.insertOutreachDraft({
      leadId: draft.leadId,
      workflowRunId,
      subject: draft.subject,
      body: draft.body,
    });
    await recordStageUsage(
      persistence,
      workflowRunId,
      stepsByType,
      "draft",
      draftResult,
    );
  } catch (error) {
    await failLeadAtStage(
      persistence,
      workflowRunId,
      leadId,
      "draft",
      thrownMessage(error),
    );
    for (const openedStep of opened.values()) {
      await completeOpenedStep(
        persistence,
        openedStep.step,
        openedStep.startedAt,
      );
    }
    if (ranQualify) {
      await recomputeQualificationRanks(persistence, workflowRunId);
    }
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return { status: "completed", stages: [] };
  }

  await succeedLeadAtStage(persistence, workflowRunId, leadId, "done");
  for (const openedStep of opened.values()) {
    await completeOpenedStep(
      persistence,
      openedStep.step,
      openedStep.startedAt,
    );
  }
  if (ranQualify) {
    await recomputeQualificationRanks(persistence, workflowRunId);
  }
  await persistence.updateRun(workflowRunId, {
    status: "completed",
    completedAt: new Date(),
    errorMessage: null,
  });
  return { status: "completed", stages: [] };
}

/**
 * Retries a failed identify step. Existing leads stay as they are.
 * New companies continue through qualify, summarize, and draft.
 */
export async function retryFailedIdentify(
  input: RetryFailedIdentifyInput,
  persistence: WorkflowPersistence = defaultPersistence,
  stageRunners: WorkflowStageRunners = defaultStageRunners,
): Promise<LeadWorkflowResult> {
  const { workflowRunId, userId, icp, firstAttemptCount } = input;

  await persistence.updateRun(workflowRunId, {
    status: "running",
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
  });

  const steps = await persistence.listSteps(workflowRunId);
  const stepsByType = new Map<WorkflowStepType, WorkflowStepRow>();
  for (const step of steps) {
    if (!includesWorkflowStepType(step.stepType)) {
      continue;
    }
    stepsByType.set(step.stepType, step);
  }

  const identifyStep = stepsByType.get("identify");
  if (!identifyStep) {
    await persistence.updateRun(workflowRunId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: 'Workflow step "identify" was not found.',
    });
    return { status: "failed", stages: [] };
  }

  let existingLeads = await persistence.listRunLeads(workflowRunId);
  let identifyAttached: WorkflowLeadContext[] = [];
  if (existingLeads.length > 0) {
    identifyAttached = await persistence.listLeadContexts(
      existingLeads.map((lead) => lead.leadId),
    );
  }

  const excludeWebsites = identifyAttached.flatMap((lead) =>
    lead.website === undefined || lead.website.trim().length === 0
      ? []
      : [lead.website],
  );
  const search = () =>
    existingLeads.length > 0
      ? stageRunners.identify(icp, {
          excludeWebsites,
          excludeCompanyNames: identifyAttached.map((lead) => lead.companyName),
        })
      : stageRunners.identify(icp);

  const agentStartedAt = new Date();
  let identifyResult: AgentStageResult;
  try {
    const attempted = await callAgentWithRetry(
      search,
      (result) => result.status === "failed",
      async (attemptCount) => {
        await persistence.updateStep(identifyStep.workflowStepId, {
          status: "running",
          attemptCount,
          errorMessage: null,
          completedAt: null,
          durationMs: null,
        });
      },
      firstAttemptCount,
    );
    identifyResult = attempted.result;
  } catch (error) {
    const message = thrownMessage(error);
    const durationMs = elapsedMs(agentStartedAt, new Date());
    if (existingLeads.length === 0) {
      await failIdentify(
        persistence,
        workflowRunId,
        identifyStep,
        existingLeads,
        message,
        durationMs,
      );
      return {
        status: "failed",
        stages: [{ stage: "identify", status: "failed", message }],
      };
    }
    await persistence.updateStep(identifyStep.workflowStepId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
      durationMs,
    });
    await persistence.updateRun(workflowRunId, {
      status: "completed",
      completedAt: new Date(),
      errorMessage: null,
    });
    return {
      status: "completed",
      stages: [{ stage: "identify", status: "failed", message }],
    };
  }

  const identifyDurationMs = elapsedMs(agentStartedAt, new Date());

  if (identifyResult.status === "failed" && existingLeads.length === 0) {
    await failIdentify(
      persistence,
      workflowRunId,
      identifyStep,
      existingLeads,
      identifyResult.message,
      identifyDurationMs,
    );
    return { status: "failed", stages: [identifyResult] };
  }

  const priorLeadIds = new Set(existingLeads.map((lead) => lead.leadId));
  const newLeadIds: string[] = [];

  if (
    identifyResult.status === "completed" &&
    identifyResult.candidates !== undefined &&
    identifyResult.candidates.length > 0
  ) {
    const drafts: WorkflowRunLeadDraft[] = [];
    const candidates = identifyResult.candidates.filter(
      (candidate) => !candidateMatchesAttached(candidate, identifyAttached),
    );

    try {
      for (const candidate of candidates) {
        const stored = await persistence.insertIdentifiedLead({
          userId,
          ...candidate,
        });
        if (priorLeadIds.has(stored.leadId)) {
          continue;
        }
        priorLeadIds.add(stored.leadId);
        newLeadIds.push(stored.leadId);
        drafts.push({
          workflowRunId,
          leadId: stored.leadId,
          currentStage: "identify",
          status: "pending",
        });
      }
      await persistence.insertRunLeads(drafts);
      existingLeads = await persistence.listRunLeads(workflowRunId);
    } catch (error) {
      const message = thrownMessage(error);
      if (existingLeads.length === 0) {
        await failIdentify(
          persistence,
          workflowRunId,
          identifyStep,
          existingLeads,
          message,
          identifyDurationMs,
        );
        return {
          status: "failed",
          stages: [{ stage: "identify", status: "failed", message }],
        };
      }
      await persistence.updateStep(identifyStep.workflowStepId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        durationMs: identifyDurationMs,
      });
      await persistence.updateRun(workflowRunId, {
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
      });
      return {
        status: "completed",
        stages: [{ stage: "identify", status: "failed", message }],
      };
    }
  }

  if (identifyResult.status === "completed") {
    const completedAt = new Date();
    await persistence.updateStep(identifyStep.workflowStepId, {
      status: "completed",
      completedAt,
      durationMs: identifyDurationMs,
      errorMessage: null,
    });
  }

  if (
    identifyResult.status === "failed" ||
    newLeadIds.length === 0
  ) {
    await persistence.updateRun(workflowRunId, {
      status: existingLeads.length === 0 ? "failed" : "completed",
      completedAt: new Date(),
      errorMessage:
        existingLeads.length === 0 ? identifyResult.message : null,
    });
    return {
      status: existingLeads.length === 0 ? "failed" : "completed",
      stages: [identifyResult],
    };
  }

  const newLeads = existingLeads.filter((lead) =>
    newLeadIds.includes(lead.leadId),
  );

  await markLeads(persistence, workflowRunId, newLeads, {
    currentStage: "identify",
    status: "completed",
    errorMessage: null,
  });

  const pendingQualify = await markLeads(persistence, workflowRunId, newLeads, {
    currentStage: "qualify",
    status: "pending",
    errorMessage: null,
  });
  if (!pendingQualify.ok) {
    await persistence.updateRun(workflowRunId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: pendingQualify.message,
    });
    return { status: "failed", stages: [identifyResult] };
  }

  const runExclusive = createWriteLock();
  const rollup = createStageRollup(
    persistence,
    workflowRunId,
    stepsByType,
    runExclusive,
  );

  let qualifyRemaining = newLeads.length;
  const scoredForRank: { leadId: string; score: number }[] = [];
  let rankPass: Promise<void> = Promise.resolve();
  let summarizeScheduled = 0;
  let summarizeFinished = 0;

  async function noteQualifyFinished(
    scored: { leadId: string; score: number } | null,
  ): Promise<void> {
    if (scored !== null) {
      scoredForRank.push(scored);
    }
    qualifyRemaining -= 1;
    if (qualifyRemaining === 0) {
      await rollup.seal("qualify");
      rankPass = (async () => {
        await recomputeQualificationRanks(persistence, workflowRunId);
      })().catch((error: unknown) => {
        if (databaseUnavailable(error)) {
          throw error;
        }
      });
      await rollup.seal("summarize");
    }
  }

  async function noteSummarizeFinished(): Promise<void> {
    summarizeFinished += 1;
    if (summarizeFinished === summarizeScheduled) {
      await rollup.seal("draft");
    }
  }

  await mapWithLimit(newLeads, leadPipelineConcurrency, async (lead) => {
    await processLeadPipeline({
      leadId: lead.leadId,
      workflowRunId,
      icp,
      persistence,
      stageRunners,
      stepsByType,
      rollup,
      noteQualifyFinished,
      noteSummarizeScheduled: () => {
        summarizeScheduled += 1;
      },
      noteSummarizeFinished,
    });
  });

  if (summarizeScheduled === 0) {
    await rollup.seal("summarize");
    await rollup.seal("draft");
  } else if (summarizeFinished === summarizeScheduled) {
    await rollup.seal("draft");
  }
  await rollup.skipRemaining();
  await rankPass;

  await persistence.updateRun(workflowRunId, {
    status: "completed",
    completedAt: new Date(),
    errorMessage: null,
  });

  return { status: "completed", stages: [identifyResult] };
}
