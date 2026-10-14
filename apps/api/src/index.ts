import cors from "cors";
import express from "express";
import { createPool } from "@ithaca/db";
import { healthRouter } from "./routes/health.js";
import { workflowRouter } from "./routes/workflow.js";

const port = Number(process.env.PORT ?? 3001);

if (process.env.DATABASE_URL) {
  createPool();
} else {
  console.warn(
    "[api] DATABASE_URL not set; health checks will report db as down",
  );
}

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/workflow", workflowRouter);

app.get("/", (_req, res) => {
  res.json({ name: "@ithaca/api", status: "ok" });
});

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
