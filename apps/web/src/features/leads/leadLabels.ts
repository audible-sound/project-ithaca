import type { LeadListStage } from "@ithaca/shared";

const leadListStageLabels: Record<LeadListStage, string> = {
  not_started: "Not started",
  identify: "Identify",
  qualify: "Qualify",
  summarize: "Summarize",
  draft: "Draft",
  done: "Done",
  follow_up: "Follow-up",
  closed: "Closed",
};

export function leadStageLabel(stage: LeadListStage): string {
  return leadListStageLabels[stage];
}

export const companySizeBands = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;

export function companySizeLabel(band: string): string {
  return `${band} employees`;
}