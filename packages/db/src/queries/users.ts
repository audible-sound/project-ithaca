import { eq } from "drizzle-orm";
import { requireDb } from "../client.js";
import { users } from "../schema/users.js";
import type { User } from "../schema/users.js";

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await requireDb()
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return rows[0] ?? null;
}
