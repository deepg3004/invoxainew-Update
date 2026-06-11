export { prisma } from "./client";
export { PrismaClient, Prisma } from "@prisma/client";
export {
  upsertProfile,
  getTenantByOwnerId,
  getTenantByUsername,
  isUsernameTaken,
  createTenantForOwner,
  isTenantSuspended,
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
export {
  getSellerGateway,
  connectSellerGateway,
  disconnectSellerGateway,
} from "./gateway";
export {
  createPaymentPage,
  listPaymentPages,
  getPaymentPageById,
  getActivePaymentPage,
  getActivePaymentPageById,
  updatePaymentPage,
  setPaymentPageActive,
  getCommissionBpsForTenant,
  createBuyerPayment,
  getBuyerPaymentByOrderId,
  markBuyerPaymentPaid,
  settleDueCommissions,
  listTenantOrders,
  getTenantSalesSummary,
  updateOrderFulfillment,
  type CreatePageResult,
  type BuyerPaidResult,
  type SalesSummary,
} from "./payments";
export {
  ensureBuyerAccount,
  listBuyerOrders,
} from "./buyer";
export {
  chargeAndCreateAiPage,
  listAiPages,
  getPublishedAiPage,
  deleteAiPage,
  type ChargeCreateResult,
} from "./aipage";
export {
  getPlatformOverview,
  listTenantsAdmin,
  getTenantAdminDetail,
  setTenantSuspended,
  adminAdjustWallet,
  listAdminAuditLog,
  getRevenueReport,
  getWalletAttention,
  searchBuyerPayments,
  listRecentPaymentEvents,
  type PlatformOverview,
  type AdminWalletResult,
  type RevenueReport,
  type AttentionRow,
} from "./admin";
