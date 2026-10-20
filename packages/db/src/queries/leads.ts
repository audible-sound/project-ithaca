import { and, desc, eq, inArray } from "drizzle-orm";
import { requireDb } from "../client.js";
import type { Lead } from "../schema/leads.js";
import { companies, leads } from "../schema/leads.js";

export type LeadListRow = Lead & {
  companyName: string;
};


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
 * Checks if a user owns a lead by its ID.
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

/**
 * Lists a user's leads with the company name, newest first.
 * @param userId - The ID of the user who owns the leads.
 * @returns The leads if found, otherwise an empty array.
 */
export async function listLeadsByUser(userId: string): Promise<LeadListRow[]> {
  return requireDb()
    .select({
      leadId: leads.leadId,
      companyId: leads.companyId,
      primaryContactId: leads.primaryContactId,
      createdByUserId: leads.createdByUserId,
      sourceType: leads.sourceType,
      lifecycleStatus: leads.lifecycleStatus,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      companyName: companies.name,
    })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.companyId))
    .where(eq(leads.createdByUserId, userId))
    .orderBy(desc(leads.createdAt), desc(leads.leadId));
}
