/**
 * Runs the browser suites against a production build.
 *
 * Each suite gets a database in a known state: the app seeds itself on first
 * request, and `ensureSchema()` memoises per process, so a suite that needs
 * fresh data needs a fresh server rather than a truncate.
 *
 * Arguments narrow the run to suites whose name contains one of them:
 * `node test/run.mjs 11 12`. No arguments runs everything, which is what CI does.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { TOKEN as BLOB_TOKEN, startBlobStandIn } from "./blob-standin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const PORT = Number(process.env.TEST_PORT ?? 3100);

/**
 * Nobody can register themselves any more, so every suite needs the one account
 * that exists before anything else does. The server creates it from these on
 * first boot; the suites sign in as it and make the rest.
 */
const ADMIN_EMAIL = "boss@example.com";
/** A second admin address, to prove the allowlist admits more than one. */
const SECOND_ADMIN = "richard@cwcasting.co.uk";
const ADMIN_PASSWORD = "bootstrap-admin-password";
const CRON_SECRET = "test-cron-secret";
const AUTH_SECRET = "test-auth-secret-at-least-32-characters-long";

/**
 * Extra environment for one suite only. The pre-launch switches change the
 * whole site, so every other suite has to run with them off, which is also the
 * arrangement that matters at launch.
 */
const SUITE_ENV = {
  "11-prelaunch.mjs": { SITE_PASSCODE: "test-site-passcode" },
  // The wall with its signing key missing: the one misconfiguration that
  // leaves a right passcode unable to open it.
  "12-unconfigured.mjs": { SITE_PASSCODE: "test-site-passcode", AUTH_SECRET: "" },
};
const MAIL_PORT = PORT + 1;
const MAILBOX = path.join(here, "mailbox.json");
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * The stand-in store, for the one suite that puts files up. Every other suite
 * runs with no store, as a deployment without one does, and checks that the
 * form offers no uploads. The server is given a token so it treats the store
 * as connected, told to send the SDK's requests here, and told to read files
 * back from here; the suite routes the browser's uploads here itself.
 */
const BLOB_PORT = PORT + 2;
const BLOB_STANDIN = `http://127.0.0.1:${BLOB_PORT}`;
/** The proxy the suite's browser is given: vercel.com goes to the stand-in, nothing else goes anywhere. */
const BLOB_PROXY = `http://127.0.0.1:${PORT + 4}`;
SUITE_ENV["17-uploads.mjs"] = {
  BLOB_READ_WRITE_TOKEN: BLOB_TOKEN,
  VERCEL_BLOB_API_URL: BLOB_STANDIN,
  BLOB_READ_BASE: BLOB_STANDIN,
};

const ONLY = process.argv.slice(2);
const SUITES = readdirSync(path.join(here, "suites"))
  .filter((name) => name.endsWith(".mjs") && !name.startsWith("_"))
  .filter((name) => ONLY.length === 0 || ONLY.some((part) => name.includes(part)))
  .sort();

if (SUITES.length === 0) {
  console.error(`No suite matches ${ONLY.join(", ")}`);
  process.exit(1);
}

mkdirSync(path.join(here, "screenshots"), { recursive: true });

function run(command, args, options = {}) {
  return spawn(command, args, { cwd: root, stdio: "inherit", ...options });
}

/**
 * The server's own output, kept so a suite can read the sign-in link out of it.
 * With no mail provider configured the link is logged instead of sent, which is
 * exactly the hook a test needs, and is why it never happens in production.
 */
const MAIL_LOG = path.join(here, "server.log");

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
    "DROP TABLE IF EXISTS activity, rate_limits, submissions, sessions, sessions_casting, "
      + "login_attempts, roles, users, clients, production_companies, schema_migrations CASCADE",
  );
  await pool.end();
}

/**
 * A stand-in for the mail provider. The app posts to it exactly as it posts to
 * Resend, so the delivery path under test is the real one; the messages land in
 * a file a suite can read instead of an inbox.
 */
function startMailbox() {
  writeFileSync(MAILBOX, "[]");
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try {
        const sent = JSON.parse(readFileSync(MAILBOX, "utf8"));
        sent.push({ at: Date.now(), ...JSON.parse(body) });
        writeFileSync(MAILBOX, JSON.stringify(sent, null, 2));
      } catch (error) {
        console.error("mailbox could not record a message:", error.message);
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "test" }));
    });
  });
  server.listen(MAIL_PORT, "127.0.0.1");
  return server;
}

const mailbox = startMailbox();
const blobStore = startBlobStandIn(BLOB_PORT, PORT + 3, PORT + 4);

let failures = 0;

for (const suite of SUITES) {
  console.log(`\n${"═".repeat(64)}\n  ${suite}\n${"═".repeat(64)}`);

  await resetDatabase();

  const signal = { exited: false };
  writeFileSync(MAIL_LOG, "");
  const log = openSync(MAIL_LOG, "a");
  const server = run("npx", ["next", "start", "--port", String(PORT)], {
    detached: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      NODE_ENV: "production",
      ADMIN_EMAILS: `${ADMIN_EMAIL},${SECOND_ADMIN}`,
      ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASSWORD,
      CRON_SECRET,
      AUTH_SECRET,
      RESEND_API_KEY: "test-key",
      RESEND_API_URL: `http://127.0.0.1:${MAIL_PORT}/emails`,
      ...(SUITE_ENV[suite] ?? {}),
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
          SECOND_ADMIN,
          CRON_SECRET,
          AUTH_SECRET,
          MAIL_LOG,
          MAILBOX,
          BLOB_STANDIN,
          BLOB_PROXY,
          ...(SUITE_ENV[suite] ?? {}),
        },
      });
      child.on("exit", resolve);
    });
    if (code !== 0) {
      failures++;
      console.log("--- server output ---");
      console.log(readFileSync(MAIL_LOG, "utf8").split("\n").slice(-40).join("\n"));
    }
  } catch (error) {
    console.error(`  ${suite} could not run:`, error.message);
    failures++;
  } finally {
    stop(server);
    // Give the port time to come back before the next suite claims it.
    await sleep(1500);
  }
}

mailbox.close();
blobStore.server.close();
blobStore.secure.close();
blobStore.proxy.close();
console.log(`\n${failures === 0 ? "All suites passed" : `${failures} suite(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
