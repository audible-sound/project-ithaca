import type { LeadListItem } from "@ithaca/shared";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import {
  TablePaginationBar,
  tablePageSize,
  useTablePage,
} from "../../../components/TablePaginationBar";
import type { RequestStatus } from "../../../stores/api";
import { capitalize } from "../../../utils/string";
import { leadStageLabel } from "../leadLabels";

type LeadTableProps = {
  leads: LeadListItem[];
  status: RequestStatus;
};

type ScoreDirection = "asc" | "desc";

function sourceLabel(lead: LeadListItem): string {
  return lead.sourceType === "manual" ? "Manual" : "Website";
}

function priorityLabel(lead: LeadListItem): string {
  if (lead.priority === null) {
    return "—";
  }

  return capitalize(lead.priority);
}

function sortedLeads(
  leads: LeadListItem[],
  direction: ScoreDirection,
): LeadListItem[] {
  return [...leads].sort((a, b) => {
    if (a.score === null && b.score === null) {
      return 0;
    }

    if (a.score === null) {
      return 1;
    }

    if (b.score === null) {
      return -1;
    }

    return direction === "desc" ? b.score - a.score : a.score - b.score;
  });
}

export function LeadTable({ leads, status }: LeadTableProps): ReactElement | null {
  const [scoreDirection, setScoreDirection] = useState<ScoreDirection>("desc");
  const listKey = leads
    .map((lead) => lead.leadId)
    .sort()
    .join(",");
  const { page, setPage } = useTablePage(listKey, leads.length);

  if (status === "error" && leads.length === 0) {
    return null;
  }

  const showEmpty = status === "ready" && leads.length === 0;
  const rows = sortedLeads(leads, scoreDirection);
  const pageRows = rows.slice(
    page * tablePageSize,
    page * tablePageSize + tablePageSize,
  );

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      {showEmpty ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          No leads yet.
        </Typography>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: "secondary.main",
                  "& .MuiTableCell-root": {
                    color: "background.paper",
                    fontWeight: 500,
                  },
                }}
              >
                <TableCell>Company</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>
                  <TableSortLabel
                    active
                    direction={scoreDirection}
                    onClick={() => {
                      setScoreDirection((current) =>
                        current === "desc" ? "asc" : "desc",
                      );
                      setPage(0);
                    }}
                    sx={{
                      color: "background.paper",
                      "&.Mui-active": { color: "background.paper" },
                      "& .MuiTableSortLabel-icon": {
                        color: "background.paper !important",
                      },
                    }}
                  >
                    Score
                  </TableSortLabel>
                </TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Follow-up</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((lead) => (
                <TableRow key={lead.leadId} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      component={Link}
                      to={`/leads/${lead.leadId}`}
                      sx={{
                        color: "primary.main",
                        textDecoration: "none",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      {lead.companyName}
                    </Typography>
                  </TableCell>
                  <TableCell>{lead.ownerName ?? "—"}</TableCell>
                  <TableCell>{lead.contactName ?? "—"}</TableCell>
                  <TableCell>{sourceLabel(lead)}</TableCell>
                  <TableCell>{lead.score ?? "—"}</TableCell>
                  <TableCell>{priorityLabel(lead)}</TableCell>
                  <TableCell>{leadStageLabel(lead.stage)}</TableCell>
                  <TableCell>
                    {lead.followUpDue ? (
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{ color: "warning.main" }}
                      >
                        Due
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="small" disabled>
                      Edit
                    </Button>
                    <Button size="small" color="error" disabled>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 0 ? (
            <TablePaginationBar
              count={rows.length}
              page={page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </Paper>
  );
}
