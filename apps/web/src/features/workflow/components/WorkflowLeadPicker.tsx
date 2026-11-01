import type { LeadSummary } from "@ithaca/shared";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
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
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement } from "react";
import {
  TablePaginationBar,
  tablePageSize,
  useTablePage,
} from "../../../components/TablePaginationBar";
import type { RequestStatus } from "../../../stores/api";
import { workflowLabel } from "../workflowLabels";

const allValue = "all";
const noneIcpValue = "none";

type WorkflowLeadPickerProps = {
  leads: LeadSummary[];
  leadIds: string[];
  status: RequestStatus;
  onToggleLead: (leadId: string) => void;
};

type FilterOption = {
  value: string;
  label: string;
};

function matchesName(lead: LeadSummary, nameQuery: string): boolean {
  const query = nameQuery.trim().toLowerCase();
  if (query.length === 0) {
    return true;
  }

  return lead.companyName.toLowerCase().includes(query);
}

function matchesSource(lead: LeadSummary, sourceFilter: string): boolean {
  return sourceFilter === allValue || lead.sourceType === sourceFilter;
}

function matchesIcp(lead: LeadSummary, icpFilter: string): boolean {
  if (icpFilter === allValue) {
    return true;
  }

  if (icpFilter === noneIcpValue) {
    return lead.icps.length === 0;
  }

  return lead.icps.some((icp) => icp.icpId === icpFilter);
}

function icpLabel(lead: LeadSummary): string {
  if (lead.icps.length === 0) {
    return "—";
  }

  return lead.icps.map((icp) => icp.name).join(", ");
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}): ReactElement {
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

const headerCellSx = {
  bgcolor: "secondary.main",
  "& .MuiTableCell-root": {
    color: "background.paper",
    fontWeight: 500,
  },
} as const;

export function WorkflowLeadPicker({
  leads,
  leadIds,
  status,
  onToggleLead,
}: WorkflowLeadPickerProps): ReactElement {
  const [nameQuery, setNameQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState(allValue);
  const [icpFilter, setIcpFilter] = useState(allValue);

  const icps = new Map<string, string>();
  for (const lead of leads) {
    for (const icp of lead.icps) {
      if (!icps.has(icp.icpId)) {
        icps.set(icp.icpId, icp.name);
      }
    }
  }

  const icpOptions: FilterOption[] = [
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
  const sourceOptions: FilterOption[] = [
    { value: "manual", label: workflowLabel("manual") },
    { value: "identified", label: workflowLabel("identified") },
  ];

  const filteredLeads = leads.filter(
    (lead) =>
      matchesName(lead, nameQuery) &&
      matchesSource(lead, sourceFilter) &&
      matchesIcp(lead, icpFilter),
  );

  const listKey = filteredLeads
    .map((lead) => lead.leadId)
    .sort()
    .join(",");
  const { page, setPage } = useTablePage(listKey, filteredLeads.length);
  const pageRows = filteredLeads.slice(
    page * tablePageSize,
    page * tablePageSize + tablePageSize,
  );

  const showEmpty =
    status === "ready" && (leads.length === 0 || filteredLeads.length === 0);
  const emptyLabel =
    leads.length === 0 ? "No leads yet." : "No leads match these filters.";

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Leads to include</Typography>
      <TextField
        size="small"
        label="Name"
        placeholder="Search by company name"
        value={nameQuery}
        onChange={(event) => {
          setNameQuery(event.target.value);
        }}
        sx={{
          width: 360,
          maxWidth: "100%",
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
          },
        }}
      />
      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}
      >
        <FilterSelect
          id="workflow-lead-source-filter-label"
          label="Source"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={sourceOptions}
        />
        <FilterSelect
          id="workflow-lead-icp-filter-label"
          label="ICP"
          value={icpFilter}
          onChange={setIcpFilter}
          options={icpOptions}
        />
      </Stack>
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        {showEmpty ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
            {emptyLabel}
          </Typography>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow sx={headerCellSx}>
                  <TableCell padding="checkbox" />
                  <TableCell>Company</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>ICP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((lead) => (
                  <TableRow key={lead.leadId} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={leadIds.includes(lead.leadId)}
                        onChange={() => {
                          onToggleLead(lead.leadId);
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{lead.companyName}</TableCell>
                    <TableCell>{workflowLabel(lead.sourceType)}</TableCell>
                    <TableCell>{icpLabel(lead)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredLeads.length > 0 ? (
              <TablePaginationBar
                count={filteredLeads.length}
                page={page}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Paper>
      {leadIds.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          {leadIds.length === 1
            ? "1 lead selected."
            : `${leadIds.length} leads selected.`}
        </Typography>
      ) : null}
      <FormHelperText sx={{ mx: 0 }}>
        Leaving every box unchecked identifies companies from the profile.
      </FormHelperText>
    </Stack>
  );
}
