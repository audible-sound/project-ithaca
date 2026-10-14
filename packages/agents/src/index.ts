import { generateText } from "@ithaca/ai-model";
import { searchCompanies } from "@ithaca/exa";
import type { AgentStageResult, IdealCustomerProfileInput } from "@ithaca/shared";

export async function identifyLeads(
  icp: IdealCustomerProfileInput,
): Promise<AgentStageResult> {
  const results = await searchCompanies({
    industries: icp.industries,
    locations: icp.locations,
    keywords: icp.businessNeedKeywords,
  });

  await generateText({
    prompt: `Identify leads for ICP: ${icp.name}`,
  });

  return {
    stage: "identify",
    status: "completed",
    message: "Lead identification stub completed",
    data: { candidateCount: results.length },
  };
}

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
