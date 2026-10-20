import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, type ReactElement } from "react";
import { useParams } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { useIcpStore } from "../../stores/icpStore";
import { WorkflowLeadTable } from "./components/WorkflowLeadTable";
import { WorkflowStatusText } from "./components/WorkflowStatusText";
import { WorkflowStepTable } from "./components/WorkflowStepTable";
import { formatWorkflowTime } from "./workflowLabels";
import { useWorkflowStore } from "../../stores/workflowStore";

export function WorkflowRunPage(): ReactElement {
  const { workflowRunId } = useParams();
  const name = useAuthStore((state) => state.name);
  const profiles = useIcpStore((state) => state.profiles);
  const loadProfiles = useIcpStore((state) => state.loadProfiles);
  const run = useWorkflowStore((state) => state.run);
  const runStatus = useWorkflowStore((state) => state.runStatus);
  const runMessage = useWorkflowStore((state) => state.runMessage);
  const loadRun = useWorkflowStore((state) => state.loadRun);
  const leads = useWorkflowStore((state) => state.leads);
  const loadLeads = useWorkflowStore((state) => state.loadLeads);

  const visibleRun =
    run && workflowRunId && run.workflowRunId === workflowRunId ? run : null;

  useEffect(() => {
    if (!workflowRunId) {
      return;
    }

    void loadRun(workflowRunId);
    void loadLeads();
    void loadProfiles();
  }, [workflowRunId, loadRun, loadLeads, loadProfiles]);

  useEffect(() => {
    if (!workflowRunId || !visibleRun) {
      return;
    }

    if (visibleRun.status !== "pending" && visibleRun.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      void loadRun(workflowRunId);
      void loadLeads();
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [workflowRunId, visibleRun, loadRun, loadLeads]);

  const profileName = visibleRun
    ? (profiles.find((profile) => profile.icpId === visibleRun.icpId)?.name ??
      visibleRun.icpId)
    : "";

  const meta = [name, visibleRun ? formatWorkflowTime(visibleRun.startedAt) : ""]
    .filter((part) => part && part.length > 0)
    .join(" · ");

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">Workflow run</Typography>
        {visibleRun ? (
          <>
            <Typography variant="body1">{profileName}</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
              {meta ? (
                <Typography variant="body2" component="span" color="text.secondary">
                  {meta} ·
                </Typography>
              ) : null}
              <WorkflowStatusText status={visibleRun.status} />
            </Stack>
          </>
        ) : null}
      </Stack>
      {runStatus === "error" && runMessage ? (
        <Alert severity="error">{runMessage}</Alert>
      ) : null}
      {visibleRun ? (
        <>
          <WorkflowStepTable steps={visibleRun.steps} />
          {visibleRun.status === "failed" && visibleRun.errorMessage ? (
            <Alert severity="error">{visibleRun.errorMessage}</Alert>
          ) : null}
          <Stack spacing={2}>
            <Typography variant="h6">Leads in this run</Typography>
            <WorkflowLeadTable
              leads={visibleRun.leads}
              summaries={leads}
            />
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
