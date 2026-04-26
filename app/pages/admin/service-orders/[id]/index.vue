<script setup lang="ts">
import type { PaymentMethod, ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";

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
  image: { id: string; secureUrl: string | null; url: string | null } | null;
  deliveryImage: { id: string; secureUrl: string | null; url: string | null } | null;
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
  activeEntitlements: Array<{
    id: string;
    status: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    activatedAt: string | null;
    endAt: string | null;
    product: { id: string; name: string; packageType: string; credits: number | null; validityDays: number | null };
  }>;
  items: Array<{
    id: string;
    storefrontPriceId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
    isPackageIncluded: boolean;
    image: { id: string; secureUrl: string | null; url: string | null } | null;
    photos: Array<{
      id: string;
      imageId: string;
      isDamaged: boolean;
      sortOrder: number;
      secureUrl: string | null;
      url: string | null;
    }>;
    service: { id: string; name: string };
    item: { id: string; name: string };
    label: string;
  }>;
  payments: Array<{
    id: string;
    paymentNo: string | null;
    paymentMethod: PaymentMethod;
    isVerified: boolean;
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
const notify = useNotify();
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
  void navigateTo("/admin/service-orders");
};

const openReceipt = () => {
  if (!order.value) return;
  void navigateTo(`/admin/service-orders/${order.value.id}/intake`);
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

  const isCompleted = order.value.status === "COMPLETED";
  const deliveredAt = order.value.payments[0]?.paidAt ?? null;
  const rows: InfoRow[] = [
    { label: "เลขรับผ้า", value: order.value.orderNo || order.value.id, valueClass: "font-mono text-xs" },
    { label: "สถานะงาน", value: orderStatusLabels[order.value.status] },
    { label: "วันที่รับงาน", value: formatDateTime(order.value.receivedAt) },
    isCompleted
      ? { label: "วันที่ส่งผ้า", value: deliveredAt ? formatDateTime(deliveredAt) : "-" }
      : { label: "วันนัดรับ", value: order.value.dueAt ? formatDateTime(order.value.dueAt) : "-" },
  ];

  if (order.value.basket) {
    rows.push({ label: "ตะกร้า", value: order.value.basket.label || order.value.basket.qrCode || "-" });
  }

  const active = order.value.activeEntitlements ?? [];
  if (active.length) {
    const value = active
      .map((ent) => `${ent.product.name}`)
      .join(" , ");
    rows.push({ label: `แพ็กเกจที่ใช้งานอยู่ (${active.length})`, value, valueClass: "whitespace-pre-line" });
  } else if (order.value.memberEntitlement) {
    const ent = order.value.memberEntitlement;
    rows.push({ label: "แพ็กเกจที่ใช้", value: `${ent.product.name}` });
  }

  return rows;
});

const isMemberZero = computed(() =>
  Boolean(order.value?.memberEntitlement) && Number(order.value?.totalAmount ?? 0) === 0,
);

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

  if (order.value.memberEntitlement) {
    rows.push({
      label: "ใช้เครดิตรายเดือน",
      value: `${order.value.creditUsed ?? 0} เครดิต`,
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

const hasMemberEntitlement = computed(() => Boolean(order.value?.memberEntitlement));
const memberPackageName = computed(() => {
  const active = order.value?.activeEntitlements ?? [];
  if (active.length) {
    return active
      .map((ent) => `${ent.product.name}`)
      .join(" , ");
  }
  const ent = order.value?.memberEntitlement;
  if (!ent) return "-";
  return `${ent.product.name}`;
});

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

const previewOpen = ref(false);
const previewUrl = ref("");
const previewTitle = ref("ดูรูป");
const openImagePreview = (url: string | null | undefined, title = "ดูรูป") => {
  if (!url) return;
  previewUrl.value = url;
  previewTitle.value = title;
  previewOpen.value = true;
};
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
            <UButton label="ดูใบเสร็จ" color="neutral" variant="outline" icon="i-lucide-receipt" @click="openReceipt" />
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
        <section class="space-y-5 rounded-2xl border border-default bg-default p-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex min-w-0 items-center gap-4">
              <UAvatar size="xl" v-bind="getAvatarProps(order.customer)" />
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    class="truncate text-lg font-semibold text-highlighted hover:underline cursor-pointer"
                    @click="navigateTo(`/admin/users/${order.customer.id}`)"
                  >
                    {{ order.customer.name || order.customer.email || "-" }}
                  </button>
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

            <div class="grid grid-cols-2 gap-3 lg:ml-auto lg:flex lg:flex-wrap lg:justify-end *:min-w-35">
              <UCard>
                <div class="space-y-1">
                  <p class="text-xs text-muted">สถานะล่าสุด</p>
                  <UBadge :color="orderStatusBadgeColors[order.status]" variant="subtle" size="lg">
                    {{ orderStatusLabels[order.status] }}
                  </UBadge>
                  <p class="text-xs text-muted">อัปเดต {{ formatDateTime(order.updatedAt) }}</p>
                </div>
              </UCard>
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
                  <p :class="['text-lg font-semibold', isMemberZero ? 'text-success' : 'text-primary']">
                    {{ isMemberZero ? "ใช้สิทธิ์แพ็กเกจ" : formatCurrency(order.totalAmount || 0) }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ hasMemberEntitlement ? "งานนี้ใช้ร่วมกับแพ็กเกจสมาชิก" : "รวมค่าไม้แขวนและส่วนลดแล้ว" }}
                  </p>
                </div>
              </UCard>
              <UCard v-if="hasMemberEntitlement">
                <div class="space-y-1">
                  <p class="text-xs text-muted">เครดิตที่ใช้</p>
                  <p class="text-lg font-semibold text-highlighted">{{ usedCreditLabel }}</p>
                  <p class="text-xs text-muted">คงเหลือ {{ remainingCreditLabel }}</p>
                </div>
              </UCard>
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

        <UCard>
          <template #header>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p class="font-semibold text-highlighted">รายการบริการ</p>
                <p class="text-sm text-muted">{{ itemCountLabel }}</p>
              </div>

              <div v-if="order.image || order.deliveryImage" class="flex items-center gap-3">
                <!-- <span class="hidden text-sm font-medium text-muted md:inline">หลักฐาน:</span> -->
                <div class="flex items-center gap-3">
                  <div class="flex flex-col items-center gap-1">
                    <button
                      v-if="order.image"
                      type="button"
                      class="relative block size-12 overflow-hidden rounded-md cursor-pointer"
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
                      class="relative block size-12 overflow-hidden rounded-md cursor-pointer"
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
          </template>

          <div class="space-y-3">


            <div class="overflow-x-auto rounded-md border border-default">
              <table class="w-full min-w-160 text-sm">
                <thead class="bg-elevated/40 text-xs text-muted">
                  <tr>
                    <th class="w-20 px-3 py-2 text-left font-medium">รูป</th>
                    <th class="px-3 py-2 text-left font-medium">รายการ</th>
                    <th class="w-28 px-3 py-2 text-right font-medium">ราคา/ชิ้น</th>
                    <th class="w-24 px-3 py-2 text-right font-medium">จำนวน</th>
                    <th class="w-28 px-3 py-2 text-right font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in order.items"
                    :key="item.id"
                    class="border-t border-default align-top"
                  >
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-1">
                        <button
                          v-for="photo in (item.photos?.length ? item.photos : (item.image ? [{ id: item.image.id, imageId: item.image.id, isDamaged: false, sortOrder: 0, secureUrl: item.image.secureUrl, url: item.image.url }] : []))"
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
                          v-if="!item.photos?.length && !item.image"
                          class="flex size-14 items-center justify-center rounded-lg border border-dashed border-default text-xs text-muted"
                        >-</div>
                      </div>
                    </td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium text-highlighted">{{ item.label }}</p>
                        <UBadge v-if="item.isPackageIncluded" color="success" variant="subtle" size="xs">
                          รวมในแพ็กเกจ
                        </UBadge>
                      </div>
                      <p class="text-xs text-muted">{{ item.service.name }} | {{ item.item.name }}</p>
                      <p v-if="item.notes" class="mt-1 text-xs text-muted whitespace-pre-line">{{ item.notes }}</p>
                    </td>
                    <td class="px-3 py-3 text-right text-muted">
                      {{ hasMemberEntitlement && item.isPackageIncluded ? "-" : formatCurrency(item.unitPrice) }}
                    </td>
                    <td class="px-3 py-3 text-right text-muted">{{ item.quantity }} ชิ้น</td>
                    <td class="px-3 py-3 text-right">
                      <span
                        v-if="hasMemberEntitlement && item.isPackageIncluded"
                        class="font-semibold text-success"
                      >{{ item.quantity }} เครดิต</span>
                      <span v-else class="font-semibold text-highlighted">{{ formatCurrency(item.totalPrice) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <ImagePreviewModal
    v-model:open="previewOpen"
    :title="previewTitle"
    :image-url="previewUrl"
    image-alt="รูปหลักฐาน"
  />
</template>
