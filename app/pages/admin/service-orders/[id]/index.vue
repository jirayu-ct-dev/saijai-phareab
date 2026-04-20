<script setup lang="ts">
import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";

type BadgeColor = "success" | "info" | "error" | "neutral" | "primary" | "secondary" | "warning";
type InfoRow = { label: string; value: string; valueClass?: string; dividerBefore?: boolean };

type ServiceOrderDetailResponse = {
  id: string;
  orderNo: string | null;
  status: ServiceOrderStatus;
  isWalkIn: boolean;
  walkInName: string | null;
  walkInPhone: string | null;
  creditUsed: number | null;
  note: string | null;
  receivedAt: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number | null;
  hangerCharge: { count: number; pricePerUnit: number; total: number } | null;
  customer: { id: string; name: string | null; email: string; phoneNumber: string | null; image: string | null };
  employee: { id: string; name: string | null; email: string } | null;
  basket: { id: string; label: string | null; qrCode: string | null; status: string } | null;
  memberEntitlement: {
    id: string;
    status: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    activatedAt: string | null;
    endAt: string | null;
    product: { id: string; name: string; packageType: string; credits: number | null; validityDays: number | null };
  } | null;
  items: Array<{
    id: string;
    storefrontPriceId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
    isPackageIncluded: boolean;
    service: { id: string; name: string };
    item: { id: string; name: string };
    label: string;
  }>;
  payments: Array<{
    id: string;
    paymentNo: string | null;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    note: string | null;
    paidAt: string | null;
    verifiedAt: string | null;
    verifiedBy: { id: string; name: string | null; email: string } | null;
    slipImage: { id: string; secureUrl: string | null; url: string | null } | null;
  }>;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const serviceOrderId = computed(() => String(route.params.id ?? ""));
const { data, status, refresh, error } = await useFetch<ServiceOrderDetailResponse>(
  () => `/api/admin/service-orders/${serviceOrderId.value}`,
  {
    key: () => `admin-service-order-detail-${serviceOrderId.value}`,
  },
);

const order = computed(() => data.value ?? null);
const isLoading = computed(() => status.value === "pending");
const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;
const paymentStatusBadgeColors = paymentStatusColors as Record<PaymentStatus, BadgeColor>;
const paymentMethodLabelMap: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
};

const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }
  void navigateTo("/admin/service-orders");
};

const openReceipt = () => {
  if (!order.value) return;
  void navigateTo(`/admin/service-orders/${order.value.id}/intake`);
};

const openPaymentDetail = (paymentId: string) => {
  void navigateTo(`/admin/payment/${paymentId}`);
};

const getAvatarProps = (target?: ServiceOrderDetailResponse["customer"] | null) => ({
  as: { img: "img" },
  src: target?.image || "",
  alt: target?.name || target?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const customerRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];

  return [
    { label: "ชื่อลูกค้า", value: order.value.customer.name || "-" },
    { label: "อีเมล", value: order.value.customer.email, valueClass: "break-all" },
    { label: "เบอร์โทร", value: order.value.customer.phoneNumber || "-" },
    { label: "ประเภทลูกค้า", value: order.value.isWalkIn ? "ลูกค้าหน้าร้าน" : "สมาชิก/ลูกค้าในระบบ" },
    { label: "ผู้รับงาน", value: order.value.employee?.name || order.value.employee?.email || "-" },
    { label: "หมายเหตุ", value: order.value.note || "-", valueClass: "whitespace-pre-line" },
  ];
});

const orderRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];

  return [
    { label: "เลขรับผ้า", value: order.value.orderNo || order.value.id, valueClass: "font-mono text-xs" },
    { label: "สถานะงาน", value: orderStatusLabels[order.value.status] },
    { label: "วันที่รับงาน", value: formatDateTime(order.value.receivedAt) },
    { label: "วันนัดรับ", value: order.value.dueAt ? formatDateTime(order.value.dueAt) : "-" },
    { label: "สร้างเมื่อ", value: formatDateTime(order.value.createdAt) },
    { label: "อัปเดตล่าสุด", value: formatDateTime(order.value.updatedAt) },
  ];
});

const supportRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];

  return [
    { label: "ตะกร้า", value: order.value.basket?.label || order.value.basket?.qrCode || "-" },
    { label: "สถานะตะกร้า", value: order.value.basket?.status || "-" },
    { label: "แพ็กเกจที่ใช้", value: order.value.memberEntitlement?.product.name || "-" },
    { label: "เครดิตคงเหลือ", value: order.value.memberEntitlement?.creditRemaining != null ? String(order.value.memberEntitlement.creditRemaining) : "-" },
    { label: "เครดิตที่ใช้", value: order.value.creditUsed != null ? String(order.value.creditUsed) : "-" },
  ];
});

const totalRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];

  const rows: InfoRow[] = [
    { label: "ค่าบริการ", value: formatCurrency(order.value.subtotalAmount) },
  ];

  if (order.value.hangerCharge) {
    rows.push({
      label: `ค่าไม้แขวน (${order.value.hangerCharge.count} ชิ้น)`,
      value: formatCurrency(order.value.hangerCharge.total),
    });
  }

  rows.push({ label: "ส่วนลด", value: formatCurrency(order.value.discountAmount) });
  rows.push({
    label: "ยอดรวมสุทธิ",
    value: formatCurrency(order.value.totalAmount || 0),
    valueClass: "font-semibold text-highlighted",
    dividerBefore: true,
  });

  return rows;
});

const hasMemberEntitlement = computed(() => Boolean(order.value?.memberEntitlement));
const memberPackageName = computed(() => order.value?.memberEntitlement?.product.name || "-");
const remainingCreditLabel = computed(() => {
  if (order.value?.memberEntitlement?.creditRemaining == null) return "-";
  return `${order.value.memberEntitlement.creditRemaining} เครดิต`;
});
const usedCreditLabel = computed(() => {
  if (order.value?.creditUsed == null) return "-";
  return `${order.value.creditUsed} เครดิต`;
});
const latestPayment = computed(() => order.value?.payments[0] ?? null);
const itemCountLabel = computed(() => `${order.value?.items.length ?? 0} รายการ`);
const totalQuantity = computed(() => (order.value?.items ?? []).reduce((sum, item) => sum + item.quantity, 0));
</script>

<template>
  <UDashboardPanel id="service-order-detail">
    <template #header>
      <UDashboardNavbar title="รายละเอียดรายการรับผ้า" icon="i-lucide-shopping-basket">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton label="กลับ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack" />
            <UButton label="ดูใบรับผ้า" color="neutral" variant="outline" icon="i-lucide-ticket" @click="openReceipt" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="isLoading" class="space-y-4">
        <USkeleton class="h-32 w-full rounded-2xl" />
        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <USkeleton class="h-[520px] w-full rounded-2xl" />
          <USkeleton class="h-[520px] w-full rounded-2xl" />
        </div>
      </div>

      <div v-else-if="error || !order" class="rounded-2xl border border-default bg-default p-6">
        <p class="text-base font-semibold text-highlighted">ไม่พบรายละเอียดรายการรับผ้า</p>
        <p class="mt-2 text-sm text-muted">รายการอาจถูกลบหรือยังไม่พร้อมใช้งาน</p>
        <div class="mt-4">
          <UButton label="ลองใหม่" color="neutral" variant="outline" @click="refresh()" />
        </div>
      </div>

      <div v-else class="space-y-5">
        <section class="rounded-2xl border border-default bg-default p-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex min-w-0 items-center gap-4">
              <UAvatar size="xl" v-bind="getAvatarProps(order.customer)" />
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-lg font-semibold text-highlighted">
                    {{ order.customer.name || order.customer.email || "-" }}
                  </p>
                  <UBadge :color="orderStatusBadgeColors[order.status]" variant="subtle">
                    {{ orderStatusLabels[order.status] }}
                  </UBadge>
                </div>
                <p class="font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
                <p class="text-sm text-muted">
                  รับงานเมื่อ {{ formatDateTime(order.receivedAt) }}
                  <span v-if="order.dueAt"> | นัดรับ {{ formatDateTime(order.dueAt) }}</span>
                </p>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <UCard>
                <div class="space-y-1">
                  <p class="text-xs text-muted">จำนวนรายการ</p>
                  <p class="text-lg font-semibold text-highlighted">{{ itemCountLabel }}</p>
                  <p class="text-xs text-muted">{{ totalQuantity }} ชิ้น</p>
                </div>
              </UCard>
              <UCard>
                <div class="space-y-1">
                  <p class="text-xs text-muted">ยอดรวมสุทธิ</p>
                  <p class="text-lg font-semibold text-primary">{{ formatCurrency(order.totalAmount || 0) }}</p>
                  <p class="text-xs text-muted">
                    {{ hasMemberEntitlement ? "งานนี้ใช้ร่วมกับแพ็กเกจสมาชิก" : "รวมค่าไม้แขวนและส่วนลดแล้ว" }}
                  </p>
                </div>
              </UCard>
              <UCard v-if="hasMemberEntitlement">
                <div class="space-y-1">
                  <p class="text-xs text-muted">เครดิตคงเหลือ</p>
                  <p class="text-lg font-semibold text-success">{{ remainingCreditLabel }}</p>
                  <p class="text-xs text-muted">{{ memberPackageName }}</p>
                </div>
              </UCard>
              <UCard>
                <div class="space-y-1">
                  <p class="text-xs text-muted">{{ hasMemberEntitlement ? "เครดิตที่ใช้" : "ชำระล่าสุด" }}</p>
                  <p class="text-lg font-semibold text-highlighted">
                    {{ hasMemberEntitlement ? usedCreditLabel : (latestPayment ? paymentStatusLabels[latestPayment.status] : "ยังไม่มี") }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ hasMemberEntitlement ? `สถานะแพ็กเกจ ${memberPackageName}` : (latestPayment?.paymentNo || "-") }}
                  </p>
                </div>
              </UCard>
            </div>
          </div>
        </section>

        <div class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <div class="space-y-5">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-semibold text-highlighted">รายการบริการ</p>
                    <p class="text-sm text-muted">{{ itemCountLabel }}</p>
                  </div>
                </div>
              </template>

              <div class="space-y-3">
                <div
                  v-for="item in order.items"
                  :key="item.id"
                  class="flex flex-col gap-3 rounded-xl border border-default p-4 md:flex-row md:items-start md:justify-between"
                >
                  <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-medium text-highlighted">{{ item.label }}</p>
                      <UBadge v-if="item.isPackageIncluded" color="success" variant="subtle">
                        รวมในแพ็กเกจ
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted">{{ item.service.name }} | {{ item.item.name }}</p>
                    <p v-if="item.notes" class="text-sm text-muted whitespace-pre-line">{{ item.notes }}</p>
                  </div>

                  <div class="grid shrink-0 gap-1 text-sm md:text-right">
                    <p class="text-muted">จำนวน {{ item.quantity }} ชิ้น</p>
                    <p class="text-muted">{{ formatCurrency(item.unitPrice) }} / ชิ้น</p>
                    <p class="font-semibold text-highlighted">{{ formatCurrency(item.totalPrice) }}</p>
                  </div>
                </div>
              </div>
            </UCard>

          </div>

          <div class="space-y-5">
            <UCard>
              <template #header>
                <div>
                  <p class="font-semibold text-highlighted">ข้อมูลลูกค้าและงาน</p>
                </div>
              </template>

              <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                <div class="space-y-3">
                  <div v-for="row in customerRows" :key="row.label" class="space-y-1">
                    <p class="text-xs text-muted">{{ row.label }}</p>
                    <p :class="['text-sm text-highlighted', row.valueClass]">{{ row.value }}</p>
                  </div>
                </div>
                <div class="space-y-3">
                  <div v-for="row in orderRows" :key="row.label" class="space-y-1">
                    <p class="text-xs text-muted">{{ row.label }}</p>
                    <p :class="['text-sm text-highlighted', row.valueClass]">{{ row.value }}</p>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div>
                  <p class="font-semibold text-highlighted">สรุปยอด</p>
                </div>
              </template>

              <div class="space-y-3 text-sm">
                <div
                  v-for="row in totalRows"
                  :key="row.label"
                  :class="['flex items-center justify-between gap-3', row.dividerBefore ? 'border-t border-default pt-3' : '']"
                >
                  <span class="text-muted">{{ row.label }}</span>
                  <span :class="row.valueClass || 'font-medium text-highlighted'">{{ row.value }}</span>
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div>
                  <p class="font-semibold text-highlighted">การชำระเงิน</p>
                </div>
              </template>

              <div v-if="order.payments.length" class="space-y-4">
                <div
                  v-for="payment in order.payments"
                  :key="payment.id"
                  class="space-y-3 rounded-xl border border-default p-4"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-mono text-xs text-muted">{{ payment.paymentNo || payment.id }}</p>
                      <div class="mt-1 flex flex-wrap items-center gap-2">
                        <UBadge color="info" variant="subtle">{{ paymentMethodLabelMap[payment.paymentMethod] }}</UBadge>
                        <UBadge :color="paymentStatusBadgeColors[payment.status]" variant="subtle">
                          {{ paymentStatusLabels[payment.status] }}
                        </UBadge>
                      </div>
                    </div>

                    <UButton
                      label="เปิดการชำระ"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-external-link"
                      @click="openPaymentDetail(payment.id)"
                    />
                  </div>

                  <div class="space-y-2 text-sm">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-muted">ยอดชำระ</span>
                      <span class="font-medium text-highlighted">{{ formatCurrency(payment.amount) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-muted">ชำระเมื่อ</span>
                      <span class="text-highlighted">{{ payment.paidAt ? formatDateTime(payment.paidAt) : "-" }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-muted">ตรวจสอบเมื่อ</span>
                      <span class="text-highlighted">{{ payment.verifiedAt ? formatDateTime(payment.verifiedAt) : "-" }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-muted">ผู้ตรวจสอบ</span>
                      <span class="text-highlighted">{{ payment.verifiedBy?.name || payment.verifiedBy?.email || "-" }}</span>
                    </div>
                    <div v-if="payment.note" class="space-y-1">
                      <p class="text-xs text-muted">หมายเหตุ</p>
                      <p class="text-sm text-highlighted whitespace-pre-line">{{ payment.note }}</p>
                    </div>
                    <div v-if="payment.slipImage" class="space-y-2">
                      <p class="text-xs text-muted">สลิปการชำระ</p>
                      <NuxtImg
                        :src="payment.slipImage.secureUrl || payment.slipImage.url || ''"
                        class="w-full rounded-xl border border-default object-cover"
                        sizes="sm:360px"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p v-else class="text-sm text-muted">ยังไม่มีรายการชำระเงิน</p>
            </UCard>

            <UCard>
              <template #header>
                <div>
                  <p class="font-semibold text-highlighted">ข้อมูลสนับสนุน</p>
                </div>
              </template>

              <div class="space-y-3">
                <div v-for="row in supportRows" :key="row.label" class="space-y-1">
                  <p class="text-xs text-muted">{{ row.label }}</p>
                  <p :class="['text-sm text-highlighted', row.valueClass]">{{ row.value }}</p>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
