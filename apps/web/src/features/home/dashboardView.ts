import type {
  DashboardLead,
  DashboardUsageRow,
  LeadListStage,
} from "@ithaca/shared";

export const dashboardAllValue = "all";
export const dashboardUnassignedOwnerValue = "unassigned";
export const dashboardDueFollowUpValue = "due";
export const dashboardNotDueFollowUpValue = "not_due";

export const dashboardStageButtons = [
  "identify",
  "qualify",
  "summarize",
  "draft",
  "follow_up",
] as const;

export type DashboardStageButton = (typeof dashboardStageButtons)[number];

export type DashboardFilters = {
  owner: string;
  stage: string;
  followUp: string;
};

export type DashboardAttentionReason =
  | "send_failed"
  | "stage_failed"
  | "draft_review"
  | "follow_up_due";

export type DashboardAttentionItem = {
  leadId: string;
  ownerName: string;
  companyName: string;
  reason: string;
  reasonKind: DashboardAttentionReason;
  href: string;
};

export type DashboardStageCount = {
  stage: DashboardStageButton;
  count: number;
  dueCount: number;
};

export type DashboardOwnerLine = {
  ownerId: string | null;
  ownerFilterValue: string;
  name: string;
  leadCount: number;
  dueCount: number;
  failedCount: number;
};

export type DashboardRankedLead = {
  leadId: string;
  companyName: string;
  ownerName: string;
  score: number;
  stage: LeadListStage;
  followUpDue: boolean;
};

export type DashboardView = {
  attention: DashboardAttentionItem[];
  stageCounts: DashboardStageCount[];
  owners: DashboardOwnerLine[];
  ranked: DashboardRankedLead[];
  usageCaption: string;
  viewAllHref: string;
};

function ownerFilterValue(ownerId: string | null): string {
  return ownerId ?? dashboardUnassignedOwnerValue;
}

function ownerDisplayName(lead: DashboardLead): string {
  return lead.ownerName ?? "Unassigned";
}

function matchesOwner(lead: DashboardLead, ownerFilter: string): boolean {
  return (
    ownerFilter === dashboardAllValue ||
    ownerFilterValue(lead.ownerId) === ownerFilter
  );
}

function matchesStage(lead: DashboardLead, stageFilter: string): boolean {
  return stageFilter === dashboardAllValue || lead.stage === stageFilter;
}

function matchesFollowUp(lead: DashboardLead, followUpFilter: string): boolean {
  if (followUpFilter === dashboardAllValue) {
    return true;
  }

  if (followUpFilter === dashboardDueFollowUpValue) {
    return lead.followUpDue;
  }

  return !lead.followUpDue;
}

function isSendFailed(lead: DashboardLead): boolean {
  return lead.deliveryStatus === "failed";
}

function isStageFailed(lead: DashboardLead): boolean {
  return lead.runLeadStatus === "failed";
}

function isDraftWaiting(lead: DashboardLead): boolean {
  return lead.outreachStatus === "draft" || lead.outreachStatus === "edited";
}

function attentionFor(lead: DashboardLead): DashboardAttentionItem | null {
  const ownerName = ownerDisplayName(lead);

  if (isSendFailed(lead)) {
    return {
      leadId: lead.leadId,
      ownerName,
      companyName: lead.companyName,
      reason: "Could not send. This draft was not delivered.",
      reasonKind: "send_failed",
      href: `/leads/${lead.leadId}`,
    };
  }

  if (isStageFailed(lead)) {
    const stage = lead.runLeadStage ?? "stage";
    const href =
      lead.workflowRunId !== null
        ? `/workflow/${lead.workflowRunId}`
        : `/leads/${lead.leadId}`;
    return {
      leadId: lead.leadId,
      ownerName,
      companyName: lead.companyName,
      reason: `${stage} failed`,
      reasonKind: "stage_failed",
      href,
    };
  }

  if (isDraftWaiting(lead)) {
    return {
      leadId: lead.leadId,
      ownerName,
      companyName: lead.companyName,
      reason: "Draft waiting for review",
      reasonKind: "draft_review",
      href: `/leads/${lead.leadId}`,
    };
  }

  if (lead.followUpDue) {
    return {
      leadId: lead.leadId,
      ownerName,
      companyName: lead.companyName,
      reason: "Follow-up due",
      reasonKind: "follow_up_due",
      href: `/leads/${lead.leadId}`,
    };
  }

  return null;
}

function isFailed(lead: DashboardLead): boolean {
  return isSendFailed(lead) || isStageFailed(lead);
}

function formatTokens(value: number): string {
  return value.toLocaleString("en-US");
}

function formatCost(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function viewAllHref(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.owner !== dashboardAllValue) {
    params.set("owner", filters.owner);
  }
  if (filters.stage !== dashboardAllValue) {
    params.set("stage", filters.stage);
  }
  if (filters.followUp !== dashboardAllValue) {
    params.set("followUp", filters.followUp);
  }
  const query = params.toString();
  return query.length > 0 ? `/leads?${query}` : "/leads";
}

export function buildDashboardView(
  leads: DashboardLead[],
  usage: DashboardUsageRow[],
  filters: DashboardFilters,
): DashboardView {
  const filtered = leads.filter(
    (lead) =>
      matchesOwner(lead, filters.owner) &&
      matchesStage(lead, filters.stage) &&
      matchesFollowUp(lead, filters.followUp),
  );

  const attention: DashboardAttentionItem[] = [];
  const attentionIds = new Set<string>();
  for (const lead of filtered) {
    const item = attentionFor(lead);
    if (item === null) {
      continue;
    }
    attention.push(item);
    attentionIds.add(lead.leadId);
  }

  const stageCounts: DashboardStageCount[] = dashboardStageButtons.map(
    (stage) => {
      const inStage = filtered.filter((lead) => lead.stage === stage);
      return {
        stage,
        count: inStage.length,
        dueCount: inStage.filter((lead) => lead.followUpDue).length,
      };
    },
  );

  const ownersByKey = new Map<string, DashboardOwnerLine>();
  for (const lead of filtered) {
    const key = ownerFilterValue(lead.ownerId);
    const existing = ownersByKey.get(key);
    if (existing === undefined) {
      ownersByKey.set(key, {
        ownerId: lead.ownerId,
        ownerFilterValue: key,
        name: ownerDisplayName(lead),
        leadCount: 1,
        dueCount: lead.followUpDue ? 1 : 0,
        failedCount: isFailed(lead) ? 1 : 0,
      });
      continue;
    }

    existing.leadCount += 1;
    if (lead.followUpDue) {
      existing.dueCount += 1;
    }
    if (isFailed(lead)) {
      existing.failedCount += 1;
    }
  }

  const owners = [...ownersByKey.values()].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) {
      return byName;
    }
    return a.ownerFilterValue.localeCompare(b.ownerFilterValue);
  });

  const ranked = filtered
    .filter(
      (lead) =>
        lead.score !== null &&
        lead.stage !== "closed" &&
        !attentionIds.has(lead.leadId),
    )
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 5)
    .map((lead) => ({
      leadId: lead.leadId,
      companyName: lead.companyName,
      ownerName: ownerDisplayName(lead),
      score: lead.score as number,
      stage: lead.stage,
      followUpDue: lead.followUpDue,
    }));

  const runIds = new Set(
    filtered
      .map((lead) => lead.workflowRunId)
      .filter((id): id is string => id !== null),
  );
  let promptTokens = 0;
  let completionTokens = 0;
  let estimatedCost = 0;
  for (const row of usage) {
    if (!runIds.has(row.workflowRunId)) {
      continue;
    }
    promptTokens += row.promptTokens;
    completionTokens += row.completionTokens;
    estimatedCost += row.estimatedCost;
  }
  const totalTokens = promptTokens + completionTokens;
  const usageCaption = `${formatTokens(totalTokens)} tokens · Estimated cost ${formatCost(estimatedCost)}`;

  return {
    attention,
    stageCounts,
    owners,
    ranked,
    usageCaption,
    viewAllHref: viewAllHref(filters),
  };
}

export function ownerOptionsFromLeads(
  leads: DashboardLead[],
): { value: string; label: string }[] {
  const owners = new Map<string, string>();
  for (const lead of leads) {
    const value = ownerFilterValue(lead.ownerId);
    if (!owners.has(value)) {
      owners.set(value, ownerDisplayName(lead));
    }
  }

  return [...owners.entries()]
    .sort((a, b) => {
      const byName = a[1].localeCompare(b[1]);
      if (byName !== 0) {
        return byName;
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([value, label]) => ({ value, label }));
}
