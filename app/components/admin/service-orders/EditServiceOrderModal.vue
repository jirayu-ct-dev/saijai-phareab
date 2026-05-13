<script setup lang="ts">
import { CalendarDate, parseDate } from "@internationalized/date";
import OrderItemPhotosField, { type OrderItemPhoto } from "~~/app/components/admin/pos/OrderItemPhotosField.vue";
import type { PaymentSlipImage } from "~~/app/composables/useAdminPayments";
import type { AdminServiceOrder, CreateAdminServiceOrderBody } from "~~/app/composables/useAdminServiceOrders";
import { useBusinessSetting } from "~~/app/composables/useBusinessSetting";
import { formatCurrency } from "~~/shared/utils/format";
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import * as adminUi from "~~/shared/config/adminUi";

const adminDashboardCardClass =
  adminUi.adminDashboardCardClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55";

type FormItemState = {
  key: string;
  storefrontPriceId: string;
  unitPrice?: number;
  quantity: number;
  notes: string;
  photos: OrderItemPhoto[];
  fallbackLabel?: string;
  fallbackUnitPrice?: number;
};
type CatalogMenuItem = { label: string; icon: string; onSelect: () => void; description?: string };
type CustomerOption = {
  label: string;
  value: string;
  image?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  activeMemberEntitlement?: {
    id: string;
    productName: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
  } | null;
};

const props = defineProps<{
  order: AdminServiceOrder | null;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });

const serviceOrderStatusOptions: Array<{ label: string; value: ServiceOrderStatus }> = [
  { label: "รับผ้าแล้ว", value: "RECEIVED" },
  { label: "กำลังดำเนินการ", value: "PROCESSING" },
  { label: "กำลังจัดส่ง", value: "DELIVERING" },
  { label: "เสร็จสิ้น", value: "COMPLETED" },
  { label: "ยกเลิก", value: "CANCELLED" },
];

const notify = useNotify();
const { updateServiceOrder, uploadOrderImage } = useAdminServiceOrders({ fetchList: false, refreshAfterMutation: false });
const { customers, isLoading: isCustomersLoading } = useAdminCustomerOptions();
const { items: catalogItems, isLoading: isCatalogLoading, refresh: refreshCatalog } = useStorefrontCatalog();
const { uploadSlip } = useAdminPayments({ fetchList: false, refreshAfterMutation: false });
const { hangerPricePerUnit, washFoldPricePerKg, washFoldMinKg } = useBusinessSetting();

const isSubmitting = ref(false);
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<PaymentSlipImage | null>(null);
const orderImageFile = ref<File | null>(null);
const uploadedOrderImage = ref<AdminServiceOrder["image"] | null>(null);
const editDeliveryImageFile = ref<File | null>(null);
const uploadedEditDeliveryImage = ref<AdminServiceOrder["image"] | null>(null);

const intakeFileInputRef = ref<HTMLInputElement | null>(null);
const deliveryFileInputRef = ref<HTMLInputElement | null>(null);
const intakeObjectUrl = ref("");
const deliveryObjectUrl = ref("");
const editPhotoPreviewOpen = ref(false);
const editPhotoPreviewUrl = ref("");
const editPhotoPreviewTitle = ref("");
const editPhotoRemoveOpen = ref(false);
const editPhotoRemoveTarget = ref<"intake" | "delivery" | null>(null);

let itemKeySeed = 0;
let photoKeySeed = 0;
const createItemKey = () => `service-order-item-${++itemKeySeed}`;
const createPhotoKey = () => `edit-order-photo-${Date.now()}-${++photoKeySeed}`;

const createEmptyForm = () => ({
  customerId: "",
  isWalkIn: false,
  walkInName: "",
  walkInPhone: "",
  serviceOrderStatus: "RECEIVED" as ServiceOrderStatus,
  hangerCount: 0,
  missingHangerCount: 0,
  memberEntitlementId: null as string | null,
  orderImageId: null as string | null,
  deliveryImageId: null as string | null,
  discountAmount: 0,
  note: "",
  washFoldMode: false,
  washFoldWeightKg: 0,
  washFoldNotes: "",
});

const form = reactive(createEmptyForm());
const formItems = ref<FormItemState[]>([]);
const expandedItems = ref<Set<string>>(new Set());
const dueDate = shallowRef<CalendarDate | null>(null);
const dueTime = ref("00:00");

const getAvatarProps = (customer?: Pick<CustomerOption, "image" | "name" | "email"> | AdminServiceOrder["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const customerOptions = computed<CustomerOption[]>(() =>
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
const selectedCustomer = computed(() => customerOptions.value.find((item) => item.value === form.customerId) ?? null);
const activeMemberEntitlement = computed(() => selectedCustomer.value?.activeMemberEntitlement ?? null);
const canUseMemberPackage = computed(() => !form.isWalkIn && Boolean(activeMemberEntitlement.value));

const catalogMap = computed(() => new Map((catalogItems.value ?? []).map((item) => [item.id, item])));
const formLineItems = computed(() =>
  formItems.value
    .map((item) => {
      const catalog = catalogMap.value.get(item.storefrontPriceId);
      const label = catalog?.label ?? item.fallbackLabel ?? "";
      const unitPrice = item.unitPrice ?? catalog?.price ?? item.fallbackUnitPrice ?? 0;
      if (!label) return null;
      return {
        key: item.key,
        storefrontPriceId: item.storefrontPriceId,
        label,
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
  form.washFoldMode ? washFoldSubtotal.value : formLineItems.value.reduce((sum, item) => sum + item.totalPrice, 0),
);
const totalQuantity = computed(() =>
  form.washFoldMode ? 1 : formLineItems.value.reduce((sum, item) => sum + item.quantity, 0),
);
const hangerCharge = computed(() =>
  form.washFoldMode
    ? { count: 0, pricePerUnit: 0, total: 0 }
    : {
        count: form.missingHangerCount,
        pricePerUnit: hangerPricePerUnit.value,
        total: form.missingHangerCount * hangerPricePerUnit.value,
      },
);
const sanitizedDiscountAmount = computed(() => {
  const raw = Number(form.discountAmount || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, subtotalAmount.value);
});
const creditAvailable = computed(() => Math.max(0, Number(activeMemberEntitlement.value?.creditRemaining ?? 0)));
const creditUsedPreview = computed(() => {
  if (!form.memberEntitlementId) return 0;
  return Math.min(totalQuantity.value, creditAvailable.value);
});
const cashSubtotal = computed(() => {
  if (!form.memberEntitlementId) return subtotalAmount.value;
  let remaining = creditAvailable.value;
  let total = 0;
  for (const item of formLineItems.value) {
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
const totalAmount = computed(() => (
  form.memberEntitlementId
    ? cashSubtotal.value - sanitizedCashDiscount.value + hangerCharge.value.total
    : subtotalAmount.value - sanitizedDiscountAmount.value + hangerCharge.value.total
));

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
const dueDateLabel = computed(() => {
  if (!dueDate.value) return "เลือกวันที่";
  const dd = String(dueDate.value.day).padStart(2, "0");
  const mm = String(dueDate.value.month).padStart(2, "0");
  return `${dd}/${mm}/${dueDate.value.year}`;
});

const intakeDisplayUrl = computed(
  () => uploadedOrderImage.value?.secureUrl || uploadedOrderImage.value?.url || intakeObjectUrl.value || "",
);
const deliveryDisplayUrl = computed(
  () => uploadedEditDeliveryImage.value?.secureUrl || uploadedEditDeliveryImage.value?.url || deliveryObjectUrl.value || "",
);

watch(orderImageFile, (file) => {
  if (intakeObjectUrl.value && import.meta.client) URL.revokeObjectURL(intakeObjectUrl.value);
  intakeObjectUrl.value = file && import.meta.client ? URL.createObjectURL(file) : "";
});
watch(editDeliveryImageFile, (file) => {
  if (deliveryObjectUrl.value && import.meta.client) URL.revokeObjectURL(deliveryObjectUrl.value);
  deliveryObjectUrl.value = file && import.meta.client ? URL.createObjectURL(file) : "";
});
watch(() => form.washFoldMode, (enabled) => {
  if (enabled) {
    formItems.value = [];
    form.memberEntitlementId = null;
    form.missingHangerCount = 0;
    form.hangerCount = 0;
  } else {
    form.washFoldWeightKg = 0;
    form.washFoldNotes = "";
  }
});
watch(
  [() => form.isWalkIn, activeMemberEntitlement],
  () => {
    if (!canUseMemberPackage.value) {
      form.memberEntitlementId = null;
      return;
    }
    if (form.memberEntitlementId && form.memberEntitlementId !== activeMemberEntitlement.value?.id) {
      form.memberEntitlementId = activeMemberEntitlement.value?.id ?? null;
    }
  },
  { immediate: true },
);
watch(() => form.hangerCount, (value) => {
  if (value !== form.missingHangerCount) form.missingHangerCount = value;
});
watch(() => form.missingHangerCount, (value) => {
  if (value !== form.hangerCount) form.hangerCount = value;
});

const resetForm = () => {
  Object.assign(form, createEmptyForm());
  formItems.value = [];
  expandedItems.value = new Set();
  dueDate.value = null;
  dueTime.value = "00:00";
  slipFile.value = null;
  uploadedSlip.value = null;
  orderImageFile.value = null;
  uploadedOrderImage.value = null;
  editDeliveryImageFile.value = null;
  uploadedEditDeliveryImage.value = null;
};

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

const applyOrderToForm = () => {
  const order = props.order;
  if (!order) return;
  form.customerId = order.isWalkIn ? "" : order.customer.id;
  form.isWalkIn = order.isWalkIn;
  form.walkInName = order.walkInName || "";
  form.walkInPhone = order.walkInPhone || "";
  form.memberEntitlementId = order.memberEntitlement?.id ?? null;
  form.serviceOrderStatus = order.status;
  setDueDateTime(order.dueAt);
  form.hangerCount = order.hangerCharge?.count ?? order.items.reduce((sum, item) => sum + item.quantity, 0);
  form.missingHangerCount = order.hangerCharge?.count ?? 0;
  form.orderImageId = order.image?.id ?? null;
  form.deliveryImageId = order.deliveryImage?.id ?? null;
  form.discountAmount = order.discountAmount;
  form.note = order.note || "";
  const isWashFoldOrder = order.weightKg != null;
  form.washFoldMode = isWashFoldOrder;
  form.washFoldWeightKg = isWashFoldOrder ? Number(order.weightKg ?? 0) : 0;
  form.washFoldNotes = "";
  formItems.value = order.items.filter((it) => it.storefrontPriceId).map((item) => {
    const existingPhotos: OrderItemPhoto[] = (item.photos ?? []).map((photo) => ({
      key: createPhotoKey(),
      file: null,
      uploadedImageId: photo.imageId,
      uploadedUrl: photo.secureUrl || photo.url || null,
      isDamaged: photo.isDamaged,
    }));
    if (!existingPhotos.length && item.image) {
      existingPhotos.push({
        key: createPhotoKey(),
        file: null,
        uploadedImageId: item.image.id,
        uploadedUrl: item.image.secureUrl || item.image.url || null,
        isDamaged: false,
      });
    }
    const catalogEntry = catalogMap.value.get(item.storefrontPriceId as string);
    const catalogPrice = catalogEntry?.price ?? null;
    return {
      key: createItemKey(),
      storefrontPriceId: item.storefrontPriceId as string,
      unitPrice: catalogPrice != null && item.unitPrice === catalogPrice ? undefined : item.unitPrice,
      quantity: item.quantity,
      notes: item.notes || "",
      photos: existingPhotos,
      fallbackLabel: item.label,
      fallbackUnitPrice: item.unitPrice,
    };
  });
  uploadedOrderImage.value = order.image;
  orderImageFile.value = null;
  uploadedEditDeliveryImage.value = order.deliveryImage;
  editDeliveryImageFile.value = null;
  uploadedSlip.value = order.payment?.slipImage
    ? {
        id: order.payment.slipImage.id,
        secureUrl: order.payment.slipImage.secureUrl,
        url: order.payment.slipImage.url,
      }
    : null;
  slipFile.value = null;
};

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      applyOrderToForm();
      if (!catalogItems.value?.length) void refreshCatalog();
    } else {
      resetForm();
    }
  },
);
watch(
  () => props.order?.id,
  () => {
    if (open.value) applyOrderToForm();
  },
);

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
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
const toggleItemExpand = (key: string) => {
  const next = new Set(expandedItems.value);
  next.has(key) ? next.delete(key) : next.add(key);
  expandedItems.value = next;
};
const setItemQuantity = (key: string, value: number | string | null | undefined) => {
  const qty = Math.max(0, Math.floor(Number(value) || 0));
  const target = formItems.value.find((entry) => entry.key === key);
  if (!target) return;
  if (qty === 0) {
    formItems.value = formItems.value.filter((entry) => entry.key !== key);
    const next = new Set(expandedItems.value);
    next.delete(key);
    expandedItems.value = next;
    return;
  }
  target.quantity = qty;
};
const removeItemRow = (key: string) => {
  formItems.value = formItems.value.filter((item) => item.key !== key);
  const next = new Set(expandedItems.value);
  next.delete(key);
  expandedItems.value = next;
};
const updateItemNotes = (key: string, value: string) => {
  const target = formItems.value.find((item) => item.key === key);
  if (target) target.notes = value;
};
const updateItemUnitPrice = (key: string, price: number) => {
  const target = formItems.value.find((item) => item.key === key);
  if (target) target.unitPrice = price;
};
const updateItemPhotos = (key: string, photos: OrderItemPhoto[]) => {
  const target = formItems.value.find((item) => item.key === key);
  if (target) target.photos = photos;
};

const editPriceInputOpen = ref(false);
const editPriceInputPriceId = ref("");
const editPriceInputValue = ref<number | null>(null);
const editPriceInputMin = ref<number | null>(null);
const editPriceInputMax = ref<number | null>(null);
const isEditRangeItem = (storefrontPriceId: string) => {
  const c = catalogMap.value.get(storefrontPriceId);
  return c?.priceMin != null && c?.priceMax != null && c.priceMin !== c.priceMax;
};
const openEditPriceInput = (storefrontPriceId: string) => {
  const c = catalogMap.value.get(storefrontPriceId);
  if (!c) return;
  editPriceInputPriceId.value = storefrontPriceId;
  editPriceInputMin.value = c.priceMin;
  editPriceInputMax.value = c.priceMax;
  editPriceInputValue.value = c.priceMin ?? c.price;
  editPriceInputOpen.value = true;
};
const confirmEditPriceInput = () => {
  const price = Number(editPriceInputValue.value);
  if (!Number.isFinite(price) || price < 0) return;
  const priceId = editPriceInputPriceId.value;
  const existingRow = formItems.value.find(
    (i) => i.storefrontPriceId === priceId && (i.unitPrice ?? catalogMap.value.get(priceId)?.price) === price,
  );
  if (existingRow) {
    existingRow.quantity += 1;
    formItems.value = [existingRow, ...formItems.value.filter((i) => i.key !== existingRow.key)];
  } else {
    formItems.value = [{ key: createItemKey(), storefrontPriceId: priceId, unitPrice: price, quantity: 1, notes: "", photos: [] }, ...formItems.value];
  }
  editPriceInputOpen.value = false;
};
const addCatalogItemToTop = (storefrontPriceId: string) => {
  if (isEditRangeItem(storefrontPriceId)) {
    openEditPriceInput(storefrontPriceId);
    return;
  }
  const existing = formItems.value.find((item) => item.storefrontPriceId === storefrontPriceId);
  if (existing) {
    existing.quantity += 1;
    formItems.value = [existing, ...formItems.value.filter((item) => item.key !== existing.key)];
    return;
  }
  formItems.value = [{ key: createItemKey(), storefrontPriceId, quantity: 1, notes: "", photos: [] }, ...formItems.value];
};
const catalogDropdownItems = computed<CatalogMenuItem[][]>(() => {
  const items = (catalogItems.value ?? []).map((item) => ({
    label: item.label,
    description: item.categoryName ? `${item.categoryName} | ${item.serviceName}` : item.serviceName,
    icon: "i-lucide-plus",
    onSelect: () => addCatalogItemToTop(item.id),
  }));
  if (!items.length) return [[{ label: "ไม่พบบริการ", icon: "i-lucide-ban", onSelect: () => {} }]];
  return [items];
});

const openIntakePicker = () => intakeFileInputRef.value?.click();
const openDeliveryPicker = () => deliveryFileInputRef.value?.click();
const onIntakeFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) return;
  orderImageFile.value = file;
  uploadedOrderImage.value = null;
  form.orderImageId = null;
  if (input) input.value = "";
};
const onDeliveryFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) return;
  editDeliveryImageFile.value = file;
  uploadedEditDeliveryImage.value = null;
  form.deliveryImageId = null;
  if (input) input.value = "";
};
const openEditPhotoPreview = (url: string, title: string) => {
  if (!url) return;
  editPhotoPreviewUrl.value = url;
  editPhotoPreviewTitle.value = title;
  editPhotoPreviewOpen.value = true;
};
const requestRemoveEditPhoto = (target: "intake" | "delivery") => {
  editPhotoRemoveTarget.value = target;
  editPhotoRemoveOpen.value = true;
};
const performRemoveEditPhoto = () => {
  if (editPhotoRemoveTarget.value === "intake") {
    orderImageFile.value = null;
    uploadedOrderImage.value = null;
    form.orderImageId = null;
  } else if (editPhotoRemoveTarget.value === "delivery") {
    editDeliveryImageFile.value = null;
    uploadedEditDeliveryImage.value = null;
    form.deliveryImageId = null;
  }
  editPhotoRemoveTarget.value = null;
  editPhotoRemoveOpen.value = false;
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
const uploadSlipIfNeeded = async (): Promise<string | null> => {
  if (!slipFile.value) return uploadedSlip.value?.id ?? null;
  const image = await uploadSlip(slipFile.value);
  if (!image) return null;
  uploadedSlip.value = image;
  return image.id;
};
const uploadOrderImagesIfNeeded = async (): Promise<void> => {
  if (orderImageFile.value) {
    const image = await uploadOrderImage(orderImageFile.value);
    if (!image) throw new Error("upload-order-image-failed");
    uploadedOrderImage.value = image;
    form.orderImageId = image.id;
  }
  if (editDeliveryImageFile.value) {
    const image = await uploadOrderImage(editDeliveryImageFile.value);
    if (!image) throw new Error("upload-delivery-image-failed");
    uploadedEditDeliveryImage.value = image;
    form.deliveryImageId = image.id;
  }
  for (const item of formItems.value) {
    for (const photo of item.photos) {
      if (!photo.file || photo.uploadedImageId) continue;
      const image = await uploadOrderImage(photo.file);
      if (!image) throw new Error("upload-item-image-failed");
      photo.uploadedImageId = image.id;
      photo.uploadedUrl = image.secureUrl ?? image.url ?? null;
      photo.file = null;
    }
  }
};

const buildBody = async (): Promise<CreateAdminServiceOrderBody | null> => {
  if (!form.isWalkIn && !form.customerId) {
    notify.validationError("กรุณาเลือกลูกค้า");
    return null;
  }
  if (form.isWalkIn && !form.walkInName.trim()) {
    notify.validationError("กรุณากรอกชื่อลูกค้าหน้าร้าน");
    return null;
  }
  if (form.washFoldMode) {
    const w = Number(form.washFoldWeightKg || 0);
    if (w <= 0) {
      notify.validationError("กรุณากรอกน้ำหนักผ้า");
      return null;
    }
    if (washFoldMinKg.value > 0 && w < washFoldMinKg.value) {
      notify.validationError(`น้ำหนักขั้นต่ำ ${washFoldMinKg.value} กก.`);
      return null;
    }
  }

  const slipImageId = await uploadSlipIfNeeded();
  if (!form.washFoldMode) await uploadOrderImagesIfNeeded();
  const items = form.washFoldMode
    ? []
    : formItems.value
        .map((item) => {
          const readyPhotos = item.photos.filter((photo) => photo.uploadedImageId);
          return {
            storefrontPriceId: item.storefrontPriceId,
            quantity: Number(item.quantity ?? 1),
            unitPrice: item.unitPrice ?? null,
            imageId: readyPhotos[0]?.uploadedImageId ?? null,
            notes: item.notes.trim() || null,
            photos: readyPhotos.map((photo, index) => ({
              imageId: photo.uploadedImageId as string,
              isDamaged: photo.isDamaged,
              sortOrder: index,
            })),
          };
        })
        .filter((item) => item.storefrontPriceId);
  if (!form.washFoldMode && !items.length) {
    notify.validationError("กรุณาเลือกบริการอย่างน้อย 1 รายการ");
    return null;
  }

  return {
    customerId: form.isWalkIn ? null : form.customerId,
    isWalkIn: form.isWalkIn,
    walkInName: form.isWalkIn ? form.walkInName.trim() || null : null,
    walkInPhone: form.isWalkIn ? form.walkInPhone.trim() || null : null,
    memberEntitlementId: form.washFoldMode ? null : form.memberEntitlementId,
    orderImageId: form.orderImageId,
    deliveryImageId: form.deliveryImageId,
    items: form.washFoldMode ? [] : items,
    washFold: form.washFoldMode
      ? { weightKg: Number(form.washFoldWeightKg), notes: form.washFoldNotes.trim() || null }
      : null,
    missingHangerCount: form.washFoldMode ? 0 : form.missingHangerCount,
    dueAt: dueAtValue.value ? new Date(dueAtValue.value).toISOString() : null,
    discountAmount: form.washFoldMode
      ? sanitizedDiscountAmount.value
      : (form.memberEntitlementId ? sanitizedCashDiscount.value : sanitizedDiscountAmount.value),
    serviceOrderStatus: form.serviceOrderStatus,
    note: form.note.trim() || null,
    slipImageId,
  };
};

const handleSubmit = async () => {
  if (!props.order) return;
  isSubmitting.value = true;
  const body = await buildBody();
  if (!body) {
    isSubmitting.value = false;
    return;
  }
  const ok = await updateServiceOrder(props.order.id, body);
  isSubmitting.value = false;
  if (!ok) return;
  open.value = false;
  emit("updated");
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="แก้ไขรายการรับผ้า"
    description="อัปเดตรายการ บริการ และข้อมูลชำระเงินของงานนี้"
    :ui="{
      content: 'sm:!max-w-none sm:!w-screen sm:!h-screen sm:!max-h-screen sm:!rounded-none bg-default dark:bg-default',
      body: '!p-2 sm:p-4! bg-default dark:bg-default',
      header: 'bg-default dark:bg-default',
      footer: 'bg-default dark:bg-default',
    }"
  >
    <template #body>
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] sm:gap-4">
        <div class="space-y-3 sm:space-y-4">
          <div :class="adminDashboardCardClass">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium text-highlighted">ข้อมูลลูกค้า</p>
                <p class="text-sm text-muted">เลือกสมาชิกในระบบหรือบันทึกลูกค้าหน้าร้าน</p>
              </div>
              <div class="flex items-center gap-2">
                <USwitch v-model="form.isWalkIn" color="warning" />
                <span class="text-sm text-muted">ลูกค้าหน้าร้าน</span>
              </div>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <UFormField v-if="!form.isWalkIn" label="ลูกค้า" required>
                <USelectMenu
                  v-model="form.customerId"
                  :items="customerOptions"
                  value-key="value"
                  label-key="label"
                  searchable
                  :loading="isCustomersLoading"
                  :avatar="getAvatarProps(selectedCustomer)"
                  class="w-full"
                  placeholder="เลือกลูกค้า"
                >
                  <template #item="{ item }">
                    <div class="flex items-center gap-3">
                      <UAvatar v-bind="getAvatarProps(item)" size="sm" />
                      <div class="min-w-0">
                        <p class="truncate font-medium text-highlighted">{{ item.name || item.email }}</p>
                        <p class="truncate text-xs text-muted">
                          {{ item.phoneNumber ? `${item.phoneNumber} | ` : "" }}{{ item.email }}
                        </p>
                      </div>
                    </div>
                  </template>
                  <template #empty>
                    <div class="px-3 py-2 text-sm text-muted">ไม่พบรายชื่อลูกค้า</div>
                  </template>
                </USelectMenu>
              </UFormField>

              <div
                v-if="canUseMemberPackage"
                class="rounded-md border border-default/35 bg-elevated/70 p-3 dark:border-default/25 dark:bg-elevated/45 md:col-span-2"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium text-success">{{ activeMemberEntitlement?.productName }}</p>
                    <p class="text-xs text-muted">
                      เครดิตคงเหลือ {{ activeMemberEntitlement?.creditRemaining ?? 0 }} | ใช้งานครั้งนี้ {{ creditUsedPreview }} เครดิต
                      <span v-if="form.memberEntitlementId && cashQuantity > 0">
                        | คิดเพิ่ม {{ cashQuantity }} ชิ้น ({{ formatCurrency(cashSubtotal) }})
                      </span>
                    </p>
                  </div>
                  <USwitch
                    :model-value="Boolean(form.memberEntitlementId)"
                    color="success"
                    @update:model-value="form.memberEntitlementId = $event ? activeMemberEntitlement?.id ?? null : null"
                  />
                </div>
              </div>

              <template v-if="form.isWalkIn">
                <UFormField label="ชื่อลูกค้าหน้าร้าน" required>
                  <UInput v-model="form.walkInName" class="w-full" placeholder="เช่น คุณสมชาย" />
                </UFormField>
                <UFormField label="เบอร์โทร">
                  <UInput v-model="form.walkInPhone" class="w-full" placeholder="08x-xxx-xxxx" />
                </UFormField>
              </template>

              <UFormField label="วันนัดรับ">
                <div class="space-y-2">
                  <div class="flex flex-wrap gap-1.5">
                    <UButton size="xs" color="neutral" variant="soft" label="พุธ" @click="setPickupDow(3)" />
                    <UButton size="xs" color="neutral" variant="soft" label="เสาร์" @click="setPickupDow(6)" />
                    <UButton size="xs" color="neutral" :variant="dueDate ? 'ghost' : 'solid'" label="ไม่ระบุ" @click="clearDueDate" />
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
                    <button class="underline" type="button" @click="setPickupDow(3)">เลือกวัน</button>
                  </p>
                </div>
              </UFormField>

              <UFormField label="สถานะงาน">
                <USelect v-model="form.serviceOrderStatus" :items="serviceOrderStatusOptions" value-key="value" class="w-full" />
              </UFormField>
            </div>
          </div>

          <div :class="[adminDashboardCardClass, 'border-warning/40! bg-warning/5!']">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-medium text-highlighted">โหมดซัก-พับ ชั่งกิโล</p>
                <p class="text-xs text-muted">
                  {{ formatCurrency(washFoldPricePerKg) }} / กก.<span v-if="washFoldMinKg > 0"> · ขั้นต่ำ {{ washFoldMinKg }} กก.</span>
                </p>
              </div>
              <USwitch v-model="form.washFoldMode" color="warning" />
            </div>
            <div v-if="form.washFoldMode" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <UFormField label="น้ำหนัก (กก.)" required>
                <UInputNumber v-model="form.washFoldWeightKg" :min="0" :step="0.5" class="w-full" />
              </UFormField>
              <UFormField label="หมายเหตุ">
                <UInput v-model="form.washFoldNotes" placeholder="เช่น แยกซัก สีอ่อน-เข้ม" class="w-full" />
              </UFormField>
            </div>
          </div>

          <div :class="adminDashboardCardClass">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium text-highlighted">รายการบริการ</p>
                <p class="text-sm text-muted">เพิ่มบริการที่ลูกค้านำมาส่งซักและกำหนดจำนวน</p>
              </div>
              <UDropdownMenu :items="catalogDropdownItems" :content="{ align: 'end' }" :ui="{ content: 'max-h-80 overflow-y-auto' }">
                <UButton label="เพิ่มรายการ" icon="i-lucide-plus" color="neutral" variant="outline" :loading="isCatalogLoading" />
              </UDropdownMenu>
            </div>

            <div class="mt-3 space-y-1">
              <div v-for="item in formLineItems" :key="item.key">
                <div class="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-elevated/30">
                  <div class="flex min-w-0 flex-1 flex-col">
                    <div class="flex items-center">
                      <p class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ item.label }}</p>
                      <div class="flex items-center justify-end">
                        <span class="w-16 shrink-0 text-right text-xs font-medium text-muted">
                          {{ form.washFoldMode ? "ชั่งกิโล" : (form.memberEntitlementId ? `${item.quantity} เครดิต` : formatCurrency(item.totalPrice)) }}
                        </span>
                        <UButton
                          :icon="expandedItems.has(item.key) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="toggleItemExpand(item.key)"
                        />
                        <UButton icon="i-lucide-x" color="error" variant="ghost" size="xs" @click="removeItemRow(item.key)" />
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-0.5">
                      <UInputNumber :model-value="item.quantity" :step="1" size="xs" class="w-20" @update:model-value="setItemQuantity(item.key, $event)" />
                      <template v-if="isEditRangeItem(item.storefrontPriceId)">
                        <UInput
                          :model-value="item.unitPrice ?? item.unitPrice"
                          type="number"
                          size="xs"
                          class="w-20"
                          :placeholder="`฿${catalogMap.get(item.storefrontPriceId)?.priceMin ?? ''}–${catalogMap.get(item.storefrontPriceId)?.priceMax ?? ''}`"
                          @update:model-value="updateItemUnitPrice(item.key, Number($event))"
                        />
                      </template>
                    </div>
                  </div>
                </div>

                <div v-if="expandedItems.has(item.key)" class="mb-1 ml-1.5 space-y-2 border-l-2 border-default pl-3 pt-1">
                  <p class="text-sm font-medium text-highlighted">{{ item.label }}</p>
                  <UTextarea
                    :model-value="item.notes"
                    :rows="2"
                    class="w-full"
                    placeholder="บันทึกตำหนิหรือรายละเอียดของผ้าชิ้นนี้"
                    @update:model-value="updateItemNotes(item.key, String($event || ''))"
                  />
                  <OrderItemPhotosField :photos="item.photos" :disabled="isSubmitting" @update:photos="updateItemPhotos(item.key, $event)" />
                </div>
              </div>

              <p v-if="formLineItems.length === 0" class="rounded-md border border-dashed border-default p-4 text-center text-sm text-muted">
                ยังไม่ได้เลือกบริการ
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-3 sm:space-y-4">
          <div :class="adminDashboardCardClass">
            <p class="font-medium text-highlighted">สรุปรายการ</p>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted">รายการบริการ</span>
                <span class="font-medium text-highlighted">{{ totalQuantity }} ชิ้น</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted">ค่าบริการ</span>
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
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted">จำนวนไม้แขวน</span>
                <UInputNumber v-model="form.missingHangerCount" :min="0" :step="1" orientation="vertical" class="w-28" />
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted">ค่าไม้แขวน</span>
                <span class="font-medium text-highlighted">{{ formatCurrency(hangerCharge.total) }}</span>
              </div>

              <div class="rounded-md border border-dashed border-default p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-medium text-highlighted">รูปหลักฐานการรับผ้า</p>
                    <p v-if="!intakeDisplayUrl" class="text-sm text-muted">ยังไม่ได้แนบรูป</p>
                  </div>
                  <UButton v-if="!intakeDisplayUrl" label="เพิ่มรูป" icon="i-lucide-camera" color="neutral" variant="solid" @click="openIntakePicker" />
                </div>
                <input ref="intakeFileInputRef" type="file" accept="image/*" capture="environment" class="hidden" @change="onIntakeFileSelected">
                <div v-if="intakeDisplayUrl" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div class="group relative overflow-hidden rounded-md border border-default bg-muted/30">
                    <img :src="intakeDisplayUrl" alt="รูปหลักฐานการรับผ้า" class="h-28 w-full cursor-pointer object-cover" @click="openEditPhotoPreview(intakeDisplayUrl, 'รูปหลักฐานการรับผ้า')">
                    <UButton icon="i-lucide-x" color="error" variant="solid" size="xs" class="absolute right-1 top-1" @click.stop="requestRemoveEditPhoto('intake')" />
                  </div>
                </div>
              </div>

              <div class="rounded-md border border-dashed border-default p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-medium text-highlighted">รูปหลักฐานการส่งผ้า</p>
                    <p v-if="!deliveryDisplayUrl" class="text-sm text-muted">ยังไม่ได้แนบรูป</p>
                  </div>
                  <UButton v-if="!deliveryDisplayUrl" label="เพิ่มรูป" icon="i-lucide-camera" color="neutral" variant="solid" @click="openDeliveryPicker" />
                </div>
                <input ref="deliveryFileInputRef" type="file" accept="image/*" capture="environment" class="hidden" @change="onDeliveryFileSelected">
                <div v-if="deliveryDisplayUrl" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div class="group relative overflow-hidden rounded-md border border-default bg-muted/30">
                    <img :src="deliveryDisplayUrl" alt="รูปหลักฐานการส่งผ้า" class="h-28 w-full cursor-pointer object-cover" @click="openEditPhotoPreview(deliveryDisplayUrl, 'รูปหลักฐานการส่งผ้า')">
                    <UButton icon="i-lucide-x" color="error" variant="solid" size="xs" class="absolute right-1 top-1" @click.stop="requestRemoveEditPhoto('delivery')" />
                  </div>
                </div>
              </div>

              <UFormField label="ส่วนลด">
                <UInputNumber v-model="form.discountAmount" :min="0" :max="subtotalAmount" :step="1" class="w-full" />
              </UFormField>

              <UFormField label="หมายเหตุ">
                <UTextarea v-model="form.note" class="w-full" :rows="3" placeholder="รายละเอียดเพิ่มเติมสำหรับทีมงานหรือใบรับผ้า" />
              </UFormField>

              <div class="flex items-center justify-between gap-3 border-t border-default pt-3 text-base">
                <span class="font-medium text-highlighted">ยอดรวมสุทธิ</span>
                <span class="font-semibold text-primary">{{ formatCurrency(totalAmount) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton label="ยกเลิก" color="neutral" variant="outline" @click="open = false" />
        <UButton label="บันทึกการแก้ไข" icon="i-lucide-save" color="primary" :loading="isSubmitting" @click="handleSubmit" />
      </div>
    </template>
  </UModal>

  <UIImagePreviewModal
    v-model:open="editPhotoPreviewOpen"
    :title="editPhotoPreviewTitle"
    :image-url="editPhotoPreviewUrl"
    :image-alt="editPhotoPreviewTitle"
  />

  <UIConfirmModal
    v-model:open="editPhotoRemoveOpen"
    title="ลบรูปนี้"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบรูป"
    confirm-color="error"
    message="ต้องการลบรูปนี้หรือไม่"
    sub-message="หากยืนยันแล้ว รูปจะถูกถอดออกจากรายการ"
    @confirm="performRemoveEditPhoto"
  />

  <UModal v-model:open="editPriceInputOpen" title="กรอกราคา" :ui="{ content: 'max-w-sm' }">
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          ช่วงราคา:
          <span class="font-medium text-highlighted">
            ฿{{ editPriceInputMin?.toLocaleString() }}–{{ editPriceInputMax?.toLocaleString() }}
          </span>
        </p>
        <UFormField label="ราคา (บาท)" required>
          <UInput
            v-model.number="editPriceInputValue"
            type="number"
            :min="editPriceInputMin ?? 0"
            :max="editPriceInputMax ?? undefined"
            class="w-full"
            autofocus
            @keydown.enter.prevent="confirmEditPriceInput"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="editPriceInputOpen = false">ยกเลิก</UButton>
        <UButton icon="i-lucide-plus" @click="confirmEditPriceInput">เพิ่มในรายการ</UButton>
      </div>
    </template>
  </UModal>
</template>
