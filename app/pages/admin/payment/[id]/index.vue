<script setup lang="ts">
import type {
  EntitlementStatus,
  PackageSaleStatus,
  PaymentMethod,
  PaymentStatus,
  ServiceOrderStatus,
} from "~~/shared/types/enums";
import { paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { packageTypeColors, packageTypeLabels } from "~~/shared/config/packageConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import { useAdminPayments } from "~~/app/composables/useAdminPayments";

type PaymentDetailResponse = {
  id: string;
  paymentNo: string | null;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  note: string | null;
  referenceNo: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  verifiedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  slipImage: {
    id: string;
    url: string | null;
    secureUrl: string | null;
  } | null;
  memberEntitlement: {
    id: string;
    status: EntitlementStatus;
    creditInitial: number | null;
    creditRemaining: number | null;
    startAt: string | null;
    endAt: string | null;
    activatedAt: string | null;
    product: {
      id: string;
      name: string;
      packageType: "MAIN" | "ADDON";
      price: number;
      credits: number | null;
      validityDays: number | null;
    };
  } | null;
  packageSale: {
    id: string;
    status: PackageSaleStatus;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    note: string | null;
    soldBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    items: Array<{
      id: string;
      itemType: "MAIN" | "ADDON";
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      product: {
        id: string;
        name: string;
        packageType: "MAIN" | "ADDON";
        price: number;
        credits: number | null;
        validityDays: number | null;
      };
    }>;
  } | null;
  serviceOrder: {
    id: string;
    orderNo: string | null;
    status: ServiceOrderStatus;
    isWalkIn: boolean;
    walkInName: string | null;
    walkInPhone: string | null;
    creditUsed: number | null;
    receivedAt: string | null;
    dueAt: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    note: string | null;
    employee: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    memberEntitlement: {
      id: string;
      status: EntitlementStatus;
      product: {
        id: string;
        name: string;
        packageType: "MAIN" | "ADDON";
        credits: number | null;
        validityDays: number | null;
      };
    } | null;
    basket: {
      id: string;
      label: string | null;
      qrCode: string | null;
    } | null;
    hangerCharge: {
      count: number;
      pricePerUnit: number;
      total: number;
    } | null;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      isPackageIncluded: boolean;
      notes: string | null;
      storefrontPriceId: string;
      service: {
        id: string;
        name: string;
      };
      item: {
        id: string;
        name: string;
      };
      label: string;
    }>;
  } | null;
};

type BadgeColor = "error" | "primary" | "secondary" | "success" | "info" | "warning" | "neutral";

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const notify = useNotify();
const { updatePayment, uploadSlip } = useAdminPayments();

const { data, status, refresh, error } = await useFetch<PaymentDetailResponse>(
  () => `/api/admin/payments/${paymentId.value}`,
  { key: () => `admin-payment-detail-${paymentId.value}` },
);

const payment = computed(() => data.value ?? null);
const isLoading = computed(() => status.value === "pending");
const isPackagePayment = computed(() => Boolean(payment.value?.packageSale));
const canEditPayment = computed(() => Boolean(payment.value?.packageSale));

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
};

const entitlementStatusMap: Record<EntitlementStatus, { label: string; color: BadgeColor }> = {
  ACTIVE: { label: "ใช้งานอยู่", color: "success" },
  PENDING: { label: "รอเปิดใช้งาน", color: "warning" },
  SUSPENDED: { label: "ระงับ", color: "neutral" },
  EXPIRED: { label: "หมดอายุ", color: "neutral" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const packageSaleStatusMap: Record<PackageSaleStatus, { label: string; color: BadgeColor }> = {
  PAID: { label: "ชำระแล้ว", color: "success" },
  PENDING: { label: "รอชำระ", color: "warning" },
  DRAFT: { label: "ฉบับร่าง", color: "neutral" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const serviceOrderStatusMap: Record<ServiceOrderStatus, { label: string; color: BadgeColor }> = {
  RECEIVED: { label: "รับงานแล้ว", color: "info" },
  PENDING: { label: "รอดำเนินการ", color: "warning" },
  CHECKING: { label: "กำลังตรวจสอบ", color: "info" },
  PROCESSING: { label: "กำลังดำเนินการ", color: "warning" },
  PENDING_REVIEW: { label: "รอตรวจทาน", color: "warning" },
  COMPLETED: { label: "เสร็จสิ้น", color: "success" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const paymentForm = ref({
  paymentMethod: "CASH" as PaymentMethod,
  status: "PENDING" as PaymentStatus,
  note: "",
  slipImageId: null as string | null,
});
const newSlip = ref<{ id: string; secureUrl: string | null; url: string | null } | null>(null);
const slipInputRef = ref<HTMLInputElement | null>(null);
const isUploadingSlip = ref(false);
const isSavingPayment = ref(false);

watch(
  payment,
  (nextPayment) => {
    if (!nextPayment) return;
    paymentForm.value = {
      paymentMethod: nextPayment.paymentMethod,
      status: nextPayment.status,
      note: nextPayment.note ?? "",
      slipImageId: nextPayment.slipImage?.id ?? null,
    };
    newSlip.value = null;
  },
  { immediate: true },
);

const currentSlipImage = computed(() => newSlip.value ?? payment.value?.slipImage ?? null);
const isDirty = computed(() => {
  if (!payment.value) return false;
  return paymentForm.value.paymentMethod !== payment.value.paymentMethod
    || paymentForm.value.status !== payment.value.status
    || paymentForm.value.note !== (payment.value.note ?? "")
    || paymentForm.value.slipImageId !== (payment.value.slipImage?.id ?? null);
});
const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }

  void navigateTo("/admin/payment");
};

const summaryCards = computed(() => {
  if (!payment.value) return [];
  return [
    {
      label: "เลขชำระ",
      value: payment.value.paymentNo || "-",
      hint: isPackagePayment.value ? "รายการแพ็กเกจ" : payment.value.serviceOrder?.orderNo || "รายการผ้า",
    },
    {
      label: "ยอดชำระ",
      value: formatCurrency(payment.value.amount),
      hint: paymentMethodLabels[payment.value.paymentMethod],
    },
    {
      label: "สถานะ",
      value: paymentStatusLabels[payment.value.status],
      hint: payment.value.paidAt ? formatDateTime(payment.value.paidAt) : "ยังไม่ระบุเวลาชำระ",
    },
    {
      label: "ลูกค้า",
      value: payment.value.customer.name || payment.value.customer.email || "-",
      hint: payment.value.customer.phoneNumber || payment.value.customer.email || "-",
    },
  ];
});

const metadataText = computed(() => {
  if (!payment.value?.metadata) return null;
  return JSON.stringify(payment.value.metadata, null, 2);
});

const getAvatarProps = (target?: PaymentDetailResponse["customer"] | null) => ({
  as: { img: "img" },
  src: target?.image || "",
  alt: target?.name || target?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const paymentMethodOptions: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];

const openSlipPicker = () => slipInputRef.value?.click();

const onSlipSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  isUploadingSlip.value = true;
  const uploaded = await uploadSlip(file);
  isUploadingSlip.value = false;
  if (uploaded) {
    newSlip.value = uploaded;
    paymentForm.value.slipImageId = uploaded.id;
  }
  if (input) input.value = "";
};

const savePaymentChanges = async () => {
  if (!payment.value || !canEditPayment.value) return;
  if (paymentForm.value.paymentMethod === "TRANSFER" && !paymentForm.value.slipImageId) {
    notify.error("กรุณาอัปโหลดหลักฐานการโอน");
    return;
  }
  isSavingPayment.value = true;
  const ok = await updatePayment(payment.value.id, {
    paymentMethod: paymentForm.value.paymentMethod,
    status: paymentForm.value.status,
    note: paymentForm.value.note.trim() || null,
    slipImageId: paymentForm.value.slipImageId,
  });
  isSavingPayment.value = false;
  if (ok) await refresh();
};
</script>

<template>
  <UDashboardPanel id="payment-detail">
    <template #header>
      <UDashboardNavbar :title="payment?.paymentNo || 'รายละเอียดการชำระเงิน'" icon="i-lucide-badge-info">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton label="กลับ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack" />
            <UButton
              v-if="payment?.serviceOrder?.id"
              label="ใบรับผ้า"
              color="neutral"
              variant="outline"
              icon="i-lucide-ticket"
              @click="navigateTo(`/admin/service-orders/${payment.serviceOrder.id}/intake`)"
            />
            <UButton
              v-if="payment"
              label="ใบเสร็จ"
              color="neutral"
              variant="outline"
              icon="i-lucide-receipt"
              @click="navigateTo(`/admin/payment/${payment.id}/receipt`)"
            />
            <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="isLoading" @click="refresh()" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="isLoading" class="grid gap-4 lg:grid-cols-4">
        <USkeleton v-for="index in 4" :key="index" class="h-28 rounded-2xl" />
      </div>

      <div v-else-if="error || !payment" class="rounded-2xl border border-default bg-default p-6">
        <p class="text-base font-semibold text-highlighted">ไม่พบข้อมูลการชำระเงิน</p>
        <p class="mt-2 text-sm text-muted">รายการนี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง</p>
      </div>

      <div v-else class="space-y-5">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UCard v-for="card in summaryCards" :key="card.label" :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <p class="text-sm text-muted">{{ card.label }}</p>
            <p class="mt-2 wrap-break-word text-xl font-semibold text-highlighted">{{ card.value }}</p>
            <p class="mt-1 text-xs text-muted">{{ card.hint }}</p>
          </UCard>
        </div>

        <div class="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div class="space-y-5">
            <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex min-w-0 items-center gap-3">
                  <UAvatar v-bind="getAvatarProps(payment.customer)" size="lg" />
                  <div class="min-w-0">
                    <p class="font-semibold text-highlighted">{{ payment.customer.name || payment.customer.email || "-" }}</p>
                    <p class="text-sm text-muted">{{ payment.customer.email }}</p>
                    <p class="text-sm text-muted">{{ payment.customer.phoneNumber || "-" }}</p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <UBadge :color="paymentStatusColors[payment.status] as BadgeColor" variant="subtle">
                    {{ paymentStatusLabels[payment.status] }}
                  </UBadge>
                  <UBadge :color="isPackagePayment ? 'primary' : 'warning'" variant="subtle">
                    {{ isPackagePayment ? "แพ็กเกจ" : "ผ้า" }}
                  </UBadge>
                </div>
              </div>

              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="rounded-xl border border-default p-4">
                  <p class="text-xs uppercase tracking-wide text-muted">ข้อมูลการชำระเงิน</p>
                  <div class="mt-3 space-y-2 text-sm">
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">เลขชำระ</span>
                      <span class="text-right font-medium">{{ payment.paymentNo || "-" }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">ยอดชำระ</span>
                      <span class="text-right font-medium">{{ formatCurrency(payment.amount) }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">ช่องทาง</span>
                      <span class="text-right">{{ paymentMethodLabels[payment.paymentMethod] }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">วันที่สร้าง</span>
                      <span class="text-right">{{ formatDateTime(payment.createdAt) }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">วันที่ชำระ</span>
                      <span class="text-right">{{ payment.paidAt ? formatDateTime(payment.paidAt) : "-" }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">อ้างอิง</span>
                      <span class="break-all text-right">{{ payment.referenceNo || "-" }}</span>
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-default p-4">
                  <p class="text-xs uppercase tracking-wide text-muted">การตรวจสอบ</p>
                  <div class="mt-3 space-y-2 text-sm">
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">ผู้ตรวจสอบ</span>
                      <span class="text-right">{{ payment.verifiedBy?.name || payment.verifiedBy?.email || "-" }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">ตรวจสอบเมื่อ</span>
                      <span class="text-right">{{ payment.verifiedAt ? formatDateTime(payment.verifiedAt) : "-" }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">หมายเหตุ</span>
                      <span class="text-right whitespace-pre-line">{{ payment.note || "-" }}</span>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                      <span class="text-muted">เหตุผลไม่ผ่าน</span>
                      <span class="text-right whitespace-pre-line">{{ payment.rejectionReason || "-" }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-base font-semibold text-highlighted">
                    {{ isPackagePayment ? "รายการขายแพ็กเกจ" : "ข้อมูลงานผ้า" }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ isPackagePayment ? `Sale ID: ${payment.packageSale?.id || "-"}` : `Order ID: ${payment.serviceOrder?.id || "-"}` }}
                  </p>
                </div>

                <UBadge
                  v-if="payment.packageSale"
                  :color="packageSaleStatusMap[payment.packageSale.status].color"
                  variant="subtle"
                >
                  {{ packageSaleStatusMap[payment.packageSale.status].label }}
                </UBadge>
                <UBadge
                  v-else-if="payment.serviceOrder"
                  :color="serviceOrderStatusMap[payment.serviceOrder.status].color"
                  variant="subtle"
                >
                  {{ serviceOrderStatusMap[payment.serviceOrder.status].label }}
                </UBadge>
              </div>

              <div v-if="payment.packageSale" class="mt-5 space-y-3">
                <div
                  v-for="item in payment.packageSale.items"
                  :key="item.id"
                  class="rounded-xl border border-default p-4"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium text-highlighted">{{ item.product.name }}</p>
                        <UBadge :color="packageTypeColors[item.product.packageType]" variant="subtle">
                          {{ packageTypeLabels[item.product.packageType] }}
                        </UBadge>
                      </div>
                      <p class="mt-1 text-sm text-muted">{{ item.quantity }} รายการ x {{ formatCurrency(item.unitPrice) }}</p>
                      <p class="mt-1 text-xs text-muted">
                        เครดิต {{ item.product.credits ?? "-" }} • อายุ {{ item.product.validityDays ? `${item.product.validityDays} วัน` : "-" }}
                      </p>
                    </div>
                    <p class="text-sm font-medium">{{ formatCurrency(item.totalPrice) }}</p>
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-3">
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ยอดก่อนลด</p>
                    <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(payment.packageSale.subtotalAmount) }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ส่วนลด</p>
                    <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(payment.packageSale.discountAmount) }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ยอดรวม</p>
                    <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(payment.packageSale.totalAmount) }}</p>
                  </div>
                </div>
              </div>

              <div v-else-if="payment.serviceOrder" class="mt-5 space-y-4">
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">เลขรับผ้า</p>
                    <p class="mt-1 break-all font-medium text-highlighted">{{ payment.serviceOrder.orderNo || "-" }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">วันที่รับ</p>
                    <p class="mt-1 font-medium text-highlighted">{{ payment.serviceOrder.receivedAt ? formatDateTime(payment.serviceOrder.receivedAt) : "-" }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">วันนัดรับ</p>
                    <p class="mt-1 font-medium text-highlighted">{{ payment.serviceOrder.dueAt ? formatDateTime(payment.serviceOrder.dueAt) : "-" }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ผู้รับงาน</p>
                    <p class="mt-1 font-medium text-highlighted">{{ payment.serviceOrder.employee?.name || payment.serviceOrder.employee?.email || "-" }}</p>
                  </div>
                </div>

                <div
                  v-for="item in payment.serviceOrder.items"
                  :key="item.id"
                  class="rounded-xl border border-default p-4"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium text-highlighted">{{ item.label }}</p>
                        <UBadge v-if="item.isPackageIncluded" color="success" variant="subtle">รวมในแพ็กเกจ</UBadge>
                      </div>
                      <p class="mt-1 text-sm text-muted">{{ item.quantity }} ชิ้น x {{ formatCurrency(item.unitPrice) }}</p>
                      <p v-if="item.notes" class="mt-1 text-sm text-muted whitespace-pre-line">{{ item.notes }}</p>
                    </div>
                    <p class="text-sm font-medium">{{ formatCurrency(item.totalPrice) }}</p>
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-4">
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ค่าบริการ</p>
                    <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(payment.serviceOrder.subtotalAmount) }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ส่วนลด</p>
                    <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(payment.serviceOrder.discountAmount) }}</p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ค่าไม้แขวน</p>
                    <p class="mt-1 font-medium text-highlighted">
                      {{ payment.serviceOrder.hangerCharge ? formatCurrency(payment.serviceOrder.hangerCharge.total) : "-" }}
                    </p>
                  </div>
                  <div class="rounded-xl border border-default p-4 text-sm">
                    <p class="text-muted">ยอดรวม</p>
                    <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(payment.serviceOrder.totalAmount) }}</p>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard v-if="payment.memberEntitlement" :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-base font-semibold text-highlighted">สิทธิ์สมาชิกที่เชื่อมกับรายการนี้</p>
                  <p class="text-sm text-muted">Entitlement ID: {{ payment.memberEntitlement.id }}</p>
                </div>
                <UBadge :color="entitlementStatusMap[payment.memberEntitlement.status].color" variant="subtle">
                  {{ entitlementStatusMap[payment.memberEntitlement.status].label }}
                </UBadge>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm">
                <div class="rounded-xl border border-default p-4">
                  <p class="text-muted">แพ็กเกจ</p>
                  <p class="mt-1 font-medium text-highlighted">{{ payment.memberEntitlement.product.name }}</p>
                </div>
                <div class="rounded-xl border border-default p-4">
                  <p class="text-muted">เครดิตเริ่มต้น</p>
                  <p class="mt-1 font-medium text-highlighted">{{ payment.memberEntitlement.creditInitial ?? "-" }}</p>
                </div>
                <div class="rounded-xl border border-default p-4">
                  <p class="text-muted">เครดิตคงเหลือ</p>
                  <p class="mt-1 font-medium text-highlighted">{{ payment.memberEntitlement.creditRemaining ?? "-" }}</p>
                </div>
                <div class="rounded-xl border border-default p-4">
                  <p class="text-muted">หมดอายุ</p>
                  <p class="mt-1 font-medium text-highlighted">{{ payment.memberEntitlement.endAt ? formatDateTime(payment.memberEntitlement.endAt) : "-" }}</p>
                </div>
              </div>
            </UCard>

            <UCard v-if="metadataText" :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
              <p class="text-base font-semibold text-highlighted">Metadata</p>
              <pre class="mt-4 overflow-x-auto rounded-xl bg-elevated/50 p-4 text-xs text-muted">{{ metadataText }}</pre>
            </UCard>
          </div>

          <div class="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-base font-semibold text-highlighted">จัดการการชำระเงิน</p>
                  <p class="text-sm text-muted">
                    {{ canEditPayment ? "รายการแพ็กเกจแก้ช่องทางชำระ สถานะ และสลิปได้จากด้านขวา" : "รายการผ้าตอนนี้ยังเปิดดูข้อมูลได้อย่างเดียว เพื่อไม่ให้ payment กับ order คลาดกัน" }}
                  </p>
                </div>
                <UBadge :color="canEditPayment ? 'success' : 'warning'" variant="subtle">
                  {{ canEditPayment ? "แก้ไขได้" : "อ่านอย่างเดียว" }}
                </UBadge>
              </div>

              <div class="mt-5 space-y-4">
                <UFormField label="ช่องทางชำระเงิน">
                  <USelect
                    v-model="paymentForm.paymentMethod"
                    :items="paymentMethodOptions"
                    value-key="value"
                    :disabled="!canEditPayment || isSavingPayment"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="สถานะการชำระ">
                  <USelect
                    v-model="paymentForm.status"
                    :items="paymentStatusOptions"
                    value-key="value"
                    :disabled="!canEditPayment || isSavingPayment"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="หมายเหตุ">
                  <UTextarea
                    v-model="paymentForm.note"
                    :disabled="!canEditPayment || isSavingPayment"
                    :rows="4"
                    placeholder="เพิ่มหมายเหตุเกี่ยวกับการชำระเงิน"
                  />
                </UFormField>

                <div class="rounded-xl border border-dashed border-default p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-medium text-highlighted">หลักฐานการชำระ</p>
                      <p class="text-sm text-muted">
                        {{ currentSlipImage ? "มีไฟล์แนบแล้ว สามารถอัปโหลดแทนที่ได้" : "ยังไม่มีไฟล์แนบ" }}
                      </p>
                    </div>
                    <UButton
                      label="อัปโหลด"
                      icon="i-lucide-upload"
                      color="neutral"
                      variant="outline"
                      :loading="isUploadingSlip"
                      :disabled="!canEditPayment || isSavingPayment"
                      @click="openSlipPicker"
                    />
                  </div>

                  <input ref="slipInputRef" type="file" accept="image/*" class="hidden" @change="onSlipSelected" />

                  <div v-if="currentSlipImage" class="mt-4 space-y-3">
                    <img
                      :src="currentSlipImage.secureUrl || currentSlipImage.url || ''"
                      alt="หลักฐานการชำระเงิน"
                      class="h-48 w-full rounded-xl border border-default object-cover"
                    >
                    <UButton
                      label="เปิดรูป"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-image"
                      @click="navigateTo(currentSlipImage.secureUrl || currentSlipImage.url || '', { external: true, open: { target: '_blank' } })"
                    />
                  </div>
                </div>

                <div class="rounded-xl border border-default p-4 text-sm">
                  <div class="flex items-start justify-between gap-3">
                    <span class="text-muted">ยอดที่ชำระ</span>
                    <span class="font-medium text-highlighted">{{ formatCurrency(payment.amount) }}</span>
                  </div>
                  <div class="mt-2 flex items-start justify-between gap-3">
                    <span class="text-muted">อัปเดตล่าสุด</span>
                    <span>{{ formatDateTime(payment.updatedAt) }}</span>
                  </div>
                </div>

                <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <UButton
                    label="บันทึกการเปลี่ยนแปลง"
                    icon="i-lucide-save"
                    color="primary"
                    :loading="isSavingPayment"
                    :disabled="!canEditPayment || !isDirty || isUploadingSlip"
                    @click="savePaymentChanges"
                  />
                  <UButton
                    label="รีเซ็ต"
                    color="neutral"
                    variant="outline"
                    :disabled="!canEditPayment || isSavingPayment"
                    @click="refresh()"
                  />
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
