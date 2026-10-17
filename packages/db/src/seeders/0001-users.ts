import { hashPassword } from "@ithaca/security";
import type { Database } from "../client.js";
import { users } from "../schema/users.js";

const samplePassword = "ithaca";

const sampleUsers = [
  { email: "ada.lim@ithaca.example", fullName: "Ada Lim" },
  { email: "marcus.tan@ithaca.example", fullName: "Marcus Tan" },
  { email: "priya.nair@ithaca.example", fullName: "Priya Nair" },
  { email: "owen.choo@ithaca.example", fullName: "Owen Choo" },
  { email: "lina.hassan@ithaca.example", fullName: "Lina Hassan" },
] as const;

export async function seed(database: Database): Promise<void> {
  for (const user of sampleUsers) {
    const passwordHash = await hashPassword(samplePassword);
    const now = new Date();
    await database
      .insert(users)
      .values({
        email: user.email,
        fullName: user.fullName,
        passwordHash,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName: user.fullName,
          passwordHash,
          updatedAt: now,
        },
      });
  }
}
