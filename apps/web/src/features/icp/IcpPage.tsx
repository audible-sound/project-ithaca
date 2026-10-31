import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, type ReactElement } from "react";
import { Link } from "react-router";
import { IcpTable } from "./components/IcpTable";
import { useIcpStore } from "../../stores/icpStore";

export function IcpPage(): ReactElement {
  const profiles = useIcpStore((state) => state.profiles);
  const listStatus = useIcpStore((state) => state.listStatus);
  const listMessage = useIcpStore((state) => state.listMessage);
  const activeMessage = useIcpStore((state) => state.activeMessage);
  const loadProfiles = useIcpStore((state) => state.loadProfiles);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h1">Ideal Customer Profiles</Typography>
        <Button component={Link} to="/icp/new" variant="contained">
          New profile
        </Button>
      </Stack>
      {listStatus === "error" && listMessage ? (
        <Alert severity="error">{listMessage}</Alert>
      ) : null}
      {activeMessage ? <Alert severity="error">{activeMessage}</Alert> : null}
      <IcpTable profiles={profiles} status={listStatus} />
    </Stack>
  );
}
