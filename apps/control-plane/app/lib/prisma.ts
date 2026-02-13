import { PrismaClient } from "./generated/prisma";

declare global {
  // eslint-disable-next-line no-var
  var __cp_prisma: PrismaClient | undefined;
}

export const prisma = global.__cp_prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__cp_prisma = prisma;
}
