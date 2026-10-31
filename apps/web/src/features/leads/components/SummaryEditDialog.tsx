import type { EditLeadSummaryRequest } from "@ithaca/shared";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type ReactElement } from "react";

type SummaryEditDialogProps = {
  open: boolean;
  summaryText: string;
  snapshot: string | null;
  whyItFits: string | null;
  gap: string | null;
  nextStep: string | null;
  saving: boolean;
  message: string | null;
  onCancel: () => void;
  onClearMessage: () => void;
  onSave: (values: EditLeadSummaryRequest) => void;
};

const fields = [
  { key: "summaryText", label: "Summary" },
  { key: "snapshot", label: "About the company" },
  { key: "whyItFits", label: "Why it fits" },
  { key: "gap", label: "Gap" },
  { key: "nextStep", label: "Next step" },
] as const;

function emptyValues(): EditLeadSummaryRequest {
  return {
    summaryText: "",
    snapshot: "",
    whyItFits: "",
    gap: "",
    nextStep: "",
  };
}

export function SummaryEditDialog({
  open,
  summaryText,
  snapshot,
  whyItFits,
  gap,
  nextStep,
  saving,
  message,
  onCancel,
  onClearMessage,
  onSave,
}: SummaryEditDialogProps): ReactElement {
  const [values, setValues] = useState<EditLeadSummaryRequest>(emptyValues);

  useEffect(() => {
    if (open) {
      setValues({
        summaryText,
        snapshot: snapshot ?? "",
        whyItFits: whyItFits ?? "",
        gap: gap ?? "",
        nextStep: nextStep ?? "",
      });
    }
  }, [open, summaryText, snapshot, whyItFits, gap, nextStep]);

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!saving) {
          onCancel();
        }
      }}
    >
      <DialogTitle>Edit summary</DialogTitle>
      <DialogContent>
        {message !== null ? (
          <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
            {message}
          </Typography>
        ) : null}
        {fields.map((field, index) => (
          <TextField
            key={field.key}
            label={field.label}
            value={values[field.key]}
            onChange={(event) => {
              const next = event.target.value;
              setValues((current: EditLeadSummaryRequest) => ({
                ...current,
                [field.key]: next,
              }));
              if (message !== null) {
                onClearMessage();
              }
            }}
            fullWidth
            multiline
            minRows={2}
            autoFocus={index === 0}
            disabled={saving}
            sx={{ mt: index === 0 ? 1 : 2 }}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => {
            onSave(values);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
