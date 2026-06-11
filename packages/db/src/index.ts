import { PrismaClient } from "@prisma/client";
import { loadEnv } from "@invoxai/config";

// Ensure the root .env is loaded before the client reads DATABASE_URL.
loadEnv();

/**
 * Prisma Client singleton.
 *
 * In dev, Next.js hot-reload re-evaluates modules and would otherwise spawn a
 * new client (and a new connection pool) on every change, exhausting the
 * Supabase pooler. We cache the instance on globalThis to prevent that.
 *
 * This module is server-only. Never import it from a Client Component.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient } from "@prisma/client";
