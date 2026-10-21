import { generateText } from "@ithaca/ai-model";
import type { AgentStageResult, IdealCustomerProfileInput } from "@ithaca/shared";

export async function qualifyLeads(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  await generateText({
    prompt: `Qualify leads against ICP: ${icp.name}`,
  });

  return {
    stage: "qualify",
    status: "completed",
    message: "Lead qualification stub completed",
  };
}
