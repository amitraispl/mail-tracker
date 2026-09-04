import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across dev hot-reloads so we don't exhaust the
// Neon connection pool by creating a new client on every module reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
