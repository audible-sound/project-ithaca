import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

type LeadDeleteDialogProps = {
  open: boolean;
  companyName: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LeadDeleteDialog({
  open,
  companyName,
  deleting,
  onCancel,
  onConfirm,
}: LeadDeleteDialogProps): ReactElement {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!deleting) {
          onCancel();
        }
      }}
    >
      <DialogTitle>Delete this lead?</DialogTitle>
      <DialogContent>
        <Typography variant="body1">Delete {companyName}?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={deleting}
          onClick={onConfirm}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
