import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

type IcpDeleteDialogProps = {
  open: boolean;
  name: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function IcpDeleteDialog({
  open,
  name,
  deleting,
  onCancel,
  onConfirm,
}: IcpDeleteDialogProps): ReactElement {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!deleting) {
          onCancel();
        }
      }}
    >
      <DialogTitle>Delete this profile?</DialogTitle>
      <DialogContent>
        <Typography variant="body1">Delete {name}?</Typography>
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
