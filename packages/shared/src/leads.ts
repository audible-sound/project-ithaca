export interface LeadSummary {
  leadId: string;
  companyName: string;
  sourceType: "manual" | "identified";
}

export interface ListLeadsResponse {
  leads: LeadSummary[];
}

export const leadListStages = [
  "not_started",
  "identify",
  "qualify",
  "summarize",
  "draft",
  "done",
  "follow_up",
  "closed",
] as const;
export type LeadListStage = (typeof leadListStages)[number];

export const leadPriorities = ["high", "medium", "low"] as const;
export type LeadPriority = (typeof leadPriorities)[number];

export interface LeadListItem {
  leadId: string;
  companyName: string;
  ownerId: string | null;
  ownerName: string | null;
  contactName: string | null;
  sourceType: "manual" | "identified";
  score: number | null;
  priority: LeadPriority | null;
  stage: LeadListStage;
  followUpDue: boolean;
}

export interface ListLeadListResponse {
  leads: LeadListItem[];
}
