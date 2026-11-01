import type { WorkflowRunLead, WorkflowRunStatus } from "@ithaca/shared";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { Link } from "react-router";
import { workflowLabel } from "../workflowLabels";
import { WorkflowStatusText } from "./WorkflowStatusText";

type WorkflowLeadTableProps = {
  workflowRunId: string;
  leads: WorkflowRunLead[];
  runStatus: WorkflowRunStatus;
  emptyMessage?: string;
  onRetryLead?: (leadId: string) => void;
  retryDisabled?: boolean;
};

const headerCellSx = {
  bgcolor: "secondary.main",
  "& .MuiTableCell-root": {
    color: "background.paper",
    fontWeight: 500,
  },
} as const;

const retryableStages = new Set(["qualify", "summarize", "draft"]);

function canRetryLead(
  lead: WorkflowRunLead,
  runStatus: WorkflowRunStatus,
): boolean {
  if (runStatus === "pending" || runStatus === "running") {
    return false;
  }
  return lead.status === "failed" && retryableStages.has(lead.currentStage);
}

export function WorkflowLeadTable({
  workflowRunId,
  leads,
  runStatus,
  emptyMessage = "No leads in this run.",
  onRetryLead,
  retryDisabled = false,
}: WorkflowLeadTableProps): ReactElement {
  if (leads.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          {emptyMessage}
        </Typography>
      </Paper>
    );
  }

  const showActions = leads.some((lead) => canRetryLead(lead, runStatus));

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <Table>
        <TableHead>
          <TableRow sx={headerCellSx}>
            <TableCell>Company</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Stage</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Attempts</TableCell>
            {showActions ? <TableCell>Actions</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {leads.map((lead) => {
            const showRetry = canRetryLead(lead, runStatus);
            return (
              <TableRow key={lead.leadId}>
                <TableCell>
                  <Typography
                    variant="body2"
                    component={Link}
                    to={`/leads/${lead.leadId}`}
                    state={{ returnTo: `/workflow/${workflowRunId}` }}
                    sx={{
                      color: "primary.main",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {lead.companyName}
                  </Typography>
                  {lead.errorMessage ? (
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{ color: "error.main" }}
                    >
                      {lead.errorMessage}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{workflowLabel(lead.sourceType)}</TableCell>
                <TableCell>
                  <WorkflowStatusText status={lead.currentStage} />
                </TableCell>
                <TableCell>
                  <WorkflowStatusText status={lead.status} />
                </TableCell>
                <TableCell>{lead.attemptCount}</TableCell>
                {showActions ? (
                  <TableCell>
                    {showRetry && onRetryLead ? (
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={retryDisabled}
                        onClick={() => {
                          onRetryLead(lead.leadId);
                        }}
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
