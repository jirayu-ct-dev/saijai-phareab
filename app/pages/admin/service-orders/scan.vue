<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";
import type { PaymentSlipImage } from "~~/app/composables/useAdminPayments";
import type { CreateAdminServiceOrderBody } from "~~/app/composables/useAdminServiceOrders";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

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
  addonEntitlements: Array<{
    id: string;
    status: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
    product: { id: string; name: string; packageType: string; credits: number | null };
  }>;
  addonUsages: Array<{
    entitlementId: string;
    productId: string;
    productName: string;
    credits: number;
    appliedAt: string;
  }>;
  image: { id: string; secureUrl: string | null; url: string | null } | null;
  deliveryImage: { id: string; secureUrl: string | null; url: string | null } | null;
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

interface BarcodeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
declare var BarcodeDetector: { new(options?: { formats: string[] }): BarcodeDetector };

const notify = useNotify();
const route = useRoute();
const { uploadSlip } = useAdminPayments();
const { serviceOrders, uploadOrderImage } = useAdminServiceOrders();

const lookupOptions = computed(() =>
  (serviceOrders.value ?? []).map((so) => ({
    label: so.orderNo || so.id,
    value: so.orderNo || so.id,
    customerName: so.customer.name || so.customer.email,
    statusLabel: orderStatusLabels[so.status],
  })),
);

const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;
const quickStatusOptions: Array<{ label: string; value: ServiceOrderStatus; icon: string; color: BadgeColor }> = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED", icon: "i-lucide-inbox", color: "info" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING", icon: "i-lucide-washing-machine", color: "primary" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING", icon: "i-lucide-truck", color: "warning" },
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
  note: "",
});
const uploadedSlip = ref<PaymentSlipImage | null>(null);
const slipFile = ref<File | null>(null);
const isDeliveryConfirmOpen = ref(false);
const deliveryImageFile = ref<File | null>(null);
const uploadedDeliveryImage = ref<{ id: string; secureUrl: string | null; url: string | null } | null>(null);
const isApplyingCompletion = ref(false);

const previewOpen = ref(false);
const previewUrl = ref("");
const previewTitle = ref("ดูรูป");
const openImagePreview = (url: string | null | undefined, title = "ดูรูป") => {
  if (!url) return;
  previewUrl.value = url;
  previewTitle.value = title;
  previewOpen.value = true;
};

type AddonPickerEntry = {
  entitlementId: string;
  productName: string;
  creditRemaining: number;
  selected: boolean;
  credits: number;
};
const addonPickerEntries = ref<AddonPickerEntry[]>([]);

const totalQuantity = computed(() => (order.value?.items ?? []).reduce((sum, item) => sum + item.quantity, 0));
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

const patchStatus = async (
  status: ServiceOrderStatus,
  deliveryImageId?: string | null,
  addonUsages?: Array<{ entitlementId: string; credits: number }>,
) => {
  if (!order.value) return false;
  try {
    const body: {
      status: ServiceOrderStatus;
      deliveryImageId?: string | null;
      addonUsages?: Array<{ entitlementId: string; credits: number }>;
    } = { status };
    if (deliveryImageId !== undefined) body.deliveryImageId = deliveryImageId;
    if (addonUsages && addonUsages.length) body.addonUsages = addonUsages;
    const result = await $fetch<{ id: string; orderNo: string | null; status: ServiceOrderStatus; updatedAt: string }>(
      `/api/admin/service-orders/${order.value.id}/status`,
      { method: "PATCH", body },
    );
    order.value = { ...order.value, status: result.status, updatedAt: result.updatedAt };
    syncEditForm(order.value);
    notify.updated(`สถานะงานเป็น ${orderStatusLabels[result.status]}`);

    if (isAutoReset.value) {
      clearResult();
      lookupQuery.value = "";
    }
    return true;
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "data" in error
      ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || "ไม่สามารถอัปเดตสถานะได้")
      : "ไม่สามารถอัปเดตสถานะได้";
    notify.error(message);
    return false;
  }
};

const applyStatus = async (status: ServiceOrderStatus) => {
  if (!order.value || order.value.status === status) return;

  if (status === "COMPLETED") {
    deliveryImageFile.value = null;
    uploadedDeliveryImage.value = null;
    addonPickerEntries.value = (order.value.addonEntitlements ?? [])
      .filter((e) => (e.creditRemaining ?? 0) > 0)
      .map((e) => ({
        entitlementId: e.id,
        productName: e.product.name,
        creditRemaining: e.creditRemaining ?? 0,
        selected: false,
        credits: 1,
      }));
    isDeliveryConfirmOpen.value = true;
    return;
  }

  isApplyingStatus.value = status;
  await patchStatus(status);
  isApplyingStatus.value = null;
};

const confirmDeliveryComplete = async () => {
  if (!order.value) return;

  const addonUsages: Array<{ entitlementId: string; credits: number }> = [];
  for (const entry of addonPickerEntries.value) {
    if (!entry.selected) continue;
    const credits = Math.max(0, Math.floor(entry.credits || 0));
    if (credits <= 0) {
      notify.validationError(`กรุณากรอกจำนวนเครดิตของ "${entry.productName}"`);
      return;
    }
    if (credits > entry.creditRemaining) {
      notify.validationError(`"${entry.productName}" คงเหลือ ${entry.creditRemaining} เครดิตเท่านั้น`);
      return;
    }
    addonUsages.push({ entitlementId: entry.entitlementId, credits });
  }

  isApplyingCompletion.value = true;
  let deliveryImageId: string | null = null;
  if (deliveryImageFile.value) {
    const uploaded = await uploadOrderImage(deliveryImageFile.value);
    if (!uploaded) {
      isApplyingCompletion.value = false;
      return;
    }
    uploadedDeliveryImage.value = uploaded;
    deliveryImageId = uploaded.id;
  }
  isApplyingStatus.value = "COMPLETED";
  const ok = await patchStatus("COMPLETED", deliveryImageId, addonUsages);
  isApplyingStatus.value = null;
  isApplyingCompletion.value = false;
  if (ok) {
    isDeliveryConfirmOpen.value = false;
    deliveryImageFile.value = null;
    uploadedDeliveryImage.value = null;
    addonPickerEntries.value = [];
  }
};

const handleRemoveDeliveryImage = () => {
  deliveryImageFile.value = null;
  uploadedDeliveryImage.value = null;
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

const slipPhotos = computed<import("~~/app/components/UI/PhotoUpload.vue").Photo[]>(() => {
  if (slipFile.value) return [{ key: "slip", file: slipFile.value, url: null }];
  const url = uploadedSlip.value?.secureUrl ?? uploadedSlip.value?.url ?? null;
  return url ? [{ key: "slip", file: null, url }] : [];
});

const onSlipPhotosUpdate = (photos: import("~~/app/components/UI/PhotoUpload.vue").Photo[]) => {
  const photo = photos[0] ?? null;
  slipFile.value = photo?.file ?? null;
  if (!photo) uploadedSlip.value = null;
};

const deliveryPhotos = computed<import("~~/app/components/UI/PhotoUpload.vue").Photo[]>(() => {
  if (deliveryImageFile.value) return [{ key: "delivery", file: deliveryImageFile.value, url: null }];
  const url = uploadedDeliveryImage.value?.secureUrl ?? uploadedDeliveryImage.value?.url ?? null;
  return url ? [{ key: "delivery", file: null, url }] : [];
});

const onDeliveryPhotosUpdate = (photos: import("~~/app/components/UI/PhotoUpload.vue").Photo[]) => {
  const photo = photos[0] ?? null;
  deliveryImageFile.value = photo?.file ?? null;
  if (!photo) uploadedDeliveryImage.value = null;
};

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

  const aggregatedItems = new Map<
    string,
    {
      storefrontPriceId: string;
      quantity: number;
      notes: string | null;
      imageId: string | null;
      photos: Array<{ imageId: string; isDamaged: boolean; sortOrder: number }>;
    }
  >();
  for (const item of order.value.items) {
    const existing = aggregatedItems.get(item.storefrontPriceId);
    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.imageId && item.image?.id) existing.imageId = item.image.id;
      if (!existing.notes && item.notes) existing.notes = item.notes;
      for (const photo of item.photos) {
        if (!existing.photos.some((p) => p.imageId === photo.imageId)) {
          existing.photos.push({
            imageId: photo.imageId,
            isDamaged: photo.isDamaged,
            sortOrder: photo.sortOrder,
          });
        }
      }
    } else {
      aggregatedItems.set(item.storefrontPriceId, {
        storefrontPriceId: item.storefrontPriceId,
        quantity: item.quantity,
        notes: item.notes,
        imageId: item.image?.id ?? null,
        photos: item.photos.map((photo) => ({
          imageId: photo.imageId,
          isDamaged: photo.isDamaged,
          sortOrder: photo.sortOrder,
        })),
      });
    }
  }

  return {
    customerId: order.value.isWalkIn ? null : order.value.customer.id,
    isWalkIn: order.value.isWalkIn,
    walkInName: order.value.isWalkIn ? order.value.walkInName : null,
    walkInPhone: order.value.isWalkIn ? order.value.walkInPhone : null,
    memberEntitlementId: order.value.memberEntitlement?.id ?? null,
    orderImageId: order.value.image?.id ?? null,
    deliveryImageId: order.value.deliveryImage?.id ?? null,
    items: Array.from(aggregatedItems.values()),
    missingHangerCount: order.value.hangerCharge?.count ?? 0,
    dueAt: dueAtValue.value ? new Date(dueAtValue.value).toISOString() : null,
    discountAmount: order.value.discountAmount,
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

const goBack = () => void navigateTo("/admin/service-orders");
const openDetail = () => void (order.value && navigateTo(`/admin/service-orders/${order.value.id}`));
const openReceipt = () => void (order.value && navigateTo(`/admin/service-orders/${order.value.id}/intake`));

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

// Camera scan
const isCameraOpen = ref(false);
const isCameraStarting = ref(false);
const cameraError = ref("");
const isBarcodeDetectorSupported = ref(false);
const cameraVideoEl = useTemplateRef<HTMLVideoElement>("cameraVideo");

let cameraStream: MediaStream | null = null;
let cameraDetector: InstanceType<typeof BarcodeDetector> | null = null;
let cameraFrameHandle: number | null = null;

const stopCameraScan = () => {
  if (cameraFrameHandle !== null) {
    cancelAnimationFrame(cameraFrameHandle);
    cameraFrameHandle = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
};

const closeCameraScan = () => {
  stopCameraScan();
  isCameraOpen.value = false;
  cameraError.value = "";
};

const handleScannedValue = (value: string) => {
  closeCameraScan();
  lookupQuery.value = value;
  void lookupOrder(value);
};

const scanFrame = () => {
  const video = cameraVideoEl.value;
  if (!video || !cameraDetector || video.readyState < 2) {
    cameraFrameHandle = requestAnimationFrame(scanFrame);
    return;
  }
  cameraDetector.detect(video).then((barcodes) => {
    const barcode = barcodes[0];
    if (barcode?.rawValue) {
      handleScannedValue(barcode.rawValue);
    } else {
      cameraFrameHandle = requestAnimationFrame(scanFrame);
    }
  }).catch(() => {
    cameraFrameHandle = requestAnimationFrame(scanFrame);
  });
};

const openCameraScan = async () => {
  cameraError.value = "";
  isCameraOpen.value = true;
  isCameraStarting.value = true;
  try {
    cameraDetector = new BarcodeDetector({ formats: ["qr_code"] });
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    await nextTick();
    if (cameraVideoEl.value) {
      cameraVideoEl.value.srcObject = cameraStream;
      await cameraVideoEl.value.play();
    }
    cameraFrameHandle = requestAnimationFrame(scanFrame);
  } catch (err: unknown) {
    cameraError.value = err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องได้";
    stopCameraScan();
  } finally {
    isCameraStarting.value = false;
  }
};

onMounted(() => {
  isBarcodeDetectorSupported.value = typeof BarcodeDetector !== "undefined";
  if (isBarcodeDetectorSupported.value && !route.query.q && window.matchMedia("(max-width: 768px)").matches) {
    void openCameraScan();
  }
});

onBeforeUnmount(() => {
  stopCameraScan();
});
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
            <UButton 
              label="กลับหน้ารายการ" 
              color="neutral" 
              variant="outline" 
              icon="i-lucide-arrow-left" 
              class="shrink-0"
              aria-label="กลับหน้ารายการ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="goBack" 
            />
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
                <UInputMenu
                  v-model="lookupQuery"
                  :items="lookupOptions"
                  label-key="label"
                  value-key="value"
                  create-item
                  autofocus
                  icon="i-lucide-scan-search"
                  class="flex-1"
                  size="xl"
                  placeholder="สแกน QR / เลือก / พิมพ์เลขรับผ้า"
                  @create="lookupQuery = $event"
                >
                  <template #item="{ item }">
                    <div class="flex w-full items-center justify-between gap-3">
                      <span class="font-mono text-xs">{{ item.label }}</span>
                      <span class="truncate text-xs text-muted">{{ item.customerName }} | {{ item.statusLabel }}</span>
                    </div>
                  </template>
                  <template #empty>
                    <div class="px-3 py-2 text-sm text-muted">ไม่พบในรายการ กด Enter เพื่อค้นหา</div>
                  </template>
                </UInputMenu>
                <UButton type="submit" label="ค้นหา" icon="i-lucide-search" color="primary" :loading="isLookingUp" />
                <UButton label="ล้าง" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="clearResult(); lookupQuery = ''" />
                <UButton v-if="isBarcodeDetectorSupported" label="เปิดกล้องสแกน" icon="i-lucide-camera" color="neutral" variant="outline" @click="openCameraScan" />
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
                  <UButton label="ใบเสร็จ" color="neutral" variant="outline" icon="i-lucide-receipt" @click="openReceipt" />
                  <UButton label="แก้ไขเพิ่มเติม" color="primary" variant="outline" icon="i-lucide-square-pen" @click="openEditDrawer" />
                </div>
              </div>
            </template>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <div v-if="hasMemberEntitlement" class="rounded-xl border border-default/35 bg-elevated/70 p-4 dark:border-default/25 dark:bg-elevated/45">
                <p class="text-xs text-muted">เครดิตที่ใช้</p>
                <p class="mt-1 font-semibold text-success">{{ usedCreditLabel }}</p>
                <p class="text-xs text-muted">คงเหลือ {{ remainingCreditLabel }} | {{ memberPackageName }}</p>
              </div>
              <div v-else class="rounded-xl border border-default bg-elevated/30 p-4">
                <p class="text-xs text-muted">ตะกร้า / QR</p>
                <p class="mt-1 font-medium text-highlighted">{{ order.basket?.label || order.basket?.qrCode || "-" }}</p>
              </div>
            </div>

            <div class="mt-4 space-y-2">
              <p class="text-sm font-medium text-highlighted">รายการบริการ</p>
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

            </div>

            <UIPhotoUpload
              label="หลักฐานการชำระเงิน"
              :photos="slipPhotos"
              :max="1"
              confirm-remove
              @update:photos="onSlipPhotosUpdate"
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

      <UModal
        v-model:open="isDeliveryConfirmOpen"
        title="ยืนยันการส่งผ้าเสร็จสิ้น"
        description="แนบรูปหลักฐานการส่งผ้า (ไม่บังคับ) แล้วยืนยันเพื่อปิดงาน"
      >
        <template #body>
          <div class="space-y-4">
            <UIPhotoUpload
              label="รูปหลักฐานการส่งผ้า"
              description="ถ่ายรูปตอนส่งคืนผ้าให้ลูกค้า (ไม่บังคับ)"
              :photos="deliveryPhotos"
              :max="1"
              @update:photos="onDeliveryPhotosUpdate"
            />

            <div v-if="addonPickerEntries.length" class="space-y-2">
              <div>
                <p class="text-sm font-medium text-highlighted">ใช้สิทธิ์แพ็กเกจรอง</p>
                <p class="text-xs text-muted">เลือกแพ็กเกจและจำนวนเครดิตที่จะหักเมื่อปิดงาน (ค่าเริ่มต้น 1)</p>
              </div>
              <div class="space-y-2">
                <div
                  v-for="entry in addonPickerEntries"
                  :key="entry.entitlementId"
                  class="flex flex-wrap items-center gap-3 rounded-xl border border-default p-3"
                >
                  <UCheckbox v-model="entry.selected" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium text-highlighted">{{ entry.productName }}</p>
                    <p class="text-xs text-muted">คงเหลือ {{ entry.creditRemaining }} เครดิต</p>
                  </div>
                  <UInputNumber
                    v-model="entry.credits"
                    :min="1"
                    :max="entry.creditRemaining"
                    :disabled="!entry.selected"
                    class="w-28"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isDeliveryConfirmOpen = false" />
            <UButton
              label="ยืนยันเสร็จสิ้น"
              icon="i-lucide-badge-check"
              color="success"
              :loading="isApplyingCompletion"
              @click="confirmDeliveryComplete"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>

  <ImagePreviewModal
    v-model:open="previewOpen"
    :title="previewTitle"
    :image-url="previewUrl"
    image-alt="รูปหลักฐาน"
  />

  <UModal v-model:open="isCameraOpen" title="สแกน QR ด้วยกล้อง" @update:open="(v) => !v && closeCameraScan()">
    <template #body>
      <div class="space-y-3">
        <div v-if="cameraError" class="text-sm text-error">{{ cameraError }}</div>
        <div v-else class="relative overflow-hidden rounded-lg bg-black aspect-video flex items-center justify-center">
          <video ref="cameraVideo" class="w-full h-full object-cover" autoplay muted playsinline />
          <div class="absolute inset-0 border-4 border-white/30 rounded-lg pointer-events-none" />
          <div v-if="isCameraStarting" class="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">กำลังเปิดกล้อง...</div>
        </div>
        <UButton label="ปิดกล้อง" icon="i-lucide-x" color="neutral" variant="outline" block @click="closeCameraScan" />
      </div>
    </template>
  </UModal>
</template>
