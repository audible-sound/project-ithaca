import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useEffect, useState, type ReactElement } from "react";

type QualificationOverrideDialogProps = {
  open: boolean;
  score: number | null;
  reason: string | null;
  saving: boolean;
  message: string | null;
  onCancel: () => void;
  onClearMessage: () => void;
  onSave: (score: unknown, reason: string) => void;
};

/** Turns the field text into a JSON score value the API can accept or reject. */
function scoreValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

export function QualificationOverrideDialog({
  open,
  score,
  reason,
  saving,
  message,
  onCancel,
  onClearMessage,
  onSave,
}: QualificationOverrideDialogProps): ReactElement {
  const [scoreText, setScoreText] = useState("");
  const [reasonText, setReasonText] = useState("");

  useEffect(() => {
    if (open) {
      setScoreText(score === null ? "" : String(score));
      setReasonText(reason ?? "");
    }
  }, [open, score, reason]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) {
          onCancel();
        }
      }}
    >
      <DialogTitle>Override suitability</DialogTitle>
      <DialogContent>
        <TextField
          label="Suitability score"
          value={scoreText}
          onChange={(event) => {
            setScoreText(event.target.value);
            if (message !== null) {
              onClearMessage();
            }
          }}
          error={message !== null}
          helperText={message ?? "Whole number from 0 to 100."}
          fullWidth
          autoFocus
          disabled={saving}
          sx={{ mt: 1 }}
        />
        <TextField
          label="Reason"
          value={reasonText}
          onChange={(event) => {
            setReasonText(event.target.value);
            if (message !== null) {
              onClearMessage();
            }
          }}
          helperText="Why you are replacing the agent's score. Optional."
          fullWidth
          multiline
          minRows={2}
          disabled={saving}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => {
            onSave(scoreValue(scoreText), reasonText);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
