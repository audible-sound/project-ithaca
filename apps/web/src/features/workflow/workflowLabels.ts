const labels: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
  identify: "Identify",
  qualify: "Qualify",
  summarize: "Summarize",
  draft: "Draft",
  done: "Done",
  manual: "Manual",
  identified: "Identified",
};

export function workflowLabel(value: string): string {
  return labels[value] ?? value;
}

export const noMatchingCompaniesMessage =
  "Lead identification completed with no matching companies.";

export function workflowStatusColor(
  status: string,
): "success.main" | "error.main" | "warning.main" | "text.secondary" {
  if (status === "completed") {
    return "success.main";
  }

  if (status === "failed") {
    return "error.main";
  }

  if (status === "running") {
    return "warning.main";
  }

  if (status === "skipped") {
    return "text.secondary";
  }

  return "text.secondary";
}

export const noLeadsReachedStepMessage = "No leads reached this step.";

const pipelineStageOrder = [
  "identify",
  "qualify",
  "summarize",
  "draft",
  "done",
] as const;

function pipelineStageIndex(stage: string): number {
  const index = (pipelineStageOrder as readonly string[]).indexOf(stage);
  return index < 0 ? 0 : index;
}

export type StepLeadProgress = {
  pending: number;
  running: number;
  finished: number;
  failed: number;
};

/**
 * Counts leads that have reached a workflow step.
 * Leads still on an earlier stage are left out.
 */
export function stepLeadProgress(
  stepType: string,
  leads: readonly { currentStage: string; status: string }[],
): StepLeadProgress {
  const stepIndex = pipelineStageIndex(stepType);
  let pending = 0;
  let running = 0;
  let finished = 0;
  let failed = 0;

  for (const lead of leads) {
    const leadIndex = pipelineStageIndex(lead.currentStage);
    if (leadIndex < stepIndex) {
      continue;
    }

    if (lead.currentStage === stepType) {
      if (lead.status === "pending") {
        pending += 1;
      } else if (lead.status === "running") {
        running += 1;
      } else if (lead.status === "failed") {
        failed += 1;
      } else {
        finished += 1;
      }
      continue;
    }

    finished += 1;
  }

  return { pending, running, finished, failed };
}

export function formatStepLeadProgress(progress: StepLeadProgress): string {
  const parts: string[] = [];
  if (progress.pending > 0) {
    parts.push(`${progress.pending} pending`);
  }
  if (progress.running > 0) {
    parts.push(`${progress.running} running`);
  }
  if (progress.finished > 0) {
    parts.push(`${progress.finished} finished`);
  }
  if (progress.failed > 0) {
    parts.push(`${progress.failed} failed`);
  }
  return parts.join(" · ");
}

export function formatWorkflowTime(value: string | null): string {
  if (!value) {
    return "Not started";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
