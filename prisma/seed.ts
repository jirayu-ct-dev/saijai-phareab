import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import {
  mockServicesData,
  mockCategoriesData,
  mockItemsData,
  mockPricesData,
  mockPackagesData,
} from "../shared/data/mockPricing.ts";

config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  console.log("Seeding categories...");
  for (const category of mockCategoriesData) {
    await prisma.storefrontCategory.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        description: category.description,
      },
      create: {
        id: category.id,
        name: category.name,
        description: category.description,
      },
    });
  }

  console.log("Seeding services...");
  for (const service of mockServicesData) {
    await prisma.storefrontService.upsert({
      where: { id: service.id },
      update: {
        name: service.name,
      },
      create: {
        id: service.id,
        name: service.name,
      },
    });
  }

  console.log("Seeding items...");
  for (const item of mockItemsData) {
    await prisma.storefrontItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        categoryId: item.categoryId,
        description: 'description' in item ? (item.description as string) : null,
      },
      create: {
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        description: 'description' in item ? (item.description as string) : null,
      },
    });
  }

  console.log("Seeding prices...");
  for (const price of mockPricesData) {
    const existing = await prisma.storefrontPrice.findUnique({
      where: {
        storefrontServiceId_storefrontItemId: {
          storefrontServiceId: price.storefrontServiceId,
          storefrontItemId: price.storefrontItemId,
        },
      },
    });

    if (existing) {
      await prisma.storefrontPrice.update({
        where: { id: existing.id },
        data: {
          price: price.price,
          priceMin: price.priceMin ?? null,
          priceMax: price.priceMax ?? null,
        },
      });
      continue;
    }

    await prisma.storefrontPrice.create({
      data: {
        storefrontServiceId: price.storefrontServiceId,
        storefrontItemId: price.storefrontItemId,
        price: price.price,
        priceMin: price.priceMin ?? null,
        priceMax: price.priceMax ?? null,
      },
    });
  }

  console.log("Seeding packages...");
  for (const pkg of mockPackagesData) {
    await prisma.packageProduct.upsert({
      where: { id: pkg.id },
      update: {
        name: pkg.name,
        description: pkg.description,
        packageType: pkg.packageType,
        deductOn: pkg.deductOn,
        price: pkg.price,
        credits: pkg.credits,
        validityDays: pkg.validityDays,
      },
      create: {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        packageType: pkg.packageType,
        deductOn: pkg.deductOn,
        price: pkg.price,
        credits: pkg.credits,
        validityDays: pkg.validityDays,
      },
    });
  }

  console.log("Seeding completed.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });