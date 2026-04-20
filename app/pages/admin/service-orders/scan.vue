<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";
import SlipUploadField from "~~/app/components/UI/SlipUploadField.vue";
import type { PaymentSlipImage } from "~~/app/composables/useAdminPayments";
import type { CreateAdminServiceOrderBody } from "~~/app/composables/useAdminServiceOrders";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";

type BadgeColor = "success" | "info" | "error" | "neutral" | "primary" | "secondary" | "warning";
type LookupServiceOrderResponse = {
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

const notify = useNotify();
const route = useRoute();
const { uploadSlip } = useAdminPayments();

const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;
const paymentStatusBadgeColors = paymentStatusColors as Record<PaymentStatus, BadgeColor>;
const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
};
const paymentMethodOptions: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];
const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];
const quickStatusOptions: Array<{ label: string; value: ServiceOrderStatus; icon: string; color: BadgeColor }> = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED", icon: "i-lucide-inbox", color: "info" },
  { label: orderStatusLabels.PENDING, value: "PENDING", icon: "i-lucide-hourglass", color: "neutral" },
  { label: orderStatusLabels.CHECKING, value: "CHECKING", icon: "i-lucide-search-check", color: "warning" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING", icon: "i-lucide-washing-machine", color: "primary" },
  { label: orderStatusLabels.PENDING_REVIEW, value: "PENDING_REVIEW", icon: "i-lucide-clipboard-check", color: "secondary" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED", icon: "i-lucide-badge-check", color: "success" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED", icon: "i-lucide-ban", color: "error" },
];

const lookupQuery = ref(typeof route.query.q === "string" ? route.query.q : "");
const isAutoReset = ref(true);
const isLookingUp = ref(false);
const lookupError = ref("");
const order = ref<LookupServiceOrderResponse | null>(null);
const isApplyingStatus = ref<ServiceOrderStatus | null>(null);
const isEditOpen = ref(false);
const isSavingEdit = ref(false);
const dueDate = shallowRef<CalendarDate | null>(null);
const dueTime = ref("00:00");
const editForm = reactive({
  serviceOrderStatus: "RECEIVED" as ServiceOrderStatus,
  paymentMethod: "CASH" as PaymentMethod,
  paymentStatus: "PENDING" as PaymentStatus,
  note: "",
});
const uploadedSlip = ref<PaymentSlipImage | null>(null);
const slipFile = ref<File | null>(null);

const totalQuantity = computed(() => (order.value?.items ?? []).reduce((sum, item) => sum + item.quantity, 0));
const latestPayment = computed(() => order.value?.payments[0] ?? null);
const currentResultTitle = computed(() => order.value?.customer.name || order.value?.customer.email || "-");
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
const dueTimeOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ label: value, value });
    }
  }
  return options;
});
const dueAtValue = computed(() => {
  if (!dueDate.value) return null;
  return `${dueDate.value.toString()}T${dueTime.value || "00:00"}`;
});
const getAvatarProps = (customer?: LookupServiceOrderResponse["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const setDueDateTime = (value: string | null) => {
  if (!value) {
    dueDate.value = null;
    dueTime.value = "00:00";
    return;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    dueDate.value = null;
    dueTime.value = "00:00";
    return;
  }

  dueDate.value = new CalendarDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  dueTime.value = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
};

const syncEditForm = (target: LookupServiceOrderResponse | null) => {
  editForm.serviceOrderStatus = target?.status ?? "RECEIVED";
  editForm.paymentMethod = target?.payments[0]?.paymentMethod ?? "CASH";
  editForm.paymentStatus = target?.payments[0]?.status ?? "PENDING";
  editForm.note = target?.note ?? "";
  uploadedSlip.value = target?.payments[0]?.slipImage
    ? {
        id: target.payments[0].slipImage.id,
        secureUrl: target.payments[0].slipImage.secureUrl,
        url: target.payments[0].slipImage.url,
      }
    : null;
  slipFile.value = null;
  setDueDateTime(target?.dueAt ?? null);
};

const clearResult = () => {
  order.value = null;
  lookupError.value = "";
  syncEditForm(null);
};

const lookupOrder = async (query = lookupQuery.value) => {
  const normalized = query.trim();
  lookupQuery.value = normalized;
  if (!normalized) {
    lookupError.value = "กรุณาสแกนหรือกรอกรหัสรายการ";
    order.value = null;
    return;
  }

  isLookingUp.value = true;
  lookupError.value = "";

  try {
    const result = await $fetch<LookupServiceOrderResponse>("/api/admin/service-orders/lookup", {
      query: { q: normalized },
    });
    order.value = result;
    syncEditForm(result);
  } catch (error: unknown) {
    order.value = null;
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      lookupError.value = data?.statusMessage || "ไม่พบรายการรับผ้า";
    } else {
      lookupError.value = "ไม่สามารถค้นหารายการรับผ้าได้";
    }
  } finally {
    isLookingUp.value = false;
  }
};

const refreshLookup = async () => {
  if (!order.value) return;
  await lookupOrder(order.value.id);
};

const handleLookupSubmit = async () => {
  await lookupOrder();
};

const applyStatus = async (status: ServiceOrderStatus) => {
  if (!order.value || order.value.status === status) return;

  isApplyingStatus.value = status;
  try {
    const result = await $fetch<{ id: string; orderNo: string | null; status: ServiceOrderStatus; updatedAt: string }>(
      `/api/admin/service-orders/${order.value.id}/status`,
      {
        method: "PATCH",
        body: { status },
      },
    );

    order.value = {
      ...order.value,
      status: result.status,
      updatedAt: result.updatedAt,
    };
    syncEditForm(order.value);
    notify.updated(`สถานะงานเป็น ${orderStatusLabels[result.status]}`);

    if (isAutoReset.value) {
      clearResult();
      lookupQuery.value = "";
    }
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "data" in error
      ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || "ไม่สามารถอัปเดตสถานะได้")
      : "ไม่สามารถอัปเดตสถานะได้";
    notify.error(message);
  } finally {
    isApplyingStatus.value = null;
  }
};

const openEditDrawer = () => {
  if (!order.value) return;
  syncEditForm(order.value);
  isEditOpen.value = true;
};

const handleRemoveSlip = () => {
  slipFile.value = null;
  uploadedSlip.value = null;
};

const handleBlockedSlip = (message: string) => notify.warning(message);

const uploadSlipIfNeeded = async (): Promise<string | null> => {
  if (!slipFile.value) return uploadedSlip.value?.id ?? null;
  const image = await uploadSlip(slipFile.value);
  if (!image) return null;
  uploadedSlip.value = image;
  return image.id;
};

const buildEditBody = async (): Promise<CreateAdminServiceOrderBody | null> => {
  if (!order.value) return null;

  const slipImageId = await uploadSlipIfNeeded();
  if (editForm.paymentMethod === "TRANSFER" && !slipImageId) {
    notify.validationError("กรุณาอัปโหลดสลิปสำหรับรายการโอน");
    return null;
  }

  return {
    customerId: order.value.isWalkIn ? null : order.value.customer.id,
    isWalkIn: order.value.isWalkIn,
    walkInName: order.value.isWalkIn ? order.value.walkInName : null,
    walkInPhone: order.value.isWalkIn ? order.value.walkInPhone : null,
    items: order.value.items.map((item) => ({
      storefrontPriceId: item.storefrontPriceId,
      quantity: item.quantity,
    })),
    hangerCount: order.value.hangerCharge?.count ?? totalQuantity.value,
    dueAt: dueAtValue.value ? new Date(dueAtValue.value).toISOString() : null,
    discountAmount: order.value.discountAmount,
    paymentMethod: editForm.paymentMethod,
    status: editForm.paymentStatus,
    serviceOrderStatus: editForm.serviceOrderStatus,
    note: editForm.note.trim() || null,
    slipImageId,
  };
};

const submitEdit = async () => {
  if (!order.value) return;

  isSavingEdit.value = true;
  const body = await buildEditBody();
  if (!body) {
    isSavingEdit.value = false;
    return;
  }

  try {
    await $fetch(`/api/admin/service-orders/${order.value.id}`, {
      method: "PUT",
      body,
    });
    notify.updated("รายการรับผ้า");
    isEditOpen.value = false;
    await refreshLookup();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "data" in error
      ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || "ไม่สามารถบันทึกข้อมูลได้")
      : "ไม่สามารถบันทึกข้อมูลได้";
    notify.error(message);
  } finally {
    isSavingEdit.value = false;
  }
};

const goBack = () => navigateTo("/admin/service-orders");
const openDetail = () => order.value ? navigateTo(`/admin/service-orders/${order.value.id}`) : Promise.resolve();
const openReceipt = () => order.value ? navigateTo(`/admin/service-orders/${order.value.id}/intake`) : Promise.resolve();

watch(
  () => route.query.q,
  (value) => {
    if (typeof value === "string" && value.trim()) {
      lookupQuery.value = value;
      void lookupOrder(value);
    }
  },
  { immediate: true },
);
</script>

<template>
  <UDashboardPanel id="service-order-scan">
    <template #header>
      <UDashboardNavbar title="สแกนและอัปเดตสถานะผ้า" icon="i-lucide-scan-line">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton label="กลับหน้ารายการ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div class="space-y-5">
          <UCard>
            <template #header>
              <div>
                <p class="font-semibold text-highlighted">ค้นหารายการจาก QR / เลขรับผ้า / รหัสตะกร้า</p>
                <p class="text-sm text-muted">รองรับการยิงสแกนเนอร์เข้าช่องค้นหาโดยตรง แล้วกด Enter เพื่อค้นหา</p>
              </div>
            </template>

            <form class="space-y-4" @submit.prevent="handleLookupSubmit">
              <div class="flex flex-col gap-3 sm:flex-row">
                <UInput
                  v-model="lookupQuery"
                  autofocus
                  icon="i-lucide-scan-search"
                  class="flex-1"
                  size="xl"
                  placeholder="สแกน QR / กรอกเลขรับผ้า / รหัสตะกร้า"
                />
                <UButton type="submit" label="ค้นหา" icon="i-lucide-search" color="primary" :loading="isLookingUp" />
                <UButton label="ล้าง" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="clearResult(); lookupQuery = ''" />
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <USwitch v-model="isAutoReset" label="รีเซ็ตเพื่อสแกนถัดไปหลังอัปเดตสำเร็จ" />
                <p class="text-xs text-muted">ใช้กับสแกนเนอร์หรือพิมพ์ค้นหาแบบเร็วได้</p>
              </div>
            </form>
          </UCard>

          <UCard v-if="order">
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <UAvatar size="lg" v-bind="getAvatarProps(order.customer)" />
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="truncate text-lg font-semibold text-highlighted">{{ currentResultTitle }}</p>
                      <UBadge :color="orderStatusBadgeColors[order.status]" variant="subtle">
                        {{ orderStatusLabels[order.status] }}
                      </UBadge>
                    </div>
                    <p class="font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton label="ดูรายละเอียด" color="neutral" variant="outline" icon="i-lucide-eye" @click="openDetail" />
                  <UButton label="ใบรับผ้า" color="neutral" variant="outline" icon="i-lucide-ticket" @click="openReceipt" />
                  <UButton label="แก้ไขเพิ่มเติม" color="primary" variant="outline" icon="i-lucide-square-pen" @click="openEditDrawer" />
                </div>
              </div>
            </template>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div class="rounded-xl border border-default bg-elevated/30 p-4">
                <p class="text-xs text-muted">วันนัดรับ</p>
                <p class="mt-1 font-medium text-highlighted">{{ order.dueAt ? formatDateTime(order.dueAt) : "-" }}</p>
              </div>
              <div class="rounded-xl border border-default bg-elevated/30 p-4">
                <p class="text-xs text-muted">จำนวนรายการ / ชิ้น</p>
                <p class="mt-1 font-medium text-highlighted">{{ order.items.length }} รายการ | {{ totalQuantity }} ชิ้น</p>
              </div>
              <div class="rounded-xl border border-default bg-elevated/30 p-4">
                <p class="text-xs text-muted">ยอดรวมสุทธิ</p>
                <p class="mt-1 font-medium text-highlighted">{{ formatCurrency(order.totalAmount || 0) }}</p>
              </div>
              <div v-if="hasMemberEntitlement" class="rounded-xl border border-success/40 bg-success/10 p-4">
                <p class="text-xs text-muted">เครดิตคงเหลือ</p>
                <p class="mt-1 font-semibold text-success">{{ remainingCreditLabel }}</p>
                <p class="text-xs text-muted">{{ memberPackageName }}</p>
              </div>
              <div class="rounded-xl border border-default bg-elevated/30 p-4">
                <p class="text-xs text-muted">{{ hasMemberEntitlement ? "เครดิตที่ใช้" : "ตะกร้า / QR" }}</p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ hasMemberEntitlement ? usedCreditLabel : (order.basket?.label || order.basket?.qrCode || "-") }}
                </p>
                <p v-if="hasMemberEntitlement" class="text-xs text-muted">ใช้สิทธิ์จากแพ็กเกจสมาชิก</p>
              </div>
            </div>

            <div class="mt-4 space-y-2">
              <p class="text-sm font-medium text-highlighted">รายการบริการ</p>
              <div class="space-y-2">
                <div
                  v-for="item in order.items"
                  :key="item.id"
                  class="flex flex-col gap-2 rounded-xl border border-default p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div class="min-w-0">
                    <p class="truncate font-medium text-highlighted">{{ item.label }}</p>
                    <p class="text-xs text-muted">
                      {{ item.service.name }} | {{ item.item.name }} | {{ formatCurrency(item.unitPrice) }} / ชิ้น
                    </p>
                  </div>
                  <div class="text-sm md:text-right">
                    <p class="text-muted">จำนวน {{ item.quantity }} ชิ้น</p>
                    <p class="font-medium text-highlighted">{{ formatCurrency(item.totalPrice) }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="order.note" class="mt-4 rounded-xl border border-default bg-elevated/20 p-4">
              <p class="text-xs text-muted">หมายเหตุ</p>
              <p class="mt-1 whitespace-pre-line text-sm text-highlighted">{{ order.note }}</p>
            </div>
          </UCard>

          <UCard v-else-if="lookupError">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-alert-circle" class="mt-0.5 size-5 text-error" />
              <div>
                <p class="font-medium text-highlighted">ไม่พบรายการที่ค้นหา</p>
                <p class="text-sm text-muted">{{ lookupError }}</p>
              </div>
            </div>
          </UCard>

          <UCard v-else>
            <div class="flex flex-col items-center justify-center py-12 text-center">
              <UIcon name="i-lucide-scan-line" class="mb-3 size-10 text-muted opacity-70" />
              <p class="font-medium text-highlighted">พร้อมสแกนรายการรับผ้า</p>
              <p class="mt-1 text-sm text-muted">สแกน QR หรือกรอกเลขรับผ้าเพื่อเรียก quick actions และแก้ไขข้อมูลเพิ่มเติม</p>
            </div>
          </UCard>
        </div>

        <div class="space-y-5">
          <UCard>
            <template #header>
              <div>
                <p class="font-semibold text-highlighted">อัปเดตสถานะด่วน</p>
                <p class="text-sm text-muted">ออกแบบสำหรับงานหน้าร้านและการสแกนต่อเนื่อง</p>
              </div>
            </template>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <UButton
                v-for="option in quickStatusOptions"
                :key="option.value"
                :label="option.label"
                :icon="option.icon"
                :color="order?.status === option.value ? 'neutral' : option.color"
                :variant="order?.status === option.value ? 'soft' : 'solid'"
                size="xl"
                block
                :disabled="!order || order.status === option.value || Boolean(isApplyingStatus)"
                :loading="isApplyingStatus === option.value"
                @click="applyStatus(option.value)"
              />
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <p class="font-semibold text-highlighted">สรุปการชำระเงิน</p>
              </div>
            </template>

            <div v-if="latestPayment" class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="info" variant="subtle">{{ paymentMethodLabels[latestPayment.paymentMethod] }}</UBadge>
                <UBadge :color="paymentStatusBadgeColors[latestPayment.status]" variant="subtle">
                  {{ paymentStatusLabels[latestPayment.status] }}
                </UBadge>
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted">เลขชำระเงิน</span>
                  <span class="font-mono text-highlighted">{{ latestPayment.paymentNo || "-" }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted">ยอดชำระ</span>
                  <span class="font-medium text-highlighted">{{ formatCurrency(latestPayment.amount) }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted">ชำระเมื่อ</span>
                  <span class="text-highlighted">{{ latestPayment.paidAt ? formatDateTime(latestPayment.paidAt) : "-" }}</span>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-muted">ยังไม่มีรายการชำระเงิน</p>
          </UCard>
        </div>
      </div>

      <UModal
        v-model:open="isEditOpen"
        title="แก้ไขข้อมูลเพิ่มเติม"
        description="แก้ไขข้อมูลหลักของงานโดยไม่ออกจากโหมดสแกน"
        :ui="{ content: 'max-w-3xl lg:ml-auto lg:h-full lg:max-h-screen lg:rounded-none' }"
      >
        <template #body>
          <div v-if="order" class="space-y-5">
            <div class="rounded-2xl border border-default p-4">
              <div class="flex items-center gap-3">
                <UAvatar size="lg" v-bind="getAvatarProps(order.customer)" />
                <div class="min-w-0">
                  <p class="truncate font-semibold text-highlighted">{{ currentResultTitle }}</p>
                  <p class="font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
                </div>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <p class="mb-2 text-sm font-medium text-highlighted">วันนัดรับ</p>
                <div class="grid grid-cols-2 gap-2">
                  <UPopover>
                    <UInputDate v-model="dueDate" icon="i-lucide-calendar" class="w-full" />
                    <template #content>
                      <UCalendar v-model="dueDate" locale="th-TH" class="p-2" />
                    </template>
                  </UPopover>

                  <USelect
                    v-model="dueTime"
                    :items="dueTimeOptions"
                    value-key="value"
                    icon="i-lucide-clock"
                    class="w-full"
                  />
                </div>
              </div>

              <UFormField label="สถานะงาน">
                <USelect
                  v-model="editForm.serviceOrderStatus"
                  :items="quickStatusOptions.map((item) => ({ label: item.label, value: item.value }))"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="ช่องทางชำระเงิน">
                <USelect v-model="editForm.paymentMethod" :items="paymentMethodOptions" value-key="value" class="w-full" />
              </UFormField>

              <UFormField label="สถานะชำระเงิน">
                <USelect v-model="editForm.paymentStatus" :items="paymentStatusOptions" value-key="value" class="w-full" />
              </UFormField>
            </div>

            <SlipUploadField
              label="หลักฐานการชำระเงิน"
              :file="slipFile"
              :image-url="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
              :image-label="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
              :blocked-message="editForm.paymentMethod !== 'TRANSFER' ? 'อัปโหลดสลิปได้เฉพาะเมื่อเลือกการชำระเงินแบบโอน' : null"
              confirm-remove
              @update:file="slipFile = $event"
              @blocked="handleBlockedSlip"
              @remove="handleRemoveSlip"
            />

            <UFormField label="หมายเหตุ">
              <UTextarea
                v-model="editForm.note"
                :rows="4"
                class="w-full"
                placeholder="หมายเหตุเพิ่มเติมสำหรับทีมงาน"
              />
            </UFormField>
          </div>
        </template>

        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isEditOpen = false" />
            <UButton label="บันทึกการแก้ไข" icon="i-lucide-save" color="primary" :loading="isSavingEdit" @click="submitEdit" />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
