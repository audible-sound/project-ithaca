import argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    return await argon2.verify(stored, password);
  } catch {
    return false;
  }
}
