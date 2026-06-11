// Idempotent seed for C3 platform pricing. Upserts by stable key, so it is
// safe to run repeatedly — re-running never duplicates and only refreshes the
// seeded defaults. Run from the repo root:
//   dotenv -e .env -- node packages/db/prisma/seed.mjs
//
// MONEY: amounts are integer paise (₹1 = 100 paise); commission is integer
// basis points (1% = 100 bps). These are starting defaults — they are meant to
// be edited in the admin UI, which is the whole point of C3.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** ₹ → paise, % → bps, kept inline so the seed has no workspace deps. */
const rupees = (r) => Math.round(r * 100);
const percent = (p) => Math.round(p * 100);

const PLANS = [
  {
    key: "free",
    name: "Free",
    description: "Get started with a storefront and a single AI page.",
    priceMonthly: rupees(0),
    priceYearly: rupees(0),
    commissionBps: percent(5),
    maxProducts: 10,
    maxAiPages: 1,
    sortOrder: 0,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For growing sellers — lower commission, more room.",
    priceMonthly: rupees(499),
    priceYearly: rupees(4999),
    commissionBps: percent(3),
    maxProducts: 100,
    maxAiPages: 5,
    sortOrder: 1,
  },
  {
    key: "pro",
    name: "Pro",
    description: "Unlimited catalogue and AI pages, lowest commission.",
    priceMonthly: rupees(1499),
    priceYearly: rupees(14999),
    commissionBps: percent(1.5),
    maxProducts: null,
    maxAiPages: null,
    sortOrder: 2,
  },
];

const SETTINGS = [
  { key: "ai_page_price", label: "AI page generation fee", valuePaise: rupees(149) },
];

async function main() {
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { key: p.key },
      create: p,
      // Refresh editable fields, but never reactivate a plan an admin retired.
      update: {
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        commissionBps: p.commissionBps,
        maxProducts: p.maxProducts,
        maxAiPages: p.maxAiPages,
        sortOrder: p.sortOrder,
      },
    });
    console.log(`✓ plan: ${p.key}`);
  }

  for (const s of SETTINGS) {
    await prisma.pricingSetting.upsert({
      where: { key: s.key },
      create: s,
      update: { label: s.label, valuePaise: s.valuePaise },
    });
    console.log(`✓ pricing: ${s.key}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
