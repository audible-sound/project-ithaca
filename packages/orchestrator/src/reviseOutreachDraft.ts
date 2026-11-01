import { reviseOutreach } from "@ithaca/agents";
import type { ReviseOutreachResult } from "@ithaca/agents";
import {
  findIdealCustomerProfileById,
  findLatestOutreachByLeadId,
  findLeadById,
  findWorkflowRunById,
  insertTokenUsage,
  listLeadContextsByIds,
  listWorkflowStepsByRunId,
} from "@ithaca/db";
import type {
  IdealCustomerProfile,
  LatestOutreachRow,
  Lead,
  TokenUsageDraft,
  WorkflowRun,
  WorkflowStep,
} from "@ithaca/db";
import type {
  IdealCustomerProfileInput,
  WorkflowLeadContext,
} from "@ithaca/shared";

const editableDraftStatuses = ["draft", "edited"] as const;

export type ReviseOutreachDraftInput = {
  leadId: string;
  userId: string;
  subject: string;
  body: string;
  instruction: string;
};

export type ReviseOutreachDraftResult =
  | {
      status: "revised";
      subject: string;
      body: string;
    }
  | { status: "not_found" }
  | { status: "not_drafted" }
  | { status: "not_editable" };

type RevisePersistence = {
  findLead: (leadId: string, userId: string) => Promise<Lead | null>;
  findLatestOutreach: (leadId: string) => Promise<LatestOutreachRow | null>;
  findWorkflowRun: (
    workflowRunId: string,
    userId: string,
  ) => Promise<WorkflowRun | null>;
  findProfile: (
    icpId: string,
    userId: string,
  ) => Promise<IdealCustomerProfile | null>;
  listLeadContexts: (leadIds: string[]) => Promise<WorkflowLeadContext[]>;
  listSteps: (workflowRunId: string) => Promise<WorkflowStep[]>;
  insertTokenUsage: (draft: TokenUsageDraft) => Promise<void>;
};

type ReviseAgent = (
  input: Parameters<typeof reviseOutreach>[0],
) => Promise<ReviseOutreachResult>;

const defaultPersistence: RevisePersistence = {
  findLead: findLeadById,
  findLatestOutreach: findLatestOutreachByLeadId,
  findWorkflowRun: findWorkflowRunById,
  findProfile: findIdealCustomerProfileById,
  listLeadContexts: listLeadContextsByIds,
  listSteps: listWorkflowStepsByRunId,
  async insertTokenUsage(draft) {
    await insertTokenUsage(draft);
  },
};

function toWorkflowIcp(profile: IdealCustomerProfile): IdealCustomerProfileInput {
  const icp: IdealCustomerProfileInput = {
    name: profile.name,
  };

  const tone = profile.outreachTone?.trim() ?? "";
  if (tone.length > 0) {
    icp.outreachTone = tone;
  }

  const constraints = profile.messageConstraints?.trim() ?? "";
  if (constraints.length > 0) {
    icp.messageConstraints = constraints;
  }

  return icp;
}

/**
 * Revises one owned outreach draft from a user instruction.
 * Returns the revised subject and body. Does not update the draft row.
 */
export async function reviseOutreachDraft(
  input: ReviseOutreachDraftInput,
  persistence: RevisePersistence = defaultPersistence,
  revise: ReviseAgent = reviseOutreach,
): Promise<ReviseOutreachDraftResult> {
  const lead = await persistence.findLead(input.leadId, input.userId);
  if (lead === null) {
    return { status: "not_found" };
  }

  const outreach = await persistence.findLatestOutreach(input.leadId);
  if (outreach === null) {
    return { status: "not_drafted" };
  }

  if (
    !editableDraftStatuses.includes(
      outreach.status as (typeof editableDraftStatuses)[number],
    )
  ) {
    return { status: "not_editable" };
  }

  const run = await persistence.findWorkflowRun(
    outreach.workflowRunId,
    input.userId,
  );
  if (run === null) {
    return { status: "not_found" };
  }

  const profile = await persistence.findProfile(run.icpId, input.userId);
  if (profile === null) {
    throw new Error("Ideal customer profile was not found.");
  }

  const contexts = await persistence.listLeadContexts([input.leadId]);
  const leadContext = contexts[0];
  if (leadContext === undefined) {
    throw new Error(`Lead ${input.leadId} was not found.`);
  }

  const revised = await revise({
    icp: toWorkflowIcp(profile),
    lead: leadContext,
    subject: input.subject,
    body: input.body,
    instruction: input.instruction,
  });

  const steps = await persistence.listSteps(outreach.workflowRunId);
  const draftStep = steps.find((step) => step.stepType === "draft");
  if (draftStep === undefined) {
    throw new Error(`Workflow step "draft" was not found.`);
  }

  await persistence.insertTokenUsage({
    workflowRunId: outreach.workflowRunId,
    workflowStepId: draftStep.workflowStepId,
    agentType: "outreach",
    modelName: revised.usage.modelName,
    promptTokens: revised.usage.promptTokens,
    completionTokens: revised.usage.completionTokens,
    estimatedCost: String(revised.usage.estimatedCost),
  });

  return {
    status: "revised",
    subject: revised.subject,
    body: revised.body,
  };
}
