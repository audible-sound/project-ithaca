import { workflowStepTypes } from "@ithaca/shared";
import type {
  WorkflowRunLead,
  WorkflowRunStatus,
  WorkflowStep,
} from "@ithaca/shared";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import {
  formatStepLeadProgress,
  noLeadsReachedStepMessage,
  stepLeadProgress,
  workflowLabel,
} from "../workflowLabels";
import { WorkflowStatusText } from "./WorkflowStatusText";

type WorkflowStepTableProps = {
  steps: WorkflowStep[];
  leads: WorkflowRunLead[];
  runStatus: WorkflowRunStatus;
  onRetryIdentify?: () => void;
  retryDisabled?: boolean;
};

const headerCellSx = {
  bgcolor: "secondary.main",
  "& .MuiTableCell-root": {
    color: "background.paper",
    fontWeight: 500,
  },
} as const;

function orderedSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const order = new Map(workflowStepTypes.map((step, index) => [step, index]));
  return [...steps].sort(
    (left, right) =>
      (order.get(left.stepType) ?? 0) - (order.get(right.stepType) ?? 0),
  );
}

function stepProgressText(
  step: WorkflowStep,
  leads: WorkflowRunLead[],
): string {
  if (step.status === "skipped") {
    return noLeadsReachedStepMessage;
  }

  const progress = stepLeadProgress(step.stepType, leads);
  const total =
    progress.pending + progress.running + progress.finished + progress.failed;
  if (total === 0) {
    return "";
  }

  return formatStepLeadProgress(progress);
}

function canRetryIdentify(
  step: WorkflowStep,
  runStatus: WorkflowRunStatus,
): boolean {
  if (runStatus === "pending" || runStatus === "running") {
    return false;
  }
  return step.stepType === "identify" && step.status === "failed";
}

export function WorkflowStepTable({
  steps,
  leads,
  runStatus,
  onRetryIdentify,
  retryDisabled = false,
}: WorkflowStepTableProps): ReactElement {
  const showActions = orderedSteps(steps).some((step) =>
    canRetryIdentify(step, runStatus),
  );

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <Table>
        <TableHead>
          <TableRow sx={headerCellSx}>
            <TableCell>Step</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Leads</TableCell>
            <TableCell>Attempts</TableCell>
            <TableCell>Error</TableCell>
            {showActions ? <TableCell>Actions</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {orderedSteps(steps).map((step) => {
            const progressText = stepProgressText(step, leads);
            const showRetry = canRetryIdentify(step, runStatus);
            return (
              <TableRow key={step.workflowStepId}>
                <TableCell>{workflowLabel(step.stepType)}</TableCell>
                <TableCell>
                  <WorkflowStatusText status={step.status} />
                </TableCell>
                <TableCell>
                  {progressText ? (
                    <Typography
                      variant="body2"
                      color={
                        step.status === "skipped"
                          ? "text.secondary"
                          : "text.primary"
                      }
                    >
                      {progressText}
                    </Typography>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell>{step.attemptCount}</TableCell>
                <TableCell>{step.errorMessage ?? ""}</TableCell>
                {showActions ? (
                  <TableCell>
                    {showRetry && onRetryIdentify ? (
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={retryDisabled}
                        onClick={onRetryIdentify}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
