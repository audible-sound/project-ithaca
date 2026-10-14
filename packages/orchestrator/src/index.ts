import {
  draftOutreach,
  identifyLeads,
  qualifyLeads,
  summarizeLeads,
} from "@ithaca/agents";
import type {
  AgentStageResult,
  LeadWorkflowInput,
  LeadWorkflowResult,
} from "@ithaca/shared";

/**
 * Sequential lead workflow shell (identify → qualify → summarize → draft).
 * Stub implementation without ADK runtime; real SequentialAgent wiring comes later.
 */
export async function runLeadWorkflow(
  input: LeadWorkflowInput,
): Promise<LeadWorkflowResult> {
  const stages: AgentStageResult[] = [];

  const pipeline = [
    () => identifyLeads(input.icp),
    () => qualifyLeads(input.icp),
    () => summarizeLeads(input.icp),
    () => draftOutreach(input.icp),
  ] as const;

  for (const step of pipeline) {
    const result = await step();
    stages.push(result);
    if (result.status === "failed") {
      return { status: "failed", stages };
    }
  }

  return { status: "completed", stages };
}
