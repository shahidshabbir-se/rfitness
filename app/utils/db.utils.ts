import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Avoid creating multiple instances in development
const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export { prisma };
