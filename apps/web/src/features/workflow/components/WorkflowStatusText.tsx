import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { workflowLabel, workflowStatusColor } from "../workflowLabels";

type WorkflowStatusTextProps = {
  status: string;
};

export function WorkflowStatusText({
  status,
}: WorkflowStatusTextProps): ReactElement {
  return (
    <Typography
      variant="body2"
      component="span"
      sx={{ color: workflowStatusColor(status) }}
    >
      {workflowLabel(status)}
    </Typography>
  );
}
