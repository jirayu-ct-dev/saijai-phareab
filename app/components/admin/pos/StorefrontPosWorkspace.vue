<script setup lang="ts">
import { parseDate, type CalendarDate } from "@internationalized/date";
import { useMediaQuery } from "@vueuse/core";
import PosCatalogCard from "~~/app/components/admin/pos/PosCatalogCard.vue";
import PosCheckoutPanel from "~~/app/components/admin/pos/PosCheckoutPanel.vue";
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";
import type { AdminSaleSlipImage } from "~~/app/composables/useAdminSales";
import type { AdminServiceOrderImage } from "~~/app/composables/useAdminServiceOrders";
import type { PosStorefrontCatalogItem } from "~~/app/composables/useStorefrontCatalog";
import { useBusinessSetting } from "~~/app/composables/useBusinessSetting";
import * as adminUi from "~~/shared/config/adminUi";
import { formatCurrency } from "~~/shared/utils/format";

const dashboardCardClass =
  adminUi.adminDashboardCardClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55 dark:shadow-[0_1px_2px_rgb(0_0_0/0.16),0_8px_22px_-12px_rgb(0_0_0/0.26)]";
const filterBarClass =
  adminUi.adminFilterBarClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55";
const mobileListCardClass = adminUi.adminMobileListCardClass;
const emptyStateClass = adminUi.adminEmptyStateClass;
const checkoutSectionClass = dashboardCardClass;

type FormItemState = {
  key: string;
  storefrontPriceId: string;
  unitPrice?: number;
  quantity: number;
  notes: string;
  photos: Photo[];
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const emit = defineEmits<{
  completed: [payload: { paymentId: string; serviceOrderId: string; orderNo: string | null; saleType: "STOREFRONT"; title: string }];
}>();

const notify = useNotify();
const { customers, isLoading: isCustomersLoading } = useAdminCustomerOptions();
const { hangerPricePerUnit, washFoldPricePerKg, washFoldMinKg, vatRate, vatIncluded, computeVatPreview } = useBusinessSetting();
const { items, isLoading: isCatalogLoading, refresh } = useStorefrontCatalog();
const { createServiceOrder, uploadOrderImage } = useAdminServiceOrders({
  fetchList: false,
  refreshAfterMutation: false,
});
const { uploadSlip } = useAdminPayments();

const searchQuery = ref("");
const categoryFilter = ref<"all" | string>("all");
const serviceFilter = ref<"all" | string>("all");

const catalogMap = computed(() => new Map((items.value ?? []).map((item) => [item.id, item])));

const categoryOptions = computed(() => {
  const map = new Map<string, string>();
  for (const item of items.value ?? []) {
    if (item.categoryId && item.categoryName) map.set(item.categoryId, item.categoryName);
  }
  return [{ label: "ทุกหมวดหมู่", value: "all" }, ...Array.from(map.entries()).map(([value, label]) => ({ label, value }))];
});

const serviceOptions = computed(() => {
  const map = new Map<string, string>();
  for (const item of items.value ?? []) {
    map.set(item.serviceId, item.serviceName);
  }
  return [{ label: "ทุกบริการ", value: "all" }, ...Array.from(map.entries()).map(([value, label]) => ({ label, value }))];
});

// New catalog item modal
type PricingRef = {
  services?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
};
const { data: pricingData, refresh: refreshPricing } = useFetch<PricingRef>("/api/admin/pricing", {
  key: "admin-pricing-for-pos",
  default: () => ({ services: [], categories: [] }),
});
const newItemModalOpen = ref(false);
const isSavingNewItem = ref(false);
const newItemData = ref({ name: "", categoryId: undefined as string | undefined, description: "" });
const newItemPrices = ref<Record<string, number | string | undefined>>({});

const openNewItemModal = () => {
  newItemData.value = {
    name: "",
    categoryId: pricingData.value?.categories?.[0]?.id ?? undefined,
    description: "",
  };
  newItemPrices.value = {};
  newItemModalOpen.value = true;
};

const saveNewItem = async () => {
  const name = newItemData.value.name.trim();
  if (!name) return notify.validationError("กรุณากรอกชื่อรายการ");
  isSavingNewItem.value = true;
  try {
    const created = await $fetch<{ id: string }>("/api/admin/pricing/item", {
      method: "POST",
      body: {
        name,
        categoryId: newItemData.value.categoryId || undefined,
        description: newItemData.value.description.trim() || undefined,
      },
    });
    const services = pricingData.value?.services ?? [];
    for (const service of services) {
      const price = newItemPrices.value[service.id];
      if (price === null || price === undefined || price === "") continue;
      await $fetch("/api/admin/pricing/price", {
        method: "PUT",
        body: {
          storefrontItemId: created.id,
          storefrontServiceId: service.id,
          price: Number(price),
        },
      });
    }
    notify.created("รายการซัก");
    newItemModalOpen.value = false;
    await Promise.all([refresh(), refreshPricing()]);
  } catch (error: unknown) {
    const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage;
    notify.error(message || "ไม่สามารถเพิ่มรายการได้");
  } finally {
    isSavingNewItem.value = false;
  }
};

const customerOptions = computed(() =>
  (customers.value ?? []).map((customer) => ({
    label: customer.label,
    value: customer.id,
    image: customer.image,
    name: customer.name,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
    activeMemberEntitlement: customer.activeMemberEntitlement ?? null,
  })),
);
const selectedCustomer = computed(() => customerOptions.value.find((customer) => customer.value === form.customerId) ?? null);
const activeMemberEntitlement = computed(() => selectedCustomer.value?.activeMemberEntitlement ?? null);
const canUseMemberPackage = computed(() => !form.isWalkIn && Boolean(activeMemberEntitlement.value));

const filteredCatalog = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return (items.value ?? []).filter((item) => {
    if (categoryFilter.value !== "all" && item.categoryId !== categoryFilter.value) return false;
    if (serviceFilter.value !== "all" && item.serviceId !== serviceFilter.value) return false;
    if (!keyword) return true;
    return [item.label, item.categoryName ?? "", item.serviceName, item.itemName].join(" ").toLowerCase().includes(keyword);
  });
});

let itemKeySeed = 0;
const createItemKey = () => `service-pos-item-${++itemKeySeed}`;

const createEmptyForm = () => ({
  customerId: "",
  isWalkIn: false,
  walkInName: "",
  walkInPhone: "",
  memberEntitlementId: null as string | null,
  items: [] as FormItemState[],
  washFoldMode: false,
  washFoldWeightKg: 0,
  washFoldNotes: "",
  hangerCount: 0,
  missingHangerCount: 0,
  discountAmount: 0,
  note: "",
  slipImageId: null as string | null,
  orderImageId: null as string | null,
});

const form = reactive(createEmptyForm());
const dueDate = shallowRef<CalendarDate | null>(null);
const dueTime = ref("00:00");
const isSubmitting = ref(false);
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<AdminSaleSlipImage | null>(null);
const orderImageFile = ref<File | null>(null);
const uploadedOrderImage = ref<AdminServiceOrderImage | null>(null);
const uploadedPhotoIds = ref(new Map<string, string>()); // photoKey → imageId


const selectedItemMap = computed(() => new Map(form.items.map((item) => [item.storefrontPriceId, item])));

const cartItems = computed(() =>
  form.items
    .map((item) => {
      const catalog = catalogMap.value.get(item.storefrontPriceId);
      if (!catalog) return null;
      const unitPrice = item.unitPrice ?? catalog.price;
      return {
        key: item.key,
        storefrontPriceId: item.storefrontPriceId,
        label: catalog.label,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        notes: item.notes,
        photos: item.photos,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

const washFoldSubtotal = computed(() =>
  form.washFoldMode ? Math.round(Number(form.washFoldWeightKg || 0) * washFoldPricePerKg.value * 100) / 100 : 0,
);

const subtotalAmount = computed(() =>
  form.washFoldMode ? washFoldSubtotal.value : cartItems.value.reduce((sum, item) => sum + item.totalPrice, 0),
);
const totalQuantity = computed(() => cartItems.value.reduce((sum, item) => sum + item.quantity, 0));

const hangerCharge = computed(() =>
  form.washFoldMode
    ? { count: 0, total: 0 }
    : {
        count: form.missingHangerCount,
        total: form.missingHangerCount * hangerPricePerUnit.value,
      },
);

watch(() => form.washFoldMode, (enabled) => {
  if (enabled) {
    form.memberEntitlementId = null;
    form.missingHangerCount = 0;
    form.hangerCount = 0;
  } else {
    form.washFoldWeightKg = 0;
    form.washFoldNotes = "";
  }
});

const sanitizedDiscountAmount = computed(() => {
  const raw = Number(form.discountAmount || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, subtotalAmount.value);
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

const dueTimeLabel = computed(() => dueTime.value || "00:00");
const dueAtValue = computed(() => {
  if (!dueDate.value) return null;
  return `${dueDate.value.toString()}T${dueTimeLabel.value}`;
});
const formatDueDateLabel = (value: CalendarDate | null) => {
  if (!value) return "เลือกวันที่";
  const dd = String(value.day).padStart(2, "0");
  const mm = String(value.month).padStart(2, "0");
  return `${dd}/${mm}/${value.year}`;
};
const dueDateLabel = computed(() => formatDueDateLabel(dueDate.value));

const setPickupDow = (targetDow: number) => {
  const now = new Date();
  const bkk = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const currentDow = bkk.getUTCDay();
  let daysUntil = (targetDow - currentDow + 7) % 7;
  const hour = bkk.getUTCHours();
  const minute = bkk.getUTCMinutes();
  if (daysUntil === 0 && (hour > 17 || (hour === 17 && minute > 0))) daysUntil = 7;
  const target = new Date(bkk.getTime() + daysUntil * 86400000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  dueDate.value = parseDate(`${y}-${m}-${d}`);
  dueTime.value = "17:00";
};

const clearDueDate = () => {
  dueDate.value = null;
  dueTime.value = "00:00";
};

const creditAvailable = computed(() => Math.max(0, Number(activeMemberEntitlement.value?.creditRemaining ?? 0)));
const creditUsedPreview = computed(() => {
  if (!form.memberEntitlementId) return 0;
  return Math.min(totalQuantity.value, creditAvailable.value);
});
const cashSubtotal = computed(() => {
  if (!form.memberEntitlementId) return subtotalAmount.value;
  let remaining = creditAvailable.value;
  let total = 0;
  for (const item of cartItems.value) {
    const creditQty = Math.min(item.quantity, remaining);
    remaining -= creditQty;
    total += (item.quantity - creditQty) * item.unitPrice;
  }
  return total;
});
const cashQuantity = computed(() => totalQuantity.value - creditUsedPreview.value);

const sanitizedCashDiscount = computed(() => {
  if (!form.memberEntitlementId) return sanitizedDiscountAmount.value;
  const raw = Number(form.discountAmount || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, cashSubtotal.value);
});

const beforeVatAmount = computed(() => (
  form.memberEntitlementId
    ? cashSubtotal.value - sanitizedCashDiscount.value + hangerCharge.value.total
    : subtotalAmount.value - sanitizedDiscountAmount.value + hangerCharge.value.total
));
const vatPreview = computed(() => computeVatPreview(beforeVatAmount.value));
const totalAmount = computed(() => vatPreview.value.totalAmount);

const isMemberWithZeroTotal = computed(() => Boolean(form.memberEntitlementId) && totalAmount.value === 0);

const normalizedItems = computed(() =>
  cartItems.value.map((item) => {
    const readyPhotos = item.photos.filter((p) => uploadedPhotoIds.value.has(p.key));
    const firstPhoto = readyPhotos[0];
    const formItem = form.items.find((i) => i.key === item.key);
    return {
      storefrontPriceId: item.storefrontPriceId,
      quantity: item.quantity,
      unitPrice: formItem?.unitPrice ?? null,
      imageId: firstPhoto ? (uploadedPhotoIds.value.get(firstPhoto.key) ?? null) : null,
      notes: item.notes.trim() || null,
      photos: readyPhotos.map((photo, index) => ({
        imageId: uploadedPhotoIds.value.get(photo.key) as string,
        isDamaged: true,
        sortOrder: index,
      })),
    };
  }),
);

// Price-input modal for range-price items
const priceInputModal = ref(false);
const priceInputCatalogId = ref("");
const priceInputValue = ref<number | null>(null);
const priceInputMin = ref<number | null>(null);
const priceInputMax = ref<number | null>(null);

const openPriceInput = (storefrontPriceId: string) => {
  const catalog = catalogMap.value.get(storefrontPriceId);
  if (!catalog) return;
  priceInputCatalogId.value = storefrontPriceId;
  priceInputMin.value = catalog.priceMin;
  priceInputMax.value = catalog.priceMax;
  priceInputValue.value = catalog.priceMin ?? catalog.price;
  priceInputModal.value = true;
};

const confirmPriceInput = () => {
  const price = Number(priceInputValue.value);
  if (!Number.isFinite(price) || price < 0) return;
  const storefrontPriceId = priceInputCatalogId.value;
  // Find existing row with same priceId and same unitPrice
  const existingRow = form.items.find(
    (i) => i.storefrontPriceId === storefrontPriceId && (i.unitPrice ?? catalogMap.value.get(storefrontPriceId)?.price) === price
  );
  if (existingRow) {
    existingRow.quantity += 1;
  } else {
    form.items.push({ key: createItemKey(), storefrontPriceId, unitPrice: price, quantity: 1, notes: "", photos: [] });
  }
  priceInputModal.value = false;
};

const isRangeItem = (storefrontPriceId: string) => {
  const c = catalogMap.value.get(storefrontPriceId);
  return c?.priceMin != null && c?.priceMax != null && c.priceMin !== c.priceMax;
};

const incrementCatalogItem = (storefrontPriceId: string) => {
  if (isRangeItem(storefrontPriceId)) { openPriceInput(storefrontPriceId); return; }
  const existing = selectedItemMap.value.get(storefrontPriceId);
  if (existing) { existing.quantity += 1; return; }
  form.items.push({
    key: createItemKey(),
    storefrontPriceId,
    quantity: 1,
    notes: "",
    photos: [],
  });
};

const decrementCatalogItem = (storefrontPriceId: string) => {
  const existing = selectedItemMap.value.get(storefrontPriceId);
  if (!existing) return;
  if (existing.quantity <= 1) {
    form.items = form.items.filter((e) => e.key !== existing.key);
    const next = new Set(expandedItems.value);
    next.delete(existing.key);
    expandedItems.value = next;
    return;
  }
  existing.quantity -= 1;
};

const setCatalogItemQuantity = (storefrontPriceId: string, qty: number) => {
  const value = Math.max(0, Math.floor(qty));
  const existing = selectedItemMap.value.get(storefrontPriceId);
  if (value === 0) {
    if (existing) {
      form.items = form.items.filter((e) => e.key !== existing.key);
      const next = new Set(expandedItems.value);
      next.delete(existing.key);
      expandedItems.value = next;
    }
    return;
  }
  if (existing) {
    existing.quantity = value;
  } else {
    form.items.push({ key: createItemKey(), storefrontPriceId, quantity: value, notes: "", photos: [] });
  }
};

const getCatalogQuantity = (storefrontPriceId: string) =>
  form.items
    .filter((item) => item.storefrontPriceId === storefrontPriceId)
    .reduce((sum, item) => sum + item.quantity, 0);

const getCatalogDescription = (item: { categoryName?: string | null; serviceName: string }) =>
  item.categoryName ? `${item.categoryName} | ${item.serviceName}` : item.serviceName;

// Responsive cart slideover
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
const isXlQuery = useMediaQuery("(min-width: 1280px)");
const isCompact = computed(() => mounted.value && !isXlQuery.value);
const isCartOpen = ref(false);
watch(isCompact, (value) => { if (!value) isCartOpen.value = false; });

// Cart item expand state
const expandedItems = ref<Set<string>>(new Set());
const toggleItemExpand = (key: string) => {
  const next = new Set(expandedItems.value);
  next.has(key) ? next.delete(key) : next.add(key);
  expandedItems.value = next;
};
const decrementItemByKey = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;
  if (item.quantity <= 1) { form.items = form.items.filter((entry) => entry.key !== key); return; }
  item.quantity -= 1;
};
const incrementItemByKey = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (item) item.quantity += 1;
};
const removeItem = (key: string) => {
  const item = form.items.find((e) => e.key === key);
  if (item) item.photos.forEach((p) => uploadedPhotoIds.value.delete(p.key));
  form.items = form.items.filter((entry) => entry.key !== key);
  const next = new Set(expandedItems.value);
  next.delete(key);
  expandedItems.value = next;
};
const updateItemNotes = (key: string, value: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (item) item.notes = value;
};
const updateItemPhotos = (key: string, photos: Photo[]) => {
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;
  const removedKeys = new Set(item.photos.map((p) => p.key).filter((k) => !photos.some((p) => p.key === k)));
  removedKeys.forEach((k) => uploadedPhotoIds.value.delete(k));
  item.photos = photos;
};
const setItemQuantity = (key: string, value: number | string | null | undefined) => {
  const qty = Math.max(0, Math.floor(Number(value) || 0));
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;
  if (qty === 0) {
    form.items = form.items.filter((entry) => entry.key !== key);
    const next = new Set(expandedItems.value);
    next.delete(key);
    expandedItems.value = next;
    return;
  }
  item.quantity = qty;
};

const resetSlip = () => {
  slipFile.value = null;
  uploadedSlip.value = null;
  form.slipImageId = null;
};

const resetForm = () => {
  Object.assign(form, createEmptyForm());
  dueDate.value = null;
  dueTime.value = "00:00";
  resetSlip();
  orderImageFile.value = null;
  uploadedOrderImage.value = null;
  uploadedPhotoIds.value.clear();
  expandedItems.value = new Set();
};

const intakePhotos = computed<Photo[]>(() => {
  if (orderImageFile.value) return [{ key: "intake", file: orderImageFile.value, url: null }];
  const url = uploadedOrderImage.value?.secureUrl ?? uploadedOrderImage.value?.url ?? null;
  return url ? [{ key: "intake", file: null, url }] : [];
});

const onIntakePhotosUpdate = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  orderImageFile.value = photo?.file ?? null;
  if (!photo) {
    uploadedOrderImage.value = null;
    form.orderImageId = null;
  }
};

const uploadSlipIfNeeded = async () => {
  if (!slipFile.value) return;
  const image = await uploadSlip(slipFile.value);
  if (!image) throw new Error("upload-failed");
  uploadedSlip.value = image;
  form.slipImageId = image.id;
};

const uploadOrderImagesIfNeeded = async () => {
  if (orderImageFile.value && !form.orderImageId) {
    const image = await uploadOrderImage(orderImageFile.value);
    if (!image) throw new Error("upload-order-image-failed");
    uploadedOrderImage.value = image;
    form.orderImageId = image.id;
  }
  for (const item of form.items) {
    for (const photo of item.photos) {
      if (!photo.file || uploadedPhotoIds.value.has(photo.key)) continue;
      const image = await uploadOrderImage(photo.file);
      if (!image) throw new Error("upload-item-image-failed");
      uploadedPhotoIds.value.set(photo.key, image.id);
      photo.url = image.secureUrl ?? image.url ?? null;
      photo.file = null;
    }
  }
};

watch(
  [() => form.isWalkIn, activeMemberEntitlement],
  ([isWalkIn, entitlement]) => {
    if (isWalkIn || !entitlement) { form.memberEntitlementId = null; return; }
    form.memberEntitlementId = (entitlement.creditRemaining ?? 0) > 0 ? entitlement.id : null;
  },
  { immediate: true },
);

watch(() => form.hangerCount, (raw) => { const v = Number.isFinite(raw) ? raw : 0; form.hangerCount = v; if (v !== form.missingHangerCount) form.missingHangerCount = v; });
watch(() => form.missingHangerCount, (raw) => { const v = Number.isFinite(raw) ? raw : 0; form.missingHangerCount = v; if (v !== form.hangerCount) form.hangerCount = v; });

const handleSubmit = async () => {
  if (!form.isWalkIn && !form.customerId) return notify.validationError("กรุณาเลือกลูกค้า");
  if (normalizedItems.value.length === 0) return notify.validationError("กรุณาเลือกบริการอย่างน้อย 1 รายการ");

  if (form.washFoldMode) {
    const w = Number(form.washFoldWeightKg || 0);
    if (w <= 0) return notify.validationError("กรุณากรอกน้ำหนักผ้า");
    if (washFoldMinKg.value > 0 && w < washFoldMinKg.value) {
      return notify.validationError(`น้ำหนักขั้นต่ำ ${washFoldMinKg.value} กก.`);
    }
  }

  isSubmitting.value = true;
  try {
    await uploadSlipIfNeeded();
    await uploadOrderImagesIfNeeded();

    const result = await createServiceOrder({
      customerId: form.isWalkIn ? null : form.customerId,
      isWalkIn: form.isWalkIn,
      walkInName: form.isWalkIn ? form.walkInName.trim() || null : null,
      walkInPhone: form.isWalkIn ? form.walkInPhone.trim() || null : null,
      memberEntitlementId: form.washFoldMode ? null : form.memberEntitlementId,
      orderImageId: form.orderImageId,
      items: normalizedItems.value,
      washFold: form.washFoldMode
        ? { weightKg: Number(form.washFoldWeightKg), notes: form.washFoldNotes.trim() || null }
        : null,
      missingHangerCount: form.washFoldMode ? 0 : form.missingHangerCount,
      dueAt: dueAtValue.value,
      discountAmount: form.washFoldMode
        ? sanitizedDiscountAmount.value
        : (form.memberEntitlementId ? sanitizedCashDiscount.value : sanitizedDiscountAmount.value),
      note: form.note.trim() || null,
      slipImageId: isMemberWithZeroTotal.value ? null : form.slipImageId,
    });

    if (result) {
      emit("completed", {
        paymentId: result.paymentId,
        serviceOrderId: result.id,
        orderNo: result.orderNo,
        saleType: "STOREFRONT",
        title: "บันทึกรายการรับผ้าสำเร็จ",
      });
      resetForm();
      await refresh();
    }
  } catch {
    notify.error("ไม่สามารถอัปโหลดสลิปได้");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
    <div class="min-w-0 space-y-4 sm:space-y-6">
      <section class="flex flex-col gap-3">
        <div :class="dashboardCardClass">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
              <p class="text-base font-semibold text-highlighted">เลือกบริการ</p>
              <p class="mt-0.5 text-sm text-muted">ค้นหาแล้วแตะบริการ ผ้าที่เลือกจะไปอยู่ในตะกร้าด้านขวา</p>
            </div>

            <div class="min-w-0 lg:shrink-0">
              <div class="flex min-w-0 items-center gap-3 rounded-md border border-default px-3 py-2 lg:w-[26rem]">
                <div class="flex min-w-0 flex-1 items-center gap-2">
                  <p class="text-sm font-medium text-highlighted">ซัก-พับ ชั่งกิโล</p>
                  <p class="min-w-0 truncate text-xs text-muted">
                    {{ formatCurrency(washFoldPricePerKg) }} / กก.<span v-if="washFoldMinKg > 0"> · ขั้นต่ำ {{ washFoldMinKg }} กก.</span>
                  </p>
                </div>
                <USwitch v-model="form.washFoldMode" color="warning" class="shrink-0" />
              </div>
            </div>
          </div>

          <div v-if="form.washFoldMode" class="mt-3 grid grid-cols-1 gap-3 border-t border-default pt-3 md:grid-cols-2">
            <UFormField label="น้ำหนัก (กก.)" required>
              <UInputNumber v-model="form.washFoldWeightKg" :min="0" :step="0.5" class="w-full" />
            </UFormField>
            <UFormField label="หมายเหตุ">
              <UInput v-model="form.washFoldNotes" placeholder="เช่น แยกซัก สีอ่อน-เข้ม" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div :class="[filterBarClass, 'flex flex-col gap-1.5 sm:flex-row sm:items-center']">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="ค้นหาบริการหรือชนิดผ้า"
            class="min-w-0 sm:flex-[1_1_32rem]"
          />
          <div class="grid grid-cols-2 gap-1.5 sm:flex sm:shrink-0 sm:items-center">
            <USelect v-model="categoryFilter" :items="categoryOptions" value-key="value" class="min-w-0 md:w-40 lg:w-44" />
            <USelect v-model="serviceFilter" :items="serviceOptions" value-key="value" class="min-w-0 md:w-40 lg:w-44" />
          </div>
        </div>

        <div v-if="isCatalogLoading" class="space-y-3">
          <div class="space-y-1 md:hidden">
            <USkeleton v-for="i in 5" :key="`mlist-${i}`" class="h-20 w-full rounded-md" />
          </div>
          <div class="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            <PosCatalogCard v-for="i in 8" :key="`mgrid-${i}`" loading />
          </div>
        </div>

        <div v-else-if="filteredCatalog.length">
          <div class="space-y-1 md:hidden">
            <div
              v-for="item in filteredCatalog"
              :key="item.id"
              role="button"
              tabindex="0"
              :class="[mobileListCardClass, 'admin-dashboard-card rounded-md px-4 py-3']"
              @click="incrementCatalogItem(item.id)"
              @keydown.enter.prevent="incrementCatalogItem(item.id)"
              @keydown.space.prevent="incrementCatalogItem(item.id)"
            >
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <p class="min-w-0 wrap-break-word text-sm font-medium text-highlighted">{{ item.label }}</p>
                    <UBadge v-if="isRangeItem(item.id)" color="warning" variant="subtle" size="xs">กำหนดราคา</UBadge>
                    <UBadge v-else-if="getCatalogQuantity(item.id) > 0" color="primary" variant="subtle" size="xs">
                      {{ getCatalogQuantity(item.id) }} ชิ้น
                    </UBadge>
                  </div>
                  <p class="mt-0.5 wrap-break-word text-xs text-muted">{{ getCatalogDescription(item) }}</p>
                </div>

                <p class="shrink-0 text-sm font-semibold text-highlighted">
                  {{ item.priceMin != null && item.priceMax != null && item.priceMin !== item.priceMax
                    ? `฿${item.priceMin.toLocaleString()}–${item.priceMax.toLocaleString()}`
                    : formatCurrency(item.price) }}
                </p>
              </div>

              <div class="mt-3 flex items-center justify-between gap-3">
                <span class="text-xs text-muted">
                  {{ getCatalogQuantity(item.id) > 0 ? "เลือกแล้ว" : "แตะเพื่อเพิ่ม" }}
                </span>
                <div class="flex items-center gap-1" @click.stop>
                  <UButton
                    v-if="getCatalogQuantity(item.id) > 0 && !isRangeItem(item.id)"
                    icon="i-lucide-minus"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    aria-label="ลดจำนวน"
                    @click="decrementCatalogItem(item.id)"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    aria-label="เพิ่มรายการ"
                    @click="incrementCatalogItem(item.id)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            <PosCatalogCard
              v-for="item in filteredCatalog"
              :key="item.id"
              :title="item.label"
              :description="getCatalogDescription(item)"
              badge-label="ราคาหน้าร้าน"
              badge-color="primary"
              :price-label="item.priceMin != null && item.priceMax != null && item.priceMin !== item.priceMax
                ? `฿${item.priceMin.toLocaleString()}–${item.priceMax.toLocaleString()}`
                : formatCurrency(item.price)"
              :is-range="isRangeItem(item.id)"
              :quantity="getCatalogQuantity(item.id)"
              :selected="getCatalogQuantity(item.id) > 0"
              @increment="incrementCatalogItem(item.id)"
              @decrement="decrementCatalogItem(item.id)"
              @change="setCatalogItemQuantity(item.id, $event)"
            />
          </div>
        </div>

        <div v-else :class="emptyStateClass">
          ไม่พบบริการที่ตรงกับตัวกรอง
        </div>
      </section>
    </div>

    <aside
      v-show="mounted"
      :class="!isCompact
        ? 'space-y-4 rounded-md sm:space-y-6 xl:sticky xl:top-4 xl:self-start'
        : [
            'admin-workspace fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-default shadow-2xl',
            mounted ? 'transition-transform duration-200' : '',
            isCartOpen ? 'translate-x-0' : 'translate-x-full',
          ]"
    >
      <div v-if="isCompact" class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-default bg-default px-4 py-3 dark:bg-elevated/55">
        <p class="text-base font-semibold text-highlighted">ตะกร้ารับผ้า</p>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" aria-label="ปิด" @click="isCartOpen = false" />
      </div>
      <div :class="isCompact ? 'flex-1 p-2' : ''">
      <PosCheckoutPanel
        title="ตะกร้ารับผ้า"
        description="สรุปรายการผ้า วันนัดรับ และการชำระเงินในหน้าเดียว"
        :flat="isCompact"
        :section-class="checkoutSectionClass"
        :customer-id="form.customerId"
        :customer-options="customerOptions"
        :customer-loading="isCustomersLoading"
        allow-walk-in
        :is-walk-in="form.isWalkIn"
        :walk-in-name="form.walkInName"
        :walk-in-phone="form.walkInPhone"
        :note="form.note"
        total-label="ยอดรวมสุทธิ"
        :total-value="formatCurrency(totalAmount)"
        :total-meta="`${cartItems.length} รายการ | ${totalQuantity} ชิ้น`"
        submit-label="บันทึกรับผ้า"
        :is-submitting="isSubmitting"
        :slip-file="slipFile"
        :uploaded-slip-url="uploadedSlip?.secureUrl || uploadedSlip?.url"
        :uploaded-slip-label="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
        :hide-payment-fields="isMemberWithZeroTotal"
        @update:customer-id="form.customerId = $event"
        @update:is-walk-in="form.isWalkIn = $event"
        @update:walk-in-name="form.walkInName = $event"
        @update:walk-in-phone="form.walkInPhone = $event"
        @update:note="form.note = $event"
        @update:slip-file="slipFile = $event"
        @remove-slip="resetSlip"
        @submit="handleSubmit"
        @reset="resetForm"
      >
        <template #cart>
          <div :class="[checkoutSectionClass, 'space-y-3']">
            <div v-if="form.washFoldMode" class="border-l-2 border-warning pl-3">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-medium text-highlighted">ซัก-พับ ชั่งกิโล</p>
                <span class="text-sm text-muted">{{ formatCurrency(washFoldPricePerKg) }} / กก.</span>
              </div>
              <div class="mt-1 flex justify-between text-sm font-medium">
                <span>รวม</span>
                <span>{{ formatCurrency(washFoldSubtotal) }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-highlighted">รายการที่เลือก</p>
              <span class="text-xs text-muted">{{ totalQuantity }} ชิ้น</span>
            </div>

            <div v-if="cartItems.length" class="space-y-2">
              <div v-if="canUseMemberPackage" class="border-l-2 border-success pl-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-success">{{ activeMemberEntitlement?.productName }}</p>
                    <p class="text-xs text-muted">
                      เครดิตคงเหลือ {{ activeMemberEntitlement?.creditRemaining ?? 0 }} | ใช้ {{ creditUsedPreview }} เครดิต
                      <span v-if="form.memberEntitlementId && cashQuantity > 0">| คิดเพิ่ม {{ cashQuantity }} ชิ้น ({{ formatCurrency(cashSubtotal) }})</span>
                    </p>
                  </div>
                  <USwitch
                    :model-value="Boolean(form.memberEntitlementId)"
                    color="success"
                    size="sm"
                    @update:model-value="form.memberEntitlementId = $event ? activeMemberEntitlement?.id ?? null : null"
                  />
                </div>
              </div>

              <div class="divide-y divide-default">
                <div v-for="item in cartItems" :key="item.key" class="py-2 first:pt-0 last:pb-0">
                  <div class="flex cursor-pointer items-start gap-2 rounded-md py-1 hover:bg-elevated/30" @click="toggleItemExpand(item.key)">
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-start gap-2">
                        <p class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ item.label }}</p>
                        <span class="shrink-0 text-right text-xs font-medium text-muted">
                          {{ form.washFoldMode ? "ชั่งกิโล" : (form.memberEntitlementId ? `${item.quantity} เครดิต` : formatCurrency(item.totalPrice)) }}
                        </span>
                      </div>
                      <div class="mt-1 flex items-center gap-1" @click.stop>
                        <UInputNumber
                          :model-value="item.quantity"
                          :min="0"
                          :step="1"
                          size="xs"
                          class="w-20"
                          @update:model-value="setItemQuantity(item.key, $event)"
                        />
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center">
                      <UButton
                        :icon="expandedItems.has(item.key) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click.stop="toggleItemExpand(item.key)"
                      />
                      <UButton icon="i-lucide-x" color="error" variant="ghost" size="xs" @click.stop="removeItem(item.key)" />
                    </div>
                  </div>

                  <div v-if="expandedItems.has(item.key)" class="mt-2 space-y-2 border-l-2 border-default pl-3">
                    <UTextarea
                      :model-value="item.notes"
                      :rows="2"
                      class="w-full"
                      placeholder="บันทึกตำหนิหรือรายละเอียดผ้าชิ้นนี้"
                      @update:model-value="updateItemNotes(item.key, String($event || ''))"
                    />
                    <UIPhotoUpload
                      label="รูปผ้าชำรุด"
                      description="แนบรูปเฉพาะผ้าที่มีตำหนิหรือชำรุด"
                      :photos="item.photos"
                      :disabled="isSubmitting"
                      capture="environment"
                      @update:photos="updateItemPhotos(item.key, $event)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="border-y border-dashed border-default py-8 text-center text-sm text-muted">
              ยังไม่ได้เลือกบริการ
            </div>
          </div>
        </template>

        <template #summary>
          <div :class="[checkoutSectionClass, 'space-y-3 text-sm']">
            <div class="flex items-center justify-between gap-3">
              <span class="text-muted">รวมค่าบริการ</span>
              <span class="font-medium text-highlighted">{{ formatCurrency(subtotalAmount) }}</span>
            </div>

            <div v-if="form.memberEntitlementId" class="flex items-center justify-between gap-3">
              <span class="text-muted">ตัดเครดิตรายเดือน</span>
              <span class="font-medium text-success">{{ creditUsedPreview }} เครดิต</span>
            </div>
            <div v-if="form.memberEntitlementId && cashQuantity > 0" class="flex items-center justify-between gap-3">
              <span class="text-muted">เครดิตไม่พอ ({{ cashQuantity }} ชิ้น)</span>
              <span class="font-medium text-highlighted">{{ formatCurrency(cashSubtotal) }}</span>
            </div>

            <div v-if="!form.washFoldMode" class="flex items-center justify-between gap-3">
              <span class="text-muted">ค่าไม้แขวน</span>
              <span class="font-medium text-highlighted">{{ formatCurrency(hangerCharge.total) }}</span>
            </div>

            <div v-if="vatRate > 0" class="flex items-center justify-between gap-3">
              <span class="text-muted">{{ vatIncluded ? `รวม VAT ${vatRate}%` : `VAT ${vatRate}%` }}</span>
              <span class="font-medium text-highlighted">{{ formatCurrency(vatPreview.vatAmount) }}</span>
            </div>

            <div v-if="!form.washFoldMode" class="flex items-center justify-between gap-3">
              <span class="text-muted">จำนวนไม้แขวน</span>
              <div class="flex items-center gap-2">
                <UInputNumber v-model="form.missingHangerCount" :min="0" :step="1" orientation="horizontal" size="xs" class="w-20" />
                <UButton label="ตามจำนวนผ้า" color="neutral" variant="outline" size="xs" @click="form.hangerCount = totalQuantity" />
              </div>
            </div>

            <div>
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-highlighted">วันนัดรับ</p>
                <div class="flex gap-1.5">
                  <UButton size="xs" color="neutral" variant="soft" label="พุธ" @click="setPickupDow(3)" />
                  <UButton size="xs" color="neutral" variant="soft" label="เสาร์" @click="setPickupDow(6)" />
                  <UButton size="xs" color="neutral" :variant="dueDate ? 'ghost' : 'solid'" label="ไม่ระบุ" @click="clearDueDate" />
                </div>
              </div>
              <div v-if="dueDate" class="grid grid-cols-2 gap-2">
                <UPopover>
                  <UButton
                    :label="dueDateLabel"
                    icon="i-lucide-calendar"
                    color="neutral"
                    variant="outline"
                    block
                    class="justify-start font-normal"
                  />
                  <template #content>
                    <UCalendar v-model="dueDate" locale="th-TH" class="p-2" />
                  </template>
                </UPopover>
                <USelect v-model="dueTime" :items="dueTimeOptions" value-key="value" icon="i-lucide-clock" class="w-full" />
              </div>
              <p v-else class="text-xs text-muted">ไม่ระบุวันนัด — กดพุธ / เสาร์ หรือ
                <button class="underline" @click="setPickupDow(3)">เลือกวัน</button>
              </p>
            </div>
          </div>
        </template>

        <template #discount>
          <div :class="[checkoutSectionClass, 'space-y-3']">
            <UFormField v-if="!isMemberWithZeroTotal" label="ส่วนลด">
              <UInputNumber
                :model-value="form.discountAmount"
                :min="0"
                :max="subtotalAmount"
                :step="1"
                :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }"
                class="w-full"
                @update:model-value="form.discountAmount = Number.isFinite($event) ? $event : 0"
              />
            </UFormField>

            <UIPhotoUpload
              label="รูปหลักฐานการรับผ้า"
              :photos="intakePhotos"
              :max="1"
              :disabled="isSubmitting"
              capture="environment"
              confirm-remove
              @update:photos="onIntakePhotosUpdate"
            />
          </div>
        </template>
      </PosCheckoutPanel>
      </div>
    </aside>
  </div>

  <!-- Mobile/Tablet: FAB + backdrop -->
  <div
    v-if="isCompact && isCartOpen"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
    aria-hidden="true"
    @click="isCartOpen = false"
  />
  <UButton
    v-if="isCompact"
    icon="i-lucide-shopping-cart"
    color="primary"
    size="xl"
    class="fixed bottom-6 right-6 z-30 size-14 justify-center !rounded-full shadow-lg"
    aria-label="เปิดตะกร้ารับผ้า"
    @click="isCartOpen = true"
  >
    <span
      v-if="totalQuantity > 0"
      class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-xs font-semibold text-white"
    >{{ totalQuantity }}</span>
  </UButton>

  <!-- New Catalog Item Modal -->
  <!-- Price-range input modal -->
  <UModal v-model:open="priceInputModal" title="กรอกราคา" :ui="{ content: 'max-w-sm' }">
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          ช่วงราคา:
          <span class="font-medium text-highlighted">
            ฿{{ priceInputMin?.toLocaleString() }}–{{ priceInputMax?.toLocaleString() }}
          </span>
        </p>
        <UFormField label="ราคา (บาท)" required>
          <UInput
            v-model.number="priceInputValue"
            type="number"
            :min="priceInputMin ?? 0"
            :max="priceInputMax ?? undefined"
            class="w-full"
            autofocus
            @keydown.enter.prevent="confirmPriceInput"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="priceInputModal = false">ยกเลิก</UButton>
        <UButton icon="i-lucide-plus" @click="confirmPriceInput">เพิ่มในตะกร้า</UButton>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="newItemModalOpen" title="เพิ่มรายการซักใหม่" description="สร้างรายการผ้าใหม่พร้อมราคาต่อบริการ">
    <template #body>
      <div class="space-y-4">
        <UFormField label="ชื่อรายการ" required>
          <UInput v-model="newItemData.name" class="w-full" placeholder="เช่น เสื้อเชิ้ต, กางเกงยีนส์" />
        </UFormField>

        <UFormField label="ประเภท / หมวดหมู่">
          <USelect
            v-model="newItemData.categoryId"
            :items="pricingData?.categories || []"
            label-key="name"
            value-key="id"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UFormField v-for="service in pricingData?.services || []" :key="service.id" :label="service.name">
            <UInput v-model.number="newItemPrices[service.id]" type="number" class="w-full" placeholder="-" />
          </UFormField>
        </div>

        <UFormField label="หมายเหตุ">
          <UInput v-model="newItemData.description" class="w-full" placeholder="เช่น คิดตามขนาด" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton label="ยกเลิก" color="neutral" variant="outline" @click="newItemModalOpen = false" />
        <UButton
          label="บันทึก"
          color="primary"
          icon="i-lucide-check"
          :loading="isSavingNewItem"
          :disabled="!newItemData.name.trim()"
          @click="saveNewItem"
        />
      </div>
    </template>
  </UModal>
</template>
