import { Prisma } from "~~/app/generated/prisma/client";

export const DELETED_DATA_TYPES = [
  "user",
  "service_order",
  "package_sale",
  "payment_record",
  "member_entitlement",
  "storefront_price",
] as const;

export type DeletedDataType = typeof DELETED_DATA_TYPES[number];

export type DeletedDataItem = {
  id: string;
  type: DeletedDataType;
  title: string;
  description: string;
  amount?: number;
  deletedAt: Date;
  deletedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  impact: string[];
};

type Tx = Prisma.TransactionClient;
type PrismaLike = Tx;

export const HARD_DELETE_CONFIRM_TEXT = "ยืนยันการลบข้อมูล";
export const WALK_IN_EMAIL = "walkin@saijai.local";

export const deletedDataTypeLabels: Record<DeletedDataType | "all", string> = {
  all: "ทั้งหมด",
  user: "ผู้ใช้งาน",
  service_order: "รายการรับผ้า",
  package_sale: "รายการขายแพ็กเกจ",
  payment_record: "การชำระเงิน",
  member_entitlement: "แพ็กเกจสมาชิก",
  storefront_price: "ราคาหน้าร้าน",
};

export const isDeletedDataType = (value: string): value is DeletedDataType =>
  DELETED_DATA_TYPES.includes(value as DeletedDataType);

const deletedBySelect = {
  id: true,
  name: true,
  email: true,
} as const;

const toDeletedBy = (value: { id: string; name: string | null; email: string } | null | undefined) =>
  value ? { id: value.id, name: value.name, email: value.email } : null;

const createSearch = (search: string | null | undefined) => search?.trim() || "";

const createInsensitiveContains = (search: string) => ({
  contains: search,
  mode: "insensitive" as const,
});

const inIds = (ids: string[]) => ids.length ? { in: ids } : { in: ["__none__"] };

export const getDeletedDataImpact = async (
  prisma: PrismaLike,
  type: DeletedDataType,
  id: string,
): Promise<string[]> => {
  if (type === "user") {
    const [orders, payments, entitlements, packageSales, images, addresses] = await Promise.all([
      prisma.serviceOrder.count({ where: { customerId: id } }),
      prisma.paymentRecord.count({ where: { userId: id } }),
      prisma.memberEntitlement.count({ where: { customerId: id } }),
      prisma.packageSale.count({ where: { customerId: id } }),
      prisma.image.count({ where: { userId: id } }),
      prisma.userAddress.count({ where: { userId: id } }),
    ]);
    return [
      `${orders} คำสั่งซักรีด`,
      `${payments} การชำระเงิน`,
      `${entitlements} แพ็กเกจสมาชิก`,
      `${packageSales} รายการขายแพ็กเกจ`,
      `${images} รูปภาพ`,
      `${addresses} ที่อยู่`,
    ];
  }

  if (type === "service_order") {
    const [items, payments] = await Promise.all([
      prisma.serviceOrderItem.count({ where: { serviceOrderId: id } }),
      prisma.paymentRecord.count({ where: { serviceOrderId: id } }),
    ]);
    return [`${items} รายการผ้า`, `${payments} การชำระเงิน`];
  }

  if (type === "package_sale") {
    const saleItems = await prisma.packageSaleItem.findMany({
      where: { packageSaleId: id },
      select: { id: true },
    });
    const saleItemIds = saleItems.map((item) => item.id);
    const [payments, entitlements] = await Promise.all([
      prisma.paymentRecord.count({ where: { packageSaleId: id } }),
      prisma.memberEntitlement.count({ where: { sourceSaleItemId: inIds(saleItemIds) } }),
    ]);
    return [`${saleItemIds.length} รายการแพ็กเกจ`, `${payments} การชำระเงิน`, `${entitlements} สิทธิ์สมาชิก`];
  }

  if (type === "payment_record") {
    const logs = await prisma.paymentAuditLog.count({ where: { paymentId: id } });
    return [`${logs} ประวัติการเปลี่ยนแปลง`, "รูปสลิปที่เกี่ยวข้อง"];
  }

  if (type === "member_entitlement") {
    const [payments, orders, notifications] = await Promise.all([
      prisma.paymentRecord.count({ where: { memberEntitlementId: id } }),
      prisma.serviceOrder.count({ where: { memberEntitlementId: id } }),
      prisma.packageExpiryNotification.count({ where: { entitlementId: id } }),
    ]);
    return [`${payments} การชำระเงิน`, `${orders} ออเดอร์ที่อ้างอิง`, `${notifications} ประวัติแจ้งเตือนหมดอายุ`];
  }

  const orderItems = await prisma.serviceOrderItem.count({ where: { storefrontPriceId: id } });
  return [`${orderItems} รายการผ้าที่อ้างอิงราคานี้`];
};

export const getDeletedDataItems = async (
  prisma: PrismaLike,
  params: {
    type: DeletedDataType | "all";
    search?: string | null;
    page: number;
    limit: number;
  },
) => {
  const search = createSearch(params.search);
  const fetchLimit = params.type === "all" ? Math.max(params.page * params.limit, params.limit) : params.limit;
  const skip = params.type === "all" ? 0 : (params.page - 1) * params.limit;
  const types = params.type === "all" ? DELETED_DATA_TYPES : [params.type];
  const items: DeletedDataItem[] = [];
  let total = 0;

  if (types.includes("user")) {
    const where: Prisma.UserWhereInput = {
      deletedAt: { not: null },
      email: { not: WALK_IN_EMAIL },
      ...(search
        ? {
            OR: [
              { name: createInsensitiveContains(search) },
              { email: createInsensitiveContains(search) },
              { phoneNumber: createInsensitiveContains(search) },
            ],
          }
        : {}),
    };
    total += await prisma.user.count({ where });
    const rows = await prisma.user.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip,
      take: fetchLimit,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        deletedAt: true,
        deletedBy: { select: deletedBySelect },
      },
    });
    for (const row of rows) {
      if (!row.deletedAt) continue;
      items.push({
        id: row.id,
        type: "user",
        title: row.name || row.email,
        description: [row.email, row.phoneNumber].filter(Boolean).join(" | "),
        deletedAt: row.deletedAt,
        deletedBy: toDeletedBy(row.deletedBy),
        impact: await getDeletedDataImpact(prisma, "user", row.id),
      });
    }
  }

  if (types.includes("service_order")) {
    const where: Prisma.ServiceOrderWhereInput = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { orderNo: createInsensitiveContains(search) },
              { quotationNo: createInsensitiveContains(search) },
              { walkInName: createInsensitiveContains(search) },
              { customer: { name: createInsensitiveContains(search) } },
              { customer: { email: createInsensitiveContains(search) } },
            ],
          }
        : {}),
    };
    total += await prisma.serviceOrder.count({ where });
    const rows = await prisma.serviceOrder.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip,
      take: fetchLimit,
      select: {
        id: true,
        orderNo: true,
        isWalkIn: true,
        walkInName: true,
        totalAmount: true,
        deletedAt: true,
        deletedBy: { select: deletedBySelect },
        customer: { select: { name: true, email: true } },
      },
    });
    for (const row of rows) {
      if (!row.deletedAt) continue;
      items.push({
        id: row.id,
        type: "service_order",
        title: row.orderNo ? `Order #${row.orderNo}` : "รายการรับผ้า",
        description: `${row.isWalkIn ? row.walkInName || "ลูกค้าหน้าร้าน (walk-in)" : row.customer.name || row.customer.email} | ยอด ${Number(row.totalAmount ?? 0).toLocaleString("th-TH")} บาท`,
        amount: Number(row.totalAmount ?? 0),
        deletedAt: row.deletedAt,
        deletedBy: toDeletedBy(row.deletedBy),
        impact: await getDeletedDataImpact(prisma, "service_order", row.id),
      });
    }
  }

  if (types.includes("package_sale")) {
    const where: Prisma.PackageSaleWhereInput = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { customer: { name: createInsensitiveContains(search) } },
              { customer: { email: createInsensitiveContains(search) } },
              { note: createInsensitiveContains(search) },
            ],
          }
        : {}),
    };
    total += await prisma.packageSale.count({ where });
    const rows = await prisma.packageSale.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip,
      take: fetchLimit,
      select: {
        id: true,
        totalAmount: true,
        deletedAt: true,
        deletedBy: { select: deletedBySelect },
        customer: { select: { name: true, email: true } },
      },
    });
    for (const row of rows) {
      if (!row.deletedAt) continue;
      items.push({
        id: row.id,
        type: "package_sale",
        title: `ขายแพ็กเกจ: ${row.customer.name || row.customer.email}`,
        description: `ยอด ${Number(row.totalAmount).toLocaleString("th-TH")} บาท`,
        amount: Number(row.totalAmount),
        deletedAt: row.deletedAt,
        deletedBy: toDeletedBy(row.deletedBy),
        impact: await getDeletedDataImpact(prisma, "package_sale", row.id),
      });
    }
  }

  if (types.includes("payment_record")) {
    const where: Prisma.PaymentRecordWhereInput = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { paymentNo: createInsensitiveContains(search) },
              { receiptNo: createInsensitiveContains(search) },
              { user: { name: createInsensitiveContains(search) } },
              { user: { email: createInsensitiveContains(search) } },
            ],
          }
        : {}),
    };
    total += await prisma.paymentRecord.count({ where });
    const rows = await prisma.paymentRecord.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip,
      take: fetchLimit,
      select: {
        id: true,
        paymentNo: true,
        receiptNo: true,
        amount: true,
        deletedAt: true,
        deletedBy: { select: deletedBySelect },
        user: { select: { name: true, email: true } },
      },
    });
    for (const row of rows) {
      if (!row.deletedAt) continue;
      items.push({
        id: row.id,
        type: "payment_record",
        title: row.paymentNo || row.receiptNo || "การชำระเงิน",
        description: `${row.user.name || row.user.email} | ยอด ${Number(row.amount).toLocaleString("th-TH")} บาท`,
        amount: Number(row.amount),
        deletedAt: row.deletedAt,
        deletedBy: toDeletedBy(row.deletedBy),
        impact: await getDeletedDataImpact(prisma, "payment_record", row.id),
      });
    }
  }

  if (types.includes("member_entitlement")) {
    const where: Prisma.MemberEntitlementWhereInput = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { customer: { name: createInsensitiveContains(search) } },
              { customer: { email: createInsensitiveContains(search) } },
              { product: { name: createInsensitiveContains(search) } },
            ],
          }
        : {}),
    };
    total += await prisma.memberEntitlement.count({ where });
    const rows = await prisma.memberEntitlement.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip,
      take: fetchLimit,
      select: {
        id: true,
        creditRemaining: true,
        creditInitial: true,
        deletedAt: true,
        deletedBy: { select: deletedBySelect },
        customer: { select: { name: true, email: true } },
        product: { select: { name: true } },
      },
    });
    for (const row of rows) {
      if (!row.deletedAt) continue;
      items.push({
        id: row.id,
        type: "member_entitlement",
        title: row.product.name,
        description: `${row.customer.name || row.customer.email} | เครดิต ${row.creditRemaining ?? 0}/${row.creditInitial ?? 0}`,
        deletedAt: row.deletedAt,
        deletedBy: toDeletedBy(row.deletedBy),
        impact: await getDeletedDataImpact(prisma, "member_entitlement", row.id),
      });
    }
  }

  if (types.includes("storefront_price")) {
    const where: Prisma.StorefrontPriceWhereInput = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { storefrontService: { name: createInsensitiveContains(search) } },
              { storefrontItem: { name: createInsensitiveContains(search) } },
            ],
          }
        : {}),
    };
    total += await prisma.storefrontPrice.count({ where });
    const rows = await prisma.storefrontPrice.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip,
      take: fetchLimit,
      select: {
        id: true,
        price: true,
        priceMin: true,
        priceMax: true,
        deletedAt: true,
        deletedBy: { select: deletedBySelect },
        storefrontService: { select: { name: true } },
        storefrontItem: { select: { name: true } },
      },
    });
    for (const row of rows) {
      if (!row.deletedAt) continue;
      const priceLabel =
        row.priceMin != null && row.priceMax != null && row.priceMin !== row.priceMax
          ? `${Number(row.priceMin).toLocaleString("th-TH")}-${Number(row.priceMax).toLocaleString("th-TH")} บาท`
          : `${Number(row.price).toLocaleString("th-TH")} บาท`;
      items.push({
        id: row.id,
        type: "storefront_price",
        title: `${row.storefrontService.name} / ${row.storefrontItem.name}`,
        description: priceLabel,
        amount: Number(row.price),
        deletedAt: row.deletedAt,
        deletedBy: toDeletedBy(row.deletedBy),
        impact: await getDeletedDataImpact(prisma, "storefront_price", row.id),
      });
    }
  }

  const sorted = items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  const paginated = params.type === "all"
    ? sorted.slice((params.page - 1) * params.limit, params.page * params.limit)
    : sorted;

  return { items: paginated, total };
};

export const restoreDeletedData = async (tx: Tx, type: DeletedDataType, id: string) => {
  if (type === "user") {
    const user = await tx.user.findUnique({ where: { id }, select: { email: true } });
    if (user?.email === WALK_IN_EMAIL) {
      throw createError({ statusCode: 400, statusMessage: "ไม่สามารถกู้คืนผู้ใช้ระบบหน้าร้านได้" });
    }
    return tx.user.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  }
  if (type === "service_order") return tx.serviceOrder.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  if (type === "package_sale") return tx.packageSale.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  if (type === "payment_record") return tx.paymentRecord.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  if (type === "member_entitlement") return tx.memberEntitlement.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  return tx.storefrontPrice.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
};

const hardDeletePayments = async (tx: Tx, ids: string[]) => {
  if (!ids.length) return;
  const payments = await tx.paymentRecord.findMany({
    where: { id: inIds(ids) },
    select: { slipImageId: true },
  });
  const imageIds = payments.map((payment) => payment.slipImageId).filter((id): id is string => Boolean(id));
  await tx.paymentAuditLog.deleteMany({ where: { paymentId: inIds(ids) } });
  await tx.paymentRecord.deleteMany({ where: { id: inIds(ids) } });
  if (imageIds.length) await tx.image.deleteMany({ where: { id: inIds(imageIds) } });
};

const hardDeleteMemberEntitlements = async (tx: Tx, ids: string[]) => {
  if (!ids.length) return;
  const payments = await tx.paymentRecord.findMany({
    where: { memberEntitlementId: inIds(ids) },
    select: { id: true },
  });
  await tx.serviceOrder.updateMany({
    where: { memberEntitlementId: inIds(ids) },
    data: { memberEntitlementId: null },
  });
  await tx.packageExpiryNotification.deleteMany({ where: { entitlementId: inIds(ids) } });
  await hardDeletePayments(tx, payments.map((payment) => payment.id));
  await tx.memberEntitlement.deleteMany({ where: { id: inIds(ids) } });
};

const hardDeleteServiceOrders = async (tx: Tx, ids: string[]) => {
  if (!ids.length) return;
  const orders = await tx.serviceOrder.findMany({
    where: { id: inIds(ids) },
    select: { imageId: true, deliveryImageId: true },
  });
  const items = await tx.serviceOrderItem.findMany({
    where: { serviceOrderId: inIds(ids) },
    select: { id: true, imageId: true },
  });
  const itemIds = items.map((item) => item.id);
  const photos = await tx.serviceOrderItemImage.findMany({
    where: { serviceOrderItemId: inIds(itemIds) },
    select: { imageId: true },
  });
  const payments = await tx.paymentRecord.findMany({
    where: { serviceOrderId: inIds(ids) },
    select: { id: true },
  });
  const imageIds = [
    ...orders.flatMap((order) => [order.imageId, order.deliveryImageId]),
    ...items.map((item) => item.imageId),
    ...photos.map((photo) => photo.imageId),
  ].filter((id): id is string => Boolean(id));

  await hardDeletePayments(tx, payments.map((payment) => payment.id));
  await tx.serviceOrderItemImage.deleteMany({ where: { serviceOrderItemId: inIds(itemIds) } });
  await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: inIds(ids) } });
  await tx.serviceOrder.deleteMany({ where: { id: inIds(ids) } });
  if (imageIds.length) await tx.image.deleteMany({ where: { id: inIds(imageIds) } });
};

const hardDeletePackageSales = async (tx: Tx, ids: string[]) => {
  if (!ids.length) return;
  const saleItems = await tx.packageSaleItem.findMany({
    where: { packageSaleId: inIds(ids) },
    select: { id: true },
  });
  const saleItemIds = saleItems.map((item) => item.id);
  const entitlements = await tx.memberEntitlement.findMany({
    where: { sourceSaleItemId: inIds(saleItemIds) },
    select: { id: true },
  });
  const payments = await tx.paymentRecord.findMany({
    where: { packageSaleId: inIds(ids) },
    select: { id: true },
  });

  await hardDeletePayments(tx, payments.map((payment) => payment.id));
  await hardDeleteMemberEntitlements(tx, entitlements.map((entitlement) => entitlement.id));
  await tx.packageSaleItem.deleteMany({ where: { id: inIds(saleItemIds) } });
  await tx.packageSale.deleteMany({ where: { id: inIds(ids) } });
};

const clearUserReferences = async (tx: Tx, userId: string) => {
  await tx.user.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.packageProduct.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.packageSale.updateMany({ where: { soldById: userId }, data: { soldById: null } });
  await tx.packageSale.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.memberEntitlement.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.storefrontService.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.storefrontItem.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.storefrontCategory.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.storefrontPrice.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.basket.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.image.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.serviceOrder.updateMany({ where: { employeeId: userId }, data: { employeeId: null } });
  await tx.serviceOrder.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.serviceOrderItem.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.serviceOrderItemImage.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.paymentRecord.updateMany({ where: { confirmedById: userId }, data: { confirmedById: null } });
  await tx.paymentRecord.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
  await tx.paymentAuditLog.updateMany({ where: { actorId: userId }, data: { actorId: null } });
  await tx.userAddress.updateMany({ where: { deletedById: userId }, data: { deletedById: null } });
};

const hardDeleteUser = async (tx: Tx, id: string) => {
  const user = await tx.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) throw createError({ statusCode: 404, statusMessage: "ไม่พบผู้ใช้งาน" });
  if (user.email === WALK_IN_EMAIL) {
    throw createError({ statusCode: 400, statusMessage: "ห้ามลบผู้ใช้ระบบหน้าร้าน" });
  }

  const [orders, packageSales, entitlements, payments, images] = await Promise.all([
    tx.serviceOrder.findMany({ where: { customerId: id }, select: { id: true } }),
    tx.packageSale.findMany({ where: { customerId: id }, select: { id: true } }),
    tx.memberEntitlement.findMany({ where: { customerId: id }, select: { id: true } }),
    tx.paymentRecord.findMany({ where: { userId: id }, select: { id: true } }),
    tx.image.findMany({ where: { userId: id }, select: { id: true } }),
  ]);

  await hardDeleteServiceOrders(tx, orders.map((order) => order.id));
  await hardDeletePackageSales(tx, packageSales.map((sale) => sale.id));
  await hardDeleteMemberEntitlements(tx, entitlements.map((entitlement) => entitlement.id));
  await hardDeletePayments(tx, payments.map((payment) => payment.id));
  await tx.notificationSubscriber.deleteMany({ where: { userId: id } });
  await tx.userAddress.deleteMany({ where: { userId: id } });
  await tx.session.deleteMany({ where: { userId: id } });
  await tx.account.deleteMany({ where: { userId: id } });
  await clearUserReferences(tx, id);
  await tx.image.deleteMany({ where: { id: inIds(images.map((image) => image.id)) } });
  await tx.user.delete({ where: { id } });
};

export const hardDeleteDeletedData = async (tx: Tx, type: DeletedDataType, id: string) => {
  if (type === "user") return hardDeleteUser(tx, id);
  if (type === "service_order") return hardDeleteServiceOrders(tx, [id]);
  if (type === "package_sale") return hardDeletePackageSales(tx, [id]);
  if (type === "payment_record") return hardDeletePayments(tx, [id]);
  if (type === "member_entitlement") return hardDeleteMemberEntitlements(tx, [id]);

  await tx.serviceOrderItem.updateMany({ where: { storefrontPriceId: id }, data: { storefrontPriceId: null } });
  await tx.storefrontPrice.delete({ where: { id } });
};
