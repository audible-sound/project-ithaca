/**
 * Desk facts for the home dashboard (`GET /dashboard`).
 * Filters and attention layout are applied on the client.
 */

import type { LeadFollowUpIndicator, LeadListStage } from "./leads.js";

/** One lead row with the latest outreach and workflow-run facts. */
export interface DashboardLead {
  leadId: string;
  companyName: string;
  /** User who created the lead. Null when the lead has no owner. */
  ownerId: string | null;
  ownerName: string | null;
  /** Qualification score. Null until the lead is qualified. */
  score: number | null;
  /** Same stage value as the leads table. */
  stage: LeadListStage;
  /** True when the Follow-up column shows Due. */
  followUpDue: boolean;
  followUpIndicator: LeadFollowUpIndicator;
  /** Latest outreach draft status. Null when there is no draft. */
  outreachStatus: string | null;
  /** Latest delivery status. Null when no delivery exists. */
  deliveryStatus: string | null;
  /** Latest workflow run that includes this lead. Null when never run. */
  workflowRunId: string | null;
  /** Stage of that run lead. Null when never run. */
  runLeadStage: string | null;
  /** Status of that run lead. Null when never run. */
  runLeadStatus: string | null;
  /** Error on that run lead. Null when none. */
  runLeadError: string | null;
}

/** Token totals for one workflow run. */
export interface DashboardUsageRow {
  workflowRunId: string;
  promptTokens: number;
  completionTokens: number;
  /** Estimated cost in dollars. */
  estimatedCost: number;
}

/** Body of `GET /dashboard`. */
export interface DashboardResponse {
  leads: DashboardLead[];
  usage: DashboardUsageRow[];
}
