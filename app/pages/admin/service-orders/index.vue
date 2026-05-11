<script setup lang="ts">
import { CalendarDate, parseDate } from "@internationalized/date";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import OrderItemPhotosField, { type OrderItemPhoto } from "~~/app/components/admin/pos/OrderItemPhotosField.vue";
import EditPaymentStateModal from "~~/app/components/admin/payment/EditPaymentStateModal.vue";
import type { PaymentSlipImage } from "~~/app/composables/useAdminPayments";
import type {
  AdminServiceOrder,
  CreateAdminServiceOrderBody,
} from "~~/app/composables/useAdminServiceOrders";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { useBusinessSetting } from "~~/app/composables/useBusinessSetting";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import { adminTableUi, getAdminListCardClass, type AdminCardTone } from "~~/shared/config/adminUi";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UDropdownMenu = resolveComponent("UDropdownMenu");

type TableRow<T> = { original: T; toggleSelected: (value: boolean) => void };
type TableApi = {
  getFilteredSelectedRowModel: () => { rows: TableRow<AdminServiceOrder>[] };
  getRowModel: () => { rows: TableRow<AdminServiceOrder>[] };
  resetRowSelection: () => void;
};
type TableInstance = { tableApi?: TableApi };
type CustomerTypeFilter = "all" | "walk-in" | "member" | "monthly";
type FormItemState = {
  key: string;
  storefrontPriceId: string;
  unitPrice?: number;
  quantity: number;
  notes: string;
  photos: OrderItemPhoto[];
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

const serviceOrderStatusOptions: Array<{ label: string; value: ServiceOrderStatus }> = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];
const orderStatusCardTone: Record<ServiceOrderStatus, AdminCardTone> = {
  RECEIVED: "info",
  PROCESSING: "primary",
  DELIVERING: "warning",
  COMPLETED: "neutral",
  CANCELLED: "error",
};

const table = useTemplateRef<TableInstance>("table");
const rowSelection = ref<Record<string, boolean>>({});
const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});

const {
  serviceOrders,
  isLoading,
  refresh,
  createServiceOrder,
  updateServiceOrder,
  updateServiceOrderStatus,
  deleteServiceOrder,
  uploadOrderImage,
} = useAdminServiceOrders();
const { customers, isLoading: isCustomersLoading } = useAdminCustomerOptions();
const { items: catalogItems, isLoading: isCatalogLoading } = useStorefrontCatalog();
const { uploadSlip } = useAdminPayments();
const notify = useNotify();
const route = useRoute();

onActivated(async () => {
  await refresh();
});

const searchQuery = ref("");
const statusFilter = ref<ServiceOrderStatus | "all">("all");
const customerTypeFilter = ref<CustomerTypeFilter>("all");

watch(
  () => route.query.status,
  (value) => {
    const nextStatus = Array.isArray(value) ? value[0] : value;
    statusFilter.value = serviceOrderStatusOptions.some((item) => item.value === nextStatus)
      ? (nextStatus as ServiceOrderStatus)
      : "all";
  },
  { immediate: true },
);

const filteredServiceOrders = computed<AdminServiceOrder[]>(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return (serviceOrders.value ?? []).filter((order) => {
    const matchKeyword = keyword
      ? [
          order.orderNo ?? "",
          order.customer.name ?? "",
          order.customer.email,
          order.customer.phoneNumber ?? "",
          order.note ?? "",
          ...order.items.map((item) => item.label),
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      : true;

    const matchStatus = statusFilter.value === "all" || order.status === statusFilter.value;
    const matchCustomerType = (() => {
      if (customerTypeFilter.value === "all") return true;
      if (customerTypeFilter.value === "walk-in") return order.isWalkIn;
      if (customerTypeFilter.value === "monthly") return Boolean(order.memberEntitlement);
      return !order.isWalkIn;
    })();

    return matchKeyword && matchStatus && matchCustomerType;
  });
});

const selectedRows = computed<TableRow<AdminServiceOrder>[]>(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [];
});
const selectedOrders = computed<AdminServiceOrder[]>(() => selectedRows.value.map((row) => row.original));
const selectedRowsCount = computed(() => selectedOrders.value.length);
const filteredRowCount = computed(() => filteredServiceOrders.value.length);

const setPage = (page: number) => {
  pagination.value = { ...pagination.value, pageIndex: page - 1 };
};

watch([searchQuery, statusFilter, customerTypeFilter], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 };
  rowSelection.value = {};
});

watch(() => pagination.value.pageIndex, () => {
  rowSelection.value = {};
});

const currentPageRange = computed(() => {
  const total = filteredRowCount.value;
  if (!total) return { start: 0, end: 0, total: 0 };

  const start = pagination.value.pageIndex * pagination.value.pageSize + 1;
  const end = Math.min(total, start + pagination.value.pageSize - 1);
  return { start, end, total };
});

const paginationSummary = computed(() => {
  const { start, end, total } = currentPageRange.value;
  if (!total) return "ไม่พบรายการ";
  if (!selectedRowsCount.value) return `แสดง ${start}-${end} จาก ${total} รายการ`;
  return `แสดง ${start}-${end} จาก ${total} รายการ | เลือก ${selectedRowsCount.value} รายการ`;
});

const paginatedServiceOrders = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize;
  return filteredServiceOrders.value.slice(start, start + pagination.value.pageSize);
});

const getMobileRowId = (index: number) => String(pagination.value.pageIndex * pagination.value.pageSize + index);
const isMobileRowSelected = (index: number) => Boolean(rowSelection.value[getMobileRowId(index)]);
const setMobileRowSelected = (index: number, value: boolean | "indeterminate") => {
  const rowId = getMobileRowId(index);
  rowSelection.value = {
    ...rowSelection.value,
    [rowId]: !!value,
  };
  if (!value) {
    const next = { ...rowSelection.value };
    delete next[rowId];
    rowSelection.value = next;
  }
};

const getAvatarProps = (customer?: Pick<CustomerOption, "image" | "name" | "email"> | AdminServiceOrder["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const formatItemSummary = (order: AdminServiceOrder) => {
  const items = order.items.slice(0, 2).map((item) => `${item.label} x${item.quantity}`);
  if (order.items.length > 2) items.push(`+ อีก ${order.items.length - 2} รายการ`);
  return items;
};
const formatOptionalDateTime = (value: string | null | undefined) => value ? formatDateTime(value) : "-";

const openDocument = (order: AdminServiceOrder) => {
  const paymentId = order.payment?.id;
  if (!paymentId) return navigateTo(`/admin/service-orders/${order.id}/intake`);
  const path = order.payment?.status === "PAID" ? "receipt" : "quotation";
  return navigateTo(`/admin/payment/${paymentId}/${path}`);
};

const isStatusOpen = ref(false);
const isUpdatingStatus = ref(false);
const statusTarget = ref<AdminServiceOrder | null>(null);
const statusDraft = ref<ServiceOrderStatus>("RECEIVED");
const deliveryImageFile = ref<File | null>(null);
const uploadedDeliveryImage = ref<AdminServiceOrder["image"] | null>(null);

type AddonPickerEntry = {
  entitlementId: string;
  productName: string;
  creditRemaining: number;
  selected: boolean;
  credits: number;
};
const addonPickerEntries = ref<AddonPickerEntry[]>([]);
const isLoadingAddons = ref(false);

const loadAddonEntitlements = async (order: AdminServiceOrder) => {
  addonPickerEntries.value = [];
  if (order.isWalkIn) return;
  isLoadingAddons.value = true;
  try {
    const result = await $fetch<{
      addonEntitlements?: Array<{
        id: string;
        creditRemaining: number | null;
        product: { name: string };
      }>;
    }>("/api/admin/service-orders/lookup", { query: { q: order.id } });
    addonPickerEntries.value = (result.addonEntitlements ?? [])
      .filter((e) => (e.creditRemaining ?? 0) > 0)
      .map((e) => ({
        entitlementId: e.id,
        productName: e.product.name,
        creditRemaining: e.creditRemaining ?? 0,
        selected: false,
        credits: 1,
      }));
  } catch {
    addonPickerEntries.value = [];
  } finally {
    isLoadingAddons.value = false;
  }
};

const openStatusModal = (order: AdminServiceOrder) => {
  statusTarget.value = order;
  statusDraft.value = order.status;
  deliveryImageFile.value = null;
  uploadedDeliveryImage.value = order.deliveryImage ?? null;
  addonPickerEntries.value = [];
  isStatusOpen.value = true;
  void loadAddonEntitlements(order);
};
const handleRemoveDeliveryImage = () => {
  deliveryImageFile.value = null;
  uploadedDeliveryImage.value = null;
};
const confirmStatusUpdate = async () => {
  if (!statusTarget.value) return;

  const addonUsages: Array<{ entitlementId: string; credits: number }> = [];
  const isTransitionToCompleted = statusDraft.value === "COMPLETED" && statusTarget.value.status !== "COMPLETED";
  if (isTransitionToCompleted) {
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
  }

  isUpdatingStatus.value = true;
  let deliveryImageId: string | null | undefined = undefined;
  if (statusDraft.value === "COMPLETED") {
    if (deliveryImageFile.value) {
      const uploaded = await uploadOrderImage(deliveryImageFile.value);
      if (!uploaded) {
        isUpdatingStatus.value = false;
        return;
      }
      uploadedDeliveryImage.value = uploaded;
      deliveryImageId = uploaded.id;
    } else {
      deliveryImageId = uploadedDeliveryImage.value?.id ?? null;
    }
  } else {
    deliveryImageId = null;
  }
  const ok = await updateServiceOrderStatus(statusTarget.value.id, statusDraft.value, { deliveryImageId, addonUsages });
  isUpdatingStatus.value = false;
  if (ok) {
    isStatusOpen.value = false;
    statusTarget.value = null;
    deliveryImageFile.value = null;
    uploadedDeliveryImage.value = null;
    addonPickerEntries.value = [];
  }
};

const isDeleteOpen = ref(false);
const isBulkDeleteOpen = ref(false);
const isDeleting = ref(false);
const deletingOrder = ref<AdminServiceOrder | null>(null);

const openDeleteModal = (order: AdminServiceOrder) => {
  deletingOrder.value = order;
  isDeleteOpen.value = true;
};

const confirmDelete = async () => {
  if (!deletingOrder.value) return;
  isDeleting.value = true;
  const ok = await deleteServiceOrder(deletingOrder.value.id);
  isDeleting.value = false;

  if (ok) {
    deletingOrder.value = null;
    isDeleteOpen.value = false;
  }
};

const handleOrderDeselected = (order: AdminServiceOrder) => {
  const rows = table.value?.tableApi?.getRowModel().rows ?? [];
  const rowIndex = rows.findIndex((row) => row.original.id === order.id);
  if (rowIndex >= 0) rows[rowIndex]?.toggleSelected(false);
};

const confirmBulkDelete = async () => {
  if (!selectedOrders.value.length) return;

  isDeleting.value = true;
  for (const order of selectedOrders.value) {
    await deleteServiceOrder(order.id);
  }
  isDeleting.value = false;

  table.value?.tableApi?.resetRowSelection();
  isBulkDeleteOpen.value = false;
};

const isFormOpen = ref(false);
const isSubmitting = ref(false);
const editingOrder = ref<AdminServiceOrder | null>(null);
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<PaymentSlipImage | null>(null);
const orderImageFile = ref<File | null>(null);
const uploadedOrderImage = ref<AdminServiceOrder["image"] | null>(null);
const editDeliveryImageFile = ref<File | null>(null);
const uploadedEditDeliveryImage = ref<AdminServiceOrder["image"] | null>(null);

const intakeFileInputRef = ref<HTMLInputElement | null>(null);
const deliveryFileInputRef = ref<HTMLInputElement | null>(null);
const intakeObjectUrl = ref<string>("");
const deliveryObjectUrl = ref<string>("");
const editPhotoPreviewOpen = ref(false);
const editPhotoPreviewUrl = ref("");
const editPhotoPreviewTitle = ref("");
const editPhotoRemoveOpen = ref(false);
const editPhotoRemoveTarget = ref<"intake" | "delivery" | null>(null);

watch(orderImageFile, (file) => {
  if (intakeObjectUrl.value && import.meta.client) URL.revokeObjectURL(intakeObjectUrl.value);
  intakeObjectUrl.value = file && import.meta.client ? URL.createObjectURL(file) : "";
});
watch(editDeliveryImageFile, (file) => {
  if (deliveryObjectUrl.value && import.meta.client) URL.revokeObjectURL(deliveryObjectUrl.value);
  deliveryObjectUrl.value = file && import.meta.client ? URL.createObjectURL(file) : "";
});

const intakeDisplayUrl = computed(
  () => uploadedOrderImage.value?.secureUrl || uploadedOrderImage.value?.url || intakeObjectUrl.value || "",
);
const deliveryDisplayUrl = computed(
  () => uploadedEditDeliveryImage.value?.secureUrl || uploadedEditDeliveryImage.value?.url || deliveryObjectUrl.value || "",
);

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
let itemKeySeed = 0;
const createItemKey = () => `service-order-item-${++itemKeySeed}`;

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
const dueDate = shallowRef<CalendarDate | null>(null);
const dueTime = ref("00:00");

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

const catalogOptions = computed(() =>
  (catalogItems.value ?? []).map((item) => ({
    label: item.label,
    description: item.categoryName ? `${item.categoryName} | ${item.serviceName}` : item.serviceName,
    value: item.id,
  })),
);

const catalogMap = computed(() => new Map((catalogItems.value ?? []).map((item) => [item.id, item])));

const formLineItems = computed(() =>
  formItems.value
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

const { hangerPricePerUnit, washFoldPricePerKg, washFoldMinKg } = useBusinessSetting();
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
const dueDateLabel = computed(() => {
  if (!dueDate.value) return "เลือกวันที่";
  const dd = String(dueDate.value.day).padStart(2, "0");
  const mm = String(dueDate.value.month).padStart(2, "0");
  return `${dd}/${mm}/${dueDate.value.year}`;
});

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

watch(() => isFormOpen.value, (open) => {
  if (!open) {
    editingOrder.value = null;
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
  }
});

// Price-input modal for range items inside edit modal
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
    (i) => i.storefrontPriceId === priceId && (i.unitPrice ?? catalogMap.value.get(priceId)?.price) === price
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
  if (isEditRangeItem(storefrontPriceId)) { openEditPriceInput(storefrontPriceId); return; }
  const existing = formItems.value.find((item) => item.storefrontPriceId === storefrontPriceId);
  if (existing) {
    existing.quantity += 1;
    formItems.value = [existing, ...formItems.value.filter((item) => item.key !== existing.key)];
    return;
  }

  formItems.value = [
    {
      key: createItemKey(),
      storefrontPriceId,
      quantity: 1,
      notes: "",
      photos: [],
    },
    ...formItems.value,
  ];
};

const removeItemRow = (key: string) => {
  formItems.value = formItems.value.filter((item) => item.key !== key);
  const next = new Set(expandedItems.value);
  next.delete(key);
  expandedItems.value = next;
};

const updateItemField = (key: string, field: "storefrontPriceId" | "quantity", value: string | number) => {
  const target = formItems.value.find((item) => item.key === key);
  if (!target) return;

  if (field === "storefrontPriceId") {
    target.storefrontPriceId = String(value);
    return;
  }

  const nextQuantity = Number(value ?? 1);
  target.quantity = Number.isInteger(nextQuantity) && nextQuantity > 0 ? nextQuantity : 1;
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

let photoKeySeed = 0;
const createPhotoKey = () => `edit-order-photo-${Date.now()}-${++photoKeySeed}`;

const catalogDropdownItems = computed<CatalogMenuItem[][]>(() => {
  const items = (catalogItems.value ?? []).map((item) => ({
    label: item.label,
    description: item.categoryName ? `${item.categoryName} | ${item.serviceName}` : item.serviceName,
    icon: "i-lucide-plus",
    onSelect: () => addCatalogItemToTop(item.id),
  }));

  if (!items.length) {
    return [[{ label: "ไม่พบบริการ", icon: "i-lucide-ban", onSelect: () => {} }]];
  }

  return [items];
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

const openEditModal = (order: AdminServiceOrder) => {
  editingOrder.value = order;
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
      unitPrice: catalogPrice != null && item.unitPrice !== catalogPrice ? item.unitPrice : undefined,
      quantity: item.quantity,
      notes: item.notes || "",
      photos: existingPhotos,
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
  isFormOpen.value = true;
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

watch(
  () => form.hangerCount,
  (value) => {
    if (value !== form.missingHangerCount) {
      form.missingHangerCount = value;
    }
  },
);

watch(
  () => form.missingHangerCount,
  (value) => {
    if (value !== form.hangerCount) {
      form.hangerCount = value;
    }
  },
);

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

const openDetailPage = (order: AdminServiceOrder) => navigateTo(`/admin/service-orders/${order.id}`);
const openCustomerPage = (order: AdminServiceOrder, e: MouseEvent) => {
  e.stopPropagation();
  if (order.customer?.id) navigateTo(`/admin/users/${order.customer.id}`);
};

const handleSubmit = async () => {
  isSubmitting.value = true;
  const body = await buildBody();
  if (!body) {
    isSubmitting.value = false;
    return;
  }

  const ok = editingOrder.value
    ? await updateServiceOrder(editingOrder.value.id, body)
    : Boolean(await createServiceOrder(body));

  isSubmitting.value = false;

  if (ok) {
    isFormOpen.value = false;
  }
};

const editPaymentOpen = ref(false);
const editPaymentTarget = ref<AdminServiceOrder | null>(null);
const openEditPaymentModal = (order: AdminServiceOrder) => {
  if (!order.payment?.id) return;
  editPaymentTarget.value = order;
  editPaymentOpen.value = true;
};
const onPaymentUpdated = async () => {
  await refresh();
};

const getActionItems = (order: AdminServiceOrder) => {
  const primaryItems: Array<Record<string, unknown>> = [
    { label: "แก้ไขรายการ", icon: "i-lucide-pencil", onSelect: () => openEditModal(order) },
    order.payment?.status === "PAID"
      ? { label: "ดูใบเสร็จ", icon: "i-lucide-receipt", onSelect: () => openDocument(order) }
      : { label: "ดูใบแจ้งราคา", icon: "i-lucide-file-text", onSelect: () => openDocument(order) },
  ];
  if (order.payment?.id && order.status !== "COMPLETED") {
    primaryItems.push({
      label: "แก้ไขการชำระเงิน",
      icon: "i-lucide-credit-card",
      onSelect: () => openEditPaymentModal(order),
    });
  }
  return [
    primaryItems,
    [
      { label: "ลบรายการ", icon: "i-lucide-trash-2", color: "error", onSelect: () => openDeleteModal(order) },
    ],
  ];
};

const columns: TableColumn<AdminServiceOrder>[] = [
  {
    id: "select",
    header: ({ table }) =>
      h("div", [
        h(UCheckbox, {
          modelValue: table.getIsSomePageRowsSelected() ? "indeterminate" : table.getIsAllPageRowsSelected(),
          "onUpdate:modelValue": (value: boolean | "indeterminate") => table.toggleAllPageRowsSelected(!!value),
          ariaLabel: "เลือกทั้งหมด",
        }),
      ]),
    cell: ({ row }) =>
      h("div", [
        h(UCheckbox, {
          modelValue: row.getIsSelected(),
          "onUpdate:modelValue": (value: boolean | "indeterminate") => row.toggleSelected(!!value),
          ariaLabel: "เลือกรายการ",
        }),
      ]),
  },
  {
    accessorKey: "orderNo",
    header: "เลขรับผ้า",
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted cursor-pointer hover:underline", onClick: (e: MouseEvent) => { e.stopPropagation(); openDetailPage(row.original); } }, row.original.orderNo || row.original.id),
  },
  {
    accessorKey: "customer",
    header: "ลูกค้า",
    cell: ({ row }) => {
      const customer = row.original.customer;
      const entitlement = row.original.memberEntitlement;
      return h("div", { class: "flex items-center gap-3 cursor-pointer", onClick: (e: MouseEvent) => openCustomerPage(row.original, e) }, [
        h(UAvatar, { ...getAvatarProps(customer) }),
        h("div", { class: "space-y-0.5" }, [
          h("div", { class: "flex flex-wrap items-center gap-1.5" }, [
            h("p", { class: "font-medium text-highlighted hover:underline" }, customer.name || "-"),
            entitlement
              ? h(UBadge, { color: "success", variant: "subtle", size: "xs" }, () => "รายเดือน")
              : null,
          ]),
          h("p", { class: "text-xs text-muted" }, customer.phoneNumber || (row.original.isWalkIn ? "ลูกค้าหน้าร้าน" : customer.email)),
        ]),
      ]);
    },
  },
  {
    id: "items",
    header: "รายการ",
    cell: ({ row }) =>
      h(
        "div",
        { class: "space-y-1" },
        formatItemSummary(row.original).map((item) => h("p", { class: "text-sm text-highlighted" }, item)),
      ),
  },
  {
    id: "amount",
    header: () => h("div", { class: "text-right" }, "ยอด / เครดิต"),
    cell: ({ row }) => {
      const order = row.original;
      const entitlement = order.memberEntitlement;
      const total = Number(order.totalAmount ?? 0);
      const used = order.creditUsed ?? 0;
      const initial = entitlement?.creditInitial ?? 0;
      const isMemberZero = Boolean(entitlement) && total === 0;

      if (isMemberZero) {
        return h("div", { class: "space-y-0.5 text-right" }, [
          h("p", { class: "text-sm font-medium text-success" }, "ใช้เครดิต"),
          h("p", { class: "text-xs text-muted" }, `${used} / ${initial} เครดิต`),
        ]);
      }

      return h("div", { class: "space-y-0.5 text-right" }, [
        h("p", { class: "text-sm font-medium text-highlighted" }, formatCurrency(total)),
        entitlement ? h("p", { class: "text-xs text-success" }, `ใช้ ${used} เครดิต`) : null,
      ]);
    },
  },
  {
    id: "status",
    header: "สถานะ",
    cell: ({ row }) => {
      const order = row.original;
      return h(UBadge, { color: orderStatusColors[order.status], variant: "subtle", icon: "i-lucide-pencil", class: "cursor-pointer", onClick: (e: MouseEvent) => { e.stopPropagation(); openStatusModal(order); } }, () => orderStatusLabels[order.status]);
    },
  },
  {
    id: "dates",
    header: "วัน",
    cell: ({ row }) => {
      const order = row.original;
      const isCompleted = order.status === "COMPLETED";
      const deliveredAt = order.payment?.paidAt ?? order.dueAt ?? null;
      return h("div", { class: "space-y-0.5 text-sm" }, [
        h("p", { class: "text-highlighted" }, `รับ: ${formatDateTime(order.receivedAt)}`),
        isCompleted
          ? (deliveredAt ? h("p", { class: "text-xs text-muted" }, `ส่ง: ${formatDateTime(deliveredAt)}`) : null)
          : (order.dueAt ? h("p", { class: "text-xs text-muted" }, `นัด: ${formatDateTime(order.dueAt)}`) : null),
      ]);
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const order = row.original;

      return h("div", { class: "flex items-center justify-end gap-1" }, [
        h(UButton, {
          icon: "i-lucide-eye",
          size: "xs",
          color: "neutral",
          variant: "ghost",
          title: "ดูรายละเอียดรายการรับผ้า",
          onClick: () => openDetailPage(order),
        }),
        h(UButton, {
          icon: "i-lucide-refresh-ccw",
          size: "xs",
          color: "primary",
          variant: "ghost",
          title: "อัพเดทสถานะงาน",
          onClick: () => openStatusModal(order),
        }),
        h(
          UDropdownMenu,
          { items: getActionItems(order), content: { align: "end" } },
          {
            default: () =>
              h(UButton, {
                icon: "i-lucide-ellipsis",
                size: "xs",
                color: "neutral",
                variant: "ghost",
                title: "เมนูเพิ่มเติม",
              }),
          },
        ),
      ]);
    },
  },
];
</script>

<template>
    <UDashboardPanel id="service-orders">
    <template #header>
      <UDashboardNavbar title="รายการรับผ้า" icon="i-lucide-shopping-basket">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <!-- <UButton
              label="สแกนสถานะผ้า"
              icon="i-lucide-scan-line"
              color="neutral"
              variant="outline"
              class="shrink-0"
              aria-label="สแกนสถานะผ้า"
              :ui="{ label: 'hidden sm:inline' }"
              to="/admin/service-orders/scan"
            /> -->
            <UButton
              label="เพิ่มรายการรับผ้า"
              icon="i-lucide-plus"
              color="primary"
              class="shrink-0"
              aria-label="เพิ่มรายการรับผ้า"
              :ui="{ label: 'hidden sm:inline' }"
              to="/admin/sales"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ClientOnly>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <UInput
              v-model="searchQuery"
              class="w-full md:max-w-sm"
              icon="i-lucide-search"
              placeholder="ค้นหาเลขรับผ้า ลูกค้า เบอร์โทร หรือชื่อรายการ"
            />

            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="selectedRowsCount"
                label="ลบ"
                color="error"
                variant="subtle"
                icon="i-lucide-trash"
                @click="isBulkDeleteOpen = true"
              >
                <template #trailing>
                  <UKbd>{{ selectedRowsCount }}</UKbd>
                </template>
              </UButton>

              <USelect
                v-model="customerTypeFilter"
                :items="[
                  { label: 'ลูกค้าทุกประเภท', value: 'all' },
                  { label: 'ลูกค้าหน้าร้าน', value: 'walk-in' },
                  { label: 'สมาชิก/ลูกค้าระบบ', value: 'member' },
                  { label: 'ลูกค้ารายเดือน', value: 'monthly' },
                ]"
                value-key="value"
                class="min-w-40"
              />
              <USelect
                v-model="statusFilter"
                :items="[{ label: 'ทุกสถานะงาน', value: 'all' }, ...serviceOrderStatusOptions]"
                value-key="value"
                class="min-w-36"
              />
              <UIButtonRefresh :loading="isLoading" @refresh="refresh" />
            </div>
          </div>

          <div class="md:hidden">
            <div v-if="isLoading" class="space-y-3">
              <USkeleton v-for="i in 5" :key="i" class="h-40 w-full rounded-xl" />
            </div>

            <div v-else-if="!paginatedServiceOrders.length" class="flex flex-col items-center justify-center rounded-xl border border-dashed border-default py-12 text-center text-muted">
              <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบรายการรับผ้า</p>
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="(order, index) in paginatedServiceOrders"
                :key="order.id"
                :class="getAdminListCardClass(orderStatusCardTone[order.status])"
              >
                <div class="flex items-start gap-3">
                  <UCheckbox
                    :model-value="isMobileRowSelected(index)"
                    aria-label="เลือกรายการ"
                    class="mt-1"
                    @update:model-value="setMobileRowSelected(index, $event)"
                  />

                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <div class="min-w-0">
                        <button
                          type="button"
                          class="break-all font-mono text-xs text-muted hover:underline"
                          @click="openDetailPage(order)"
                        >
                          {{ order.orderNo || order.id }}
                        </button>
                        <button
                          type="button"
                          class="mt-1 flex min-w-0 items-center gap-2 text-left"
                          @click="openCustomerPage(order, $event)"
                        >
                          <UAvatar v-bind="getAvatarProps(order.customer)" size="sm" class="shrink-0" />
                          <span class="min-w-0">
                            <span class="block truncate text-sm font-medium text-highlighted">{{ order.customer.name || "-" }}</span>
                            <span class="block truncate text-xs text-muted">
                              {{ order.customer.phoneNumber || (order.isWalkIn ? "ลูกค้าหน้าร้าน" : order.customer.email) }}
                            </span>
                          </span>
                        </button>
                      </div>

                      <button
                        type="button"
                        class="shrink-0 inline-flex cursor-pointer items-center gap-1 rounded-full px-1 py-0.5 transition hover:bg-elevated/60"
                        title="คลิกเพื่ออัพเดทสถานะงาน"
                        aria-label="อัพเดทสถานะงาน"
                        @click="openStatusModal(order)"
                      >
                        <UBadge :color="orderStatusColors[order.status]" variant="subtle" icon="i-lucide-pencil">
                          {{ orderStatusLabels[order.status] }}
                        </UBadge>
                      </button>
                    </div>

                    <div class="mt-3 space-y-1 border-t border-default pt-3">
                      <p v-for="item in formatItemSummary(order)" :key="item" class="text-sm text-highlighted">
                        {{ item }}
                      </p>
                    </div>

                    <div class="mt-3 grid grid-cols-3 gap-2 border-t border-default pt-3 text-xs">
                      <div>
                        <p class="text-muted">ยอด/เครดิต</p>
                        <p v-if="order.memberEntitlement && Number(order.totalAmount ?? 0) === 0" class="mt-1 font-semibold text-success">
                          ใช้เครดิต
                        </p>
                        <p v-else class="mt-1 font-semibold text-highlighted">{{ formatCurrency(Number(order.totalAmount ?? 0)) }}</p>
                        <p v-if="order.memberEntitlement" class="mt-0.5 text-success">
                          {{ order.creditUsed ?? 0 }} เครดิต
                        </p>
                      </div>
                      <div>
                        <p class="text-muted">รับ</p>
                        <p class="mt-1 text-highlighted">{{ formatOptionalDateTime(order.receivedAt) }}</p>
                      </div>
                      <div>
                        <p class="text-muted">{{ order.status === "COMPLETED" ? "ส่ง" : "นัด" }}</p>
                        <p class="mt-1 text-highlighted">
                          {{ formatOptionalDateTime((order.status === "COMPLETED" ? order.payment?.paidAt : order.dueAt) || order.dueAt) }}
                        </p>
                      </div>
                    </div>

                    <div class="mt-3 flex items-center justify-end gap-1 border-t border-default pt-3">
                      <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายละเอียดรายการรับผ้า" @click="openDetailPage(order)" />
                      <UButton icon="i-lucide-refresh-ccw" size="xs" color="primary" variant="ghost" aria-label="อัพเดทสถานะงาน" @click="openStatusModal(order)" />
                      <UDropdownMenu :items="getActionItems(order)" :content="{ align: 'end' }">
                        <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" aria-label="เมนูเพิ่มเติม" />
                      </UDropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <UTable
            ref="table"
            v-model:row-selection="rowSelection"
            v-model:pagination="pagination"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            :data="filteredServiceOrders"
            :columns="columns"
            :loading="isLoading"
            class="hidden md:block"
            :ui="adminTableUi"
          >
            <template #empty>
              <div class="flex flex-col items-center justify-center py-12 text-center text-muted">
                <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
                <p>ไม่พบรายการรับผ้า</p>
              </div>
            </template>
          </UTable>

          <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <div class="text-sm text-muted">
              {{ paginationSummary }}
            </div>

            <UPagination
              :page="pagination.pageIndex + 1"
              :items-per-page="pagination.pageSize"
              :total="filteredRowCount"
              @update:page="setPage"
            />
          </div>
        </div>

        <template #fallback>
          <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <USkeleton class="h-10 w-full md:max-w-sm" />
              <div class="flex gap-2">
                <USkeleton class="h-10 w-28" />
                <USkeleton class="h-10 w-28" />
                <USkeleton class="h-10 w-28" />
              </div>
            </div>
            <USkeleton class="h-105 w-full rounded-xl" />
          </div>
        </template>
      </ClientOnly>
    </template>
    </UDashboardPanel>

    <ClientOnly>
      <UModal
      v-model:open="isFormOpen"
      title="แก้ไขรายการรับผ้า"
      description="อัปเดตรายการ บริการ และข้อมูลชำระเงินของงานนี้"
      :ui="{ content: 'max-w-5xl' }"
    >
      <template #body>
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div class="space-y-5">
            <div class="rounded-2xl border border-default p-4">
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
                  class="rounded-xl border border-default/35 bg-elevated/70 p-3 dark:border-default/25 dark:bg-elevated/45 md:col-span-2"
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
                      <USelect
                        v-model="dueTime"
                        :items="dueTimeOptions"
                        value-key="value"
                        icon="i-lucide-clock"
                        class="w-full"
                      />
                    </div>
                    <p v-else class="text-xs text-muted">ไม่ระบุวันนัด — กดพุธ / เสาร์ หรือ
                      <button class="underline" type="button" @click="setPickupDow(3)">เลือกวัน</button>
                    </p>
                  </div>
                </UFormField>

                <UFormField label="สถานะงาน">
                  <USelect
                    v-model="form.serviceOrderStatus"
                    :items="serviceOrderStatusOptions"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <div class="rounded-2xl border border-warning/40 bg-warning/5 p-4">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p class="font-medium text-highlighted">โหมดซัก-พับ ชั่งกิโล</p>
                  <p class="text-xs text-muted">
                    {{ formatCurrency(washFoldPricePerKg) }} / กก.<span v-if="washFoldMinKg > 0"> · ขั้นต่ำ {{ washFoldMinKg }} กก.</span>
                  </p>
                </div>
                <USwitch v-model="form.washFoldMode" color="warning" />
              </div>
              <div v-if="form.washFoldMode" class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormField label="น้ำหนัก (กก.)" required>
                  <UInputNumber v-model="form.washFoldWeightKg" :min="0" :step="0.5" class="w-full" />
                </UFormField>
                <UFormField label="หมายเหตุ">
                  <UInput v-model="form.washFoldNotes" placeholder="เช่น แยกซัก สีอ่อน-เข้ม" class="w-full" />
                </UFormField>
              </div>
            </div>

            <div class="rounded-2xl border border-default p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="font-medium text-highlighted">รายการบริการ</p>
                  <p class="text-sm text-muted">เพิ่มบริการที่ลูกค้านำมาส่งซักและกำหนดจำนวน</p>
                </div>
                <UDropdownMenu
                  :items="catalogDropdownItems"
                  :content="{ align: 'end' }"
                  :ui="{ content: 'max-h-80 overflow-y-auto' }"
                >
                  <UButton
                  label="เพิ่มรายการ"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  :loading="isCatalogLoading"
                  />
                </UDropdownMenu>
              </div>

              <div class="mt-3 space-y-1">
                <div
                  v-for="item in formLineItems"
                  :key="item.key"
                >
                  <div class="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-elevated/30">
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
                          <UButton
                            icon="i-lucide-x"
                            color="error"
                            variant="ghost"
                            size="xs"
                            @click="removeItemRow(item.key)"
                          />
                        </div>
                      </div>
                      <div class="flex shrink-0 items-center gap-0.5">
                        <UInputNumber
                          :model-value="item.quantity"
                          :step="1"
                          size="xs"
                          class="w-20"
                          @update:model-value="setItemQuantity(item.key, $event)"
                        />
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
                    <OrderItemPhotosField
                      :photos="item.photos"
                      :disabled="isSubmitting"
                      @update:photos="updateItemPhotos(item.key, $event)"
                    />
                  </div>
                </div>

                <p v-if="formLineItems.length === 0" class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted">
                  ยังไม่ได้เลือกบริการ
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-5">
            <div class="rounded-2xl border border-default p-4">
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
                  <UInputNumber
                    v-model="form.missingHangerCount"
                    :min="0"
                    :step="1"
                    orientation="vertical"
                    class="w-28"
                  />
                </div>

                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted">ค่าไม้แขวน</span>
                  <span class="font-medium text-highlighted">{{ formatCurrency(hangerCharge.total) }}</span>
                </div>

                <div class="rounded-xl border border-dashed border-default p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="font-medium text-highlighted">รูปหลักฐานการรับผ้า</p>
                      <p v-if="!intakeDisplayUrl" class="text-sm text-muted">ยังไม่ได้แนบรูป</p>
                    </div>
                    <UButton
                      v-if="!intakeDisplayUrl"
                      label="เพิ่มรูป"
                      icon="i-lucide-camera"
                      color="neutral"
                      variant="solid"
                      @click="openIntakePicker"
                    />
                  </div>
                  <input
                    ref="intakeFileInputRef"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    @change="onIntakeFileSelected"
                  >
                  <div v-if="intakeDisplayUrl" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div class="group relative overflow-hidden rounded-xl border border-default bg-muted/30">
                      <img
                        :src="intakeDisplayUrl"
                        alt="รูปหลักฐานการรับผ้า"
                        class="h-28 w-full cursor-pointer object-cover"
                        @click="openEditPhotoPreview(intakeDisplayUrl, 'รูปหลักฐานการรับผ้า')"
                      >
                      <UButton
                        icon="i-lucide-x"
                        color="error"
                        variant="solid"
                        size="xs"
                        class="absolute right-1 top-1"
                        @click.stop="requestRemoveEditPhoto('intake')"
                      />
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-dashed border-default p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="font-medium text-highlighted">รูปหลักฐานการส่งผ้า</p>
                      <p v-if="!deliveryDisplayUrl" class="text-sm text-muted">ยังไม่ได้แนบรูป</p>
                    </div>
                    <UButton
                      v-if="!deliveryDisplayUrl"
                      label="เพิ่มรูป"
                      icon="i-lucide-camera"
                      color="neutral"
                      variant="solid"
                      @click="openDeliveryPicker"
                    />
                  </div>
                  <input
                    ref="deliveryFileInputRef"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    @change="onDeliveryFileSelected"
                  >
                  <div v-if="deliveryDisplayUrl" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div class="group relative overflow-hidden rounded-xl border border-default bg-muted/30">
                      <img
                        :src="deliveryDisplayUrl"
                        alt="รูปหลักฐานการส่งผ้า"
                        class="h-28 w-full cursor-pointer object-cover"
                        @click="openEditPhotoPreview(deliveryDisplayUrl, 'รูปหลักฐานการส่งผ้า')"
                      >
                      <UButton
                        icon="i-lucide-x"
                        color="error"
                        variant="solid"
                        size="xs"
                        class="absolute right-1 top-1"
                        @click.stop="requestRemoveEditPhoto('delivery')"
                      />
                    </div>
                  </div>
                </div>

                <UFormField label="ส่วนลด">
                  <UInputNumber
                    v-model="form.discountAmount"
                    :min="0"
                    :max="subtotalAmount"
                    :step="1"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="หมายเหตุ">
                  <UTextarea
                    v-model="form.note"
                    class="w-full"
                    :rows="3"
                    placeholder="รายละเอียดเพิ่มเติมสำหรับทีมงานหรือใบรับผ้า"
                  />
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
          <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isFormOpen = false" />
          <UButton
            label="บันทึกการแก้ไข"
            icon="i-lucide-save"
            color="primary"
            :loading="isSubmitting"
            @click="handleSubmit"
          />
        </div>
      </template>
      </UModal>

      <UModal
      v-model:open="isBulkDeleteOpen"
      title="ลบรายการรับผ้าที่เลือก"
      :description="`ยืนยันการลบ ${selectedRowsCount} รายการ`"
    >
      <template #body>
        <div v-if="selectedOrders.length" class="max-h-72 space-y-3 overflow-auto pr-1">
          <div
            v-for="order in selectedOrders"
            :key="order.id"
            class="flex items-start gap-3"
          >
            <UAvatar v-bind="getAvatarProps(order.customer)" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-highlighted">
                {{ order.customer.name || order.customer.email }}
              </p>
              <p class="truncate text-sm text-muted">
                {{ order.orderNo || order.id }}
              </p>
            </div>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="xs"
              color="neutral"
              @click="handleOrderDeselected(order)"
            />
          </div>
        </div>
        <p v-else class="py-6 text-center text-sm text-muted">
          ยังไม่มีรายการที่เลือก
        </p>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isBulkDeleteOpen = false" />
          <UButton label="ลบ" color="error" :disabled="!selectedRowsCount" :loading="isDeleting" @click="confirmBulkDelete" />
        </div>
      </template>
      </UModal>

      <UModal
        v-model:open="isStatusOpen"
        title="อัพเดทสถานะงาน"
        :description="statusTarget?.orderNo ? `เลขรับผ้า ${statusTarget.orderNo}` : 'เลือกสถานะใหม่สำหรับงานนี้'"
      >
        <template #body>
          <div class="space-y-3">
            <div v-if="statusTarget" class="flex items-center justify-between gap-3 rounded-xl border border-default px-3 py-2 text-sm">
              <span class="text-muted">สถานะปัจจุบัน</span>
              <UBadge :color="orderStatusColors[statusTarget.status]" variant="subtle">{{ orderStatusLabels[statusTarget.status] }}</UBadge>
            </div>
            <UFormField label="สถานะใหม่">
              <USelect
                v-model="statusDraft"
                :items="serviceOrderStatusOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UIPhotoUpload
              v-if="statusDraft === 'COMPLETED'"
              label="รูปหลักฐานการส่งผ้า"
              description="ถ่ายรูปตอนส่งคืนผ้าให้ลูกค้า (ไม่บังคับ)"
              :photos="deliveryPhotos"
              :max="1"
              @update:photos="onDeliveryPhotosUpdate"
            />

            <div
              v-if="statusDraft === 'COMPLETED' && statusTarget && statusTarget.status !== 'COMPLETED' && (addonPickerEntries.length || isLoadingAddons)"
              class="space-y-2"
            >
              <div>
                <p class="text-sm font-medium text-highlighted">ใช้สิทธิ์แพ็กเกจรอง</p>
                <p class="text-xs text-muted">เลือกแพ็กเกจและจำนวนเครดิตที่จะหักเมื่อปิดงาน (ค่าเริ่มต้น 1)</p>
              </div>
              <p v-if="isLoadingAddons" class="text-sm text-muted">กำลังโหลดสิทธิ์แพ็กเกจรอง...</p>
              <div v-else class="space-y-2">
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
            <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isStatusOpen = false" />
            <UButton
              label="บันทึกสถานะ"
              icon="i-lucide-check"
              color="primary"
              :loading="isUpdatingStatus"
              :disabled="!statusTarget || statusDraft === statusTarget?.status"
              @click="confirmStatusUpdate"
            />
          </div>
        </template>
      </UModal>

      <UIConfirmModal
      v-model:open="isDeleteOpen"
      title="ลบรายการรับผ้า"
      description="ยืนยันการลบรายการรับผ้านี้ออกจากระบบ"
      icon="i-lucide-trash-2"
      icon-color="error"
      confirm-label="ลบรายการ"
      confirm-color="error"
      :loading="isDeleting"
      @confirm="confirmDelete"
    >
      <template #message>
        ต้องการลบรายการของ
        <strong class="text-highlighted">
          {{ deletingOrder?.customer.name || deletingOrder?.customer.email }}
        </strong>
        ใช่หรือไม่?
      </template>

      <template #subMessage>
        <div class="space-y-1">
          <p class="text-sm text-muted">เลขรับผ้า: {{ deletingOrder?.orderNo || "-" }}</p>
          <p class="text-sm text-muted">จำนวนรายการ: {{ deletingOrder?.items.length || 0 }} รายการ</p>
          <p class="text-sm text-muted">ยอดรวม: {{ formatCurrency(Number(deletingOrder?.totalAmount ?? 0)) }}</p>
        </div>
      </template>
      </UIConfirmModal>

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
    <!-- Price-input modal for range items in edit modal -->
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

    <EditPaymentStateModal
      v-if="editPaymentTarget?.payment?.id"
      v-model:open="editPaymentOpen"
      :payment-id="editPaymentTarget.payment.id"
      :payment-no="editPaymentTarget.payment.paymentNo"
      :amount="Number(editPaymentTarget.payment.amount ?? 0)"
      :status="editPaymentTarget.payment.status"
      :method="editPaymentTarget.payment.method"
      :existing-slip="editPaymentTarget.payment.slipImage ?? null"
      @updated="onPaymentUpdated"
    />

    </ClientOnly>
</template>
