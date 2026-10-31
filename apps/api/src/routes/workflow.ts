import {
  findIdealCustomerProfileById,
  findWorkflowRunById,
  insertWorkflowRun,
  insertWorkflowRunLeads,
  insertWorkflowSteps,
  listLeadsByIdsForUser,
  listWorkflowRunLeadsByRunId,
  listWorkflowRunsByUser,
  listWorkflowStepsByRunId,
} from "@ithaca/db";
import type {
  WorkflowRun as WorkflowRunRow,
  WorkflowRunLead as WorkflowRunLeadRow,
  WorkflowStep as WorkflowStepRow,
} from "@ithaca/db";
import { runLeadWorkflow } from "@ithaca/orchestrator";
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

function mapRunLead(row: WorkflowRunLeadRow): WorkflowRunLead {
  return {
    leadId: row.leadId,
    currentStage: workflowStage(row.currentStage),
    status: workflowLeadStatus(row.status),
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
