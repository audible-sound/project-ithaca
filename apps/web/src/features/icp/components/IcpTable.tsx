import type { IdealCustomerProfile } from "@ithaca/shared";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { RequestStatus } from "../../../stores/api";

type IcpTableProps = {
  profiles: IdealCustomerProfile[];
  status: RequestStatus;
};

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

export function IcpTable({
  profiles,
  status,
}: IcpTableProps): ReactElement | null {
  if (status === "error" && profiles.length === 0) {
    return null;
  }

  const showEmpty = status === "ready" && profiles.length === 0;

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      {showEmpty ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          No ideal customer profiles yet.
        </Typography>
      ) : (
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
              <TableCell>Name</TableCell>
              <TableCell>Industries</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Company size</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.icpId}>
                <TableCell>{profile.name}</TableCell>
                <TableCell>{industriesText(profile)}</TableCell>
                <TableCell>{locationText(profile)}</TableCell>
                <TableCell>{companySizeText(profile)}</TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{
                      color: profile.isActive ? "success.main" : "text.secondary",
                    }}
                  >
                    {profile.isActive ? "Active" : "Inactive"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
