import {
  claimFailedWorkflowRunLead,
  claimFailedWorkflowStep,
  findIdealCustomerProfileById,
  findWorkflowRunById,
  findWorkflowStepByRunAndType,
  insertWorkflowRun,
  insertWorkflowRunLeads,
  insertWorkflowSteps,
  listLeadsByIdsForUser,
  listWorkflowRunLeadsByRunId,
  listWorkflowRunsByUser,
  listWorkflowStepsByRunId,
  updateWorkflowRunStatus,
} from "@ithaca/db";
import type {
  WorkflowRun as WorkflowRunRow,
  WorkflowRunLeadListRow,
  WorkflowStep as WorkflowStepRow,
} from "@ithaca/db";
import {
  retryFailedIdentify,
  retryFailedLead,
  runLeadWorkflow,
} from "@ithaca/orchestrator";
import {
  workflowLeadStatuses,
  workflowRunStatuses,
  workflowStages,
  workflowStepStatuses,
  workflowStepTypes,
} from "@ithaca/shared";
import type {
  IdealCustomerProfile,
  IdealCustomerProfileInput,
  ListWorkflowRunsResponse,
  RetryWorkflowRunResponse,
  StartWorkflowRunResponse,
  WorkflowLeadStatus,
  WorkflowRunDetail,
  WorkflowRunLead,
  WorkflowRunStatus,
  WorkflowRunSummary,
  WorkflowStage,
  WorkflowStep,
  WorkflowStepStatus,
  WorkflowStepType,
} from "@ithaca/shared";
import { Router } from "express";
import { sendFailure, signedInUserId } from "../lib/http.js";
import { mapProfile } from "../lib/mapProfile.js";
import { asRecord, isUuid, readText, toIso } from "../lib/parse.js";
import { profileInactiveMessage } from "../lib/profileInput.js";

export const workflowRouter = Router();

const workflowStartedMessage = "Workflow run started.";
const workflowRetryStartedMessage = "Workflow retry started.";
const workflowStillRunningMessage = "Workflow run is still running.";
const workflowLeadCannotRetryMessage = "Workflow lead cannot be retried.";
const workflowStepCannotRetryMessage = "Workflow step cannot be retried.";
const retryableLeadStages = ["qualify", "summarize", "draft"] as const;

function includesValue<T extends string>(
  allowed: readonly T[],
  value: string,
): value is T {
  return allowed.some((item) => item === value);
}

function workflowRunStatus(value: string): WorkflowRunStatus {
  if (includesValue(workflowRunStatuses, value)) {
    return value;
  }

  throw new Error(`Unexpected workflow run status "${value}".`);
}

function workflowStepType(value: string): WorkflowStepType {
  if (includesValue(workflowStepTypes, value)) {
    return value;
  }

  throw new Error(`Unexpected workflow step type "${value}".`);
}

function workflowStepStatus(value: string): WorkflowStepStatus {
  if (includesValue(workflowStepStatuses, value)) {
    return value;
  }

  throw new Error(`Unexpected workflow step status "${value}".`);
}

function workflowStage(value: string): WorkflowStage {
  if (includesValue(workflowStages, value)) {
    return value;
  }

  throw new Error(`Unexpected workflow stage "${value}".`);
}

function workflowLeadStatus(value: string): WorkflowLeadStatus {
  if (includesValue(workflowLeadStatuses, value)) {
    return value;
  }

  throw new Error(`Unexpected workflow lead status "${value}".`);
}

function mapRunSummary(row: WorkflowRunRow): WorkflowRunSummary {
  return {
    workflowRunId: row.workflowRunId,
    icpId: row.icpId,
    status: workflowRunStatus(row.status),
    errorMessage: row.errorMessage,
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
  };
}

function mapStep(row: WorkflowStepRow): WorkflowStep {
  return {
    workflowStepId: row.workflowStepId,
    stepType: workflowStepType(row.stepType),
    status: workflowStepStatus(row.status),
    attemptCount: row.attemptCount,
    errorMessage: row.errorMessage,
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    durationMs: row.durationMs,
  };
}

function leadSourceType(value: string): "manual" | "identified" {
  if (value === "manual" || value === "identified") {
    return value;
  }

  throw new Error(`Unexpected lead source type "${value}".`);
}

function mapRunLead(row: WorkflowRunLeadListRow): WorkflowRunLead {
  return {
    leadId: row.leadId,
    companyName: row.companyName,
    sourceType: leadSourceType(row.sourceType),
    currentStage: workflowStage(row.currentStage),
    status: workflowLeadStatus(row.status),
    attemptCount: row.attemptCount,
    errorMessage: row.errorMessage,
  };
}

// Converts an ideal customer profile to an input for the workflow.
function toWorkflowIcp(profile: IdealCustomerProfile): IdealCustomerProfileInput {
  const icp: IdealCustomerProfileInput = {
    name: profile.name,
    industries: profile.industries,
    industriesExclude: profile.industriesExclude,
    locations: profile.locations,
    businessNeedKeywords: profile.businessNeedKeywords,
  };

  if (profile.companySizeMin !== null) {
    icp.companySizeMin = profile.companySizeMin;
  }

  if (profile.companySizeMax !== null) {
    icp.companySizeMax = profile.companySizeMax;
  }

  if (profile.outreachTone) {
    icp.outreachTone = profile.outreachTone;
  }

  if (profile.messageConstraints) {
    icp.messageConstraints = profile.messageConstraints;
  }

  const budgetCurrency = profile.budgetCurrency.trim();
  if (budgetCurrency.length > 0) {
    icp.budgetCurrency = budgetCurrency;
  }

  if (profile.budgetMin !== null) {
    icp.budgetMin = profile.budgetMin;
  }

  if (profile.budgetMax !== null) {
    icp.budgetMax = profile.budgetMax;
  }

  const budgetNotes = profile.budgetNotes.trim();
  if (budgetNotes.length > 0) {
    icp.budgetNotes = budgetNotes;
  }

  const businessNeedDescription = profile.businessNeedDescription.trim();
  if (businessNeedDescription.length > 0) {
    icp.businessNeedDescription = businessNeedDescription;
  }

  return icp;
}

function isLeadIdError(
  value: string[] | { message: string },
): value is { message: string } {
  return !Array.isArray(value);
}

function readLeadIds(
  body: Record<string, unknown>,
): string[] | { message: string } {
  if (!Object.hasOwn(body, "leadIds") || body.leadIds === undefined) {
    return [];
  }

  if (!Array.isArray(body.leadIds)) {
    return { message: "Lead ids must be a list." };
  }

  const leadIds: string[] = [];
  const seen = new Set<string>();
  for (const item of body.leadIds) {
    if (typeof item !== "string") {
      return { message: "Lead ids must be a list." };
    }

    const leadId = item.trim();
    if (!leadId) {
      return { message: "Lead ids must be a list." };
    }

    if (seen.has(leadId)) {
      continue;
    }

    seen.add(leadId);
    leadIds.push(leadId);
  }

  return leadIds;
}

function readUseSelectedLeadsOnly(
  body: Record<string, unknown>,
): boolean | { message: string } {
  if (
    !Object.hasOwn(body, "useSelectedLeadsOnly") ||
    body.useSelectedLeadsOnly === undefined
  ) {
    return false;
  }

  if (typeof body.useSelectedLeadsOnly !== "boolean") {
    return { message: "Use selected leads only must be true or false." };
  }

  return body.useSelectedLeadsOnly;
}

function isUseSelectedLeadsOnlyError(
  value: boolean | { message: string },
): value is { message: string } {
  return typeof value !== "boolean";
}

// Starts a workflow run.
workflowRouter.post("/runs", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const body = asRecord(req.body);
  const icpId = readText(body.icpId);
  if (!icpId) {
    res.status(400).json({ message: "ICP is required." });
    return;
  }

  if (!isUuid(icpId)) {
    res.status(404).json({ message: "Ideal customer profile not found." });
    return;
  }

  const leadIds = readLeadIds(body);
  if (isLeadIdError(leadIds)) {
    res.status(400).json(leadIds);
    return;
  }

  if (leadIds.some((leadId) => !isUuid(leadId))) {
    res.status(404).json({ message: "Lead not found." });
    return;
  }

  const useSelectedLeadsOnly = readUseSelectedLeadsOnly(body);
  if (isUseSelectedLeadsOnlyError(useSelectedLeadsOnly)) {
    res.status(400).json(useSelectedLeadsOnly);
    return;
  }

  if (useSelectedLeadsOnly && leadIds.length === 0) {
    res.status(400).json({ message: "Select at least one lead." });
    return;
  }

  try {
    const profile = await findIdealCustomerProfileById(icpId, userId);
    if (!profile) {
      res.status(404).json({ message: "Ideal customer profile not found." });
      return;
    }

    if (!profile.isActive) {
      res.status(409).json({ message: profileInactiveMessage });
      return;
    }

    if (leadIds.length > 0) {
      const owned = await listLeadsByIdsForUser(leadIds, userId);
      const ownedIds = new Set(owned.map((lead) => lead.leadId));
      if (leadIds.some((leadId) => !ownedIds.has(leadId))) {
        res.status(404).json({ message: "Lead not found." });
        return;
      }
    }

    const run = await insertWorkflowRun({
      userId,
      icpId,
      status: "pending",
    });
    await insertWorkflowSteps(
      workflowStepTypes.map((stepType) => ({
        workflowRunId: run.workflowRunId,
        stepType,
        status: "pending",
        attemptCount: 0,
      })),
    );
    if (leadIds.length > 0) {
      await insertWorkflowRunLeads(
        leadIds.map((leadId) => ({
          workflowRunId: run.workflowRunId,
          leadId,
          currentStage: "identify",
          status: "pending",
        })),
      );
    }

    const icp = toWorkflowIcp(mapProfile(profile));
    void runLeadWorkflow({
      workflowRunId: run.workflowRunId,
      userId,
      icp,
      leadIds,
      useSelectedLeadsOnly,
    }).catch((err: unknown) => {
      console.error(err);
    });

    const response: StartWorkflowRunResponse = {
      message: workflowStartedMessage,
      workflowRunId: run.workflowRunId,
    };
    res.status(202).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Lists workflow runs for a user.
workflowRouter.get("/runs", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  try {
    const rows = await listWorkflowRunsByUser(userId);
    const response: ListWorkflowRunsResponse = {
      runs: rows.map(mapRunSummary),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

// Retrieves a workflow run by its ID.
workflowRouter.get("/runs/:workflowRunId", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const workflowRunId = req.params.workflowRunId;
  if (!isUuid(workflowRunId)) {
    res.status(404).json({ message: "Workflow run not found." });
    return;
  }

  try {
    const row = await findWorkflowRunById(workflowRunId, userId);
    if (!row) {
      res.status(404).json({ message: "Workflow run not found." });
      return;
    }

    const steps = await listWorkflowStepsByRunId(workflowRunId);
    const leads = await listWorkflowRunLeadsByRunId(workflowRunId);
    const response: WorkflowRunDetail = {
      ...mapRunSummary(row),
      steps: steps.map(mapStep),
      leads: leads.map(mapRunLead),
    };
    res.status(200).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});

function isRetryableLeadStage(
  value: string,
): value is (typeof retryableLeadStages)[number] {
  return retryableLeadStages.some((stage) => stage === value);
}

// Retries a failed identify step or a failed lead stage.
workflowRouter.post("/runs/:workflowRunId/retry", async (req, res) => {
  const userId = req.auth?.sub;
  if (!signedInUserId(res, userId)) {
    return;
  }

  const workflowRunId = req.params.workflowRunId;
  if (!isUuid(workflowRunId)) {
    res.status(404).json({ message: "Workflow run not found." });
    return;
  }

  const body = asRecord(req.body);
  const leadIdRaw = body.leadId;
  const stepTypeRaw = body.stepType;
  const hasLeadId = leadIdRaw !== undefined;
  const hasStepType = stepTypeRaw !== undefined;

  if (hasLeadId === hasStepType) {
    res.status(400).json({
      message: "Provide either leadId or stepType identify.",
    });
    return;
  }

  try {
    const row = await findWorkflowRunById(workflowRunId, userId);
    if (!row) {
      res.status(404).json({ message: "Workflow run not found." });
      return;
    }

    if (row.status === "pending" || row.status === "running") {
      res.status(409).json({ message: workflowStillRunningMessage });
      return;
    }

    const profile = await findIdealCustomerProfileById(row.icpId, userId);
    if (!profile) {
      res.status(404).json({ message: "Ideal customer profile not found." });
      return;
    }

    if (!profile.isActive) {
      res.status(409).json({ message: profileInactiveMessage });
      return;
    }

    const icp = toWorkflowIcp(mapProfile(profile));

    if (hasLeadId) {
      const leadId = readText(leadIdRaw);
      if (!leadId || !isUuid(leadId)) {
        res.status(404).json({ message: "Lead not found." });
        return;
      }

      const claimed = await claimFailedWorkflowRunLead(workflowRunId, leadId);
      if (!claimed || !isRetryableLeadStage(claimed.currentStage)) {
        res.status(409).json({ message: workflowLeadCannotRetryMessage });
        return;
      }

      await updateWorkflowRunStatus(workflowRunId, {
        status: "running",
        completedAt: null,
        errorMessage: null,
      });

      void retryFailedLead({
        workflowRunId,
        userId,
        icp,
        leadId,
        firstAttemptCount: claimed.attemptCount,
        startStage: claimed.currentStage,
      }).catch((err: unknown) => {
        console.error(err);
      });

      const response: RetryWorkflowRunResponse = {
        message: workflowRetryStartedMessage,
        workflowRunId,
      };
      res.status(202).json(response);
      return;
    }

    const stepType = readText(stepTypeRaw);
    if (stepType !== "identify") {
      res.status(400).json({
        message: "Provide either leadId or stepType identify.",
      });
      return;
    }

    const identifyStep = await findWorkflowStepByRunAndType(
      workflowRunId,
      "identify",
    );
    if (!identifyStep) {
      res.status(404).json({ message: "Workflow run not found." });
      return;
    }

    const claimedStep = await claimFailedWorkflowStep(
      identifyStep.workflowStepId,
    );
    if (!claimedStep) {
      res.status(409).json({ message: workflowStepCannotRetryMessage });
      return;
    }

    await updateWorkflowRunStatus(workflowRunId, {
      status: "running",
      completedAt: null,
      errorMessage: null,
    });

    void retryFailedIdentify({
      workflowRunId,
      userId,
      icp,
      firstAttemptCount: claimedStep.attemptCount,
    }).catch((err: unknown) => {
      console.error(err);
    });

    const response: RetryWorkflowRunResponse = {
      message: workflowRetryStartedMessage,
      workflowRunId,
    };
    res.status(202).json(response);
  } catch (err) {
    sendFailure(res, err);
  }
});
