export { prisma } from "./client";
export { PrismaClient, Prisma } from "@prisma/client";
export type { ProductKind, ProductStatus, DiscountType, CourseStatus, LeadFormStatus } from "@prisma/client";
export {
  upsertProfile,
  getTenantByOwnerId,
  getTenantByUsername,
  isUsernameTaken,
  createTenantForOwner,
  isTenantSuspended,
  getOnboardingStatus,
  type CreateTenantResult,
  type OnboardingStatus,
} from "./tenant";
export {
  listPlans,
  listActivePlans,
  getPlanById,
  getPlanByKey,
  createPlan,
  updatePlan,
  setPlanActive,
  planAllowsCustomDomain,
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
  claimPaymentEvent,
  markPaymentEventProcessed,
  recordPaymentEventError,
  countUnprocessedEvents,
  type PaidOrderResult,
} from "./subscription";
export {
  getWalletByTenant,
  getWalletStatus,
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
  createCartOrder,
  getBuyerPaymentByOrderId,
  markBuyerPaymentPaid,
  settleDueCommissions,
  listTenantOrders,
  countTenantOrders,
  listAbandonedCheckouts,
  countAbandonedCheckouts,
  listSoldOutProductsForOrder,
  getTenantSalesSummary,
  updateOrderFulfillment,
  setOrderFulfillmentStatus,
  getRefundableOrder,
  recordRefund,
  type CreatePageResult,
  type BuyerPaidResult,
  type SalesSummary,
  type RefundResult,
  type OrderListOpts,
  type FulfillmentStatusFilter,
} from "./payments";
export {
  ensureBuyerAccount,
  listBuyerOrders,
  getBuyerOrder,
} from "./buyer";
export {
  issueSubscriptionInvoices,
  listInvoices,
  getInvoice,
} from "./invoice";
export {
  getTenantTracking,
  upsertTenantTracking,
} from "./tracking";
export {
  notifyTenant,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notifications";
export {
  normalizeDomain,
  addDomain,
  listDomains,
  getDomainById,
  deleteDomain,
  markDomainVerified,
  getTenantByCustomDomain,
  type AddDomainResult,
  type VerifyDomainResult,
} from "./domains";
export {
  createProduct,
  listProducts,
  getProductById,
  listPublishedProducts,
  getPublishedProduct,
  getPublishedProductById,
  listPublishedProductsByIds,
  updateProduct,
  setProductStatus,
  type CreateProductResult,
} from "./products";
export {
  createCoupon,
  listCoupons,
  getCouponById,
  updateCoupon,
  setCouponActive,
  deleteCoupon,
  applyCoupon,
  type CouponInput,
  type CreateCouponResult,
  type ApplyCouponResult,
} from "./coupons";
export {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  setCourseStatus,
  listLessons,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  listPublishedCourses,
  getPublishedCourse,
  getPublishedCourseById,
  getPublishedCourseMeta,
  getEnrolment,
  listEnrolledCourses,
  type CreateCourseResult,
} from "./courses";
export {
  chargeAndCreateAiPage,
  createAiPage,
  setAiPageChargeRef,
  listAiPages,
  getPublishedAiPage,
  getAiPageForOwner,
  updateAiPageContent,
  setAiPagePublished,
  deleteAiPage,
  type ChargeCreateResult,
  type CreateAiPageResult,
} from "./aipage";
export {
  getFeatureRule,
  listFeatureRules,
  upsertFeatureRule,
  setPlanFeatureLimit,
  listPlanFeatureLimits,
  getFeatureUsage,
  getFeatureQuota,
  getTenantFeatureUsageSummary,
  consumeFeature,
  type ConsumeResult,
  type FeatureQuota,
  type FeatureUsageRow,
} from "./feature";
export {
  getPlatformOverview,
  listTenantsAdmin,
  getTenantAdminDetail,
  setTenantSuspended,
  adminAdjustWallet,
  markChargeback,
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

export {
  createLeadForm,
  listLeadForms,
  getLeadFormById,
  getPublishedLeadForm,
  updateLeadForm,
  setLeadFormStatus,
  submitLead,
  listLeadSubmissions,
  countLeadSubmissions,
  type CreateLeadFormResult,
  type LeadFormInput,
} from "./leadforms";

export { listContacts, type CrmContact } from "./crm";

export {
  getBioLink,
  getPublishedBioLink,
  upsertBioLink,
  recordBioLinkClick,
  getBioLinkClickStats,
  type BioLinkInput,
  type BioClickStat,
} from "./biolink";

export {
  getAnalytics,
  type AnalyticsResult,
  type AnalyticsDay,
} from "./analytics";
