import type { IdealCustomerProfile } from "@ithaca/shared";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement, ReactNode } from "react";
import {
  budgetAmountText,
  businessNeedDescriptionText,
  businessNeedKeywordsText,
  companySizeText,
  industriesExcludeText,
  industriesText,
  locationText,
  messageConstraintsText,
  outreachToneText,
} from "../icpLabels";

type IcpCriteriaProps = {
  profile: IdealCustomerProfile;
};

type CriterionRowProps = {
  label: string;
  value: string;
  preserveLines?: boolean;
};

type SectionProps = {
  title: string;
  children: ReactNode;
};

function CriterionRow({
  label,
  value,
  preserveLines = false,
}: CriterionRowProps): ReactElement {
  return (
    <Stack direction="row" spacing={2}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 200, flexShrink: 0 }}
      >
        {label}:
      </Typography>
      <Typography
        variant="body2"
        sx={{ flex: 1, whiteSpace: preserveLines ? "pre-line" : "normal" }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function Section({ title, children }: SectionProps): ReactElement {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">{title}</Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Stack>
  );
}

export function IcpCriteria({ profile }: IcpCriteriaProps): ReactElement {
  const budgetAmount = budgetAmountText(profile);
  const budgetNotes = profile.budgetNotes;
  const budgetUnrestricted = budgetAmount === null && budgetNotes.length === 0;
  const keywords = businessNeedKeywordsText(profile);
  const description = businessNeedDescriptionText(profile);
  const businessNeedUnrestricted = keywords === null && description === null;

  return (
    <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
      <Stack spacing={3}>
        <Typography variant="h2">Criteria</Typography>
        <Section title="Industries">
          <CriterionRow label="Industries include" value={industriesText(profile)} />
          <CriterionRow
            label="Industries exclude"
            value={industriesExcludeText(profile)}
          />
        </Section>
        <Section title="Location">
          <CriterionRow label="Location" value={locationText(profile)} />
        </Section>
        <Section title="Company size">
          <CriterionRow label="Company size" value={companySizeText(profile)} />
        </Section>
        <Section title="Budget">
          {budgetUnrestricted ? (
            <CriterionRow label="Budget" value="Unrestricted" />
          ) : null}
          {budgetAmount ? (
            <CriterionRow label="Budget" value={budgetAmount} />
          ) : null}
          {budgetNotes.length > 0 ? (
            <CriterionRow label="Budget notes" value={budgetNotes} />
          ) : null}
        </Section>
        <Section title="Business need">
          {businessNeedUnrestricted ? (
            <CriterionRow label="Business need" value="Unrestricted" />
          ) : null}
          {keywords ? (
            <CriterionRow label="Business-need keywords" value={keywords} />
          ) : null}
          {description ? (
            <CriterionRow
              label="Business-need description"
              value={description}
              preserveLines
            />
          ) : null}
        </Section>
        <Section title="Outreach">
          <CriterionRow label="Outreach tone" value={outreachToneText(profile)} />
          <CriterionRow
            label="Message constraints"
            value={messageConstraintsText(profile)}
            preserveLines
          />
        </Section>
      </Stack>
    </Paper>
  );
}
