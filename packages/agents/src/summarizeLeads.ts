import { generateText } from "@ithaca/ai-model";
import type { AgentStageResult, IdealCustomerProfileInput } from "@ithaca/shared";

export async function summarizeLeads(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  await generateText({
    prompt: `Summarize leads for ICP: ${icp.name}`,
  });

  return {
    stage: "summarize",
    status: "completed",
    message: "Lead summary stub completed",
  };
}
