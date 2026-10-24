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