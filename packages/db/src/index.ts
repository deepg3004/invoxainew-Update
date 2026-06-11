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
