<script setup lang="ts">
import type { EntitlementStatus, PackageSaleStatus, PaymentMethod, PaymentStatus, Role, ServiceOrderStatus } from "~~/shared/types/enums";
import { packageTypeColors, packageTypeLabels } from "~~/shared/config/packageConfig";
import { paymentMethodLabels, paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import { useAdminPayments } from "~~/app/composables/useAdminPayments";
import ConfirmPaymentModal from "~~/app/components/admin/payment/ConfirmPaymentModal.vue";
import EditPaymentStateModal from "~~/app/components/admin/payment/EditPaymentStateModal.vue";

type BadgeColor = "error" | "primary" | "secondary" | "success" | "info" | "warning" | "neutral";
type InfoRow = { label: string; value: string; valueClass?: string; dividerBefore?: boolean; href?: string };
type DetailItemPhoto = { id: string; isDamaged?: boolean; url: string | null; secureUrl: string | null };
type DetailItem = { id: string; title: string; metaLabel?: string | null; unitPriceLabel?: string | null; quantityLabel: string; totalLabel: string; badgeLabel?: string | null; badgeColor?: BadgeColor; photos?: DetailItemPhoto[]; notes?: string | null };

type PaymentDetailResponse = {
  id: string;
  paymentNo: string | null;
  receiptNo: string | null;
  status: PaymentStatus;
  method: PaymentMethod | null;
  amount: number;
  note: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: unknown;
  customer: { id: string; name: string | null; email: string; phoneNumber: string | null; image: string | null };
  slipImage: { id: string; url: string | null; secureUrl: string | null } | null;
  memberEntitlement: {
    id: string;
    status: EntitlementStatus;
    creditInitial: number | null;
    creditRemaining: number | null;
    activatedAt: string | null;
    endAt: string | null;
    product: { name: string };
  } | null;
  packageSale: {
    id: string;
    status: PackageSaleStatus;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    note: string | null;
    soldBy: { name: string | null; email: string } | null;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      product: { name: string; packageType: "MAIN" | "ADDON"; credits: number | null; validityDays: number | null };
    }>;
  } | null;
  serviceOrder: {
    id: string;
    orderNo: string | null;
    status: ServiceOrderStatus;
    receivedAt: string | null;
    dueAt: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    note: string | null;
    employee: { name: string | null; email: string } | null;
    memberEntitlement: { product: { name: string } } | null;
    hangerCharge: { count: number; total: number } | null;
    items: Array<{ id: string; label: string; quantity: number; unitPrice: number; totalPrice: number; notes: string | null; isPackageIncluded: boolean; service: { name: string }; image: { id: string; url: string | null; secureUrl: string | null } | null; photos: Array<{ id: string; imageId: string; isDamaged: boolean; sortOrder: number; url: string | null; secureUrl: string | null }> }>;
  } | null;
};

definePageMeta({ layout: "admin", middleware: ["role-employee"] });

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const notify = useNotify();
const { user } = useUser();
const isAdmin = computed(() => (user.value?.role as Role | undefined) === "ADMIN");
const { updatePayment, uploadSlip } = useAdminPayments();
const { data, status, refresh, error } = await useFetch<PaymentDetailResponse>(() => `/api/admin/payments/${paymentId.value}`, { key: () => `admin-payment-detail-${paymentId.value}` });

const payment = computed(() => data.value ?? null);
const isLoading = computed(() => status.value === "pending");
const isPackagePayment = computed(() => Boolean(payment.value?.packageSale));

const paymentStatus = computed<PaymentStatus>(() => payment.value?.status ?? "UNPAID");
const canConfirmPayment = computed(
  () => Boolean(payment.value) && paymentStatus.value !== "PAID" && paymentStatus.value !== "CANCELLED",
);
const confirmModalOpen = ref(false);
const editStateModalOpen = ref(false);
const onPaymentConfirmed = async () => {
  await refresh();
};
const onPaymentStateUpdated = async () => {
  await refresh();
};
const handlePaymentStatusBadgeClick = () => {
  if (!payment.value) return;
  if (isAdmin.value) {
    editStateModalOpen.value = true;
    return;
  }
  if (canConfirmPayment.value) {
    confirmModalOpen.value = true;
  }
};
const isPaymentStatusActionVisible = computed(() => isAdmin.value || canConfirmPayment.value);
const paymentStatusActionLabel = computed(() => {
  if (isAdmin.value) return "แก้ไขชำระเงิน";
  if (canConfirmPayment.value) return "ยืนยันชำระเงิน";
  return paymentStatusLabels[paymentStatus.value] ?? paymentStatus.value;
});
const paymentStatusActionIcon = computed(() => {
  if (isAdmin.value) return "i-lucide-pencil";
  if (canConfirmPayment.value) return "i-lucide-check";
  return "i-lucide-circle";
});
const paymentStatusBadgeTitle = computed(() => {
  if (isAdmin.value) return "คลิกเพื่อแก้ไขสถานะ";
  if (canConfirmPayment.value) return "คลิกเพื่อยืนยันการชำระเงิน";
  return undefined;
});

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
  RECEIVED: { label: "รับผ้า", color: "info" },
  PROCESSING: { label: "ดำเนินการ", color: "primary" },
  DELIVERING: { label: "กำลังส่ง/รอรับ", color: "warning" },
  COMPLETED: { label: "เสร็จสิ้น", color: "success" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const paymentForm = ref({ note: "", slipImageId: null as string | null });
const pendingSlipFile = ref<File | null>(null);
const isUploadingSlip = ref(false);
const isSavingPayment = ref(false);
const clearPendingSlip = () => { pendingSlipFile.value = null; };
watch(payment, (nextPayment) => {
  if (!nextPayment) return;
  paymentForm.value = { note: nextPayment.note ?? "", slipImageId: nextPayment.slipImage?.id ?? null };
  clearPendingSlip();
}, { immediate: true });

const currentSlipImage = computed(() => paymentForm.value.slipImageId === null ? null : payment.value?.slipImage ?? null);
const currentSlipImageUrl = computed(() => currentSlipImage.value?.secureUrl || currentSlipImage.value?.url || "");
const hasPendingSlip = computed(() => Boolean(pendingSlipFile.value));
const isDirty = computed(() => {
  if (!payment.value) return false;
  return paymentForm.value.note !== (payment.value.note ?? "") || paymentForm.value.slipImageId !== (payment.value.slipImage?.id ?? null) || hasPendingSlip.value;
});

const copiedPaymentNo = ref(false);
const copyPaymentNo = async () => {
  const text = payment.value?.paymentNo;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedPaymentNo.value = true;
    notify.success("คัดลอกเลขชำระเงินแล้ว");
    setTimeout(() => { copiedPaymentNo.value = false; }, 2000);
  } catch {
    notify.error("ไม่สามารถคัดลอกได้");
  }
};

const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }
  void navigateTo("/admin/payment");
};

const getAvatarProps = (target?: PaymentDetailResponse["customer"] | null) => ({ as: { img: "img" }, src: target?.image || "", alt: target?.name || target?.email || "ลูกค้า", loading: "lazy" as const });
const saleTypeLabel = computed(() => (isPackagePayment.value ? "แพ็กเกจ" : "รายการผ้า"));
const saleTypeColor = computed<BadgeColor>(() => (isPackagePayment.value ? "primary" : "warning"));
const purchaseSectionTitle = computed(() => (isPackagePayment.value ? "ข้อมูลการซื้อแพ็กเกจ" : "ข้อมูลรายการผ้า"));
const totalsSectionTitle = computed(() => (isPackagePayment.value ? "สรุปยอดการซื้อ" : "สรุปยอดรายการผ้า"));
const itemSectionTitle = computed(() => (isPackagePayment.value ? "รายการแพ็กเกจ" : "รายการผ้า"));
const itemSectionDescription = computed(() => `${isPackagePayment.value ? payment.value?.packageSale?.items.length ?? 0 : payment.value?.serviceOrder?.items.length ?? 0} รายการ`);
const paymentManagerDescription = "จัดการหมายเหตุและหลักฐานการชำระเงิน";
const paymentDocumentLabel = computed(() => paymentStatus.value === "PAID" ? "ใบเสร็จ" : "ใบแจ้งราคา");
const paymentDocumentIcon = computed(() => paymentStatus.value === "PAID" ? "i-lucide-receipt" : "i-lucide-file-text");
const openPaymentDocument = () => {
  if (!payment.value) return;
  const target = paymentStatus.value === "PAID" ? "receipt" : "quotation";
  void navigateTo(`/admin/payment/${payment.value.id}/${target}`);
};

const customerInfoRows = computed<InfoRow[]>(() => payment.value ? [
  { label: "ชื่อลูกค้า", value: payment.value.customer.name || "-" },
  { label: "อีเมล", value: payment.value.customer.email, valueClass: "break-all" },
  { label: "เบอร์โทร", value: payment.value.customer.phoneNumber || "-" },
  { label: "ประเภท", value: saleTypeLabel.value },
] : []);

const purchaseInfoRows = computed<InfoRow[]>(() => {
  if (!payment.value) return [];
  if (payment.value.packageSale) {
    return [
      { label: "เลขรายการขาย", value: payment.value.packageSale.id },
      { label: "สถานะการขาย", value: packageSaleStatusMap[payment.value.packageSale.status].label },
      { label: "ผู้ขาย", value: payment.value.packageSale.soldBy?.name || payment.value.packageSale.soldBy?.email || "-" },
      { label: "หมายเหตุการขาย", value: payment.value.packageSale.note || "-", valueClass: "whitespace-pre-line" },
    ];
  }
  const serviceOrderId = payment.value.serviceOrder?.id;
  return [
    {
      label: "เลขรับผ้า",
      value: payment.value.serviceOrder?.orderNo || serviceOrderId || "-",
      href: serviceOrderId ? `/admin/service-orders/${serviceOrderId}` : undefined,
    },
    { label: "สถานะงาน", value: payment.value.serviceOrder ? serviceOrderStatusMap[payment.value.serviceOrder.status].label : "-" },
    { label: "วันที่รับงาน", value: payment.value.serviceOrder?.receivedAt ? formatDateTime(payment.value.serviceOrder.receivedAt) : "-" },
    { label: "วันนัดรับ", value: payment.value.serviceOrder?.dueAt ? formatDateTime(payment.value.serviceOrder.dueAt) : "-" },
    { label: "ผู้รับงาน", value: payment.value.serviceOrder?.employee?.name || payment.value.serviceOrder?.employee?.email || "-" },
    { label: "ใช้สิทธิ์แพ็กเกจ", value: payment.value.serviceOrder?.memberEntitlement?.product.name || "-" },
    { label: "หมายเหตุงาน", value: payment.value.serviceOrder?.note || "-", valueClass: "whitespace-pre-line" },
  ];
});

const paymentInfoRows = computed<InfoRow[]>(() => payment.value ? [
  { label: "เลขชำระเงิน", value: payment.value.paymentNo || "-" },
  { label: "เลขใบเสร็จ", value: payment.value.receiptNo || "-" },
  { label: "สถานะ", value: paymentStatusLabels[paymentStatus.value] ?? paymentStatus.value },
  { label: "ยอดชำระ", value: formatCurrency(payment.value.amount), valueClass: "font-semibold text-highlighted" },
  { label: "วิธีชำระ", value: payment.value.method ? paymentMethodLabels[payment.value.method] : "-" },
  { label: "วันที่ชำระ", value: payment.value.paidAt ? formatDateTime(payment.value.paidAt) : "-" },
  { label: "วันที่ยืนยัน", value: payment.value.confirmedAt ? formatDateTime(payment.value.confirmedAt) : "-" },
  { label: "วันที่สร้าง", value: formatDateTime(payment.value.createdAt) },
] : []);

const totalRows = computed<InfoRow[]>(() => {
  if (!payment.value) return [];
  if (payment.value.packageSale) {
    return [
      { label: "ยอดก่อนลด", value: formatCurrency(payment.value.packageSale.subtotalAmount) },
      { label: "ส่วนลด", value: formatCurrency(payment.value.packageSale.discountAmount) },
      { label: "ยอดรวมสุทธิ", value: formatCurrency(payment.value.packageSale.totalAmount), valueClass: "font-semibold text-highlighted", dividerBefore: true },
    ];
  }
  const rows: InfoRow[] = [
    { label: "ค่าบริการ", value: formatCurrency(payment.value.serviceOrder?.subtotalAmount || 0) },
  ];
  if (payment.value.serviceOrder?.hangerCharge) {
    rows.push({ label: `ค่าไม้แขวน (${payment.value.serviceOrder.hangerCharge.count} ชิ้น)`, value: formatCurrency(payment.value.serviceOrder.hangerCharge.total) });
  }
  rows.push({ label: "ส่วนลด", value: formatCurrency(payment.value.serviceOrder?.discountAmount || 0) });
    rows.push({ label: "ยอดรวมสุทธิ", value: formatCurrency(payment.value.serviceOrder?.totalAmount || 0), valueClass: "font-semibold text-highlighted", dividerBefore: true });
  return rows;
});

const detailItems = computed<DetailItem[]>(() => {
  if (!payment.value) return [];
  if (payment.value.packageSale) {
    return payment.value.packageSale.items.map<DetailItem>((item) => ({
      id: item.id,
      title: item.product.name,
      metaLabel: [
        item.product.credits ? `เครดิต ${item.product.credits}` : null,
        item.product.validityDays ? `อายุ ${item.product.validityDays} วัน` : null,
      ].filter(Boolean).join(" • "),
      unitPriceLabel: formatCurrency(item.unitPrice),
      quantityLabel: `${item.quantity} รายการ`,
      totalLabel: formatCurrency(item.totalPrice),
      badgeLabel: packageTypeLabels[item.product.packageType],
      badgeColor: packageTypeColors[item.product.packageType] as BadgeColor,
    }));
  }
  return (payment.value.serviceOrder?.items || []).map<DetailItem>((item) => ({
    id: item.id,
    title: item.label,
    metaLabel: item.service.name,
    notes: item.notes,
    unitPriceLabel: formatCurrency(item.unitPrice),
    quantityLabel: `${item.quantity} ชิ้น`,
    totalLabel: formatCurrency(item.totalPrice),
    badgeLabel: item.isPackageIncluded ? "รวมในแพ็กเกจ" : null,
    badgeColor: item.isPackageIncluded ? "success" : undefined,
    photos: (item.photos.length
      ? item.photos
      : (item.image ? [{ id: item.image.id, isDamaged: false, url: item.image.url, secureUrl: item.image.secureUrl }] : [])
    ).map((p) => ({ id: p.id, isDamaged: "isDamaged" in p ? p.isDamaged : false, url: p.url, secureUrl: p.secureUrl })),
  }));
});

const previewOpen = ref(false);
const previewUrl = ref("");
const previewTitle = ref("ดูรูป");
const openItemImagePreview = (url: string | null | undefined, title = "ดูรูป") => {
  if (!url) return;
  previewUrl.value = url;
  previewTitle.value = title;
  previewOpen.value = true;
};

const entitlementRows = computed<InfoRow[]>(() => payment.value?.memberEntitlement ? [
  { label: "ชื่อแพ็กเกจ", value: payment.value.memberEntitlement.product.name },
  { label: "สถานะสิทธิ์", value: entitlementStatusMap[payment.value.memberEntitlement.status].label },
  { label: "เครดิตเริ่มต้น", value: String(payment.value.memberEntitlement.creditInitial ?? "-") },
  { label: "เครดิตคงเหลือ", value: String(payment.value.memberEntitlement.creditRemaining ?? "-") },
  { label: "เริ่มใช้งาน", value: payment.value.memberEntitlement.activatedAt ? formatDateTime(payment.value.memberEntitlement.activatedAt) : "-" },
  { label: "หมดอายุ", value: payment.value.memberEntitlement.endAt ? formatDateTime(payment.value.memberEntitlement.endAt) : "-" },
] : []);
const handleSlipRemove = () => {
  if (hasPendingSlip.value) {
    clearPendingSlip();
    return;
  }
  paymentForm.value.slipImageId = null;
};

const slipPhotos = computed<import("~~/app/components/UI/PhotoUpload.vue").Photo[]>(() => {
  if (pendingSlipFile.value) return [{ key: "slip", file: pendingSlipFile.value, url: null }];
  return currentSlipImageUrl.value ? [{ key: "slip", file: null, url: currentSlipImageUrl.value }] : [];
});

const onSlipPhotosUpdate = (photos: import("~~/app/components/UI/PhotoUpload.vue").Photo[]) => {
  const photo = photos[0] ?? null;
  pendingSlipFile.value = photo?.file ?? null;
  if (!photo) handleSlipRemove();
};

const slipDescription = computed(() => {
  if (hasPendingSlip.value) return "เลือกรูปไว้แล้ว ระบบจะอัปโหลดเมื่อกดบันทึก";
  if (currentSlipImage.value) return "มีรูปหลักฐานแนบอยู่แล้ว สามารถเลือกไฟล์ใหม่เพื่อแทนที่ได้";
  return "ยังไม่มีรูปหลักฐานแนบ";
});
const handleSaveButtonClick = () => {
  if (!isDirty.value) {
    notify.info("ยังไม่มีการเปลี่ยนแปลงให้บันทึก");
    return;
  }
  void savePaymentChanges();
};
const savePaymentChanges = async () => {
  if (!payment.value) return;
  isSavingPayment.value = true;
  let slipImageId = paymentForm.value.slipImageId;
  if (pendingSlipFile.value) {
    isUploadingSlip.value = true;
    const uploaded = await uploadSlip(pendingSlipFile.value);
    isUploadingSlip.value = false;
    if (!uploaded) {
      isSavingPayment.value = false;
      return;
    }
    slipImageId = uploaded.id;
  }
  const ok = await updatePayment(payment.value.id, { note: paymentForm.value.note.trim() || null, slipImageId });
  isSavingPayment.value = false;
  if (ok) {
    paymentForm.value.slipImageId = slipImageId;
    await refresh();
  }
};
</script>

<template>
  <UDashboardPanel id="payment-detail">
    <template #header>
      <UDashboardNavbar :title="payment?.receiptNo || payment?.paymentNo || 'รายละเอียดการชำระเงิน'" icon="i-lucide-badge-info">
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
              v-if="payment && isPaymentStatusActionVisible"
              :label="paymentStatusActionLabel"
              :color="paymentStatusColors[paymentStatus]"
              variant="subtle"
              :icon="paymentStatusActionIcon"
              class="shrink-0"
              :title="paymentStatusBadgeTitle"
              :aria-label="paymentStatusActionLabel"
              :ui="{ label: 'hidden sm:inline' }"
              @click="handlePaymentStatusBadgeClick"
            />
            <UBadge
              v-else-if="payment"
              :color="paymentStatusColors[paymentStatus]"
              variant="soft"
              size="md"
              class="shrink-0"
            >
              {{ paymentStatusLabels[paymentStatus] }}
            </UBadge>
            <UButton 
              v-if="payment" 
              :label="paymentDocumentLabel"
              color="neutral" 
              variant="outline" 
              :icon="paymentDocumentIcon"
              class="shrink-0"
              :aria-label="paymentDocumentLabel"
              :ui="{ label: 'hidden sm:inline' }"
              @click="openPaymentDocument"
            />
            <UButton 
              icon="i-lucide-refresh-cw" 
              color="neutral" 
              variant="outline" 
              :loading="isLoading" 
              class="shrink-0"
              aria-label="รีเฟรช"
              :ui="{ label: 'hidden sm:inline' }"
              @click="refresh()" 
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div v-if="isLoading" class="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="min-w-0 space-y-5">
          <USkeleton class="h-96 rounded-2xl" />
          <USkeleton class="h-128 rounded-2xl" />
        </div>
        <div class="min-w-0 space-y-5">
          <USkeleton class="h-168 rounded-2xl" />
        </div>
      </div>

      <div v-else-if="error || !payment" class="rounded-2xl border border-default bg-default p-6">
        <p class="text-base font-semibold text-highlighted">ไม่พบข้อมูลการชำระเงิน</p>
        <p class="mt-2 text-sm text-muted">รายการนี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง</p>
      </div>

      <div v-else class="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="min-w-0 space-y-5">
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <UAvatar v-bind="getAvatarProps(payment.customer)" size="lg" />
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="truncate text-base font-semibold text-highlighted">{{ payment.customer.name || payment.customer.email || "-" }}</p>
                    <UBadge :color="saleTypeColor" variant="subtle">{{ saleTypeLabel }}</UBadge>
                  </div>
                  <div class="mt-1 flex min-w-0 items-center gap-1">
                    <p class="min-w-0 break-all text-sm text-muted">{{ payment.paymentNo || "-" }}</p>
                    <UButton
                      v-if="payment.paymentNo"
                      :icon="copiedPaymentNo ? 'i-lucide-check' : 'i-lucide-copy'"
                      size="xs"
                      :color="copiedPaymentNo ? 'success' : 'neutral'"
                      variant="ghost"
                      @click="() => copyPaymentNo()"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-5 space-y-5">
              <section>
                <p class="text-sm font-medium text-highlighted">ข้อมูลลูกค้า</p>
                <div class="mt-3 grid gap-x-6 gap-y-2 text-sm lg:grid-cols-2 lg:[&>*:nth-child(odd)]:pr-4 lg:[&>*:nth-child(even)]:border-l lg:[&>*:nth-child(even)]:border-dashed lg:[&>*:nth-child(even)]:border-default lg:[&>*:nth-child(even)]:pl-4">
                  <div v-for="row in customerInfoRows" :key="row.label" class="flex min-w-0 items-start justify-between gap-3">
                    <span class="shrink-0 text-muted">{{ row.label }}</span>
                    <span class="min-w-0 max-w-[62%] wrap-break-word text-right text-highlighted" :class="row.valueClass">{{ row.value }}</span>
                  </div>
                </div>
              </section>

              <div class="border-t border-default" />

              <section>
                <div class="flex items-start justify-between gap-3">
                  <p class="text-sm font-medium text-highlighted">{{ purchaseSectionTitle }}</p>
                  <UBadge :color="payment.packageSale ? packageSaleStatusMap[payment.packageSale.status].color : serviceOrderStatusMap[payment.serviceOrder!.status].color" variant="subtle" size="sm">
                    {{ payment.packageSale ? packageSaleStatusMap[payment.packageSale.status].label : serviceOrderStatusMap[payment.serviceOrder!.status].label }}
                  </UBadge>
                </div>
                <div class="mt-3 grid gap-x-6 gap-y-2 text-sm lg:grid-cols-2 lg:[&>*:nth-child(odd)]:pr-4 lg:[&>*:nth-child(even)]:border-l lg:[&>*:nth-child(even)]:border-dashed lg:[&>*:nth-child(even)]:border-default lg:[&>*:nth-child(even)]:pl-4">
                  <div v-for="row in purchaseInfoRows" :key="row.label" class="flex min-w-0 items-start justify-between gap-3">
                    <span class="shrink-0 text-muted">{{ row.label }}</span>
                    <NuxtLink
                      v-if="row.href"
                      :to="row.href"
                      class="flex min-w-0 max-w-[62%] items-center justify-end gap-1 wrap-break-word text-right text-primary hover:underline"
                      :class="row.valueClass"
                    >
                      <span class="min-w-0 break-all">{{ row.value }}</span>
                      <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0" />
                    </NuxtLink>
                    <span v-else class="min-w-0 max-w-[62%] wrap-break-word text-right text-highlighted" :class="row.valueClass">{{ row.value }}</span>
                  </div>
                </div>
              </section>

              <template v-if="payment.memberEntitlement">
                <div class="border-t border-default" />
                <section>
                  <div class="flex items-start justify-between gap-3">
                    <p class="text-sm font-medium text-highlighted">สิทธิ์สมาชิก</p>
                    <UBadge :color="entitlementStatusMap[payment.memberEntitlement.status].color" variant="subtle" size="sm">{{ entitlementStatusMap[payment.memberEntitlement.status].label }}</UBadge>
                  </div>
                  <div class="mt-3 grid gap-x-6 gap-y-2 text-sm lg:grid-cols-2 lg:[&>*:nth-child(odd)]:pr-4 lg:[&>*:nth-child(even)]:border-l lg:[&>*:nth-child(even)]:border-dashed lg:[&>*:nth-child(even)]:border-default lg:[&>*:nth-child(even)]:pl-4">
                    <div v-for="row in entitlementRows" :key="row.label" class="flex min-w-0 items-start justify-between gap-3">
                      <span class="shrink-0 text-muted">{{ row.label }}</span>
                      <span class="min-w-0 max-w-[62%] wrap-break-word text-right text-highlighted" :class="row.valueClass">{{ row.value }}</span>
                    </div>
                  </div>
                </section>
              </template>
            </div>
          </UCard>

          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-0' }">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <p class="text-base font-semibold text-highlighted">{{ itemSectionTitle }} <span class="text-sm text-muted ml-2">{{ itemSectionDescription }}</span></p>
              </div>
            </div>
            <div v-if="detailItems.length" class="space-y-3 p-4 md:hidden">
              <div
                v-for="item in detailItems"
                :key="item.id"
                class="rounded-xl border border-default bg-default p-3"
              >
                <div class="flex min-w-0 gap-3">
                  <div v-if="!isPackagePayment" class="shrink-0">
                    <div class="flex max-w-18 flex-wrap gap-1">
                      <button
                        v-for="photo in item.photos"
                        :key="photo.id"
                        type="button"
                        class="relative size-14 overflow-hidden rounded-lg border border-default bg-muted/30"
                        @click="openItemImagePreview(photo.secureUrl || photo.url, item.title)"
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
                        v-if="!item.photos?.length"
                        class="flex size-14 items-center justify-center rounded-lg border border-dashed border-default text-xs text-muted"
                      >-</div>
                    </div>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <p class="min-w-0 wrap-break-word font-medium text-highlighted">{{ item.title }}</p>
                      <UBadge v-if="item.badgeLabel" :color="item.badgeColor || 'neutral'" variant="subtle" size="xs">{{ item.badgeLabel }}</UBadge>
                    </div>
                    <p v-if="item.metaLabel" class="wrap-break-word text-xs text-muted">{{ item.metaLabel }}</p>
                    <p v-if="item.notes" class="mt-1 wrap-break-word text-xs text-muted whitespace-pre-line">{{ item.notes }}</p>
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-3 gap-2 border-t border-default pt-3 text-xs">
                  <div>
                    <p class="text-muted">ราคา/หน่วย</p>
                    <p class="mt-1 wrap-break-word font-medium text-highlighted">{{ item.unitPriceLabel || "-" }}</p>
                  </div>
                  <div>
                    <p class="text-muted">จำนวน</p>
                    <p class="mt-1 wrap-break-word font-medium text-highlighted">{{ item.quantityLabel }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-muted">รวม</p>
                    <p class="mt-1 wrap-break-word font-semibold text-highlighted">{{ item.totalLabel }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="detailItems.length" class="hidden overflow-x-auto md:block">
              <table class="w-full min-w-160 text-sm">
                <thead class="bg-elevated/40 text-xs text-muted">
                  <tr>
                    <th v-if="!isPackagePayment" class="w-20 px-5 py-2 text-left font-medium">รูป</th>
                    <th class="px-5 py-2 text-left font-medium">รายการ</th>
                    <th class="w-28 px-5 py-2 text-right font-medium">ราคา/หน่วย</th>
                    <th class="w-24 px-5 py-2 text-right font-medium">จำนวน</th>
                    <th class="w-28 px-5 py-2 text-right font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-for="item in detailItems" :key="item.id" class="align-top">
                    <td v-if="!isPackagePayment" class="px-5 py-3">
                      <div class="flex flex-wrap gap-1">
                        <button
                          v-for="photo in item.photos"
                          :key="photo.id"
                          type="button"
                          class="relative size-14 overflow-hidden rounded-lg border border-default bg-muted/30"
                          @click="openItemImagePreview(photo.secureUrl || photo.url, item.title)"
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
                          v-if="!item.photos?.length"
                          class="flex size-14 items-center justify-center rounded-lg border border-dashed border-default text-xs text-muted"
                        >-</div>
                      </div>
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="wrap-break-word font-medium text-highlighted">{{ item.title }}</p>
                        <UBadge v-if="item.badgeLabel" :color="item.badgeColor || 'neutral'" variant="subtle" size="xs">{{ item.badgeLabel }}</UBadge>
                      </div>
                      <p v-if="item.metaLabel" class="wrap-break-word text-xs text-muted">{{ item.metaLabel }}</p>
                      <p v-if="item.notes" class="mt-1 wrap-break-word text-xs text-muted whitespace-pre-line">{{ item.notes }}</p>
                    </td>
                    <td class="px-5 py-3 text-right text-muted">{{ item.unitPriceLabel || "-" }}</td>
                    <td class="px-5 py-3 text-right text-muted">{{ item.quantityLabel }}</td>
                    <td class="px-5 py-3 text-right font-semibold text-highlighted">{{ item.totalLabel }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="px-5 py-10 text-center text-sm text-muted">ไม่พบรายการในบิลนี้</div>
          </UCard>
        </div>

        <div class="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-base font-semibold text-highlighted">{{ totalsSectionTitle }}</p>
                <p class="text-sm text-muted">สรุปยอดของรายการนี้</p>
              </div>
              <UBadge :color="saleTypeColor" variant="subtle">{{ saleTypeLabel }}</UBadge>
            </div>
            <div class="mt-5 space-y-2 text-sm">
              <div v-for="row in totalRows" :key="row.label" class="flex min-w-0 items-start justify-between gap-3" :class="row.dividerBefore ? 'border-t border-dashed border-default pt-3 mt-3' : ''">
                <span class="shrink-0 text-muted">{{ row.label }}</span>
                <span class="min-w-0 max-w-[52%] wrap-break-word text-right" :class="row.valueClass || 'text-highlighted'">{{ row.value }}</span>
              </div>
            </div>
          </UCard>

          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-base font-semibold text-highlighted">การชำระเงิน</p>
                <p class="text-sm text-muted">{{ paymentManagerDescription }}</p>
              </div>
            </div>

            <div class="mt-5 space-y-2 text-sm">
              <div v-for="row in paymentInfoRows" :key="row.label" class="flex min-w-0 items-start justify-between gap-3">
                <span class="shrink-0 text-muted">{{ row.label }}</span>
                <span class="min-w-0 max-w-[58%] wrap-break-word text-right text-highlighted" :class="row.valueClass">{{ row.value }}</span>
              </div>
            </div>

            <div class="mt-5 space-y-4 border-t border-default pt-5">
              <UFormField label="หมายเหตุ">
                <UTextarea v-model="paymentForm.note" :disabled="isSavingPayment" :rows="4" placeholder="เพิ่มหมายเหตุเกี่ยวกับการชำระเงิน" class="w-full" />
              </UFormField>

              <UIPhotoUpload
                label="หลักฐานการชำระเงิน"
                :description="slipDescription"
                :photos="slipPhotos"
                :max="1"
                :disabled="isSavingPayment"
                confirm-remove
                @update:photos="onSlipPhotosUpdate"
              />

              <div class="rounded-xl border border-default p-4 text-sm">
                <div class="flex items-start justify-between gap-3">
                  <span class="text-muted">อัปเดตล่าสุด</span>
                  <span>{{ formatDateTime(payment.updatedAt) }}</span>
                </div>
              </div>

              <UButton block label="บันทึก" icon="i-lucide-check" color="primary" :loading="isSavingPayment" :disabled="isSavingPayment || isUploadingSlip" @click="handleSaveButtonClick" />
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UIImagePreviewModal
    v-model:open="previewOpen"
    :title="previewTitle"
    :image-url="previewUrl"
    image-alt="รูปหลักฐาน"
  />

  <ConfirmPaymentModal
    v-if="payment && canConfirmPayment"
    v-model:open="confirmModalOpen"
    :payment-id="payment.id"
    :amount="Number(payment.amount ?? 0)"
    @confirmed="onPaymentConfirmed"
  />

  <EditPaymentStateModal
    v-if="payment && isAdmin"
    v-model:open="editStateModalOpen"
    :payment-id="payment.id"
    :payment-no="payment.paymentNo"
    :amount="Number(payment.amount ?? 0)"
    :status="payment.status"
    :method="payment.method"
    @updated="onPaymentStateUpdated"
  />
</template>
