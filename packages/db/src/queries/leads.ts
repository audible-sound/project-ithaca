import { and, eq, inArray } from "drizzle-orm";
import { requireDb } from "../client.js";
import type { Lead } from "../schema/leads.js";
import { leads } from "../schema/leads.js";


/**
 * Finds a lead by its ID for a specific user.
 * @param leadId - The ID of the lead to find.
 * @param userId - The ID of the user who owns the lead.
 * @returns The lead if found, otherwise null.
 */
export async function findLeadById(
  leadId: string,
  userId: string,
): Promise<Lead | null> {
  const rows = await requireDb()
    .select()
    .from(leads)
    .where(and(eq(leads.leadId, leadId), eq(leads.createdByUserId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Lists leads by their IDs for a specific user.
 * @param leadIds - The IDs of the leads to list.
 * @param userId - The ID of the user who owns the leads.
 * @returns The leads if found, otherwise an empty array.
 */
export async function listLeadsByIdsForUser(
  leadIds: string[],
  userId: string,
): Promise<Lead[]> {
  if (leadIds.length === 0) {
    return [];
  }

  return requireDb()
    .select()
    .from(leads)
    .where(
      and(inArray(leads.leadId, leadIds), eq(leads.createdByUserId, userId)),
    );
}
