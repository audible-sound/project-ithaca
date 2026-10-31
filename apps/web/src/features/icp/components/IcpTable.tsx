import type { IdealCustomerProfile } from "@ithaca/shared";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { Link } from "react-router";
import type { RequestStatus } from "../../../stores/api";
import { useIcpStore } from "../../../stores/icpStore";
import {
  companySizeText,
  industriesText,
  locationText,
} from "../icpLabels";

type IcpTableProps = {
  profiles: IdealCustomerProfile[];
  status: RequestStatus;
};

const nameLinkSx = {
  color: "primary.main",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
} as const;

export function IcpTable({
  profiles,
  status,
}: IcpTableProps): ReactElement | null {
  const setProfileActive = useIcpStore((state) => state.setProfileActive);
  const updatingIcpId = useIcpStore((state) => state.updatingIcpId);

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
                <TableCell>
                  <Typography
                    variant="body2"
                    component={Link}
                    to={`/icp/${profile.icpId}`}
                    sx={nameLinkSx}
                  >
                    {profile.name}
                  </Typography>
                </TableCell>
                <TableCell>{industriesText(profile)}</TableCell>
                <TableCell>{locationText(profile)}</TableCell>
                <TableCell>{companySizeText(profile)}</TableCell>
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Switch
                      checked={profile.isActive}
                      size="small"
                      disabled={updatingIcpId === profile.icpId}
                      onChange={(_event, checked) => {
                        void setProfileActive(profile.icpId, checked);
                      }}
                      slotProps={{
                        input: {
                          "aria-label": profile.isActive
                            ? "Disable profile"
                            : "Activate profile",
                        },
                      }}
                    />
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        color: profile.isActive
                          ? "success.main"
                          : "text.secondary",
                      }}
                    >
                      {profile.isActive ? "Active" : "Inactive"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
