import type { LeadSummaryDetail } from "@ithaca/shared";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

type LeadReportProps = {
  summary: LeadSummaryDetail;
};

const interpretationPrefixes = ["Agent explanation:", "Evidence:"] as const;

function hasStructuredReport(summary: LeadSummaryDetail): boolean {
  return Boolean(
    summary.snapshot ||
      summary.whyItFits ||
      summary.gap ||
      summary.nextStep ||
      summary.company ||
      summary.contact ||
      summary.source ||
      summary.qualification,
  );
}

function showFact(value: string): string {
  return value.replaceAll("Missing.", "-");
}

function splitQualification(qualification: string | null): {
  facts: string[];
  interpretation: string[];
} {
  if (qualification === null || qualification.trim().length === 0) {
    return { facts: ["Qualification: —"], interpretation: [] };
  }

  const facts: string[] = [];
  const interpretation: string[] = [];
  for (const line of qualification.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (interpretationPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
      interpretation.push(trimmed);
    } else {
      facts.push(trimmed);
    }
  }

  if (facts.length === 0) {
    facts.push("Qualification: —");
  }

  return { facts, interpretation };
}

type ReportGroupProps = {
  label: "Retrieved fact" | "Interpretation";
  borderColor: "primary.main" | "secondary.main";
  textColor: "text.primary" | "text.secondary";
  lines: string[];
};

function ReportGroup({
  label,
  borderColor,
  textColor,
  lines,
}: ReportGroupProps): ReactElement {
  return (
    <Stack
      spacing={0.5}
      sx={{ borderLeft: 2, borderColor, pl: 1.5 }}
    >
      <Typography variant="caption">{label}</Typography>
      {lines.map((line, index) => (
        <Typography
          key={`${label}-${index}`}
          variant="body2"
          sx={{ color: textColor, whiteSpace: "pre-line" }}
        >
          {line}
        </Typography>
      ))}
    </Stack>
  );
}

export function LeadReport({ summary }: LeadReportProps): ReactElement {
  if (!hasStructuredReport(summary)) {
    return (
      <ReportGroup
        label="Interpretation"
        borderColor="secondary.main"
        textColor="text.primary"
        lines={[summary.summaryText]}
      />
    );
  }

  const qualification = splitQualification(summary.qualification);

  return (
    <Stack spacing={1.5}>
      <ReportGroup
        label="Interpretation"
        borderColor="secondary.main"
        textColor="text.primary"
        lines={[
          ...qualification.interpretation,
          `About the company: ${summary.snapshot ?? "—"}`,
          `Why it fits: ${summary.whyItFits ?? "—"}`,
          `Gap: ${summary.gap ?? "—"}`,
          `Next step: ${summary.nextStep ?? "—"}`,
        ]}
      />
      <ReportGroup
        label="Retrieved fact"
        borderColor="primary.main"
        textColor="text.primary"
        lines={[
          showFact(summary.company ?? "Company: —"),
          showFact(summary.contact ?? "Contact: —"),
          showFact(summary.source ?? "Source: —"),
          showFact(qualification.facts.join("\n")),
        ]}
      />
    </Stack>
  );
}
