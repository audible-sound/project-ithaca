import { config as loadEnv } from "dotenv";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, createPool, getDb, type Database } from "../client.js";

const seederDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(seederDir, "../../../../.env") });

const seederFilePattern = /^(\d+)-.+\.ts$/;

type SeederModule = {
  seed: (database: Database) => Promise<void>;
};

function isSeederModule(value: unknown): value is SeederModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "seed" in value &&
    typeof value.seed === "function"
  );
}

function seederOrder(fileName: string): number {
  const match = seederFilePattern.exec(fileName);
  const prefix = match?.[1];
  if (prefix === undefined) {
    throw new Error(`Seeder file name is invalid: ${fileName}`);
  }
  return Number(prefix);
}

async function listSeeders(): Promise<string[]> {
  const entries = await readdir(seederDir);
  return entries
    .filter((fileName) => seederFilePattern.test(fileName))
    .sort((left, right) => {
      const byNumber = seederOrder(left) - seederOrder(right);
      if (byNumber !== 0) {
        return byNumber;
      }
      return left.localeCompare(right);
    });
}

async function runSeeders(): Promise<void> {
  createPool();
  try {
    const database = getDb();
    if (!database) {
      throw new Error("Database is unavailable.");
    }

    const files = await listSeeders();
    for (const fileName of files) {
      console.log(`Seeding ${fileName}`);
      const imported: unknown = await import(`./${fileName}`);
      if (!isSeederModule(imported)) {
        throw new Error(`Seeder ${fileName} does not export seed.`);
      }
      await imported.seed(database);
    }
  } finally {
    await closePool();
  }
}

runSeeders().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Seed failed";
  console.error(message);
  process.exitCode = 1;
});
