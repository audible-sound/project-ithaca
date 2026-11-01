import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useEffect, useState, type ReactElement } from "react";

type CloseLeadDialogProps = {
  open: boolean;
  saving: boolean;
  message: string | null;
  onCancel: () => void;
  onClearMessage: () => void;
  onSave: (reason: string) => void;
};

export function CloseLeadDialog({
  open,
  saving,
  message,
  onCancel,
  onClearMessage,
  onSave,
}: CloseLeadDialogProps): ReactElement {
  const [reasonText, setReasonText] = useState("");

  useEffect(() => {
    if (open) {
      setReasonText("");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) {
          onCancel();
        }
      }}
    >
      <DialogTitle>Close lead</DialogTitle>
      <DialogContent>
        <TextField
          label="Reason"
          value={reasonText}
          onChange={(event) => {
            setReasonText(event.target.value);
            if (message !== null) {
              onClearMessage();
            }
          }}
          error={message !== null}
          helperText={message ?? "Optional."}
          fullWidth
          autoFocus
          disabled={saving}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={saving}
          onClick={() => {
            onSave(reasonText);
          }}
        >
          Close Lead
        </Button>
      </DialogActions>
    </Dialog>
  );
}
