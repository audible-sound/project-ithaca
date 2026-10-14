import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

export function createPool(connectionString?: string): Pool {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const config: PoolConfig = {
    connectionString: url,
  };

  pool = new Pool(config);
  return pool;
}

export function getPool(): Pool | null {
  return pool;
}

/** Returns true when a simple SELECT 1 succeeds. */
export async function ping(): Promise<boolean> {
  if (!pool) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
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
}
