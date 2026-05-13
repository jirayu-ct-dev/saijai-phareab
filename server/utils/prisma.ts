import { PrismaClient } from '~~/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Singleton Prisma Client สำหรับ Server-side
 * ป้องกันการสร้าง connection ใหม่ในทุก request (Hot Module Replacement dev mode)
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
    const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
        max: 5,
        idleTimeoutMillis: 10_000,
    })
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
