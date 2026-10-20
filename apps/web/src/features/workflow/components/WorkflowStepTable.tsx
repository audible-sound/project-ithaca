import { workflowStepTypes } from "@ithaca/shared";
import type { WorkflowStep } from "@ithaca/shared";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { ReactElement } from "react";
import { workflowLabel } from "../workflowLabels";
import { WorkflowStatusText } from "./WorkflowStatusText";

type WorkflowStepTableProps = {
  steps: WorkflowStep[];
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

export function WorkflowStepTable({
  steps,
}: WorkflowStepTableProps): ReactElement {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <Table>
        <TableHead>
          <TableRow sx={headerCellSx}>
            <TableCell>Step</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Attempts</TableCell>
            <TableCell>Error</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orderedSteps(steps).map((step) => (
            <TableRow key={step.workflowStepId}>
              <TableCell>{workflowLabel(step.stepType)}</TableCell>
              <TableCell>
                <WorkflowStatusText status={step.status} />
              </TableCell>
              <TableCell>{step.attemptCount}</TableCell>
              <TableCell>{step.errorMessage ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
