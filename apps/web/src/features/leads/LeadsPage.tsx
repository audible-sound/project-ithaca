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
import { LeadTable } from "./components/LeadTable";

const allOwnersValue = "all";
const unassignedOwnerValue = "unassigned";

function ownerValue(ownerId: string | null): string {
  return ownerId ?? unassignedOwnerValue;
}

export function LeadsPage(): ReactElement {
  const leads = useLeadStore((state) => state.leads);
  const listStatus = useLeadStore((state) => state.listStatus);
  const listMessage = useLeadStore((state) => state.listMessage);
  const loadLeads = useLeadStore((state) => state.loadLeads);
  const [ownerFilter, setOwnerFilter] = useState(allOwnersValue);

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

  const filteredLeads =
    ownerFilter === allOwnersValue
      ? leads
      : leads.filter((lead) => ownerValue(lead.ownerId) === ownerFilter);

  const selectedOwnerName =
    ownerFilter === allOwnersValue ? null : (owners.get(ownerFilter) ?? null);

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
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {selectedOwnerName
            ? `Showing leads for ${selectedOwnerName}.`
            : "Showing all owners."}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="lead-owner-filter-label">Owner</InputLabel>
          <Select
            labelId="lead-owner-filter-label"
            label="Owner"
            value={ownerFilter}
            onChange={(event) => {
              setOwnerFilter(event.target.value);
            }}
          >
            <MenuItem value={allOwnersValue}>All</MenuItem>
            {[...owners.entries()].map(([value, name]) => (
              <MenuItem key={value} value={value}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <LeadTable leads={filteredLeads} status={listStatus} />
    </Stack>
  );
}
