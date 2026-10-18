import type { Response } from "express";

export function sendFailure(res: Response, err: unknown): void {
  if (err instanceof Error && err.message === "Database is unavailable.") {
    res.status(503).json({ message: "Service temporarily unavailable." });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error." });
}

export function signedInUserId(
  res: Response,
  userId: string | undefined,
): userId is string {
  if (!userId) {
    res.status(401).json({ message: "Authentication required." });
    return false;
  }

  return true;
}
