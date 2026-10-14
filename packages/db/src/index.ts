import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema/index.js";

type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Database | null = null;

export function createPool(connectionString?: string): Pool {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const config: PoolConfig = {
    connectionString: url,
  };

  pool = new Pool(config);
  db = drizzle(pool, { schema });
  return pool;
}

export function getPool(): Pool | null {
  return pool;
}

export function getDb(): Database | null {
  return db;
}

/** Returns true when a simple SELECT 1 succeeds. */
export async function ping(): Promise<boolean> {
  const database = getDb();
  if (!database) {
    return false;
  }

  try {
    await database.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }

  db = null;
}

export * from "./schema/index.js";
