import { findUserByEmail } from "@ithaca/db";
import { signToken, verifyPassword } from "@ithaca/security";
import type { SignInResponse } from "@ithaca/shared";
import { Router } from "express";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const body = req.body as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password.trim() : "";

  // Verify that the email and password are provided
  if (!email) {
    res.status(400).json({ message: "Email is required." });
    return;
  }

  if (!password) {
    res.status(400).json({ message: "Password is required." });
    return;
  }

  try {
    // Find the user in database
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not set");
    }

    // Generate a JWT token
    const token = signToken({ sub: user.userId, email: user.email }, secret);
    const response: SignInResponse = {
      message: "Signed in.",
      token,
      name: user.fullName,
      userId: user.userId,
    };
    res.status(200).json(response);
  } catch (err) {
    if (err instanceof Error && err.message === "JWT_SECRET is not set") {
      console.error(err);
      res.status(500).json({ message: "Internal server error." });
      return;
    }

    res.status(503).json({ message: "Service temporarily unavailable." });
  }
});
