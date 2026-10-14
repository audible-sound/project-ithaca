import { Router } from "express";
import { ping } from "@ithaca/db";
import { runLeadWorkflow } from "@ithaca/orchestrator";
import type { HealthResponse } from "@ithaca/shared";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const dbUp = await ping().catch(() => false);

  let orchestrator: HealthResponse["orchestrator"] = "ready";
  try {
    await runLeadWorkflow({ icp: { name: "health-check" } });
  } catch {
    orchestrator = "unavailable";
  }

  const body: HealthResponse = {
    ok: true,
    db: dbUp ? "up" : "down",
    orchestrator,
  };

  res.json(body);
});
