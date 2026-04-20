<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import type { PaymentSlipImage } from "~~/app/composables/useAdminPayments";
import type {
  AdminServiceOrder,
  CreateAdminServiceOrderBody,
} from "~~/app/composables/useAdminServiceOrders";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";

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
type CustomerTypeFilter = "all" | "walk-in" | "member";
type FormItemState = { key: string; storefrontPriceId: string; quantity: number };
type CatalogMenuItem = { label: string; icon: string; onSelect: () => void; description?: string };
type CustomerOption = {
  label: string;
  value: string;
  image?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
};

const paymentMethodOptions: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];

const paymentMethodBadgeMap: Record<PaymentMethod, { label: string; color: "success" | "info" }> = {
  CASH: { label: "เงินสด", color: "success" },
  TRANSFER: { label: "โอน", color: "info" },
};

const serviceOrderStatusOptions: Array<{ label: string; value: ServiceOrderStatus }> = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PENDING, value: "PENDING" },
  { label: orderStatusLabels.CHECKING, value: "CHECKING" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.PENDING_REVIEW, value: "PENDING_REVIEW" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];

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
  deleteServiceOrder,
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
const paymentStatusFilter = ref<PaymentStatus | "all">("all");
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
    const matchPaymentStatus = paymentStatusFilter.value === "all" || order.payment?.status === paymentStatusFilter.value;
    const matchCustomerType =
      customerTypeFilter.value === "all"
      || (customerTypeFilter.value === "walk-in" ? order.isWalkIn : !order.isWalkIn);

    return matchKeyword && matchStatus && matchPaymentStatus && matchCustomerType;
  });
});

const selectedRows = computed<TableRow<AdminServiceOrder>[]>(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [];
});
const selectedOrders = computed<AdminServiceOrder[]>(() => selectedRows.value.map((row) => row.original));
const selectedRowsCount = computed(() => selectedOrders.value.length);
const filteredRowCount = computed(() => filteredServiceOrders.value.length);

watch([searchQuery, statusFilter, paymentStatusFilter, customerTypeFilter], () => {
  pagination.value.pageIndex = 0;
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

const openIntakeSlip = (order: AdminServiceOrder) => navigateTo(`/admin/service-orders/${order.id}/intake`);

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
let itemKeySeed = 0;
const createItemKey = () => `service-order-item-${++itemKeySeed}`;

const createEmptyForm = () => ({
  customerId: "",
  isWalkIn: false,
  walkInName: "",
  walkInPhone: "",
  serviceOrderStatus: "RECEIVED" as ServiceOrderStatus,
  paymentMethod: "CASH" as PaymentMethod,
  paymentStatus: "VERIFIED" as PaymentStatus,
  hangerCount: 0,
  discountAmount: 0,
  note: "",
});

const form = reactive(createEmptyForm());
const formItems = ref<FormItemState[]>([]);
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
  })),
);
const selectedCustomer = computed(() => customerOptions.value.find((item) => item.value === form.customerId) ?? null);

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

      return {
        key: item.key,
        storefrontPriceId: item.storefrontPriceId,
        label: catalog.label,
        quantity: item.quantity,
        unitPrice: catalog.price,
        totalPrice: catalog.price * item.quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

const subtotalAmount = computed(() => formLineItems.value.reduce((sum, item) => sum + item.totalPrice, 0));
const totalQuantity = computed(() => formLineItems.value.reduce((sum, item) => sum + item.quantity, 0));
const hangerCharge = computed(() => ({
  count: form.hangerCount,
  pricePerUnit: 2,
  total: form.hangerCount * 2,
}));
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
const totalAmount = computed(() => subtotalAmount.value - sanitizedDiscountAmount.value + hangerCharge.value.total);

watch(totalQuantity, (value) => {
  if (form.hangerCount < value) form.hangerCount = value;
}, { immediate: true });

watch(() => isFormOpen.value, (open) => {
  if (!open) {
    editingOrder.value = null;
    Object.assign(form, createEmptyForm());
    formItems.value = [];
    dueDate.value = null;
    dueTime.value = "00:00";
    slipFile.value = null;
    uploadedSlip.value = null;
  }
});

const addCatalogItemToTop = (storefrontPriceId: string) => {
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
    },
    ...formItems.value,
  ];
};

const removeItemRow = (key: string) => {
  formItems.value = formItems.value.filter((item) => item.key !== key);
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

const openCreateModal = () => {
  editingOrder.value = null;
  Object.assign(form, createEmptyForm());
  formItems.value = [];
  setDueDateTime(null);
  isFormOpen.value = true;
};

const openEditModal = (order: AdminServiceOrder) => {
  editingOrder.value = order;
  form.customerId = order.isWalkIn ? "" : order.customer.id;
  form.isWalkIn = order.isWalkIn;
  form.walkInName = order.walkInName || "";
  form.walkInPhone = order.walkInPhone || "";
  form.serviceOrderStatus = order.status;
  form.paymentMethod = order.payment?.paymentMethod ?? "CASH";
  form.paymentStatus = order.payment?.status ?? "PENDING";
  setDueDateTime(order.dueAt);
  form.hangerCount = order.hangerCharge?.count ?? order.items.reduce((sum, item) => sum + item.quantity, 0);
  form.discountAmount = order.discountAmount;
  form.note = order.note || "";
  formItems.value = order.items.map((item) => ({
    key: createItemKey(),
    storefrontPriceId: item.storefrontPriceId,
    quantity: item.quantity,
  }));
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

const handleBlockedSlip = (message: string) => notify.warning(message);
const handleRemoveSlip = () => {
  slipFile.value = null;
  uploadedSlip.value = null;
};

const uploadSlipIfNeeded = async (): Promise<string | null> => {
  if (!slipFile.value) return uploadedSlip.value?.id ?? null;
  const image = await uploadSlip(slipFile.value);
  if (!image) return null;
  uploadedSlip.value = image;
  return image.id;
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

  const items = formItems.value
    .map((item) => ({
      storefrontPriceId: item.storefrontPriceId,
      quantity: Number(item.quantity ?? 1),
    }))
    .filter((item) => item.storefrontPriceId);

  if (!items.length) {
    notify.validationError("กรุณาเลือกบริการอย่างน้อย 1 รายการ");
    return null;
  }

  const slipImageId = await uploadSlipIfNeeded();
  if (form.paymentMethod === "TRANSFER" && !slipImageId) {
    notify.validationError("กรุณาอัปโหลดสลิปสำหรับรายการโอน");
    return null;
  }

  return {
    customerId: form.isWalkIn ? null : form.customerId,
    isWalkIn: form.isWalkIn,
    walkInName: form.isWalkIn ? form.walkInName.trim() || null : null,
    walkInPhone: form.isWalkIn ? form.walkInPhone.trim() || null : null,
    items,
    hangerCount: form.hangerCount,
    dueAt: dueAtValue.value ? new Date(dueAtValue.value).toISOString() : null,
    discountAmount: sanitizedDiscountAmount.value,
    paymentMethod: form.paymentMethod,
    status: form.paymentStatus,
    serviceOrderStatus: form.serviceOrderStatus,
    note: form.note.trim() || null,
    slipImageId,
  };
};

const openDetailPage = (order: AdminServiceOrder) => navigateTo(`/admin/service-orders/${order.id}`);

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

const getActionItems = (order: AdminServiceOrder) => [
  [
    { label: "ดูรายละเอียด", icon: "i-lucide-eye", onSelect: () => openDetailPage(order) },
    { label: "แก้ไขรายการ", icon: "i-lucide-pencil", onSelect: () => openEditModal(order) },
    { label: "ดูใบรับผ้า", icon: "i-lucide-ticket", onSelect: () => openIntakeSlip(order) },
  ],
  [
    { label: "ลบรายการ", icon: "i-lucide-trash-2", color: "error", onSelect: () => openDeleteModal(order) },
  ],
];

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
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted" }, row.original.orderNo || row.original.id),
  },
  {
    accessorKey: "customer",
    header: "ลูกค้า",
    cell: ({ row }) => {
      const customer = row.original.customer;
      return h("div", { class: "flex min-w-0 items-center gap-3" }, [
        h(UAvatar, { ...getAvatarProps(customer) }),
        h("div", { class: "min-w-0 max-w-60 space-y-0.5" }, [
          h("p", { class: "truncate font-medium text-highlighted" }, customer.name || "-"),
          h("p", { class: "truncate text-sm text-muted" }, customer.email),
          h("p", { class: "truncate text-xs text-muted" }, customer.phoneNumber || (row.original.isWalkIn ? "ลูกค้าหน้าร้าน" : "-")),
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
        { class: "max-w-72 space-y-1" },
        formatItemSummary(row.original).map((item) => h("p", { class: "truncate text-sm text-highlighted" }, item)),
      ),
  },
  {
    accessorKey: "totalAmount",
    header: () => h("div", { class: "text-right" }, "ยอดรวม"),
    cell: ({ row }) => h("div", { class: "text-right font-medium" }, formatCurrency(row.original.totalAmount)),
  },
  {
    id: "payment",
    header: "ชำระเงิน",
    cell: ({ row }) => {
      const payment = row.original.payment;
      if (!payment) return h("span", { class: "text-sm text-muted" }, "-");

      return h("div", { class: "space-y-1" }, [
        h("div", { class: "flex flex-wrap gap-1" }, [
          h(UBadge, { color: paymentMethodBadgeMap[payment.paymentMethod].color, variant: "subtle" }, () => paymentMethodBadgeMap[payment.paymentMethod].label),
          h(UBadge, { color: paymentStatusColors[payment.status], variant: "subtle" }, () => paymentStatusLabels[payment.status]),
        ]),
        h("p", { class: "text-xs text-muted font-mono" }, payment.paymentNo || "-"),
      ]);
    },
  },
  {
    accessorKey: "status",
    header: "สถานะงาน",
    cell: ({ row }) => h(UBadge, { color: orderStatusColors[row.original.status], variant: "subtle" }, () => orderStatusLabels[row.original.status]),
  },
  {
    accessorKey: "dueAt",
    header: "วันนัดรับ",
    cell: ({ row }) => h("p", { class: "text-sm" }, row.original.dueAt ? formatDateTime(row.original.dueAt) : "-"),
  },
  {
    accessorKey: "receivedAt",
    header: "วันที่สร้าง",
    cell: ({ row }) => h("p", { class: "text-sm" }, formatDateTime(row.original.receivedAt)),
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
          icon: "i-lucide-pencil",
          size: "xs",
          color: "neutral",
          variant: "ghost",
          title: "แก้ไขรายการรับผ้า",
          onClick: () => openEditModal(order),
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
            <UButton
              label="สแกนสถานะผ้า"
              icon="i-lucide-scan-line"
              color="neutral"
              variant="outline"
              to="/admin/service-orders/scan"
            />
            <UButton
              label="เพิ่มรายการรับผ้า"
              icon="i-lucide-plus"
              color="primary"
              @click="openCreateModal"
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
                ]"
                value-key="value"
                class="min-w-40"
              />
              <USelect
                v-model="paymentStatusFilter"
                :items="[{ label: 'ทุกสถานะชำระเงิน', value: 'all' }, ...paymentStatusOptions]"
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

          <UTable
            ref="table"
            v-model:row-selection="rowSelection"
            v-model:pagination="pagination"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            :data="filteredServiceOrders"
            :columns="columns"
            :loading="isLoading"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'border-y border-default py-2 font-medium first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r',
              td: 'border-b border-default',
              separator: 'h-0'
            }"
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
              @update:page="(page: number) => { pagination.pageIndex = page - 1 }"
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
            <USkeleton class="h-[420px] w-full rounded-xl" />
          </div>
        </template>
      </ClientOnly>
    </template>
    </UDashboardPanel>

    <ClientOnly>
      <UModal
      v-model:open="isFormOpen"
      :title="editingOrder ? 'แก้ไขรายการรับผ้า' : 'เพิ่มรายการรับผ้า'"
      :description="editingOrder ? 'อัปเดตรายการ บริการ และข้อมูลชำระเงินของงานนี้' : 'สร้างรายการรับผ้าใหม่พร้อมข้อมูลลูกค้าและการชำระเงิน'"
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

                <template v-else>
                  <UFormField label="ชื่อลูกค้าหน้าร้าน" required>
                    <UInput v-model="form.walkInName" class="w-full" placeholder="เช่น คุณสมชาย" />
                  </UFormField>

                  <UFormField label="เบอร์โทร">
                    <UInput v-model="form.walkInPhone" class="w-full" placeholder="08x-xxx-xxxx" />
                  </UFormField>
                </template>

                <UFormField label="วันนัดรับ">
                  <div>
                    <!-- <p class="mb-2 text-sm font-medium text-highlighted">วันนัดรับ</p> -->
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

              <div class="mt-3 space-y-2">
                <div
                  v-for="item in formItems"
                  :key="item.key"
                  class="grid gap-2 rounded-lg border border-default p-2.5 md:grid-cols-[minmax(0,1fr)_92px_40px]"
                >
                  <UFormField label="บริการ">
                    <USelect
                      :model-value="item.storefrontPriceId"
                      :items="catalogOptions"
                      value-key="value"
                      :loading="isCatalogLoading"
                      class="w-full"
                      placeholder="เลือกบริการ"
                      @update:model-value="updateItemField(item.key, 'storefrontPriceId', $event as string)"
                    />
                  </UFormField>

                  <UFormField label="จำนวน">
                    <UInputNumber
                      :model-value="item.quantity"
                      :min="1"
                      :step="1"
                      orientation="vertical"
                      class="w-full"
                      @update:model-value="updateItemField(item.key, 'quantity', Number($event ?? 1))"
                    />
                  </UFormField>

                  <div class="flex items-end">
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      class="h-9 w-full md:w-10"
                      @click="removeItemRow(item.key)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-5">
            <div class="rounded-2xl border border-default p-4">
              <p class="font-medium text-highlighted">การชำระเงิน</p>
              <div class="mt-4 space-y-4">
                <UFormField label="ช่องทางการชำระเงิน">
                  <USelect
                    v-model="form.paymentMethod"
                    :items="paymentMethodOptions"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="สถานะชำระเงิน">
                  <USelect
                    v-model="form.paymentStatus"
                    :items="paymentStatusOptions"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>

                <UISlipUploadField
                  label="หลักฐานการโอน"
                  :file="slipFile"
                  :image-url="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
                  :image-label="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
                  :blocked-message="form.paymentMethod !== 'TRANSFER' ? 'อัปโหลดสลิปได้เฉพาะเมื่อเลือกการชำระเงินแบบโอน' : null"
                  confirm-remove
                  @update:file="slipFile = $event"
                  @blocked="handleBlockedSlip"
                  @remove="handleRemoveSlip"
                />
              </div>
            </div>

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

                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted">จำนวนไม้แขวน</span>
                  <UInputNumber
                    v-model="form.hangerCount"
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
            :label="editingOrder ? 'บันทึกการแก้ไข' : 'สร้างรายการรับผ้า'"
            :icon="editingOrder ? 'i-lucide-save' : 'i-lucide-plus'"
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
    </ClientOnly>
</template>
