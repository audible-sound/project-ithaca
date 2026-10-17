import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

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
  pool.on("error", (err: Error) => {
    console.error("[db] unexpected pool error", err);
  });
  db = drizzle(pool, { schema });
  return pool;
}

export function getPool(): Pool | null {
  return pool;
}

export function getDb(): Database | null {
  return db;
}

export function requireDb(): Database {
  if (!db) {
    throw new Error("Database is unavailable.");
  }

  return db;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }

  db = null;
}
