import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import {
  mockServicesData,
  mockCategoriesData,
  mockItemsData,
  mockPricesData,
  mockPackagesData,
} from "../shared/data/mockPricing.ts";
import { normalizeThaiPhoneNumber } from "../shared/utils/phone.ts";

config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── ID constants ───
const USERS = {
  admin:    "seed-admin-001",
  employee: "seed-employee-001",
  customer: "seed-customer-001",
  customer2:"seed-customer-002",
} as const;

// ─── helpers ───
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);
const baht = (n: number) => n; // Prisma Decimal accepts number

async function main() {
  console.log("🌱 SaiJai Phareab — Full Database Seeding\n");

  // ═══════════════════════════════════════════
  // 1. SETTINGS (singleton records)
  // ═══════════════════════════════════════════
  console.log("⚙️  Settings...");

  await prisma.shopSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "ใส่ใจ ผ้าเรียบ",
      phone: "081-234-5678",
      address: "123/4 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
    },
  });

  await prisma.businessSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      hangerPricePerUnit: 10,
      washFoldPricePerKg: 60,
      washFoldMinKg: 1,
      vatRate: 0,
      vatIncluded: false,
      paymentNoPrefix: "PAY-",
      orderNoPrefix: "ORD-",
      quotationNoPrefix: "QT-",
      receiptNoPrefix: "RC-",
      minimumOrderAmount: 0,
      packageRefundDays: 7,
    },
  });

  await prisma.notificationSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // ═══════════════════════════════════════════
  // 2. USERS
  // ═══════════════════════════════════════════
  console.log("👤 Users...");

  const userData = [
    { id: USERS.admin,    email: "admin@saijai.local",    name: "คุณผู้ดูแล",  role: "ADMIN" as const,    phone: "081-111-1111" },
    { id: USERS.employee, email: "employee@saijai.local", name: "คุณพนักงาน",  role: "EMPLOYEE" as const, phone: "081-222-2222" },
    { id: USERS.customer, email: "customer@saijai.local", name: "คุณลูกค้า",   role: "USER" as const,     phone: "081-333-3333" },
    { id: USERS.customer2,email: "customer2@saijai.local",name: "คุณสมาชิก",   role: "USER" as const,     phone: "081-444-4444" },
  ];

  // same password for all test users: password123
  const passwordHash = await hashPassword("password123");

  for (const u of userData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, phoneNumber: u.phone, normalizedPhoneNumber: normalizeThaiPhoneNumber(u.phone) },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        phoneNumber: u.phone,
        normalizedPhoneNumber: normalizeThaiPhoneNumber(u.phone),
        emailVerified: true,
      },
    });

    // create credential account for email/password login
    await prisma.account.upsert({
      where: { id: `seed-account-${u.id}` },
      update: { password: passwordHash },
      create: {
        id: `seed-account-${u.id}`,
        accountId: u.email,
        providerId: "credential",
        userId: u.id,
        password: passwordHash,
      },
    });
  }

  // ═══════════════════════════════════════════
  // 3. STOREFRONT (existing mock data)
  // ═══════════════════════════════════════════
  console.log("🏷️  Storefront...");

  for (const cat of mockCategoriesData) {
    await prisma.storefrontCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name, description: cat.description },
      create: { id: cat.id, name: cat.name, description: cat.description },
    });
  }
  for (const svc of mockServicesData) {
    await prisma.storefrontService.upsert({
      where: { id: svc.id },
      update: { name: svc.name },
      create: { id: svc.id, name: svc.name },
    });
  }
  for (const item of mockItemsData) {
    await prisma.storefrontItem.upsert({
      where: { id: item.id },
      update: { name: item.name, categoryId: item.categoryId },
      create: { id: item.id, name: item.name, categoryId: item.categoryId },
    });
  }
  for (const price of mockPricesData) {
    await prisma.storefrontPrice.upsert({
      where: { storefrontServiceId_storefrontItemId: { storefrontServiceId: price.storefrontServiceId, storefrontItemId: price.storefrontItemId } },
      update: { price: price.price, priceMin: price.priceMin ?? null, priceMax: price.priceMax ?? null },
      create: { storefrontServiceId: price.storefrontServiceId, storefrontItemId: price.storefrontItemId, price: price.price, priceMin: price.priceMin ?? null, priceMax: price.priceMax ?? null },
    });
  }

  // ═══════════════════════════════════════════
  // 4. PACKAGES
  // ═══════════════════════════════════════════
  console.log("📦 Packages...");

  const pkgIds: Record<string, string> = {};
  for (const p of mockPackagesData) {
    pkgIds[p.name] = p.id;
    await prisma.packageProduct.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, packageType: p.packageType as any, deductOn: p.deductOn as any, price: p.price, credits: p.credits, validityDays: p.validityDays },
      create: { id: p.id, name: p.name, description: p.description, packageType: p.packageType as any, deductOn: p.deductOn as any, price: p.price, credits: p.credits, validityDays: p.validityDays },
    });
  }

  // ═══════════════════════════════════════════
  // 5. PACKAGE SALES + ENTITLEMENTS
  // ═══════════════════════════════════════════
  console.log("💳 Package Sales...");

  // Sale 1: Customer buys M package
  const sale1Id = "seed-sale-001";
  const sale1ItemId = "seed-saleitem-001";
  const ent1Id = "seed-ent-001";

  await prisma.packageSale.upsert({
    where: { id: sale1Id },
    update: {},
    create: {
      id: sale1Id,
      customerId: USERS.customer2,
      soldById: USERS.admin,
      status: "PAID",
      subtotalAmount: baht(1290),
      discountAmount: baht(0),
      totalAmount: baht(1290),
      createdAt: daysAgo(10),
    },
  });

  await prisma.packageSaleItem.upsert({
    where: { id: sale1ItemId },
    update: {},
    create: {
      id: sale1ItemId,
      packageSaleId: sale1Id,
      productId: pkgIds["M"],
      itemType: "MAIN",
      qty: 1,
      unitPrice: baht(1290),
      totalPrice: baht(1290),
    },
  });

  await prisma.memberEntitlement.upsert({
    where: { id: ent1Id },
    update: {},
    create: {
      id: ent1Id,
      customerId: USERS.customer2,
      sourceSaleItemId: sale1ItemId,
      productId: pkgIds["M"],
      status: "ACTIVE",
      creditInitial: 90,
      creditRemaining: 72,
      startAt: daysAgo(10),
      endAt: daysFromNow(20),
      activatedAt: daysAgo(10),
    },
  });

  // Sale 2: Draft sale (still in progress)
  const sale2Id = "seed-sale-002";
  await prisma.packageSale.upsert({
    where: { id: sale2Id },
    update: {},
    create: {
      id: sale2Id,
      customerId: USERS.customer,
      soldById: USERS.employee,
      status: "DRAFT",
      subtotalAmount: baht(850),
      totalAmount: baht(850),
      createdAt: daysAgo(1),
    },
  });

  // ═══════════════════════════════════════════
  // 6. SERVICE ORDERS
  // ═══════════════════════════════════════════
  console.log("🧺 Service Orders...");

  // Order 1: ซักรีดทั่วไป (RECEIVED)
  const order1Id = "seed-order-001";
  await prisma.serviceOrder.upsert({
    where: { id: order1Id },
    update: {},
    create: {
      id: order1Id,
      orderNo: "ORD-20250701-001",
      customerId: USERS.customer,
      employeeId: USERS.employee,
      status: "RECEIVED",
      subtotalAmount: baht(170),
      totalAmount: baht(170),
      receivedAt: daysAgo(1),
      dueAt: daysFromNow(2),
    },
  });

  // Order 1 items
  const order1Items = [
    { id: "seed-oi-001", storefrontItemId: "i1", storefrontServiceId: "s1", qty: 3, price: 15 },  // เสื้อยืด ซักรีด 3 ตัว
    { id: "seed-oi-002", storefrontItemId: "i11", storefrontServiceId: "s1", qty: 2, price: 30 }, // สแลค ซักรีด 2 ตัว
    { id: "seed-oi-003", storefrontItemId: "i17", storefrontServiceId: "s2", qty: 2, price: 20 }, // ผ้าเช็ดตัว ซักพับ 2 ผืน
  ];
  for (const oi of order1Items) {
    await prisma.serviceOrderItem.upsert({
      where: { id: oi.id },
      update: {},
      create: {
        id: oi.id,
        serviceOrderId: order1Id,
        storefrontPriceId: (await prisma.storefrontPrice.findUniqueOrThrow({ where: { storefrontServiceId_storefrontItemId: { storefrontServiceId: oi.storefrontServiceId, storefrontItemId: oi.storefrontItemId } } })).id,
        quantity: oi.qty,
        unitPrice: baht(oi.price),
        totalPrice: baht(oi.price * oi.qty),
      },
    });
  }

  // Order 2: ซักแห้ง (PROCESSING)
  const order2Id = "seed-order-002";
  await prisma.serviceOrder.upsert({
    where: { id: order2Id },
    update: {},
    create: {
      id: order2Id,
      orderNo: "ORD-20250701-002",
      customerId: USERS.customer2,
      employeeId: USERS.employee,
      status: "PROCESSING",
      memberEntitlementId: ent1Id,
      creditUsed: 0,
      subtotalAmount: baht(380),
      totalAmount: baht(380),
      receivedAt: daysAgo(3),
      dueAt: daysAgo(1),
    },
  });

  const order2Items = [
    { id: "seed-oi-004", storefrontItemId: "cmojuey0j0002iwmtcx2lnjle", storefrontServiceId: "cmojubuag0000iwmthga44tve", qty: 1, price: 180 },
    { id: "seed-oi-005", storefrontItemId: "cmojug8rz0006iwmtkziug9fu", storefrontServiceId: "cmojubuag0000iwmthga44tve", qty: 1, price: 120 },
  ];
  for (const oi of order2Items) {
    await prisma.serviceOrderItem.upsert({
      where: { id: oi.id },
      update: {},
      create: {
        id: oi.id,
        serviceOrderId: order2Id,
        storefrontPriceId: (await prisma.storefrontPrice.findUniqueOrThrow({ where: { storefrontServiceId_storefrontItemId: { storefrontServiceId: oi.storefrontServiceId, storefrontItemId: oi.storefrontItemId } } })).id,
        quantity: oi.qty,
        unitPrice: baht(oi.price),
        totalPrice: baht(oi.price * oi.qty),
      },
    });
  }

  // Order 3: Customer wash-and-fold order (COMPLETED)
  const order3Id = "seed-order-003";
  await prisma.serviceOrder.upsert({
    where: { id: order3Id },
    update: {},
    create: {
      id: order3Id,
      orderNo: "ORD-20250628-003",
      customerId: USERS.customer,
      employeeId: USERS.employee,
      status: "COMPLETED",
      subtotalAmount: baht(75),
      totalAmount: baht(75),
      receivedAt: daysAgo(7),
      dueAt: daysAgo(4),
    },
  });
  await prisma.serviceOrderItem.upsert({
    where: { id: "seed-oi-006" },
    update: {},
    create: {
      id: "seed-oi-006",
      serviceOrderId: order3Id,
      storefrontPriceId: (await prisma.storefrontPrice.findUniqueOrThrow({ where: { storefrontServiceId_storefrontItemId: { storefrontServiceId: "s2", storefrontItemId: "i1" } } })).id,
      quantity: 5,
      unitPrice: baht(10),
      totalPrice: baht(50),
    },
  });

  // ═══════════════════════════════════════════
  // 7. PAYMENTS
  // ═══════════════════════════════════════════
  console.log("💰 Payments...");

  // Payment for sale 1 (PAID)
  await prisma.paymentRecord.upsert({
    where: { id: "seed-pay-001" },
    update: {},
    create: {
      id: "seed-pay-001",
      paymentNo: "PAY-20250701-001",
      receiptNo: "RC-20250701-001",
      userId: USERS.customer2,
      packageSaleId: sale1Id,
      amount: baht(1290),
      status: "PAID",
      method: "TRANSFER",
      paidAt: daysAgo(10),
      confirmedAt: daysAgo(10),
      confirmedById: USERS.admin,
    },
  });

  // Payment for order 1 (UNPAID)
  await prisma.paymentRecord.upsert({
    where: { id: "seed-pay-002" },
    update: {},
    create: {
      id: "seed-pay-002",
      paymentNo: "PAY-20250702-002",
      userId: USERS.customer,
      serviceOrderId: order1Id,
      amount: baht(170),
      status: "UNPAID",
      method: "CASH",
    },
  });

  // Payment for order 3 (PAID - cash)
  await prisma.paymentRecord.upsert({
    where: { id: "seed-pay-003" },
    update: {},
    create: {
      id: "seed-pay-003",
      paymentNo: "PAY-20250628-003",
      receiptNo: "RC-20250628-003",
      userId: USERS.customer,
      serviceOrderId: order3Id,
      amount: baht(75),
      status: "PAID",
      method: "CASH",
      paidAt: daysAgo(7),
      confirmedAt: daysAgo(7),
      confirmedById: USERS.admin,
    },
  });

  // ═══════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════
  console.log("\n✅ Seeding completed!");
  console.log("─────────────────────────────────────");
  console.log("  👤 admin@saijai.local       (ADMIN)");
  console.log("  👤 employee@saijai.local    (EMPLOYEE)");
  console.log("  👤 customer@saijai.local    (USER)");
  console.log("  👤 customer2@saijai.local   (USER / Member)");
  console.log("  🧺 3 service orders");
  console.log("  💳 2 package sales + 1 active entitlement");
  console.log("  💰 3 payment records");
  console.log("─────────────────────────────────────");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
