import { generateText } from "@ithaca/ai-model";
import type { AgentStageResult, IdealCustomerProfileInput } from "@ithaca/shared";

export async function draftOutreach(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  await generateText({
    prompt: `Draft outreach for ICP: ${icp.name} (tone: ${icp.outreachTone ?? "professional"})`,
  });

  return {
    stage: "draft",
    status: "completed",
    message: "Outreach draft stub completed",
  };
}
