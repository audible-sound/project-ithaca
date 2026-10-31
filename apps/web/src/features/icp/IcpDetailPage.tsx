import ArrowBack from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type ReactElement } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useIcpStore } from "../../stores/icpStore";
import { IcpCriteria } from "./components/IcpCriteria";
import { IcpDeleteDialog } from "./components/IcpDeleteDialog";

const linkSx = {
  color: "primary.main",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 0.5,
  width: "fit-content",
  "&:hover": { textDecoration: "underline" },
} as const;

export function IcpDetailPage(): ReactElement {
  const { icpId } = useParams();
  const navigate = useNavigate();
  const profile = useIcpStore((state) => state.profile);
  const detailStatus = useIcpStore((state) => state.detailStatus);
  const detailMessage = useIcpStore((state) => state.detailMessage);
  const loadProfile = useIcpStore((state) => state.loadProfile);
  const deleteProfile = useIcpStore((state) => state.deleteProfile);
  const deleteMessage = useIcpStore((state) => state.deleteMessage);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const visibleProfile =
    profile && icpId && profile.icpId === icpId ? profile : null;

  useEffect(() => {
    if (!icpId) {
      return;
    }
    void loadProfile(icpId);
  }, [icpId, loadProfile]);

  async function onDelete(): Promise<void> {
    if (!icpId) {
      return;
    }

    setDeleting(true);
    const deleted = await deleteProfile(icpId);
    if (deleted) {
      navigate("/icp");
      return;
    }

    setDeleting(false);
    setConfirmOpen(false);
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="body2" component={Link} to="/icp" sx={linkSx}>
          <ArrowBack fontSize="inherit" />
          Back
        </Typography>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: "baseline" }}>
            <Typography variant="h1">
              {visibleProfile ? visibleProfile.name : "Ideal customer profile"}
            </Typography>
            {visibleProfile ? (
              <Typography
                variant="body2"
                component="span"
                sx={{
                  color: visibleProfile.isActive
                    ? "success.main"
                    : "text.secondary",
                }}
              >
                {visibleProfile.isActive ? "Active" : "Inactive"}
              </Typography>
            ) : null}
          </Stack>
          {visibleProfile ? (
            <Button
              variant="outlined"
              color="error"
              disabled={deleting}
              onClick={() => {
                setConfirmOpen(true);
              }}
            >
              Delete
            </Button>
          ) : null}
        </Stack>
      </Stack>
      {detailStatus === "error" && detailMessage ? (
        <Alert severity="error">{detailMessage}</Alert>
      ) : null}
      {deleteMessage ? <Alert severity="error">{deleteMessage}</Alert> : null}
      {visibleProfile ? <IcpCriteria profile={visibleProfile} /> : null}
      {visibleProfile ? (
        <IcpDeleteDialog
          open={confirmOpen}
          name={visibleProfile.name}
          deleting={deleting}
          onCancel={() => {
            setConfirmOpen(false);
          }}
          onConfirm={() => {
            void onDelete();
          }}
        />
      ) : null}
    </Stack>
  );
}
