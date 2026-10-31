import type { WorkflowRunLead } from "@ithaca/shared";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { workflowLabel } from "../workflowLabels";
import { WorkflowStatusText } from "./WorkflowStatusText";

type WorkflowLeadTableProps = {
  leads: WorkflowRunLead[];
  emptyMessage?: string;
};

const headerCellSx = {
  bgcolor: "secondary.main",
  "& .MuiTableCell-root": {
    color: "background.paper",
    fontWeight: 500,
  },
} as const;

export function WorkflowLeadTable({
  leads,
  emptyMessage = "No leads in this run.",
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

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <Table>
        <TableHead>
          <TableRow sx={headerCellSx}>
            <TableCell>Company</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Stage</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {leads.map((lead) => {
            return (
              <TableRow key={lead.leadId}>
                <TableCell>
                  {lead.companyName}
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
