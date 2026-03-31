import prismaClientModule from "../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import {
  mockServicesData,
  mockCategoriesData,
  mockItemsData,
  mockPricesData,
} from "../shared/data/mockPricing.ts";

config();
const { PrismaClient } = prismaClientModule;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting database seeding...')

    // 1. Seed Categories
    console.log('⏳ Seeding categories...')
    for (const cat of mockCategoriesData) {
        await prisma.storefrontCategory.upsert({
            where: { id: cat.id },
            update: { name: cat.name, description: cat.description },
            create: { id: cat.id, name: cat.name, description: cat.description }
        })
    }

    // 2. Seed Services
    console.log('⏳ Seeding services...')
    for (const srv of mockServicesData) {
        await prisma.storefrontService.upsert({
            where: { id: srv.id },
            update: { name: srv.name },
            create: { id: srv.id, name: srv.name }
        })
    }

    // 3. Seed Items
    console.log('⏳ Seeding items...')
    for (const item of mockItemsData) {
        await prisma.storefrontItem.upsert({
            where: { id: item.id },
            update: { name: item.name, categoryId: item.categoryId },
            create: { id: item.id, name: item.name, categoryId: item.categoryId }
        })
    }

    // 4. Seed Prices
    console.log('⏳ Seeding prices...')
    for (const price of mockPricesData) {
        const existing = await prisma.storefrontPrice.findUnique({
            where: {
                storefrontServiceId_storefrontItemId: {
                    storefrontServiceId: price.storefrontServiceId,
                    storefrontItemId: price.storefrontItemId
                }
            }
        })
        
        if (existing) {
            await prisma.storefrontPrice.update({
                where: { id: existing.id },
                data: { price: price.price }
            })
        } else {
            await prisma.storefrontPrice.create({
                data: {
                    storefrontServiceId: price.storefrontServiceId,
                    storefrontItemId: price.storefrontItemId,
                    price: price.price
                }
            })
        }
    }

    console.log('✅ Seeding completed!')
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
