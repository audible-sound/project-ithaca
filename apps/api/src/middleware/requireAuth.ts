import { verifyToken } from "@ithaca/security";
import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error(new Error("JWT_SECRET is not set"));
    res.status(500).json({ message: "Internal server error." });
    return;
  }

  const payload = verifyToken(token, secret);
  if (!payload) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  req.auth = payload;
  next();
};
