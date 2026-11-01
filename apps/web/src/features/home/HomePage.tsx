import { leadListStages } from "@ithaca/shared";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { useDashboardStore } from "../../stores/dashboardStore";
import { leadStageLabel } from "../leads/leadLabels";
import {
  buildDashboardView,
  dashboardAllValue,
  dashboardDueFollowUpValue,
  dashboardNotDueFollowUpValue,
  ownerOptionsFromLeads,
  type DashboardFilters,
} from "./dashboardView";

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: FilterSelectProps): ReactElement {
  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <MenuItem value={dashboardAllValue}>All</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function HomePage(): ReactElement {
  const leads = useDashboardStore((state) => state.leads);
  const usage = useDashboardStore((state) => state.usage);
  const status = useDashboardStore((state) => state.status);
  const message = useDashboardStore((state) => state.message);
  const loadDashboard = useDashboardStore((state) => state.loadDashboard);
  const [filters, setFilters] = useState<DashboardFilters>({
    owner: dashboardAllValue,
    stage: dashboardAllValue,
    followUp: dashboardAllValue,
  });

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const view = buildDashboardView(leads, usage, filters);
  const ownerOptions = ownerOptionsFromLeads(leads);
  const stageOptions = leadListStages.map((stage) => ({
    value: stage,
    label: leadStageLabel(stage),
  }));
  const followUpOptions = [
    { value: dashboardDueFollowUpValue, label: "Due" },
    { value: dashboardNotDueFollowUpValue, label: "Not due" },
  ];

  function setOwnerFilter(value: string): void {
    setFilters((current) => ({ ...current, owner: value }));
  }

  function setStageFilter(value: string): void {
    setFilters((current) => ({ ...current, stage: value }));
  }

  function setFollowUpFilter(value: string): void {
    setFilters((current) => ({ ...current, followUp: value }));
  }

  function toggleStageButton(stage: string): void {
    setStageFilter(filters.stage === stage ? dashboardAllValue : stage);
  }

  function toggleOwnerLine(ownerFilterValue: string): void {
    setOwnerFilter(
      filters.owner === ownerFilterValue
        ? dashboardAllValue
        : ownerFilterValue,
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h1">Dashboard</Typography>
      {status === "error" && message ? (
        <Alert severity="error">{message}</Alert>
      ) : null}

      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}
      >
        <FilterSelect
          id="dashboard-owner-filter-label"
          label="Owner"
          value={filters.owner}
          onChange={setOwnerFilter}
          options={ownerOptions}
        />
        <FilterSelect
          id="dashboard-stage-filter-label"
          label="Stage"
          value={filters.stage}
          onChange={setStageFilter}
          options={stageOptions}
        />
        <FilterSelect
          id="dashboard-follow-up-filter-label"
          label="Follow-up"
          value={filters.followUp}
          onChange={setFollowUpFilter}
          options={followUpOptions}
        />
      </Stack>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Typography variant="h2" sx={{ mb: 2 }}>
          Needs attention
        </Typography>
        {view.attention.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing needs attention.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {view.attention.map((item) => (
              <Typography
                key={item.leadId}
                component={Link}
                to={item.href}
                variant="body2"
                sx={{
                  color: "text.primary",
                  textDecoration: "none",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {item.ownerName} · {item.companyName} · {item.reason}
              </Typography>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Typography variant="h2" sx={{ mb: 2 }}>
          Stage counts
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {view.stageCounts.map((entry) => {
            const selected = filters.stage === entry.stage;
            const label =
              entry.stage === "follow_up" && entry.dueCount > 0
                ? `${entry.count} · ${entry.dueCount} due`
                : String(entry.count);
            return (
              <Button
                key={entry.stage}
                size="small"
                variant={selected ? "contained" : "outlined"}
                onClick={() => {
                  toggleStageButton(entry.stage);
                }}
                sx={{ minWidth: 120 }}
              >
                <Stack spacing={0.25} sx={{ alignItems: "flex-start" }}>
                  <Typography variant="caption" component="span">
                    {leadStageLabel(entry.stage)}
                  </Typography>
                  <Typography variant="body2" component="span">
                    {label}
                  </Typography>
                </Stack>
              </Button>
            );
          })}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Typography variant="h2" sx={{ mb: 2 }}>
          By owner
        </Typography>
        {view.owners.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No leads.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {view.owners.map((owner) => {
              const parts = [`${owner.leadCount} leads`];
              if (owner.dueCount > 0) {
                parts.push(`${owner.dueCount} due`);
              }
              if (owner.failedCount > 0) {
                parts.push(`${owner.failedCount} failed`);
              }
              const selected = filters.owner === owner.ownerFilterValue;
              return (
                <Box
                  key={owner.ownerFilterValue}
                  component="button"
                  type="button"
                  onClick={() => {
                    toggleOwnerLine(owner.ownerFilterValue);
                  }}
                  sx={{
                    all: "unset",
                    cursor: "pointer",
                    color: selected ? "primary.main" : "text.primary",
                    "&:hover": { color: "primary.main" },
                  }}
                >
                  <Typography variant="body2">
                    {owner.name} · {parts.join(" · ")}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h2">Ranked leads</Typography>
          <Button component={Link} to={view.viewAllHref} size="small">
            View all
          </Button>
        </Stack>
        {view.ranked.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No ranked leads.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Company</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Follow-up</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {view.ranked.map((lead) => (
                <TableRow key={lead.leadId} hover>
                  <TableCell>
                    <Typography
                      component={Link}
                      to={`/leads/${lead.leadId}`}
                      variant="body2"
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {lead.companyName}
                    </Typography>
                  </TableCell>
                  <TableCell>{lead.ownerName}</TableCell>
                  <TableCell>{lead.score}</TableCell>
                  <TableCell>{leadStageLabel(lead.stage)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color: lead.followUpDue
                          ? "warning.main"
                          : "text.secondary",
                      }}
                    >
                      {lead.followUpDue ? "Due" : "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary">
        {view.usageCaption}
      </Typography>
    </Stack>
  );
}
