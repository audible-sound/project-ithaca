import { leadPipelineStages } from "@ithaca/shared";
import type {
  EditLeadSummaryRequest,
  LeadDetail,
  LeadPipelineStageStatus,
} from "@ithaca/shared";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement } from "react";
import { useAuthStore } from "../../../stores/authStore";
import { useLeadStore } from "../../../stores/leadStore";
import { formatDate, formatDateTime } from "../../../utils/date";
import { capitalize } from "../../../utils/string";
import { leadStageLabel } from "../leadLabels";
import { LeadReport } from "./LeadReport";
import { QualificationOverrideDialog } from "./QualificationOverrideDialog";
import { SummaryEditDialog } from "./SummaryEditDialog";

type LeadPipelineProps = {
  lead: LeadDetail;
};

const statusLabels: Record<LeadPipelineStageStatus, string> = {
  not_started: "Not started",
  waiting: "Waiting",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  current: "Current",
};

function statusColor(
  status: LeadPipelineStageStatus,
): "success.main" | "error.main" | "warning.main" | "text.secondary" {
  if (status === "completed") {
    return "success.main";
  }
  if (status === "failed") {
    return "error.main";
  }
  if (status === "running" || status === "current") {
    return "warning.main";
  }
  return "text.secondary";
}

function sourceProviderLabel(provider: string): string {
  if (provider === "exa") {
    return "Website";
  }
  if (provider === "manual") {
    return "Manual";
  }
  return "Other";
}

export function LeadPipeline({ lead }: LeadPipelineProps): ReactElement {
  const userId = useAuthStore((state) => state.userId);
  const overrideMessage = useLeadStore((state) => state.overrideMessage);
  const overrideQualification = useLeadStore(
    (state) => state.overrideQualification,
  );
  const clearOverride = useLeadStore((state) => state.clearOverride);
  const summaryMessage = useLeadStore((state) => state.summaryMessage);
  const editSummary = useLeadStore((state) => state.editSummary);
  const clearSummaryEdit = useLeadStore((state) => state.clearSummaryEdit);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const canOverride =
    lead.ownerId !== null && lead.ownerId === userId && lead.qualification !== null;
  const canEditSummary =
    lead.ownerId !== null && lead.ownerId === userId && lead.summary !== null;
  const order = new Map(leadPipelineStages.map((stage, index) => [stage, index]));
  const stages = [...lead.pipeline].sort(
    (a, b) => (order.get(a.stage) ?? 0) - (order.get(b.stage) ?? 0),
  );
  const firstSource = lead.sources[0] ?? null;
  const overriddenAt = formatDateTime(lead.qualification?.overriddenAt ?? null);

  async function onSaveOverride(score: unknown, reason: string): Promise<void> {
    setSavingOverride(true);
    const saved = await overrideQualification(lead.leadId, score, reason);
    setSavingOverride(false);
    if (saved) {
      setOverrideOpen(false);
    }
  }

  async function onSaveSummary(values: EditLeadSummaryRequest): Promise<void> {
    setSavingSummary(true);
    const saved = await editSummary(lead.leadId, values);
    setSavingSummary(false);
    if (saved) {
      setSummaryOpen(false);
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
      <Stack spacing={2}>
        <Typography variant="h2">Pipeline</Typography>
        <Stack spacing={0} divider={<Divider />}>
          {stages.map((entry, index) => (
            <Box key={entry.stage} sx={{ py: 2 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="body1">
                  {index + 1} {leadStageLabel(entry.stage)}
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ color: statusColor(entry.status) }}
                >
                  {statusLabels[entry.status]}
                </Typography>
              </Stack>
              <Box sx={{ mt: 1, pl: 3 }}>
                {entry.stage === "identify" ? (
                  firstSource ? (
                    <Typography variant="body2" color="text.secondary">
                      Source: {sourceProviderLabel(firstSource.sourceProvider)} ·{" "}
                      {firstSource.sourceTitle ?? firstSource.sourceUrl ?? "—"}
                    </Typography>
                  ) : entry.status === "not_started" ? (
                    <Typography variant="body2" color="text.secondary">
                      Not started
                    </Typography>
                  ) : null
                ) : null}

                {entry.stage === "qualify" ? (
                  lead.qualification ? (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Score {lead.qualification.score ?? "—"} · Priority{" "}
                        {lead.qualification.priority
                          ? capitalize(lead.qualification.priority)
                          : "—"}
                        {lead.qualification.fitLabel
                          ? ` · ${lead.qualification.fitLabel}`
                          : ""}
                      </Typography>
                      {lead.qualification.isUserOverride ? (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            Overridden{overriddenAt ? ` ${overriddenAt}` : ""}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Agent score {lead.qualification.agentScore ?? "—"}
                          </Typography>
                          {lead.qualification.overrideReason ? (
                            <Typography variant="body2" color="text.secondary">
                              Your reason: {lead.qualification.overrideReason}
                            </Typography>
                          ) : null}
                          {lead.qualification.explanation ? (
                            <Typography variant="body2" color="text.secondary">
                              Agent explanation:{" "}
                              {lead.qualification.explanation}
                            </Typography>
                          ) : null}
                        </>
                      ) : lead.qualification.explanation ? (
                        <Typography variant="body2" color="text.secondary">
                          {lead.qualification.explanation}
                        </Typography>
                      ) : null}
                      {lead.qualification.criteria.map((criterion) => (
                        <Typography
                          key={criterion.name}
                          variant="body2"
                          color="text.secondary"
                        >
                          {criterion.name} · {capitalize(criterion.result)}
                        </Typography>
                      ))}
                      {lead.qualification.evidence.map((item, evidenceIndex) => (
                        <Typography
                          key={`${item}-${evidenceIndex}`}
                          variant="body2"
                          color="text.secondary"
                        >
                          Evidence: {item}
                        </Typography>
                      ))}
                      <Box>
                        <Button
                          size="small"
                          disabled={!canOverride}
                          onClick={() => {
                            clearOverride();
                            setOverrideOpen(true);
                          }}
                        >
                          Edit result
                        </Button>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        No qualification yet.
                      </Typography>
                      <Box>
                        <Button size="small" disabled>
                          Edit result
                        </Button>
                      </Box>
                    </Stack>
                  )
                ) : null}

                {entry.stage === "summarize" ? (
                  lead.summary ? (
                    <Stack spacing={0.5}>
                      {lead.summary.isUserOverride ? (
                        <Typography variant="body2" color="text.secondary">
                          Edited
                        </Typography>
                      ) : null}
                      <LeadReport summary={lead.summary} />
                      <Box>
                        <Button
                          size="small"
                          disabled={!canEditSummary}
                          onClick={() => {
                            clearSummaryEdit();
                            setSummaryOpen(true);
                          }}
                        >
                          Edit result
                        </Button>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        No summary yet.
                      </Typography>
                      <Box>
                        <Button size="small" disabled>
                          Edit result
                        </Button>
                      </Box>
                    </Stack>
                  )
                ) : null}

                {entry.stage === "draft" ? (
                  lead.outreach ? (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Subject: {lead.outreach.subject ?? "—"}
                      </Typography>
                      <Box>
                        <Button size="small" disabled>
                          View message
                        </Button>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        No draft yet.
                      </Typography>
                      <Box>
                        <Button size="small" disabled>
                          View message
                        </Button>
                      </Box>
                    </Stack>
                  )
                ) : null}

                {entry.stage === "follow_up" ? (
                  lead.followUp ? (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        {[
                          formatDate(lead.followUp.sentAt)
                            ? `Sent ${formatDate(lead.followUp.sentAt)}.`
                            : null,
                          formatDate(lead.followUp.dueAt)
                            ? `Due ${formatDate(lead.followUp.dueAt)}.`
                            : null,
                          lead.followUp.repliedAt
                            ? `Replied ${formatDate(lead.followUp.repliedAt)}.`
                            : lead.followUp.sentAt
                              ? "No reply."
                              : null,
                        ]
                          .filter((part) => part !== null)
                          .join(" ") || "No follow-up yet."}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" disabled>
                          Mark replied
                        </Button>
                        <Button size="small" disabled>
                          Snooze
                        </Button>
                        <Button size="small" disabled>
                          Close
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        No follow-up yet.
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" disabled>
                          Mark replied
                        </Button>
                        <Button size="small" disabled>
                          Snooze
                        </Button>
                        <Button size="small" disabled>
                          Close
                        </Button>
                      </Stack>
                    </Stack>
                  )
                ) : null}
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>
      <QualificationOverrideDialog
        open={overrideOpen}
        score={lead.qualification?.score ?? null}
        reason={lead.qualification?.overrideReason ?? null}
        saving={savingOverride}
        message={overrideMessage}
        onCancel={() => {
          if (!savingOverride) {
            clearOverride();
            setOverrideOpen(false);
          }
        }}
        onClearMessage={clearOverride}
        onSave={(score, reason) => {
          void onSaveOverride(score, reason);
        }}
      />
      <SummaryEditDialog
        open={summaryOpen}
        summaryText={lead.summary?.summaryText ?? ""}
        snapshot={lead.summary?.snapshot ?? null}
        whyItFits={lead.summary?.whyItFits ?? null}
        gap={lead.summary?.gap ?? null}
        nextStep={lead.summary?.nextStep ?? null}
        saving={savingSummary}
        message={summaryMessage}
        onCancel={() => {
          if (!savingSummary) {
            clearSummaryEdit();
            setSummaryOpen(false);
          }
        }}
        onClearMessage={clearSummaryEdit}
        onSave={(values) => {
          void onSaveSummary(values);
        }}
      />
    </Paper>
  );
}
