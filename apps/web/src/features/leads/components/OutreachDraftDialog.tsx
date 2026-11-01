import type {
  EditLeadOutreachRequest,
  ReviseLeadOutreachRequest,
} from "@ithaca/shared";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type ReactElement } from "react";

type OutreachDraftDialogProps = {
  open: boolean;
  subject: string | null;
  body: string | null;
  generatedSubject: string | null;
  generatedBody: string | null;
  decision: string | null;
  editable: boolean;
  saving: boolean;
  revising: boolean;
  message: string | null;
  onCancel: () => void;
  onClearMessage: () => void;
  onSave: (values: EditLeadOutreachRequest) => void;
  onRevise: (
    values: ReviseLeadOutreachRequest,
  ) => Promise<{ subject: string; body: string } | null>;
};

function emptyValues(): EditLeadOutreachRequest {
  return {
    subject: "",
    body: "",
  };
}

function displayText(value: string | null): string {
  return value && value.trim().length > 0 ? value : "—";
}

export function OutreachDraftDialog({
  open,
  subject,
  body,
  generatedSubject,
  generatedBody,
  decision,
  editable,
  saving,
  revising,
  message,
  onCancel,
  onClearMessage,
  onSave,
  onRevise,
}: OutreachDraftDialogProps): ReactElement {
  const [values, setValues] = useState<EditLeadOutreachRequest>(emptyValues);
  const [instruction, setInstruction] = useState("");
  const busy = saving || revising;

  useEffect(() => {
    if (open) {
      setValues({
        subject: subject ?? "",
        body: body ?? "",
      });
      setInstruction("");
    }
  }, [open, subject, body]);

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy) {
          onCancel();
        }
      }}
    >
      <DialogTitle>{editable ? "Edit outreach draft" : "Outreach draft"}</DialogTitle>
      <DialogContent>
        {message !== null ? (
          <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
            {message}
          </Typography>
        ) : null}
        {decision !== null ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: "block", mt: 1, mb: 1 }}
          >
            {decision}
          </Typography>
        ) : null}
        <TextField
          label="Subject"
          value={values.subject}
          onChange={(event) => {
            const next = event.target.value;
            setValues((current) => ({
              ...current,
              subject: next,
            }));
            if (message !== null) {
              onClearMessage();
            }
          }}
          fullWidth
          multiline
          minRows={1}
          autoFocus={editable}
          disabled={!editable || busy}
          sx={{ mt: 1 }}
        />
        <TextField
          label="Message"
          value={values.body}
          onChange={(event) => {
            const next = event.target.value;
            setValues((current) => ({
              ...current,
              body: next,
            }));
            if (message !== null) {
              onClearMessage();
            }
          }}
          fullWidth
          multiline
          minRows={4}
          disabled={!editable || busy}
          sx={{ mt: 2 }}
        />
        {editable ? (
          <TextField
            label="Instruction"
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value);
              if (message !== null) {
                onClearMessage();
              }
            }}
            fullWidth
            multiline
            minRows={2}
            disabled={busy}
            sx={{ mt: 2 }}
          />
        ) : null}
        <Stack spacing={1.5} sx={{ mt: 3 }}>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Original subject
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
              {displayText(generatedSubject)}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Original message
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
              {displayText(generatedBody)}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        {editable ? (
          <>
            <Button onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => {
                void onRevise({
                  instruction,
                  subject: values.subject,
                  body: values.body,
                }).then((revised) => {
                  if (revised !== null) {
                    setValues({
                      subject: revised.subject,
                      body: revised.body,
                    });
                  }
                });
              }}
            >
              Revise
            </Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => {
                onSave(values);
              }}
            >
              Save
            </Button>
          </>
        ) : (
          <Button onClick={onCancel}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
