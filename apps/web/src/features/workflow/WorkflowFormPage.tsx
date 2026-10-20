import type { IdealCustomerProfile } from "@ithaca/shared";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type ReactElement, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useIcpStore } from "../../stores/icpStore";
import { workflowLabel } from "./workflowLabels";
import { useWorkflowStore } from "../../stores/workflowStore";

function industriesText(profile: IdealCustomerProfile): string {
  return profile.industries.length > 0
    ? profile.industries.join(", ")
    : "Unrestricted";
}

function locationText(profile: IdealCustomerProfile): string {
  const parts = [profile.country, profile.region, profile.city].filter(
    (part) => part.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : "Unrestricted";
}

function companySizeText(profile: IdealCustomerProfile): string {
  const { companySizeMin, companySizeMax } = profile;
  if (companySizeMin !== null && companySizeMax !== null) {
    return `${companySizeMin}–${companySizeMax}`;
  }

  if (companySizeMin !== null) {
    return `At least ${companySizeMin}`;
  }

  if (companySizeMax !== null) {
    return `At most ${companySizeMax}`;
  }

  return "Unrestricted";
}

export function WorkflowFormPage(): ReactElement {
  const navigate = useNavigate();
  const profiles = useIcpStore((state) => state.profiles);
  const listStatus = useIcpStore((state) => state.listStatus);
  const listMessage = useIcpStore((state) => state.listMessage);
  const loadProfiles = useIcpStore((state) => state.loadProfiles);
  const leads = useWorkflowStore((state) => state.leads);
  const leadStatus = useWorkflowStore((state) => state.leadStatus);
  const leadMessage = useWorkflowStore((state) => state.leadMessage);
  const loadLeads = useWorkflowStore((state) => state.loadLeads);
  const startStatus = useWorkflowStore((state) => state.startStatus);
  const startMessage = useWorkflowStore((state) => state.startMessage);
  const startRun = useWorkflowStore((state) => state.startRun);
  const clearStart = useWorkflowStore((state) => state.clearStart);
  const [icpId, setIcpId] = useState("");
  const [leadIds, setLeadIds] = useState<string[]>([]);

  const activeProfiles = profiles.filter((profile) => profile.isActive);
  const selected = activeProfiles.find((profile) => profile.icpId === icpId);

  useEffect(() => {
    clearStart();
    void loadProfiles();
    void loadLeads();
  }, [clearStart, loadProfiles, loadLeads]);

  function toggleLead(leadId: string): void {
    setLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    );
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void startRun({ icpId, leadIds }).then((workflowRunId) => {
      if (workflowRunId) {
        navigate(`/workflow/${workflowRunId}`);
      }
    });
  }

  const startDisabled =
    startStatus === "loading" ||
    listStatus === "loading" ||
    activeProfiles.length === 0;

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Typography variant="h1">Start workflow</Typography>
      {listStatus === "error" && listMessage ? (
        <Alert severity="error">{listMessage}</Alert>
      ) : null}
      {listStatus === "ready" && activeProfiles.length === 0 ? (
        <Alert severity="warning">
          Create an active ideal customer profile before starting a run.
        </Alert>
      ) : null}
      {leadStatus === "error" && leadMessage ? (
        <Alert severity="error">{leadMessage}</Alert>
      ) : null}
      <Paper
        component="form"
        elevation={0}
        onSubmit={handleSubmit}
        sx={{ p: 3, border: 1, borderColor: "divider" }}
      >
        <Stack spacing={3}>
          <Stack spacing={2}>
            <Typography variant="h6">Profile</Typography>
            <FormControl fullWidth disabled={activeProfiles.length === 0}>
              <InputLabel id="workflow-profile-label">Profile</InputLabel>
              <Select
                labelId="workflow-profile-label"
                label="Profile"
                value={icpId}
                onChange={(event) => {
                  setIcpId(event.target.value);
                }}
              >
                <MenuItem value="">Select a profile</MenuItem>
                {activeProfiles.map((profile) => (
                  <MenuItem key={profile.icpId} value={profile.icpId}>
                    {profile.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selected ? (
              <Typography variant="body2" color="text.secondary">
                {[
                  industriesText(selected),
                  locationText(selected),
                  companySizeText(selected),
                ].join(" · ")}
              </Typography>
            ) : null}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6">Leads to include</Typography>
            {leadStatus === "ready" && leads.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No leads yet.
              </Typography>
            ) : null}
            {leads.map((lead) => (
              <FormControlLabel
                key={lead.leadId}
                control={
                  <Checkbox
                    checked={leadIds.includes(lead.leadId)}
                    onChange={() => {
                      toggleLead(lead.leadId);
                    }}
                    size="small"
                  />
                }
                label={`${lead.companyName} · ${workflowLabel(lead.sourceType)}`}
              />
            ))}
            <FormHelperText sx={{ mx: 0 }}>
              Leaving every box unchecked identifies companies from the profile.
            </FormHelperText>
          </Stack>

          {startMessage ? (
            <Alert severity={startStatus === "ready" ? "success" : "error"}>
              {startMessage}
            </Alert>
          ) : null}
          <Stack direction="row" spacing={1}>
            <Button
              type="submit"
              variant="contained"
              disabled={startDisabled}
            >
              Start run
            </Button>
            <Button component={Link} to="/workflow" variant="text">
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
