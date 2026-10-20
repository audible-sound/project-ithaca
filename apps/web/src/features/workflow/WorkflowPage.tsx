import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, type ReactElement } from "react";
import { Link } from "react-router";
import { useIcpStore } from "../../stores/icpStore";
import { WorkflowRunTable } from "./components/WorkflowRunTable";
import { useWorkflowStore } from "../../stores/workflowStore";

export function WorkflowPage(): ReactElement {
  const runs = useWorkflowStore((state) => state.runs);
  const listStatus = useWorkflowStore((state) => state.listStatus);
  const listMessage = useWorkflowStore((state) => state.listMessage);
  const loadRuns = useWorkflowStore((state) => state.loadRuns);
  const profiles = useIcpStore((state) => state.profiles);
  const loadProfiles = useIcpStore((state) => state.loadProfiles);

  useEffect(() => {
    void loadRuns();
    void loadProfiles();
  }, [loadRuns, loadProfiles]);

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h1">Workflow runs</Typography>
        <Button component={Link} to="/workflow/new" variant="contained">
          Start workflow
        </Button>
      </Stack>
      {listStatus === "error" && listMessage ? (
        <Alert severity="error">{listMessage}</Alert>
      ) : null}
      <WorkflowRunTable runs={runs} profiles={profiles} status={listStatus} />
    </Stack>
  );
}
