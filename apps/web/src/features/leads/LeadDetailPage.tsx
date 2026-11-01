import ArrowBack from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, type ReactElement } from "react";
import { Link, useParams } from "react-router";
import { useLeadStore } from "../../stores/leadStore";
import { LeadFacts } from "./components/LeadFacts";
import { LeadPipeline } from "./components/LeadPipeline";

const linkSx = {
  color: "primary.main",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 0.5,
  width: "fit-content",
  "&:hover": { textDecoration: "underline" },
} as const;

export function LeadDetailPage(): ReactElement {
  const { leadId } = useParams();
  const lead = useLeadStore((state) => state.lead);
  const detailStatus = useLeadStore((state) => state.detailStatus);
  const detailMessage = useLeadStore((state) => state.detailMessage);
  const loadLead = useLeadStore((state) => state.loadLead);

  const visibleLead = lead && leadId && lead.leadId === leadId ? lead : null;

  useEffect(() => {
    if (!leadId) {
      return;
    }
    void loadLead(leadId);
  }, [leadId, loadLead]);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="body2" component={Link} to="/leads" sx={linkSx}>
          <ArrowBack fontSize="inherit" />
          Back
        </Typography>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography variant="h1">
            {visibleLead ? visibleLead.companyName : "Lead detail"}
          </Typography>
          <Button variant="contained" disabled>
            Follow up
          </Button>
        </Stack>
      </Stack>
      {detailStatus === "error" && detailMessage ? (
        <Alert severity="error">{detailMessage}</Alert>
      ) : null}
      {visibleLead ? (
        <>
          <LeadFacts lead={visibleLead} />
          <LeadPipeline lead={visibleLead} />
        </>
      ) : null}
    </Stack>
  );
}
