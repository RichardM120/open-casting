import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { seedDatabase } from "./seed-data";
import type { Database } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

/**
 * A JSON file is enough for a prototype, and it keeps the repo free of native
 * dependencies and migration tooling. Everything else in the app talks to the
 * `read`/`write` pair below, so swapping in Postgres later is a one-file job.
 *
 * Read-only filesystems (most serverless hosts) fall back to an in-process
 * cache: the app still works, but writes are lost when the instance recycles.
 */
let cache: Database | null = null;
let readOnly = false;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Database> {
  if (cache) return cache;

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw) as Database;
  } catch {
    cache = seedDatabase();
    await persist(cache);
  }

  return cache;
}

async function persist(db: Database): Promise<void> {
  if (readOnly) return;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  } catch {
    readOnly = true;
    console.warn(
      "[store] data directory is not writable — falling back to in-memory data. " +
        "Changes will not survive a restart.",
    );
  }
}

/** Reads a snapshot of the database. Callers must not mutate the result. */
export async function read<T>(select: (db: Database) => T): Promise<T> {
  const run = queue.then(async () => select(await load()));
  queue = run.catch(() => {});
  return run;
}

/**
 * Applies a mutation and persists the result. Mutations are serialised so two
 * concurrent requests cannot clobber each other's writes.
 */
export async function write<T>(mutate: (db: Database) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = mutate(db);
    await persist(db);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

/** Resets the database back to the seed content. Used by the demo reset action. */
export async function reset(): Promise<void> {
  await write((db) => {
    const fresh = seedDatabase();
    db.roles = fresh.roles;
    db.submissions = fresh.submissions;
  });
}
