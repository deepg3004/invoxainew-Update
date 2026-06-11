// InvoxAI lightweight monitor (Phase 1.4). Run every few minutes via the
// systemd timer (infra/systemd/invox-monitor.timer). Pings every app's /health
// and runs money/data anomaly checks, printing a status line (captured by the
// journal). Exits non-zero if anything is wrong, and — when ALERT_WEBHOOK_URL is
// set — POSTs a one-line alert. No external account required.
//
// Self-contained: reads DATABASE_URL straight from the root .env and resolves
// @prisma/client from packages/db, so it runs as a bare `node` with no cwd/dep
// assumptions (which is how the systemd timer invokes it).
//
//   node /root/invoxai/infra/monitor/healthcheck.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = "/root/invoxai";

// --- minimal .env loader (no dotenv dependency) ---
for (const line of readFileSync(`${ROOT}/.env`, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const require = createRequire(`${ROOT}/packages/db/`);
const { PrismaClient } = require("@prisma/client");

const SERVICES = [
  ["web", 3000],
  ["app", 3001],
  ["admin", 3002],
  ["tenant", 3003],
];
const LOW_WALLET_PAISE = 5000; // ₹50
const STUCK_ORDER_MINUTES = 60;

const problems = [];

async function checkHealth() {
  for (const [name, port] of SERVICES) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(8000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok !== true) {
        problems.push(`service ${name}:${port} unhealthy (HTTP ${res.status})`);
      }
    } catch (e) {
      problems.push(`service ${name}:${port} DOWN (${e.name})`);
    }
  }
}

async function checkData(prisma) {
  const negative = await prisma.wallet.count({ where: { balancePaise: { lt: 0 } } });
  if (negative > 0) problems.push(`${negative} wallet(s) NEGATIVE`);

  // Webhook events stuck unprocessed >10m (retry not converging) — a real issue.
  const stuckEvents = await prisma.paymentEvent.count({
    where: {
      processedAt: null,
      createdAt: { lt: new Date(Date.now() - 10 * 60_000) },
    },
  });
  if (stuckEvents > 0) problems.push(`${stuckEvents} webhook event(s) UNPROCESSED >10m`);

  const cutoff = new Date(Date.now() - STUCK_ORDER_MINUTES * 60_000);
  const stuck = await prisma.buyerPayment.count({
    where: { status: "CREATED", createdAt: { lt: cutoff } },
  });
  const due = await prisma.commissionCharge.aggregate({
    where: { status: "DUE" },
    _sum: { amountPaise: true },
  });
  const lowWallets = await prisma.wallet.count({
    where: { balancePaise: { lt: LOW_WALLET_PAISE } },
  });
  return { stuck, duePaise: due._sum.amountPaise ?? 0, lowWallets };
}

async function alert(message) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 InvoxAI: ${message}` }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* best-effort */
  }
}

const prisma = new PrismaClient({ log: ["error"] });
try {
  await checkHealth();
  const stats = await checkData(prisma);
  const ts = new Date().toISOString();
  if (problems.length) {
    const msg = problems.join("; ");
    console.error(`[${ts}] PROBLEM: ${msg}`);
    await alert(msg);
    process.exitCode = 1;
  } else {
    console.log(
      `[${ts}] OK — 4 services healthy; stuckOrders=${stats.stuck} dueCommission=INR${stats.duePaise / 100} lowWallets=${stats.lowWallets}`,
    );
  }
} catch (e) {
  console.error(`[${new Date().toISOString()}] MONITOR ERROR: ${e.message}`);
  await alert(`monitor failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
