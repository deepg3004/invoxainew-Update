import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
try {
  const t = await p.tenant.findFirst({ where: { username: "rdalgo" }, select: { id: true } });
  const pg = await p.paymentPage.create({ data: { tenantId: t.id, slug: "upitest-tmp", title: "UPI Render Test", amountPaise: 100, isActive: true }, select: { id: true } });
  console.log("created:" + pg.id);
} finally { await p.$disconnect(); }
