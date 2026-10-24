import type { LeadDetail, LeadSource } from "@ithaca/shared";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

type LeadFactsProps = {
  lead: LeadDetail;
};

function sourceProviderLabel(provider: string): string {
  if (provider === "exa") {
    return "Website";
  }
  if (provider === "manual") {
    return "Manual";
  }
  return "Other";
}

function sourceLabel(source: LeadSource): string {
  return `${sourceProviderLabel(source.sourceProvider)} · ${source.sourceTitle ?? source.sourceUrl ?? "—"}`;
}

type FactRowProps = {
  label: string;
  children: ReactElement | string;
};

function FactRow({ label, children }: FactRowProps): ReactElement {
  return (
    <Stack direction="row" spacing={2}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 120, flexShrink: 0 }}
      >
        {label}:
      </Typography>
      <Typography variant="body2" component="div" sx={{ flex: 1 }}>
        {children}
      </Typography>
    </Stack>
  );
}

export function LeadFacts({ lead }: LeadFactsProps): ReactElement {
  const contact = lead.contact;
  const contactLine = contact
    ? contact.email
      ? `${contact.fullName}, ${contact.email}`
      : contact.fullName
    : "—";

  return (
    <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography variant="h2">Retrieved facts</Typography>
          <Box>
            <Button size="small" disabled>
              Edit
            </Button>
            <Button size="small" color="error" disabled>
              Delete
            </Button>
          </Box>
        </Stack>
        <Stack spacing={1.5}>
          <FactRow label="Company">
            {lead.website ? (
              <Typography
                variant="body2"
                component="a"
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                {lead.companyName}
              </Typography>
            ) : (
              lead.companyName
            )}
          </FactRow>
          <FactRow label="Owner">{lead.ownerName ?? "—"}</FactRow>
          <FactRow label="Industry">{lead.industry ?? "—"}</FactRow>
          <FactRow label="Location">{lead.location ?? "—"}</FactRow>
          <FactRow label="Company size">
            {lead.companySizeBand ? `${lead.companySizeBand} employees` : "—"}
          </FactRow>
          <FactRow label="Contact">{contactLine}</FactRow>
          {contact?.jobTitle ? (
            <FactRow label="Job title">{contact.jobTitle}</FactRow>
          ) : null}
          {contact?.phone ? (
            <FactRow label="Phone">{contact.phone}</FactRow>
          ) : null}
          {contact?.linkedinUrl ? (
            <FactRow label="LinkedIn">
              <Typography
                variant="body2"
                component="a"
                href={contact.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                {contact.linkedinUrl}
              </Typography>
            </FactRow>
          ) : null}
          {lead.website ? (
            <FactRow label="Website">
              <Typography
                variant="body2"
                component="a"
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                {lead.website}
              </Typography>
            </FactRow>
          ) : null}
          {lead.description ? (
            <FactRow label="Description">{lead.description}</FactRow>
          ) : null}
          <FactRow label="Sources">
            {lead.sources.length === 0 ? (
              "—"
            ) : (
              <Stack spacing={0.5}>
                {lead.sources.map((source, index) =>
                  source.sourceUrl ? (
                    <Typography
                      key={`${source.sourceUrl}-${index}`}
                      variant="body2"
                      component="a"
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                    >
                      {sourceLabel(source)}
                    </Typography>
                  ) : (
                    <Typography key={`source-${index}`} variant="body2">
                      {sourceLabel(source)}
                    </Typography>
                  ),
                )}
              </Stack>
            )}
          </FactRow>
        </Stack>
      </Stack>
    </Paper>
  );
}