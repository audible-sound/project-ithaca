export interface LeadSummary {
  leadId: string;
  companyName: string;
  sourceType: "manual" | "identified";
}

export interface ListLeadsResponse {
  leads: LeadSummary[];
}
