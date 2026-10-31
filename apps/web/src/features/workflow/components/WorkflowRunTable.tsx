import type { IdealCustomerProfile, WorkflowRunSummary } from "@ithaca/shared";
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
import {
  TablePaginationBar,
  tablePageSize,
  useTablePage,
} from "../../../components/TablePaginationBar";
import type { RequestStatus } from "../../../stores/api";
import { formatWorkflowTime } from "../workflowLabels";
import { WorkflowStatusText } from "./WorkflowStatusText";

type WorkflowRunTableProps = {
  runs: WorkflowRunSummary[];
  profiles: IdealCustomerProfile[];
  status: RequestStatus;
};

const headerCellSx = {
  bgcolor: "secondary.main",
  "& .MuiTableCell-root": {
    color: "background.paper",
    fontWeight: 500,
  },
} as const;

function profileName(
  icpId: string,
  profiles: IdealCustomerProfile[],
): string {
  return profiles.find((profile) => profile.icpId === icpId)?.name ?? icpId;
}

export function WorkflowRunTable({
  runs,
  profiles,
  status,
}: WorkflowRunTableProps): ReactElement | null {
  const listKey = runs
    .map((run) => run.workflowRunId)
    .sort()
    .join(",");
  const { page, setPage } = useTablePage(listKey, runs.length);

  if (status === "error" && runs.length === 0) {
    return null;
  }

  const showEmpty = status === "ready" && runs.length === 0;
  const pageRuns = runs.slice(
    page * tablePageSize,
    page * tablePageSize + tablePageSize,
  );

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      {showEmpty ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          No workflow runs yet.
        </Typography>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow sx={headerCellSx}>
                <TableCell>Started</TableCell>
                <TableCell>Profile</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRuns.map((run) => (
                <TableRow key={run.workflowRunId}>
                  <TableCell>{formatWorkflowTime(run.startedAt)}</TableCell>
                  <TableCell>{profileName(run.icpId, profiles)}</TableCell>
                  <TableCell>
                    <WorkflowStatusText status={run.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      component={Link}
                      to={`/workflow/${run.workflowRunId}`}
                      variant="text"
                      size="small"
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {runs.length > 0 ? (
            <TablePaginationBar
              count={runs.length}
              page={page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </Paper>
  );
}
