import { Router } from "express";
import { runLeadWorkflow } from "@ithaca/orchestrator";
import type { LeadWorkflowInput } from "@ithaca/shared";

export const workflowRouter = Router();

/** Placeholder route — runs the stub orchestrator for smoke testing. */
workflowRouter.post("/run", async (req, res) => {
  const input = req.body as LeadWorkflowInput;

  if (!input?.icp?.name) {
    res.status(400).json({ error: "icp.name is required" });
    return;
  }

  const result = await runLeadWorkflow(input);
  res.json(result);
});
