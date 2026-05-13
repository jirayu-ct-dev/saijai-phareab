<script setup lang="ts">
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import EditPaymentStateModal from "~~/app/components/admin/payment/EditPaymentStateModal.vue";
import EditServiceOrderModal from "~~/app/components/admin/service-orders/EditServiceOrderModal.vue";
import type { AdminServiceOrder } from "~~/app/composables/useAdminServiceOrders";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

const adminDashboardBodyClass =
  adminUi.adminDashboardBodyClass
  ?? "admin-dashboard flex flex-col gap-4 p-2 sm:gap-6 sm:p-6";
const adminDashboardCardClass =
  adminUi.adminDashboardCardClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55";
const adminFilterBarClass =
  adminUi.adminFilterBarClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55";
const adminEmptyStateClass =
  adminUi.adminEmptyStateClass
  ?? "flex flex-col items-center justify-center rounded-sm border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30";
const adminMobileListCardClass =
  adminUi.adminMobileListCardClass
  ?? "overflow-hidden rounded-sm border border-default/30 bg-default transition-[background-color,border-color,box-shadow] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70";
const adminTableUi = adminUi.adminTableUi;

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
  updateServiceOrderStatus,
  deleteServiceOrder,
  uploadOrderImage,
} = useAdminServiceOrders();

const hydrated = ref(false);
onMounted(() => { hydrated.value = true; });
const showSkeleton = computed(() => !hydrated.value || isLoading.value);
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
  const items = order.items.slice(0, 1).map((item) => `${item.label} x${item.quantity}`);
  if (order.items.length > 1) items.push(`+ อีก ${order.items.length - 1} รายการ`);
  return items;
};
const formatOptionalDateTime = (value: string | null | undefined) => value ? formatDateTime(value) : "-";
const formatOptionalShortDate = (value: string | null | undefined) => value ? formatDate(value).replace(/\s+\d{4}$/, "") : "-";

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
const editingOrder = ref<AdminServiceOrder | null>(null);

const openEditModal = (order: AdminServiceOrder) => {
  editingOrder.value = order;
  isFormOpen.value = true;
};

const onServiceOrderUpdated = async () => {
  await refresh();
};

const stripEditQuery = () => {
  if (!route.query.edit) return;
  const { edit: _omit, ...rest } = route.query;
  void navigateTo({ path: route.path, query: rest }, { replace: true });
};
const openEditModalFromQuery = () => {
  const editId = Array.isArray(route.query.edit) ? route.query.edit[0] : route.query.edit;
  if (!editId) return;
  const target = (serviceOrders.value ?? []).find((order) => order.id === editId || order.orderNo === editId);
  if (!target) return;
  openEditModal(target);
  stripEditQuery();
};

watch(
  [() => route.query.edit, serviceOrders],
  () => openEditModalFromQuery(),
  { immediate: true },
);

const openDetailPage = (order: AdminServiceOrder) => navigateTo(`/admin/service-orders/${order.id}`);
const openCustomerPage = (order: AdminServiceOrder, e: MouseEvent) => {
  e.stopPropagation();
  if (order.customer?.id) navigateTo(`/admin/users/${order.customer.id}`);
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
        <div :class="adminDashboardBodyClass">
          <section class="flex flex-col gap-1">
            <div :class="[adminFilterBarClass, 'space-y-2 !px-3 !py-3 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0']">
              <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
                <UInput
                  v-model="searchQuery"
                  class="min-w-0 flex-1"
                  icon="i-lucide-search"
                  placeholder="ค้นหาเลขรับผ้า ลูกค้า เบอร์โทร หรือชื่อรายการ"
                />

                <UButton
                  v-if="selectedRowsCount"
                  color="error"
                  variant="subtle"
                  icon="i-lucide-trash"
                  class="shrink-0 md:hidden"
                  :aria-label="`ลบ ${selectedRowsCount} รายการ`"
                  @click="isBulkDeleteOpen = true"
                >
                  <template #trailing>
                    <UKbd class="hidden sm:inline-flex">{{ selectedRowsCount }}</UKbd>
                  </template>
                </UButton>

                <UIButtonRefresh class="shrink-0 md:hidden" :loading="isLoading" @refresh="refresh" />
              </div>

              <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
                <USelect
                  v-model="customerTypeFilter"
                  :items="[
                    { label: 'ลูกค้าทุกประเภท', value: 'all' },
                    { label: 'ลูกค้าหน้าร้าน', value: 'walk-in' },
                    { label: 'สมาชิก/ลูกค้าระบบ', value: 'member' },
                    { label: 'ลูกค้ารายเดือน', value: 'monthly' },
                  ]"
                  value-key="value"
                  class="min-w-0 sm:w-44"
                />
                <USelect
                  v-model="statusFilter"
                  :items="[{ label: 'ทุกสถานะงาน', value: 'all' }, ...serviceOrderStatusOptions]"
                  value-key="value"
                  class="min-w-0 sm:w-40"
                />

                <UButton
                  v-if="selectedRowsCount"
                  color="error"
                  variant="subtle"
                  icon="i-lucide-trash"
                  class="hidden shrink-0 md:inline-flex"
                  :aria-label="`ลบ ${selectedRowsCount} รายการ`"
                  @click="isBulkDeleteOpen = true"
                >
                  <template #trailing>
                    <UKbd class="hidden sm:inline-flex">{{ selectedRowsCount }}</UKbd>
                  </template>
                </UButton>

                <UIButtonRefresh class="hidden shrink-0 md:inline-flex" :loading="isLoading" @refresh="refresh" />
              </div>
            </div>

            <template v-if="showSkeleton">
              <div class="space-y-1 md:hidden">
                <div
                  v-for="i in 5"
                  :key="`so-mob-sk-${i}`"
                  :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md']"
                >
                  <div class="flex items-center gap-2 p-2">
                    <USkeleton class="size-4 rounded shrink-0" />
                    <USkeleton class="size-8 rounded-full shrink-0" />
                    <div class="min-w-0 flex-1 space-y-1.5">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1 space-y-1">
                          <USkeleton class="h-3.5 w-32 rounded" />
                          <USkeleton class="h-2.5 w-24 rounded" />
                        </div>
                        <div class="flex shrink-0 flex-col items-end gap-1">
                          <USkeleton class="h-4 w-16 rounded-full" />
                          <USkeleton class="h-3 w-14 rounded" />
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <USkeleton class="h-2.5 w-28 rounded" />
                        <USkeleton class="h-2.5 w-20 rounded" />
                        <USkeleton class="h-2.5 w-16 rounded" />
                      </div>
                      <USkeleton class="h-3 w-3/4 rounded" />
                      <div class="flex items-center justify-end gap-1">
                        <USkeleton class="size-5 rounded" />
                        <USkeleton class="size-5 rounded" />
                        <USkeleton class="size-5 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div :class="[adminDashboardCardClass, 'hidden !p-0 md:block']">
                <div class="space-y-2 p-3">
                  <USkeleton v-for="i in 8" :key="`so-dt-sk-${i}`" class="h-12 w-full rounded-md" />
                </div>
              </div>
            </template>

            <template v-else>
            <div class="md:hidden">
            <div v-if="isLoading" class="space-y-3">
              <USkeleton v-for="i in 5" :key="i" class="h-40 w-full rounded-md" />
            </div>

            <div v-else-if="!paginatedServiceOrders.length" :class="adminEmptyStateClass">
              <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบรายการรับผ้า</p>
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="(order, index) in paginatedServiceOrders"
                :key="order.id"
                :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md']"
              >
                <div class="flex items-center gap-2 p-2">
                  <UCheckbox
                    :model-value="isMobileRowSelected(index)"
                    aria-label="เลือกรายการ"
                    class="shrink-0"
                    @update:model-value="setMobileRowSelected(index, $event)"
                  />

                  <UAvatar v-bind="getAvatarProps(order.customer)" size="sm" class="shrink-0" />

                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <button
                          type="button"
                          class="block max-w-full truncate text-left text-sm font-medium text-highlighted hover:underline"
                          @click="openCustomerPage(order, $event)"
                        >
                          {{ order.customer.name || "-" }}
                        </button>
                        <button
                          type="button"
                          class="block max-w-full truncate font-mono text-[10px] text-muted hover:underline"
                          @click="openDetailPage(order)"
                        >
                          {{ order.orderNo || order.id }}
                        </button>
                      </div>

                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          class="inline-flex items-center rounded-md transition hover:bg-elevated/60"
                          title="คลิกเพื่ออัพเดทสถานะงาน"
                          aria-label="อัพเดทสถานะงาน"
                          @click="openStatusModal(order)"
                        >
                          <UBadge :color="orderStatusColors[order.status]" variant="subtle" size="xs" icon="i-lucide-pencil">
                            {{ orderStatusLabels[order.status] }}
                          </UBadge>
                        </button>
                        <template v-if="order.memberEntitlement && Number(order.totalAmount ?? 0) === 0">
                          <span class="text-sm font-semibold leading-none text-success">ใช้เครดิต</span>
                          <span class="text-[10px] text-muted">{{ order.creditUsed ?? 0 }} เครดิต</span>
                        </template>
                        <span v-else class="text-sm font-semibold leading-none text-primary">{{ formatCurrency(Number(order.totalAmount ?? 0)) }}</span>
                      </div>
                    </div>

                    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                      <span>{{ order.customer.phoneNumber || (order.isWalkIn ? "ลูกค้าหน้าร้าน" : order.customer.email) }}</span>
                      <span>รับ {{ formatOptionalShortDate(order.receivedAt) }}</span>
                      <span>{{ order.status === "COMPLETED" ? "ส่ง" : "นัด" }} {{ formatOptionalShortDate((order.status === "COMPLETED" ? order.payment?.paidAt : order.dueAt) || order.dueAt) }}</span>
                    </div>

                    <div class="mt-1 min-w-0">
                      <p class="truncate text-xs text-highlighted">
                        {{ formatItemSummary(order).join(" · ") || "ไม่มีรายการผ้า" }}
                      </p>
                    </div>

                    <div class="mt-1 flex items-center justify-end gap-1">
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

          <div :class="[adminDashboardCardClass, 'hidden overflow-hidden !p-0 md:block']">
            <UTable
              ref="table"
              v-model:row-selection="rowSelection"
              v-model:pagination="pagination"
              :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
              :data="filteredServiceOrders"
              :columns="columns"
              :loading="isLoading"
              :ui="adminTableUi"
            >
              <template #empty>
                <div v-if="isLoading" class="space-y-2 p-3">
                  <USkeleton v-for="i in 6" :key="`so-tbl-${i}`" class="h-12 w-full rounded-md" />
                </div>
                <div v-else :class="adminEmptyStateClass">
                  <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
                  <p>ไม่พบรายการรับผ้า</p>
                </div>
              </template>
            </UTable>
          </div>
          </template>
          </section>

          <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <div class="text-sm text-muted">
              <template v-if="showSkeleton">
                <span class="inline-flex items-center gap-2">
                  <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
                  กำลังโหลด...
                </span>
              </template>
              <template v-else>{{ paginationSummary }}</template>
            </div>

            <UPagination
              v-if="!showSkeleton"
              :page="pagination.pageIndex + 1"
              :items-per-page="pagination.pageSize"
              :total="filteredRowCount"
              @update:page="setPage"
            />
          </div>
        </div>
    </template>
    </UDashboardPanel>

    <ClientOnly>
      <EditServiceOrderModal
        v-model:open="isFormOpen"
        :order="editingOrder"
        @updated="onServiceOrderUpdated"
      />

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
            <div v-if="statusTarget" class="flex items-center justify-between gap-3 rounded-md border border-default px-3 py-2 text-sm">
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
                  class="flex flex-wrap items-center gap-3 rounded-md border border-default p-3"
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
