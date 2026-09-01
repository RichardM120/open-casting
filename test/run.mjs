/**
 * Runs the browser suites against a production build.
 *
 * Each suite gets a database in a known state: the app seeds itself on first
 * request, and `ensureSchema()` memoises per process, so a suite that needs
 * fresh data needs a fresh server rather than a truncate.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const PORT = Number(process.env.TEST_PORT ?? 3100);

/**
 * Nobody can register themselves any more, so every suite needs the one account
 * that exists before anything else does. The server creates it from these on
 * first boot; the suites sign in as it and make the rest.
 */
const ADMIN_EMAIL = "boss@example.com";
const ADMIN_PASSWORD = "bootstrap-admin-password";
const CRON_SECRET = "test-cron-secret";
const BASE = `http://127.0.0.1:${PORT}`;

const SUITES = readdirSync(path.join(here, "suites"))
  .filter((name) => name.endsWith(".mjs") && !name.startsWith("_"))
  .sort();

mkdirSync(path.join(here, "screenshots"), { recursive: true });

function run(command, args, options = {}) {
  return spawn(command, args, { cwd: root, stdio: "inherit", ...options });
}

/**
 * `npx next start` is a shell wrapping node, so killing the child leaves the
 * server holding the port and every later suite fails on EADDRINUSE. Detaching
 * gives the pair its own process group to signal as a whole.
 */
function stop(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

async function waitForServer(signal) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (signal.exited) throw new Error("server exited before it was ready");
    try {
      const response = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  throw new Error(`server did not come up on ${BASE}`);
}

async function resetDatabase() {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    "DROP TABLE IF EXISTS activity, rate_limits, submissions, sessions, sessions_casting, login_attempts, roles, users CASCADE",
  );
  await pool.end();
}

let failures = 0;

for (const suite of SUITES) {
  console.log(`\n${"═".repeat(64)}\n  ${suite}\n${"═".repeat(64)}`);

  await resetDatabase();

  const signal = { exited: false };
  const server = run("npx", ["next", "start", "--port", String(PORT)], {
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ADMIN_EMAILS: ADMIN_EMAIL,
      ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASSWORD,
      CRON_SECRET,
    },
  });
  server.on("exit", () => { signal.exited = true; });

  try {
    await waitForServer(signal);
    const code = await new Promise((resolve) => {
      const child = run("node", [path.join(here, "suites", suite)], {
        env: {
          ...process.env,
          BASE_URL: BASE,
          SHOTS: path.join(here, "screenshots"),
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
          CRON_SECRET,
        },
      });
      child.on("exit", resolve);
    });
    if (code !== 0) failures++;
  } catch (error) {
    console.error(`  ${suite} could not run:`, error.message);
    failures++;
  } finally {
    stop(server);
    // Give the port time to come back before the next suite claims it.
    await sleep(1500);
  }
}

console.log(`\n${failures === 0 ? "All suites passed" : `${failures} suite(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
