import { leadListStages, leadPriorities } from "@ithaca/shared";
import type { LeadListItem } from "@ithaca/shared";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type ReactElement } from "react";
import { useLeadStore } from "../../stores/leadStore";
import { capitalize } from "../../utils/string";
import { LeadTable } from "./components/LeadTable";
import { leadStageLabel } from "./leadLabels";

const allValue = "all";
const unassignedOwnerValue = "unassigned";
const noneIcpValue = "none";
const unscoredPriorityValue = "unscored";
const dueFollowUpValue = "due";
const notDueFollowUpValue = "not_due";

type FilterOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
};

function ownerValue(ownerId: string | null): string {
  return ownerId ?? unassignedOwnerValue;
}

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
        <MenuItem value={allValue}>All</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function matchesOwner(lead: LeadListItem, ownerFilter: string): boolean {
  return (
    ownerFilter === allValue || ownerValue(lead.ownerId) === ownerFilter
  );
}

function matchesIcp(lead: LeadListItem, icpFilter: string): boolean {
  if (icpFilter === allValue) {
    return true;
  }

  if (icpFilter === noneIcpValue) {
    return lead.icps.length === 0;
  }

  return lead.icps.some((icp) => icp.icpId === icpFilter);
}

function matchesStage(lead: LeadListItem, stageFilter: string): boolean {
  return stageFilter === allValue || lead.stage === stageFilter;
}

function matchesPriority(lead: LeadListItem, priorityFilter: string): boolean {
  if (priorityFilter === allValue) {
    return true;
  }

  if (priorityFilter === unscoredPriorityValue) {
    return lead.priority === null;
  }

  return lead.priority === priorityFilter;
}

function matchesSource(lead: LeadListItem, sourceFilter: string): boolean {
  return sourceFilter === allValue || lead.sourceType === sourceFilter;
}

function matchesFollowUp(lead: LeadListItem, followUpFilter: string): boolean {
  if (followUpFilter === allValue) {
    return true;
  }

  if (followUpFilter === dueFollowUpValue) {
    return lead.followUpDue;
  }

  return !lead.followUpDue;
}

export function LeadsPage(): ReactElement {
  const leads = useLeadStore((state) => state.leads);
  const listStatus = useLeadStore((state) => state.listStatus);
  const listMessage = useLeadStore((state) => state.listMessage);
  const loadLeads = useLeadStore((state) => state.loadLeads);
  const [ownerFilter, setOwnerFilter] = useState(allValue);
  const [icpFilter, setIcpFilter] = useState(allValue);
  const [stageFilter, setStageFilter] = useState(allValue);
  const [priorityFilter, setPriorityFilter] = useState(allValue);
  const [sourceFilter, setSourceFilter] = useState(allValue);
  const [followUpFilter, setFollowUpFilter] = useState(allValue);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const owners = new Map<string, string>();
  for (const lead of leads) {
    const value = ownerValue(lead.ownerId);
    if (!owners.has(value)) {
      owners.set(value, lead.ownerName ?? "Unassigned");
    }
  }

  const icps = new Map<string, string>();
  for (const lead of leads) {
    for (const icp of lead.icps) {
      if (!icps.has(icp.icpId)) {
        icps.set(icp.icpId, icp.name);
      }
    }
  }

  const ownerOptions = [...owners.entries()].map(([value, name]) => ({
    value,
    label: name,
  }));
  const icpOptions = [
    { value: noneIcpValue, label: "None" },
    ...[...icps.entries()]
      .sort((a, b) => {
        const byName = a[1].localeCompare(b[1]);
        if (byName !== 0) {
          return byName;
        }

        return a[0].localeCompare(b[0]);
      })
      .map(([value, name]) => ({ value, label: name })),
  ];
  const stageOptions = leadListStages.map((stage) => ({
    value: stage,
    label: leadStageLabel(stage),
  }));
  const priorityOptions = [
    ...leadPriorities.map((priority) => ({
      value: priority,
      label: capitalize(priority),
    })),
    { value: unscoredPriorityValue, label: "Unscored" },
  ];
  const sourceOptions = [
    { value: "manual", label: "Manual" },
    { value: "identified", label: "Website" },
  ];
  const followUpOptions = [
    { value: dueFollowUpValue, label: "Due" },
    { value: notDueFollowUpValue, label: "Not due" },
  ];

  const filteredLeads = leads.filter(
    (lead) =>
      matchesOwner(lead, ownerFilter) &&
      matchesIcp(lead, icpFilter) &&
      matchesStage(lead, stageFilter) &&
      matchesPriority(lead, priorityFilter) &&
      matchesSource(lead, sourceFilter) &&
      matchesFollowUp(lead, followUpFilter),
  );

  const filtersAtAll =
    ownerFilter === allValue &&
    icpFilter === allValue &&
    stageFilter === allValue &&
    priorityFilter === allValue &&
    sourceFilter === allValue &&
    followUpFilter === allValue;

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h1">Leads</Typography>
        <Button variant="contained" disabled>
          Add lead
        </Button>
      </Stack>
      {listStatus === "error" && listMessage ? (
        <Alert severity="error">{listMessage}</Alert>
      ) : null}
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {filtersAtAll
            ? "Showing all leads."
            : "Showing leads that match the selected filters."}
        </Typography>
        <Stack
          direction="row"
          sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}
        >
          <FilterSelect
            id="lead-owner-filter-label"
            label="Owner"
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={ownerOptions}
          />
          <FilterSelect
            id="lead-icp-filter-label"
            label="ICP"
            value={icpFilter}
            onChange={setIcpFilter}
            options={icpOptions}
          />
          <FilterSelect
            id="lead-stage-filter-label"
            label="Stage"
            value={stageFilter}
            onChange={setStageFilter}
            options={stageOptions}
          />
          <FilterSelect
            id="lead-priority-filter-label"
            label="Priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={priorityOptions}
          />
          <FilterSelect
            id="lead-source-filter-label"
            label="Source"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={sourceOptions}
          />
          <FilterSelect
            id="lead-follow-up-filter-label"
            label="Follow-up"
            value={followUpFilter}
            onChange={setFollowUpFilter}
            options={followUpOptions}
          />
        </Stack>
      </Stack>
      <LeadTable
        leads={filteredLeads}
        status={listStatus}
        emptyLabel={
          leads.length === 0
            ? "No leads yet."
            : "No leads match these filters."
        }
      />
    </Stack>
  );
}
