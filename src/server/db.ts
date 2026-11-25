import { type Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
		// The default 5 s is too tight for a transaction that makes several round trips to a hosted database.
		transactionOptions: { maxWait: 10_000, timeout: 20_000 },
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

/** The database client, or a transaction client inside `prisma.$transaction`. */
export type Db = PrismaClient | Prisma.TransactionClient;
