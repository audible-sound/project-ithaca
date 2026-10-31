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
  preserveLines?: boolean;
};

const linkSx = {
  color: "primary.main",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
} as const;

function FactRow({ label, children, preserveLines = false }: FactRowProps): ReactElement {
  return (
    <Stack direction="row" spacing={2}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 120, flexShrink: 0 }}
      >
        {label}:
      </Typography>
      <Typography
        variant="body2"
        component="div"
        sx={{ flex: 1, whiteSpace: preserveLines ? "pre-line" : "normal" }}
      >
        {children}
      </Typography>
    </Stack>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }): ReactElement {
  return (
    <Typography
      variant="body2"
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      sx={linkSx}
    >
      {children}
    </Typography>
  );
}

function MailLink({ email }: { email: string }): ReactElement {
  return (
    <Typography variant="body2" component="a" href={`mailto:${email}`} sx={linkSx}>
      {email}
    </Typography>
  );
}

function FactGroup({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">{title}</Typography>
      {children}
    </Stack>
  );
}

export function LeadFacts({ lead }: LeadFactsProps): ReactElement {
  const contact = lead.contact;

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
        <FactGroup title="Company">
          <Stack spacing={1.5}>
            <FactRow label="Company">{lead.companyName}</FactRow>
            {lead.website ? (
              <FactRow label="Website">
                <ExternalLink href={lead.website}>{lead.website}</ExternalLink>
              </FactRow>
            ) : null}
            {lead.companyEmail ? (
              <FactRow label="Email">
                <MailLink email={lead.companyEmail} />
              </FactRow>
            ) : null}
            {lead.companyPhone ? <FactRow label="Phone">{lead.companyPhone}</FactRow> : null}
            {lead.companyLinkedinUrl ? (
              <FactRow label="LinkedIn">
                <ExternalLink href={lead.companyLinkedinUrl}>
                  {lead.companyLinkedinUrl}
                </ExternalLink>
              </FactRow>
            ) : null}
            <FactRow label="Owner">{lead.ownerName ?? "—"}</FactRow>
            <FactRow label="Industry">{lead.industry ?? "—"}</FactRow>
            <FactRow label="Location">{lead.location ?? "—"}</FactRow>
            <FactRow label="Company size">
              {lead.companySizeBand ? `${lead.companySizeBand} employees` : "—"}
            </FactRow>
            {lead.description ? (
              <FactRow label="Description" preserveLines>
                {lead.description}
              </FactRow>
            ) : null}
            <FactRow label="Sources">
              {lead.sources.length === 0 ? (
                "—"
              ) : (
                <Stack spacing={0.5}>
                  {lead.sources.map((source, index) =>
                    source.sourceUrl ? (
                      <ExternalLink
                        key={`${source.sourceUrl}-${index}`}
                        href={source.sourceUrl}
                      >
                        {sourceLabel(source)}
                      </ExternalLink>
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
        </FactGroup>
        <FactGroup title="Contact">
          {contact ? (
            <Stack spacing={1.5}>
              <FactRow label="Name">{contact.fullName}</FactRow>
              {contact.jobTitle ? (
                <FactRow label="Job title">{contact.jobTitle}</FactRow>
              ) : null}
              {contact.email ? (
                <FactRow label="Email">
                  <MailLink email={contact.email} />
                </FactRow>
              ) : null}
              {contact.phone ? <FactRow label="Phone">{contact.phone}</FactRow> : null}
              {contact.linkedinUrl ? (
                <FactRow label="LinkedIn">
                  <ExternalLink href={contact.linkedinUrl}>{contact.linkedinUrl}</ExternalLink>
                </FactRow>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2">—</Typography>
          )}
        </FactGroup>
      </Stack>
    </Paper>
  );
}
