import { PrismaClient } from '~~/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Singleton Prisma Client สำหรับ Server-side
 * ป้องกันการสร้าง connection ใหม่ในทุก request (Hot Module Replacement dev mode)
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const poolMax = Number(process.env.PRISMA_POOL_MAX ?? (process.env.NODE_ENV === "production" ? 1 : 5))

function createPrismaClient(): PrismaClient {
    const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
        max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 15_000,
    })
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
