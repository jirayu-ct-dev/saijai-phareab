<script setup lang="ts">
import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { paymentMethodLabels, paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";

type BadgeColor = "success" | "info" | "error" | "neutral" | "primary" | "secondary" | "warning";
type InfoRow = { label: string; value: string; valueClass?: string; dividerBefore?: boolean };

type MyServiceOrderDetail = {
  id: string;
  orderNo: string | null;
  status: ServiceOrderStatus;
  note: string | null;
  creditUsed: number | null;
  receivedAt: string;
  dueAt: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number | null;
  image: { id: string; secureUrl: string | null; url: string | null } | null;
  deliveryImage: { id: string; secureUrl: string | null; url: string | null } | null;
  hangerCharge: { count: number; pricePerUnit: number; total: number } | null;
  employee: { id: string; name: string | null } | null;
  items: Array<{
    id: string;
    label: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
    isPackageIncluded: boolean;
    photos: Array<{
      id: string;
      imageId: string;
      isDamaged: boolean;
      sortOrder: number;
      secureUrl: string | null;
      url: string | null;
    }>;
  }>;
  payment: {
    id: string;
    paymentNo: string | null;
    status: PaymentStatus;
    amount: number;
    method: PaymentMethod | null;
    paidAt: string | null;
  } | null;
};
type MyServiceOrderItem = MyServiceOrderDetail["items"][number];

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const route = useRoute();
const notify = useNotify();
const serviceOrderId = computed(() => String(route.params.id ?? ""));
const { user } = useUser();
const { order: data, pending, refresh, error } = useMyOrderDetail(serviceOrderId.value);

const order = computed(() => (data.value ?? null) as MyServiceOrderDetail | null);
const hydrated = ref(false);
onMounted(() => { hydrated.value = true; });
const isLoading = computed(() => pending.value);
const showSkeleton = computed(() => !hydrated.value || isLoading.value);
const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;

const orderNoText = computed(() => order.value?.orderNo || order.value?.id || "");
const copiedOrderNo = ref(false);
const copyOrderNo = async () => {
  try {
    await navigator.clipboard.writeText(orderNoText.value);
    copiedOrderNo.value = true;
    notify.success("คัดลอกเลขรับผ้าแล้ว");
    setTimeout(() => { copiedOrderNo.value = false; }, 2000);
  } catch {
    notify.error("ไม่สามารถคัดลอกได้");
  }
};

const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }
  void navigateTo("/me/service-orders");
};

const latestPayment = computed(() => order.value?.payment ?? null);
const isPaid = computed(() => latestPayment.value?.status === "PAID");
const documentLabel = computed(() => (isPaid.value ? "ดูใบเสร็จ" : "ดูใบแจ้งราคา"));
const documentIcon = computed(() => (isPaid.value ? "i-lucide-receipt" : "i-lucide-file-text"));

const openDocument = () => {
  const paymentId = latestPayment.value?.id;
  if (!paymentId) return;
  void navigateTo(`/me/receipts/${paymentId}`);
};

const getAvatarProps = () => ({
  as: { img: "img" },
  src: user.value?.image || "",
  alt: user.value?.name || user.value?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const customerRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];
  return [
    { label: "ชื่อลูกค้า", value: user.value?.name || "-" },
    { label: "อีเมล", value: user.value?.email || "-", valueClass: "break-all" },
    { label: "เบอร์โทร", value: user.value?.phoneNumber || "-" },
    { label: "ประเภทลูกค้า", value: "ลูกค้าในระบบ" },
    { label: "ผู้รับงาน", value: order.value.employee?.name || "-" },
    { label: "หมายเหตุ", value: order.value.note || "-", valueClass: "whitespace-pre-line" },
  ];
});

const orderRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];

  const isCompleted = order.value.status === "COMPLETED";
  const deliveredAt = latestPayment.value?.paidAt ?? null;
  return [
    { label: "เลขรับผ้า", value: order.value.orderNo || order.value.id, valueClass: "font-mono text-xs" },
    { label: "สถานะงาน", value: orderStatusLabels[order.value.status] },
    { label: "วันที่รับงาน", value: formatDateTime(order.value.receivedAt) },
    isCompleted
      ? { label: "วันที่ส่งผ้า", value: deliveredAt ? formatDateTime(deliveredAt) : "-" }
      : { label: "วันนัดรับ", value: order.value.dueAt ? formatDateTime(order.value.dueAt) : "-" },
  ];
});

const isMemberZero = computed(() => Number(order.value?.totalAmount ?? 0) === 0 && Number(order.value?.creditUsed ?? 0) > 0);
const hasMemberEntitlement = computed(() => Number(order.value?.creditUsed ?? 0) > 0);
const usedCreditLabel = computed(() => order.value?.creditUsed == null ? "-" : `${order.value.creditUsed} เครดิต`);

const totalRows = computed<InfoRow[]>(() => {
  if (!order.value) return [];
  const rows: InfoRow[] = [
    { label: "ค่าบริการ", value: formatCurrency(order.value.subtotalAmount) },
  ];

  if (order.value.hangerCharge && order.value.hangerCharge.total > 0) {
    rows.push({
      label: `ค่าไม้แขวน (${order.value.hangerCharge.count} ชิ้น)`,
      value: formatCurrency(order.value.hangerCharge.total),
    });
  }

  if (Number(order.value.discountAmount) > 0) {
    rows.push({ label: "ส่วนลด", value: `-${formatCurrency(order.value.discountAmount)}` });
  }

  if (hasMemberEntitlement.value) {
    rows.push({
      label: "ใช้เครดิตรายเดือน",
      value: usedCreditLabel.value,
      valueClass: "font-medium text-success",
    });
  }

  rows.push({
    label: "ยอดรวมสุทธิ",
    value: isMemberZero.value ? "ใช้สิทธิ์แพ็กเกจ" : formatCurrency(order.value.totalAmount || 0),
    valueClass: isMemberZero.value ? "font-semibold text-success" : "font-semibold text-primary",
    dividerBefore: true,
  });

  return rows;
});

const latestPaymentStatusLabel = computed(() =>
  latestPayment.value ? paymentStatusLabels[latestPayment.value.status] : "ยังไม่มีรายการชำระเงิน",
);
const latestPaymentStatusColor = computed(() =>
  latestPayment.value ? paymentStatusColors[latestPayment.value.status] : "neutral",
);
const latestPaymentMethodLabel = computed(() =>
  latestPayment.value?.method ? paymentMethodLabels[latestPayment.value.method] : "-",
);
const paymentRows = computed<InfoRow[]>(() => {
  if (!latestPayment.value) {
    return [
      { label: "สถานะชำระเงิน", value: "ยังไม่มีรายการชำระเงิน" },
      { label: "วิธีชำระ", value: "-" },
      { label: "ยอดชำระ", value: "-" },
    ];
  }

  return [
    { label: "เลขชำระเงิน", value: latestPayment.value.paymentNo || latestPayment.value.id, valueClass: "font-mono text-xs" },
    { label: "สถานะชำระเงิน", value: paymentStatusLabels[latestPayment.value.status] },
    { label: "วิธีชำระ", value: latestPaymentMethodLabel.value },
    { label: "ยอดชำระ", value: formatCurrency(latestPayment.value.amount), valueClass: "font-semibold text-primary" },
    { label: "วันที่ชำระ", value: latestPayment.value.paidAt ? formatDateTime(latestPayment.value.paidAt) : "-" },
  ];
});

const itemCountLabel = computed(() => `${order.value?.items.length ?? 0} รายการ`);
const totalQuantity = computed(() => (order.value?.items ?? []).reduce((sum, item) => sum + item.quantity, 0));

const previewOpen = ref(false);
const previewUrl = ref("");
const previewTitle = ref("ดูรูป");
const openImagePreview = (url: string | null | undefined, title = "ดูรูป") => {
  if (!url) return;
  previewUrl.value = url;
  previewTitle.value = title;
  previewOpen.value = true;
};
const getItemPhotos = (item: MyServiceOrderItem) => item.photos ?? [];
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="my-service-order-detail">
      <template #header>
        <UDashboardNavbar title="รายละเอียดรายการรับผ้า" icon="i-lucide-shopping-basket">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              label="กลับ"
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              class="shrink-0"
              aria-label="กลับ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="goBack"
            />
            <UButton
              v-if="latestPayment"
              :label="documentLabel"
              color="neutral"
              variant="outline"
              :icon="documentIcon"
              class="shrink-0"
              :aria-label="documentLabel"
              :ui="{ label: 'hidden sm:inline' }"
              @click="openDocument"
            />
          </div>
        </template>
        </UDashboardNavbar>
      </template>

      <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <div v-if="showSkeleton" class="space-y-3">
          <div class="-mx-2 border border-default/30 bg-default p-4 p-5! dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex items-start gap-3">
              <USkeleton class="size-12 rounded-full" />
              <div class="flex-1 space-y-2">
                <USkeleton class="h-4 w-48 rounded-lg" />
                <USkeleton class="h-3 w-32 rounded-lg" />
              </div>
              <USkeleton class="h-6 w-20 rounded-full" />
            </div>
          </div>
          <div class="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_360px]">
            <div class="space-y-3">
              <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 p-5! dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <USkeleton class="h-4 w-32 rounded-lg" />
                <div class="grid gap-x-6 gap-y-2 lg:grid-cols-2">
                  <div v-for="i in 6" :key="`so-d-${i}`" class="flex justify-between gap-3">
                    <USkeleton class="h-3 w-24 rounded-lg" />
                    <USkeleton class="h-3 w-28 rounded-lg" />
                  </div>
                </div>
              </div>
              <div class="-mx-2 overflow-hidden border border-default/30 bg-default p-4 p-0! dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <div class="border-b border-default/40 p-3">
                  <USkeleton class="h-4 w-32 rounded-lg" />
                </div>
                <div class="space-y-2 p-3">
                  <USkeleton v-for="i in 4" :key="`so-row-${i}`" class="h-14 w-full rounded-lg" />
                </div>
              </div>
            </div>
            <div class="space-y-3">
              <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 p-5! dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <USkeleton class="h-5 w-36 rounded-lg" />
                <div class="space-y-2">
                  <div v-for="i in 4" :key="`so-t-${i}`" class="flex justify-between gap-3">
                    <USkeleton class="h-3 w-24 rounded-lg" />
                    <USkeleton class="h-3 w-20 rounded-lg" />
                  </div>
                </div>
              </div>
              <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 p-5! dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <USkeleton class="h-5 w-32 rounded-lg" />
                <USkeleton class="h-32 w-full rounded-lg" />
                <USkeleton class="h-10 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="error || !order" class="-mx-2 border border-default/30 bg-default p-4 p-6! dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <p class="text-base font-semibold text-highlighted">ไม่พบรายละเอียดรายการรับผ้า</p>
          <p class="mt-2 text-sm text-muted">รายการอาจถูกลบหรือยังไม่พร้อมใช้งาน</p>
          <div class="mt-4">
            <UButton label="ลองใหม่" color="neutral" variant="outline" @click="refresh()" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <section class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
            <div class="min-h-28 bg-default p-4 p-3! dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
              <div class="flex h-full min-w-0 items-start justify-between gap-3">
                <div class="min-w-0 space-y-1.5">
                  <p class="text-xs text-muted">สถานะล่าสุด</p>
                  <UBadge :color="orderStatusBadgeColors[order.status]" variant="subtle" size="lg">
                    {{ orderStatusLabels[order.status] }}
                  </UBadge>
                  <p class="truncate text-xs text-muted">รับ {{ formatDateTime(order.receivedAt) }}</p>
                </div>
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UIcon name="i-lucide-activity" class="size-4" />
                </div>
              </div>
            </div>
            <div class="min-h-28 bg-default p-4 p-3! dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
              <div class="flex h-full min-w-0 items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <p class="text-xs text-muted">จำนวนรายการ</p>
                  <p class="truncate text-lg font-semibold text-highlighted">{{ itemCountLabel }}</p>
                  <p class="text-xs text-muted">{{ totalQuantity }} ชิ้น</p>
                </div>
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <UIcon name="i-lucide-shirt" class="size-4" />
                </div>
              </div>
            </div>
            <div class="min-h-28 bg-default p-4 p-3! dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
              <div class="flex h-full min-w-0 items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <p class="text-xs text-muted">ยอดรวมสุทธิ</p>
                  <p :class="['truncate text-lg font-semibold', isMemberZero ? 'text-success' : 'text-primary']">
                    {{ isMemberZero ? "ใช้สิทธิ์แพ็กเกจ" : formatCurrency(order.totalAmount || 0) }}
                  </p>
                  <p class="line-clamp-2 text-xs text-muted">
                    {{ hasMemberEntitlement ? "งานนี้ใช้ร่วมกับแพ็กเกจสมาชิก" : "รวมค่าไม้แขวนและส่วนลดแล้ว" }}
                  </p>
                </div>
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <UIcon name="i-lucide-wallet" class="size-4" />
                </div>
              </div>
            </div>
            <div class="min-h-28 bg-default p-4 p-3! dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
              <div class="flex h-full min-w-0 items-start justify-between gap-3">
                <div class="min-w-0 space-y-1.5">
                  <p class="text-xs text-muted">การชำระเงิน</p>
                  <UBadge :color="latestPaymentStatusColor" variant="subtle" size="lg">
                    {{ latestPaymentStatusLabel }}
                  </UBadge>
                  <p class="truncate text-xs text-muted">{{ latestPaymentMethodLabel }}</p>
                </div>
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <UIcon name="i-lucide-credit-card" class="size-4" />
                </div>
              </div>
            </div>
            <div v-if="hasMemberEntitlement" class="col-span-2 min-h-28 bg-default p-4 p-3! dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20 xl:col-span-4">
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <p class="text-xs text-muted">แพ็กเกจสมาชิก</p>
                  <p class="truncate text-lg font-semibold text-highlighted">ใช้สิทธิ์แพ็กเกจ</p>
                  <p class="text-xs text-muted">ใช้ {{ usedCreditLabel }}</p>
                </div>
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <UIcon name="i-lucide-ticket-check" class="size-4" />
                </div>
              </div>
            </div>
          </section>

          <section class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex min-w-0 items-center gap-4">
                <UAvatar size="xl" class="shrink-0" v-bind="getAvatarProps()" />
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="min-w-0 truncate text-lg font-semibold text-highlighted">
                      {{ user?.name || user?.email || "-" }}
                    </p>
                    <UBadge color="neutral" variant="soft" size="xs">ลูกค้าในระบบ</UBadge>
                  </div>
                  <div class="flex items-center gap-1">
                    <p class="font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
                    <UButton
                      :icon="copiedOrderNo ? 'i-lucide-check' : 'i-lucide-copy'"
                      size="xs"
                      :color="copiedOrderNo ? 'success' : 'neutral'"
                      variant="ghost"
                      @click="() => copyOrderNo()"
                    />
                  </div>
                  <p class="text-sm text-muted">
                    รับงานเมื่อ {{ formatDateTime(order.receivedAt) }}<br>
                    <span v-if="order.status === 'COMPLETED' && latestPayment?.paidAt">ส่งผ้า {{ formatDateTime(latestPayment.paidAt) }}</span>
                    <span v-else-if="order.dueAt">นัดรับ {{ formatDateTime(order.dueAt) }}</span>
                  </p>
                </div>
              </div>
            </div>

            <div class="border-t border-default pt-5">
              <p class="text-sm font-semibold text-highlighted">ข้อมูลลูกค้าและงาน</p>
              <div class="mt-3 grid gap-x-6 gap-y-3 text-sm lg:grid-cols-2 lg:[&>*:nth-child(odd)]:pr-4 lg:[&>*:nth-child(even)]:border-l lg:[&>*:nth-child(even)]:border-dashed lg:[&>*:nth-child(even)]:border-default lg:[&>*:nth-child(even)]:pl-4">
                <div v-for="row in customerRows" :key="`c-${row.label}`" class="flex items-start justify-between gap-3">
                  <span class="text-muted">{{ row.label }}</span>
                  <span :class="['max-w-[62%] text-right text-highlighted', row.valueClass]">{{ row.value }}</span>
                </div>
                <div v-for="row in orderRows" :key="`o-${row.label}`" class="flex items-start justify-between gap-3">
                  <span class="text-muted">{{ row.label }}</span>
                  <span v-if="row.label === 'เลขรับผ้า'" class="flex items-center gap-1">
                    <span :class="['text-right text-highlighted', row.valueClass]">{{ row.value }}</span>
                    <UButton
                      :icon="copiedOrderNo ? 'i-lucide-check' : 'i-lucide-copy'"
                      size="xs"
                      :color="copiedOrderNo ? 'success' : 'neutral'"
                      variant="ghost"
                      @click="() => copyOrderNo()"
                    />
                  </span>
                  <span v-else :class="['max-w-[62%] text-right text-highlighted', row.valueClass]">{{ row.value }}</span>
                </div>
              </div>
            </div>

            <div class="border-t border-default pt-5">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-highlighted">ข้อมูลการชำระเงิน</p>
                <UBadge :color="latestPaymentStatusColor" variant="subtle" size="sm">
                  {{ latestPaymentStatusLabel }}
                </UBadge>
              </div>
              <div class="mt-3 grid gap-x-6 gap-y-3 text-sm lg:grid-cols-2 lg:[&>*:nth-child(odd)]:pr-4 lg:[&>*:nth-child(even)]:border-l lg:[&>*:nth-child(even)]:border-dashed lg:[&>*:nth-child(even)]:border-default lg:[&>*:nth-child(even)]:pl-4">
                <div v-for="row in paymentRows" :key="`p-${row.label}`" class="flex items-start justify-between gap-3">
                  <span class="text-muted">{{ row.label }}</span>
                  <span :class="['max-w-[62%] text-right text-highlighted', row.valueClass]">{{ row.value }}</span>
                </div>
              </div>
            </div>

            <div class="border-t border-default pt-5">
              <p class="text-sm font-semibold text-highlighted">สรุปยอด</p>
              <div class="mt-3 space-y-2 text-sm">
                <div
                  v-for="row in totalRows"
                  :key="row.label"
                  :class="['flex items-center justify-between gap-3', row.dividerBefore ? 'border-t border-default pt-2' : '']"
                >
                  <span class="text-muted">{{ row.label }}</span>
                  <span :class="row.valueClass || 'font-medium text-highlighted'">{{ row.value }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="-mx-2 overflow-hidden border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex flex-col justify-between gap-3 border-b border-default/40 pb-3 sm:flex-row sm:items-center">
              <div>
                <p class="text-sm font-semibold text-highlighted">รายการบริการ <span class="ml-2 text-xs text-muted">{{ itemCountLabel }}</span></p>
              </div>

              <div v-if="order.image || order.deliveryImage" class="flex items-center gap-3">
                <div class="flex items-center gap-3">
                  <div class="flex flex-col items-center gap-1">
                    <button
                      v-if="order.image"
                      type="button"
                      class="relative block size-12 overflow-hidden rounded-lg cursor-pointer"
                      title="ดูหลักฐานการรับผ้า"
                      @click="openImagePreview(order.image.secureUrl || order.image.url, 'หลักฐานการรับผ้า')"
                    >
                      <NuxtImg
                        :src="order.image.secureUrl || order.image.url || ''"
                        class="h-full w-full object-cover"
                        sizes="48px"
                        loading="lazy"
                      />
                    </button>
                    <div v-else class="flex size-12 items-center justify-center rounded-lg border border-dashed border-default bg-muted/10 text-xs text-muted" title="ไม่มีรูปรับผ้า">
                      <UIcon name="i-lucide-image-off" class="size-4" />
                    </div>
                    <span class="text-[10px] text-muted">รับผ้า</span>
                  </div>

                  <div class="flex flex-col items-center gap-1">
                    <button
                      v-if="order.deliveryImage"
                      type="button"
                      class="relative block size-12 overflow-hidden rounded-lg cursor-pointer"
                      title="ดูหลักฐานการส่งผ้า"
                      @click="openImagePreview(order.deliveryImage.secureUrl || order.deliveryImage.url, 'หลักฐานการส่งผ้า')"
                    >
                      <NuxtImg
                        :src="order.deliveryImage.secureUrl || order.deliveryImage.url || ''"
                        class="h-full w-full object-cover"
                        sizes="48px"
                        loading="lazy"
                      />
                    </button>
                    <div v-else class="flex size-12 items-center justify-center rounded-lg border border-dashed border-default bg-muted/10 text-xs text-muted" title="ไม่มีรูปส่งผ้า">
                      <UIcon name="i-lucide-image-off" class="size-4" />
                    </div>
                    <span class="text-[10px] text-muted">ส่งผ้า</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-3">
              <div v-if="order.items.length" class="space-y-1 md:hidden">
                <div
                  v-for="item in order.items"
                  :key="item.id"
                  class="overflow-hidden border border-default/30 bg-transparent transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default/70 dark:border-default/20 dark:bg-transparent dark:hover:bg-elevated/45"
                >
                  <div class="flex min-w-0 items-center gap-2 p-2">
                    <div class="shrink-0">
                      <div class="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-default/30 bg-elevated/30 dark:border-default/20 dark:bg-default/80">
                        <button
                          v-if="getItemPhotos(item)[0]"
                          type="button"
                          class="relative size-full overflow-hidden"
                          @click="openImagePreview(getItemPhotos(item)[0]?.secureUrl || getItemPhotos(item)[0]?.url, `${item.label}`)"
                        >
                          <NuxtImg
                            :src="getItemPhotos(item)[0]?.secureUrl || getItemPhotos(item)[0]?.url || ''"
                            class="h-full w-full cursor-pointer object-cover"
                            sizes="56px"
                            loading="lazy"
                          />
                          <UBadge
                            v-if="getItemPhotos(item)[0]?.isDamaged"
                            color="error"
                            variant="solid"
                            size="xs"
                            class="absolute left-0.5 top-0.5"
                          >!</UBadge>
                        </button>
                        <UIcon v-else name="i-lucide-shirt" class="size-5 text-muted" />
                      </div>
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-start justify-between gap-2">
                        <div class="min-w-0">
                          <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                            <p class="min-w-0 truncate text-sm font-medium text-highlighted">{{ item.label }}</p>
                            <UBadge v-if="item.isPackageIncluded" color="success" variant="subtle" size="xs">
                              รวมในแพ็กเกจ
                            </UBadge>
                          </div>
                          <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                            <span>{{ item.quantity }} ชิ้น</span>
                            <span>{{ item.isPackageIncluded ? "-" : formatCurrency(item.unitPrice) }}</span>
                          </div>
                        </div>
                        <div class="shrink-0 text-right">
                          <p v-if="item.isPackageIncluded" class="text-sm font-semibold leading-none text-success">
                            {{ item.quantity }} เครดิต
                          </p>
                          <p v-else class="text-[13px] font-semibold leading-none tabular-nums text-primary">{{ formatCurrency(item.totalPrice) }}</p>
                          <p v-if="getItemPhotos(item).length > 1" class="mt-1 text-[10px] text-muted">รูป {{ getItemPhotos(item).length }}</p>
                        </div>
                      </div>

                      <p v-if="item.notes" class="mt-1 line-clamp-2 text-xs text-muted whitespace-pre-line">{{ item.notes }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="order.items.length" class="hidden overflow-x-auto md:block">
                <table class="w-full min-w-160 text-sm">
                  <thead class="bg-default text-xs text-toned dark:bg-transparent">
                    <tr>
                      <th class="w-20 border-b border-default bg-default px-3 py-2.5 text-left font-semibold uppercase tracking-wide dark:border-default/20 dark:bg-transparent">รูป</th>
                      <th class="border-b border-default bg-default px-3 py-2.5 text-left font-semibold uppercase tracking-wide dark:border-default/20 dark:bg-transparent">รายการ</th>
                      <th class="w-28 border-b border-default bg-default px-3 py-2.5 text-right font-semibold uppercase tracking-wide dark:border-default/20 dark:bg-transparent">ราคา/ชิ้น</th>
                      <th class="w-24 border-b border-default bg-default px-3 py-2.5 text-right font-semibold uppercase tracking-wide dark:border-default/20 dark:bg-transparent">จำนวน</th>
                      <th class="w-28 border-b border-default bg-default px-3 py-2.5 text-right font-semibold uppercase tracking-wide dark:border-default/20 dark:bg-transparent">รวม</th>
                    </tr>
                  </thead>
                  <tbody class="[&>tr:last-child>td]:border-b-0">
                    <tr
                      v-for="item in order.items"
                      :key="item.id"
                      class="align-top transition-colors hover:bg-primary/5 dark:hover:bg-elevated/45"
                    >
                      <td class="border-b border-default px-3 py-2 dark:border-default/25">
                        <div class="flex flex-wrap gap-1">
                          <button
                            v-for="photo in getItemPhotos(item)"
                            :key="photo.id"
                            type="button"
                            class="relative size-14 overflow-hidden rounded-lg border border-default bg-muted/30"
                            @click="openImagePreview(photo.secureUrl || photo.url, `${item.label}`)"
                          >
                            <NuxtImg
                              :src="photo.secureUrl || photo.url || ''"
                              class="h-full w-full cursor-pointer object-cover"
                              sizes="56px"
                              loading="lazy"
                            />
                            <UBadge
                              v-if="photo.isDamaged"
                              color="error"
                              variant="solid"
                              size="xs"
                              class="absolute left-0.5 top-0.5"
                            >!</UBadge>
                          </button>
                          <div
                            v-if="!getItemPhotos(item).length"
                            class="flex size-14 items-center justify-center rounded-lg border border-dashed border-default text-xs text-muted"
                          >-</div>
                        </div>
                      </td>
                      <td class="border-b border-default px-3 py-2 dark:border-default/25">
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="wrap-break-word font-medium text-highlighted">{{ item.label }}</p>
                          <UBadge v-if="item.isPackageIncluded" color="success" variant="subtle" size="xs">
                            รวมในแพ็กเกจ
                          </UBadge>
                        </div>
                        <p v-if="item.notes" class="mt-1 wrap-break-word text-xs text-muted whitespace-pre-line">{{ item.notes }}</p>
                      </td>
                      <td class="border-b border-default px-3 py-2 text-right text-muted dark:border-default/25">
                        {{ item.isPackageIncluded ? "-" : formatCurrency(item.unitPrice) }}
                      </td>
                      <td class="border-b border-default px-3 py-2 text-right text-muted dark:border-default/25">{{ item.quantity }} ชิ้น</td>
                      <td class="border-b border-default px-3 py-2 text-right dark:border-default/25">
                        <span
                          v-if="item.isPackageIncluded"
                          class="font-semibold text-success"
                        >{{ item.quantity }} เครดิต</span>
                        <span v-else class="font-semibold text-highlighted">{{ formatCurrency(item.totalPrice) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">ไม่พบรายการบริการ</div>
            </div>
          </section>
        </div>
      </div>
      </template>
    </UDashboardPanel>

    <ImagePreviewModal
      v-model:open="previewOpen"
      :title="previewTitle"
      :image-url="previewUrl"
      image-alt="รูปหลักฐาน"
    />
  </div>
</template>
