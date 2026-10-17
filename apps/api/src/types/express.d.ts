import type { AuthTokenPayload } from "@ithaca/security";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export {};
