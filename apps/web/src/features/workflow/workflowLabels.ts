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

  return "text.secondary";
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
