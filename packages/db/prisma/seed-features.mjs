// Seed the Feature Billing engine (idempotent). Run from repo root:
//   dotenv -e .env -- node packages/db/prisma/seed-features.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rupees = (r) => Math.round(r * 100);

const RULES = [
  { featureKey: "ai_page", name: "AI page generation", basePaise: rupees(149), gstRateBps: 1800, walletEnabled: true, directEnabled: false, active: true },
  { featureKey: "extra_page", name: "Extra payment page", basePaise: rupees(149), gstRateBps: 1800, walletEnabled: true, directEnabled: false, active: true },
  { featureKey: "premium_template", name: "Premium template", basePaise: rupees(199), gstRateBps: 1800, walletEnabled: true, directEnabled: true, active: true },
];

// freeLimit per month: -1 = unlimited, 0 = always charged.
const LIMITS = {
  free: { ai_page: 1, extra_page: 0, premium_template: 0 },
  starter: { ai_page: 5, extra_page: 2, premium_template: 0 },
  pro: { ai_page: -1, extra_page: -1, premium_template: 0 },
};

async function main() {
  for (const r of RULES) {
    await prisma.featureRule.upsert({ where: { featureKey: r.featureKey }, create: r, update: r });
    console.log(`✓ rule: ${r.featureKey}`);
  }
  for (const [planKey, limits] of Object.entries(LIMITS)) {
    const plan = await prisma.plan.findUnique({ where: { key: planKey }, select: { id: true } });
    if (!plan) {
      console.log(`(plan "${planKey}" not found, skip)`);
      continue;
    }
    for (const [featureKey, freeLimit] of Object.entries(limits)) {
      await prisma.planFeatureLimit.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        create: { planId: plan.id, featureKey, freeLimit },
        update: { freeLimit },
      });
    }
    console.log(`✓ limits: ${planKey} → ${JSON.stringify(limits)}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
