export { prisma } from "./client";
export { PrismaClient, Prisma } from "@prisma/client";
export {
  upsertProfile,
  getTenantByOwnerId,
  getTenantByUsername,
  isUsernameTaken,
  createTenantForOwner,
  type CreateTenantResult,
} from "./tenant";
export {
  listPlans,
  listActivePlans,
  getPlanById,
  getPlanByKey,
  createPlan,
  updatePlan,
  setPlanActive,
  listPricingSettings,
  getPricingSetting,
  upsertPricingSetting,
  type PlanInput,
  type CreatePlanResult,
} from "./pricing";
export {
  getSubscriptionByTenant,
  createPlatformOrder,
  getPlatformOrderByRazorpayId,
  markPlatformOrderPaid,
  activateFreePlan,
  recordPaymentEvent,
  type PaidOrderResult,
} from "./subscription";
export {
  getWalletByTenant,
  ensureWallet,
  listWalletTransactions,
  debitWallet,
  type DebitResult,
} from "./wallet";
