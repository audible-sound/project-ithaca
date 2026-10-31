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
import { useAuthStore } from "../../../stores/authStore";
import { useLeadStore } from "../../../stores/leadStore";
import {
  TablePaginationBar,
  tablePageSize,
  useTablePage,
} from "../../../components/TablePaginationBar";
import type { RequestStatus } from "../../../stores/api";
import { capitalize } from "../../../utils/string";
import { leadStageLabel } from "../leadLabels";
import { LeadDeleteDialog } from "./LeadDeleteDialog";

type LeadTableProps = {
  leads: LeadListItem[];
  status: RequestStatus;
  emptyLabel: string;
};

type ScoreDirection = "asc" | "desc";

function sourceLabel(lead: LeadListItem): string {
  return lead.sourceType === "manual" ? "Manual" : "Website";
}

function icpLabel(lead: LeadListItem): string {
  if (lead.icps.length === 0) {
    return "—";
  }

  return lead.icps.map((icp) => icp.name).join(", ");
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

export function LeadTable({
  leads,
  status,
  emptyLabel,
}: LeadTableProps): ReactElement | null {
  const userId = useAuthStore((state) => state.userId);
  const deleteLead = useLeadStore((state) => state.deleteLead);
  const [scoreDirection, setScoreDirection] = useState<ScoreDirection>("desc");
  const [pending, setPending] = useState<LeadListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const listKey = leads
    .map((lead) => lead.leadId)
    .sort()
    .join(",");
  const { page, setPage } = useTablePage(listKey, leads.length);

  async function onConfirmDelete(): Promise<void> {
    if (!pending) {
      return;
    }

    setDeleting(true);
    await deleteLead(pending.leadId);
    setDeleting(false);
    setPending(null);
  }

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
          {emptyLabel}
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
                <TableCell>ICP</TableCell>
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
                  <TableCell>{icpLabel(lead)}</TableCell>
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
                    {lead.ownerId !== null && lead.ownerId === userId ? (
                      <Button
                        size="small"
                        component={Link}
                        to={`/leads/${lead.leadId}/edit`}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Button size="small" disabled>
                        Edit
                      </Button>
                    )}
                    {lead.ownerId !== null && lead.ownerId === userId ? (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setPending(lead);
                        }}
                      >
                        Delete
                      </Button>
                    ) : (
                      <Button size="small" color="error" disabled>
                        Delete
                      </Button>
                    )}
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
      {pending ? (
        <LeadDeleteDialog
          open
          companyName={pending.companyName}
          deleting={deleting}
          onCancel={() => {
            if (!deleting) {
              setPending(null);
            }
          }}
          onConfirm={() => {
            void onConfirmDelete();
          }}
        />
      ) : null}
    </Paper>
  );
}
