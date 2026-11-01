import { leadPipelineStages } from "@ithaca/shared";
import type {
  EditLeadOutreachRequest,
  EditLeadSummaryRequest,
  LeadDetail,
  LeadPipelineStageStatus,
  ReviseLeadOutreachRequest,
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
import { CloseLeadDialog } from "./CloseLeadDialog";
import { LeadReport } from "./LeadReport";
import { OutreachDraftDialog } from "./OutreachDraftDialog";
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
  const outreachMessage = useLeadStore((state) => state.outreachMessage);
  const editOutreach = useLeadStore((state) => state.editOutreach);
  const reviseOutreach = useLeadStore((state) => state.reviseOutreach);
  const approveOutreach = useLeadStore((state) => state.approveOutreach);
  const rejectOutreach = useLeadStore((state) => state.rejectOutreach);
  const sendOutreach = useLeadStore((state) => state.sendOutreach);
  const markOutreachDone = useLeadStore((state) => state.markOutreachDone);
  const snoozeFollowUp = useLeadStore((state) => state.snoozeFollowUp);
  const logFollowUp = useLeadStore((state) => state.logFollowUp);
  const recordFollowUpReply = useLeadStore((state) => state.recordFollowUpReply);
  const closeFollowUp = useLeadStore((state) => state.closeFollowUp);
  const clearOutreachEdit = useLeadStore((state) => state.clearOutreachEdit);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [revisingDraft, setRevisingDraft] = useState(false);
  const [decidingDraft, setDecidingDraft] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const ownsLead = lead.ownerId !== null && lead.ownerId === userId;
  const canOverride = ownsLead && lead.qualification !== null;
  const canEditSummary = ownsLead && lead.summary !== null;
  const canViewDraft = lead.outreach !== null;
  const canEditDraft =
    ownsLead &&
    lead.outreach !== null &&
    (lead.outreach.status === "draft" ||
      lead.outreach.status === "edited" ||
      lead.outreach.status === "rejected");
  const outreachStatus = lead.outreach?.status ?? null;
  const canReviewDraft =
    lead.outreach !== null && outreachStatus !== null && outreachStatus !== "sent";
  const canApproveDraft = canReviewDraft && outreachStatus !== "approved";
  const canRejectDraft = canReviewDraft && outreachStatus !== "rejected";
  const showSendOrDone = outreachStatus === "approved";
  const draftBusy =
    savingDraft || revisingDraft || decidingDraft || sendingDraft || markingDone;
  const order = new Map(leadPipelineStages.map((stage, index) => [stage, index]));
  const stages = [...lead.pipeline].sort(
    (a, b) => (order.get(a.stage) ?? 0) - (order.get(b.stage) ?? 0),
  );
  const firstSource = lead.sources[0] ?? null;
  const overriddenAt = formatDateTime(lead.qualification?.overriddenAt ?? null);
  const approvedAt = formatDateTime(lead.outreach?.approvedAt ?? null);
  const rejectedAt = formatDateTime(lead.outreach?.rejectedAt ?? null);
  const doneAt = formatDateTime(lead.outreach?.updatedAt ?? null);
  const sentAt = formatDateTime(lead.followUp?.sentAt ?? null);
  const followUpDueDate = formatDate(lead.followUp?.dueAt ?? null);
  const followUpSentDate = formatDate(lead.followUp?.sentAt ?? null);
  const followUpMarkedDate = formatDate(lead.outreach?.updatedAt ?? null);
  const followUpRepliedDate = formatDate(lead.followUp?.repliedAt ?? null);
  const followUpLastDate = formatDate(lead.followUp?.followedUpAt ?? null);
  const followUpOutreachDate = lead.followUp?.sentAt
    ? (followUpSentDate ?? "—")
    : (followUpMarkedDate ?? "—");
  const canFollowUp =
    ownsLead &&
    lead.followUp !== null &&
    lead.stage !== "closed" &&
    lead.followUp.followUpStatus !== "replied" &&
    lead.followUp.repliedAt === null;

  function outreachDecisionText(): string | null {
    if (lead.outreach === null) {
      return null;
    }

    if (lead.outreach.status === "approved") {
      return approvedAt ? `Approved ${approvedAt}` : "Approved";
    }

    if (lead.outreach.status === "rejected") {
      return rejectedAt ? `Rejected ${rejectedAt}` : "Rejected";
    }

    if (lead.outreach.status === "sent") {
      const approved = approvedAt ? `Approved ${approvedAt}` : "Approved";
      if (lead.followUp?.sentAt) {
        return `${approved}. Sent${sentAt ? ` ${sentAt}` : ""}`;
      }
      return `${approved}. Done${doneAt ? ` ${doneAt}` : ""}`;
    }

    return "Not approved";
  }

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

  async function onSaveOutreach(values: EditLeadOutreachRequest): Promise<void> {
    setSavingDraft(true);
    const saved = await editOutreach(lead.leadId, values);
    setSavingDraft(false);
    if (saved) {
      setDraftOpen(false);
    }
  }

  async function onReviseOutreach(
    values: ReviseLeadOutreachRequest,
  ): Promise<{ subject: string; body: string } | null> {
    setRevisingDraft(true);
    const revised = await reviseOutreach(lead.leadId, values);
    setRevisingDraft(false);
    return revised;
  }

  async function onApproveOutreach(): Promise<void> {
    setDecidingDraft(true);
    await approveOutreach(lead.leadId);
    setDecidingDraft(false);
  }

  async function onRejectOutreach(): Promise<void> {
    setDecidingDraft(true);
    await rejectOutreach(lead.leadId);
    setDecidingDraft(false);
  }

  async function onSendOutreach(): Promise<void> {
    setSendingDraft(true);
    await sendOutreach(lead.leadId);
    setSendingDraft(false);
  }

  async function onMarkOutreachDone(): Promise<void> {
    setMarkingDone(true);
    await markOutreachDone(lead.leadId);
    setMarkingDone(false);
  }

  async function onSnoozeFollowUp(): Promise<void> {
    setFollowUpBusy(true);
    await snoozeFollowUp(lead.leadId);
    setFollowUpBusy(false);
  }

  async function onLogFollowUp(): Promise<void> {
    setFollowUpBusy(true);
    await logFollowUp(lead.leadId);
    setFollowUpBusy(false);
  }

  async function onRecordFollowUpReply(): Promise<void> {
    setFollowUpBusy(true);
    await recordFollowUpReply(lead.leadId);
    setFollowUpBusy(false);
  }

  async function onCloseFollowUp(reason: string): Promise<void> {
    setFollowUpBusy(true);
    const closed = await closeFollowUp(lead.leadId, reason);
    setFollowUpBusy(false);
    if (closed) {
      setCloseOpen(false);
    }
  }

  const decisionText = outreachDecisionText();

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
                      {lead.outreach.isUserEdited ? (
                        <Typography variant="body2" color="text.secondary">
                          Edited
                        </Typography>
                      ) : null}
                      {decisionText !== null ? (
                        <Typography variant="body2" color="text.secondary">
                          {decisionText}
                        </Typography>
                      ) : null}
                      {lead.outreach.deliveryStatus === "failed" ? (
                        <Typography variant="body2" color="error.main">
                          Could not send. This draft was not delivered.
                        </Typography>
                      ) : null}
                      {outreachMessage !== null ? (
                        <Typography variant="caption" color="error">
                          {outreachMessage}
                        </Typography>
                      ) : null}
                      <Typography variant="body2" color="text.secondary">
                        Subject: {lead.outreach.subject ?? "—"}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        <Button
                          size="small"
                          disabled={!canViewDraft || draftBusy}
                          onClick={() => {
                            clearOutreachEdit();
                            setDraftOpen(true);
                          }}
                        >
                          {canEditDraft ? "Edit message" : "View message"}
                        </Button>
                        {canReviewDraft ? (
                          <>
                            <Button
                              size="small"
                              variant={
                                showSendOrDone ? "outlined" : "contained"
                              }
                              disabled={
                                !ownsLead || !canApproveDraft || draftBusy
                              }
                              onClick={() => {
                                void onApproveOutreach();
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={
                                !ownsLead || !canRejectDraft || draftBusy
                              }
                              onClick={() => {
                                void onRejectOutreach();
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {showSendOrDone ? (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!ownsLead || draftBusy}
                              onClick={() => {
                                void onSendOutreach();
                              }}
                            >
                              Send
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!ownsLead || draftBusy}
                              onClick={() => {
                                void onMarkOutreachDone();
                              }}
                            >
                              Done
                            </Button>
                          </>
                        ) : null}
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        No draft yet.
                      </Typography>
                      <Box>
                        <Button size="small" disabled>
                          Edit message
                        </Button>
                      </Box>
                    </Stack>
                  )
                ) : null}

                {entry.stage === "follow_up" ? (
                  <Stack spacing={0.5}>
                    {lead.followUp ? (
                      <>
                        {followUpDueDate &&
                        lead.followUp.repliedAt === null ? (
                          <Typography
                            variant="body2"
                            sx={{
                              color: lead.followUpDue
                                ? "warning.main"
                                : "text.secondary",
                            }}
                          >
                            Due {followUpDueDate}
                          </Typography>
                        ) : null}
                        <Typography variant="body2" color="text.secondary">
                          {lead.followUp.sentAt ? "Sent" : "Marked done"} ·{" "}
                          {followUpOutreachDate}
                        </Typography>
                        {followUpRepliedDate ? (
                          <Typography variant="body2" color="text.secondary">
                            Replied · {followUpRepliedDate}
                          </Typography>
                        ) : null}
                        {lead.followUp.followUpCount > 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Follow-ups · {lead.followUp.followUpCount}
                            {followUpLastDate
                              ? ` · last ${followUpLastDate}`
                              : ""}
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No follow-up yet.
                      </Typography>
                    )}
                    {outreachMessage !== null && lead.followUp !== null ? (
                      <Typography variant="caption" color="error">
                        {outreachMessage}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        disabled={!canFollowUp || followUpBusy}
                        onClick={() => {
                          void onSnoozeFollowUp();
                        }}
                      >
                        Snooze 5 Days
                      </Button>
                      <Button
                        size="small"
                        disabled={!canFollowUp || followUpBusy}
                        onClick={() => {
                          void onLogFollowUp();
                        }}
                      >
                        Log Follow-up
                      </Button>
                      <Button
                        size="small"
                        disabled={!canFollowUp || followUpBusy}
                        onClick={() => {
                          void onRecordFollowUpReply();
                        }}
                      >
                        Record Lead Reply
                      </Button>
                      <Button
                        size="small"
                        disabled={!canFollowUp || followUpBusy}
                        onClick={() => {
                          clearOutreachEdit();
                          setCloseOpen(true);
                        }}
                      >
                        Close Lead
                      </Button>
                    </Stack>
                  </Stack>
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
      <OutreachDraftDialog
        open={draftOpen}
        subject={lead.outreach?.subject ?? null}
        body={lead.outreach?.body ?? null}
        generatedSubject={lead.outreach?.generatedSubject ?? null}
        generatedBody={lead.outreach?.generatedBody ?? null}
        decision={decisionText}
        editable={canEditDraft}
        saving={savingDraft}
        revising={revisingDraft}
        message={outreachMessage}
        onCancel={() => {
          if (!draftBusy) {
            clearOutreachEdit();
            setDraftOpen(false);
          }
        }}
        onClearMessage={clearOutreachEdit}
        onSave={(values) => {
          void onSaveOutreach(values);
        }}
        onRevise={onReviseOutreach}
      />
      <CloseLeadDialog
        open={closeOpen}
        saving={followUpBusy}
        message={outreachMessage}
        onCancel={() => {
          if (!followUpBusy) {
            clearOutreachEdit();
            setCloseOpen(false);
          }
        }}
        onClearMessage={clearOutreachEdit}
        onSave={(reason) => {
          void onCloseFollowUp(reason);
        }}
      />
    </Paper>
  );
}
