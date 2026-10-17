import jwt from "jsonwebtoken";

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

export function signToken(payload: AuthTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}

export function verifyToken(
  token: string,
  secret: string,
): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string"
    ) {
      return null;
    }

    return { sub: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}
