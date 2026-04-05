<script setup lang="ts">
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { AdminPaymentRecord } from "~~/app/composables/useAdminPayments";
import { paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type { PaymentMethod, PaymentStatus, Role } from "~~/shared/types/enums";

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UDropdownMenu = resolveComponent("UDropdownMenu");
const UTooltip = resolveComponent("UTooltip");

const { user } = useUser();
const isHydrated = ref(false);
const isAdmin = computed(() => (user.value?.role as Role | undefined) === "ADMIN");
const canShowAdminActions = computed(() => isHydrated.value && isAdmin.value);
const { payments, isLoading, refresh, deletePayment } = useAdminPayments();

onMounted(async () => {
  isHydrated.value = true;
});

onActivated(async () => {
  await refresh();
});

const PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];

const PAYMENT_METHOD_BADGES: Record<PaymentMethod, { label: string; color: "success" | "info" }> = {
  CASH: { label: "เงินสด", color: "success" },
  TRANSFER: { label: "โอน", color: "info" },
};

const PAYMENT_STATUS_OPTIONS: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];

const SALE_TYPE_OPTIONS: Array<{ label: string; value: "all" | "PACKAGE" | "SERVICE" }> = [
  { label: "ทุกประเภท", value: "all" },
  { label: "แพ็กเกจ", value: "PACKAGE" },
  { label: "รายการผ้า", value: "SERVICE" },
];

const getAvatarProps = (customer?: AdminPaymentRecord["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

type TableRow<T> = { original: T; toggleSelected: (value: boolean) => void };

type TableApi = {
  getFilteredSelectedRowModel: () => { rows: TableRow<AdminPaymentRecord>[] };
  getFilteredRowModel: () => { rows: TableRow<AdminPaymentRecord>[] };
  getRowModel: () => { rows: TableRow<AdminPaymentRecord>[] };
  resetRowSelection: () => void;
  getState: () => { pagination: { pageIndex: number; pageSize: number } };
  setPageIndex: (pageIndex: number) => void;
};

type TableInstance = { tableApi?: TableApi };

const table = useTemplateRef<TableInstance>("table");
const rowSelection = ref<Record<string, boolean>>({});
const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});

const searchQuery = ref("");
const statusFilter = ref<PaymentStatus | "all">("all");
const methodFilter = ref<PaymentMethod | "all">("all");
const saleTypeFilter = ref<(typeof SALE_TYPE_OPTIONS)[number]["value"]>("all");

const filteredPayments = computed<AdminPaymentRecord[]>(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return (payments.value ?? []).filter((payment) => {
    const matchKeyword = keyword
      ? [
          payment.paymentNo ?? "",
          payment.customer.name ?? "",
          payment.customer.email,
          payment.customer.phoneNumber ?? "",
          payment.packageSale.productName ?? "",
          ...payment.packageSale.items.map((item) => item.productName),
          payment.serviceOrder?.id ?? "",
          payment.serviceOrder?.orderNo ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      : true;

    const matchStatus = statusFilter.value === "all" ? true : payment.status === statusFilter.value;
    const matchMethod = methodFilter.value === "all" ? true : payment.paymentMethod === methodFilter.value;
    const matchSaleType = saleTypeFilter.value === "all"
      ? true
      : saleTypeFilter.value === "SERVICE"
        ? Boolean(payment.serviceOrder?.id)
        : !payment.serviceOrder?.id;

    return matchKeyword && matchStatus && matchMethod && matchSaleType;
  });
});

const selectedRows = computed<TableRow<AdminPaymentRecord>[]>(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [];
});

const selectedPayments = computed<AdminPaymentRecord[]>(() => selectedRows.value.map((row) => row.original));
const selectedRowsCount = computed(() => selectedRows.value.length);
const filteredRowCount = computed(() => filteredPayments.value.length);
const currentPageRange = computed(() => {
  const total = filteredRowCount.value;
  if (!total) {
    return { start: 0, end: 0, total: 0 };
  }

  const pageIndex = pagination.value.pageIndex;
  const pageSize = pagination.value.pageSize;
  const start = pageIndex * pageSize + 1;
  const end = Math.min(total, start + pageSize - 1);

  return { start, end, total };
});
const paginationSummary = computed(() => {
  const { start, end, total } = currentPageRange.value;

  if (!total) {
    return "ไม่มีรายการ";
  }

  if (!selectedRowsCount.value) {
    return `แสดง ${start}-${end} จาก ${total} รายการ`;
  }

  return `แสดง ${start}-${end} จาก ${total} รายการ | เลือก ${selectedRowsCount.value} รายการ`;
});

watch([searchQuery, statusFilter, methodFilter, saleTypeFilter], () => {
  pagination.value.pageIndex = 0;
  rowSelection.value = {};
});

watch(() => pagination.value.pageIndex, () => {
  rowSelection.value = {};
});

const slipPreview = ref<{ url: string; title: string; alt: string } | null>(null);
const isSlipPreviewOpen = ref(false);

const openSlipPreview = (payment: AdminPaymentRecord) => {
  const url = payment.slipImage?.secureUrl || payment.slipImage?.url;
  if (!url) return;
  slipPreview.value = {
    url,
    title: `หลักฐานการชำระเงิน ${payment.paymentNo || ""}`.trim(),
    alt: payment.customer.name || payment.customer.email || "หลักฐานการชำระเงิน",
  };
  isSlipPreviewOpen.value = true;
};

const openPaymentDetail = (payment: AdminPaymentRecord) => navigateTo(`/admin/payment/${payment.id}`);
const openReceipt = (payment: AdminPaymentRecord) => navigateTo(`/admin/payment/${payment.id}/receipt`);
const openIntakeSlip = (payment: AdminPaymentRecord) => {
  if (!payment.serviceOrder?.id) return;
  return navigateTo(`/admin/service-orders/${payment.serviceOrder.id}/intake`);
};
const openMemberDetail = (payment: AdminPaymentRecord) => navigateTo(`/admin/users/${payment.customer.id}`);

const getSaleType = (payment: AdminPaymentRecord) => (payment.serviceOrder?.id ? "SERVICE" : "PACKAGE");
const getSaleTypeLabel = (payment: AdminPaymentRecord) => (getSaleType(payment) === "SERVICE" ? "รายการผ้า" : "แพ็กเกจ");
const getSaleTypeColor = (payment: AdminPaymentRecord) => (getSaleType(payment) === "SERVICE" ? "warning" : "primary");

const isDeleteOpen = ref(false);
const isBulkDeleteOpen = ref(false);
const isDeleting = ref(false);
const deletingPayment = ref<AdminPaymentRecord | null>(null);

const openDeleteModal = (payment: AdminPaymentRecord) => {
  deletingPayment.value = payment;
  isDeleteOpen.value = true;
};

const confirmDelete = async () => {
  if (!deletingPayment.value) return;

  isDeleting.value = true;
  const ok = await deletePayment(deletingPayment.value.id);
  isDeleting.value = false;

  if (ok) {
    isDeleteOpen.value = false;
    deletingPayment.value = null;
  }
};

const handlePaymentDeselected = (payment: AdminPaymentRecord) => {
  const rows = table.value?.tableApi?.getRowModel().rows ?? [];
  const rowIndex = rows.findIndex((row) => row.original.id === payment.id);
  if (rowIndex >= 0) {
    rows[rowIndex]?.toggleSelected(false);
  }
};

const confirmBulkDelete = async () => {
  if (!selectedPayments.value.length) return;

  isDeleting.value = true;

  for (const payment of selectedPayments.value) {
    await deletePayment(payment.id);
  }

  isDeleting.value = false;
  table.value?.tableApi?.resetRowSelection();
  isBulkDeleteOpen.value = false;
};

const getActionItems = (payment: AdminPaymentRecord) => {
  const primaryItems: Array<Record<string, unknown>> = [
    { label: "ดูรายละเอียด", icon: "i-lucide-eye", onSelect: () => openPaymentDetail(payment) },
    { label: "ดูใบเสร็จ", icon: "i-lucide-receipt", onSelect: () => openReceipt(payment) },
  ];

  if (payment.serviceOrder?.id) {
    primaryItems.push({ label: "ดูใบรับผ้า", icon: "i-lucide-ticket", onSelect: () => openIntakeSlip(payment) });
    primaryItems.push({
      label: `เลขรับผ้า ${payment.serviceOrder.orderNo || payment.serviceOrder.id}`,
      icon: "i-lucide-package-search",
      disabled: true,
    });
  } else {
    primaryItems.push({ label: "ดูข้อมูลลูกค้า", icon: "i-lucide-user-round-search", onSelect: () => openMemberDetail(payment) });
  }

  primaryItems.push({
    label: payment.slipImage ? "ดูหลักฐานการโอน" : "ไม่มีหลักฐานการโอน",
    icon: "i-lucide-image",
    disabled: !payment.slipImage,
    onSelect: () => openSlipPreview(payment),
  });

  const groups = [primaryItems];

  if (canShowAdminActions.value) {
    groups.push([{ label: "ลบรายการ", icon: "i-lucide-trash-2", color: "error", onSelect: () => openDeleteModal(payment) }]);
  }

  return groups;
};

const columns: TableColumn<AdminPaymentRecord>[] = [
  {
    id: "select",
    header: ({ table }) =>
      h("div", h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? "indeterminate"
          : table.getIsAllPageRowsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: "Select all",
      })),
    cell: ({ row }) =>
      h("div", h(UCheckbox, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") => row.toggleSelected(!!value),
        ariaLabel: "Select row",
      })),
  },
  {
    accessorKey: "paymentNo",
    header: "เลขชำระ",
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted" }, row.original.paymentNo || "-"),
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
        ]),
      ]);
    },
  },
  {
    id: "saleType",
    header: "ประเภท",
    cell: ({ row }) => h(UBadge, { color: getSaleTypeColor(row.original), variant: "subtle" }, () => getSaleTypeLabel(row.original)),
  },
  {
    accessorKey: "packageSale.items",
    header: "รายการขาย",
    cell: ({ row }) => {
      const payment = row.original;
      const items = payment.packageSale.items;

      if (items.length > 0) {
        return h(
          "div",
          items.map((item) =>
            h("div", { class: "flex items-center gap-3 text-sm" }, [
              h("span", { class: "text-highlighted" }, item.productName),
              h("span", { class: "shrink-0 whitespace-nowrap text-muted" }, `${item.quantity} รายการ`),
            ]),
          ),
        );
      }

      return h("div", { class: "flex items-center gap-3 text-sm" }, [
        h("span", { class: "text-highlighted" }, "รายการผ้า"),
        h("span", { class: "shrink-0 whitespace-nowrap text-muted" }, `${payment.serviceOrder?.itemCount ?? 0} รายการ`),
      ]);
    },
  },
  {
    accessorKey: "amount",
    header: () => h("div", { class: "text-right" }, "จำนวนเงิน"),
    cell: ({ row }) => h("div", { class: "text-right font-medium" }, formatCurrency(row.original.amount)),
  },
  {
    accessorKey: "paymentMethod",
    header: "ช่องทาง",
    cell: ({ row }) => {
      const badge = PAYMENT_METHOD_BADGES[row.original.paymentMethod];
      return h(UBadge, { color: badge.color, variant: "subtle" }, () => badge.label);
    },
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) =>
      h(UBadge, { color: paymentStatusColors[row.original.status], variant: "subtle" }, () => paymentStatusLabels[row.original.status]),
  },
  {
    accessorKey: "createdAt",
    header: "วันที่สร้าง",
    cell: ({ row }) => h("p", { class: "text-sm" }, formatDateTime(row.original.createdAt)),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const detailButton = h(UButton, {
        icon: "i-lucide-eye",
        size: "xs",
        color: "neutral",
        variant: "ghost",
        onClick: () => openPaymentDetail(row.original),
      });

      const menuButton = h(UButton, {
        icon: "i-lucide-ellipsis",
        size: "xs",
        color: "neutral",
        variant: "ghost",
      });

      return h("div", { class: "flex items-center justify-end gap-1" }, [
        isHydrated.value ? h(
          UTooltip,
          { text: "ดูรายละเอียดการชำระเงิน", content: { side: "top" } },
          {
            default: () => detailButton,
          },
        ) : detailButton,
        isHydrated.value ? h(
          UTooltip,
          { text: "เมนูเพิ่มเติม", content: { side: "top" } },
          {
            default: () =>
              h(
                UDropdownMenu,
                { items: getActionItems(row.original), content: { align: "end" } },
                {
                  default: () => menuButton,
                },
              ),
          },
        ) : menuButton,
      ]);
    },
  },
];
</script>

<template>
  <UDashboardPanel id="payments">
    <template #header>
      <UDashboardNavbar title="รายการชำระเงิน" icon="i-lucide-receipt">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <UButton label="ไปหน้ารายการขาย" icon="i-lucide-shopping-cart" color="primary" @click="navigateTo('/admin/sales')" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <UInput
            v-model="searchQuery"
            class="w-full md:max-w-sm"
            icon="i-lucide-search"
            placeholder="ค้นหาลูกค้า เลขชำระ เลขรับผ้า หรือชื่อรายการ"
          />

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="canShowAdminActions && selectedRowsCount"
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
              v-model="saleTypeFilter"
              :items="SALE_TYPE_OPTIONS"
              value-key="value"
              class="min-w-36"
            />
            <USelect
              v-model="methodFilter"
              :items="[{ label: 'ทุกช่องทาง', value: 'all' }, ...PAYMENT_METHOD_OPTIONS]"
              value-key="value"
              class="min-w-32"
            />
            <USelect
              v-model="statusFilter"
              :items="[{ label: 'ทุกสถานะ', value: 'all' }, ...PAYMENT_STATUS_OPTIONS]"
              value-key="value"
              class="min-w-32"
            />
            <UTooltip text="รีเฟรชรายการ" :content="{ side: 'top' }">
              <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="isLoading" @click="refresh" />
            </UTooltip>
          </div>
        </div>

        <template v-if="isHydrated">
        <UTable
          ref="table"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          :pagination-options="{
            getPaginationRowModel: getPaginationRowModel()
          }"
          :data="filteredPayments"
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
              <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบรายการชำระเงิน</p>
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
        </template>
        <div v-else class="space-y-3">
          <div class="rounded-lg border border-default">
            <div class="grid grid-cols-8 gap-3 border-b border-default px-4 py-3">
              <USkeleton v-for="index in 8" :key="`header-${index}`" class="h-4 w-full" />
            </div>
            <div class="space-y-3 px-4 py-4">
              <div v-for="index in 6" :key="`row-${index}`" class="grid grid-cols-8 gap-3">
                <USkeleton v-for="column in 8" :key="`${index}-${column}`" class="h-5 w-full" />
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <USkeleton class="h-4 w-48" />
            <USkeleton class="h-9 w-56" />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal
    v-if="canShowAdminActions"
    v-model:open="isBulkDeleteOpen"
    title="ลบรายการชำระเงินที่เลือก"
    :description="`ยืนยันการลบ ${selectedRowsCount} รายการ`"
  >
    <template #body>
      <div v-if="selectedPayments.length" class="max-h-72 space-y-3 overflow-auto pr-1">
        <div
          v-for="payment in selectedPayments"
          :key="payment.id"
          class="flex items-start gap-3"
        >
          <UAvatar v-bind="getAvatarProps(payment.customer)" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-highlighted">
              {{ payment.customer.name || payment.customer.email }}
            </p>
            <p class="truncate text-sm text-muted">
              {{ payment.paymentNo || payment.id }}
            </p>
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            size="xs"
            color="neutral"
            @click="handlePaymentDeselected(payment)"
          />
        </div>
      </div>
      <p v-else class="py-6 text-center text-sm text-muted">
        ยังไม่มีรายการที่เลือก
      </p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="ยกเลิก"
          color="neutral"
          variant="outline"
          @click="isBulkDeleteOpen = false"
        />
        <UButton
          label="ลบ"
          color="error"
          :disabled="!selectedRowsCount"
          :loading="isDeleting"
          @click="confirmBulkDelete"
        />
      </div>
    </template>
  </UModal>

  <UIConfirmModal
    v-if="canShowAdminActions"
    v-model:open="isDeleteOpen"
    title="ลบรายการชำระเงิน"
    description="ยืนยันการลบรายการชำระเงินนี้ออกจากระบบ"
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
        {{ deletingPayment?.customer.name || deletingPayment?.customer.email }}
      </strong>
      ใช่หรือไม่?
    </template>

    <template #subMessage>
      <div class="space-y-1">
        <p class="text-sm text-muted">
          เลขชำระ: {{ deletingPayment?.paymentNo || "-" }}
        </p>
        <p class="text-sm text-muted">
          รายการขาย:
          {{ deletingPayment?.packageSale.items.map((item) => `${item.productName} x${item.quantity}`).join(", ") || (deletingPayment?.serviceOrder?.orderNo || deletingPayment?.serviceOrder?.id || "-") }}
        </p>
        <p class="text-sm text-muted">
          จำนวนเงิน: {{ formatCurrency(Number(deletingPayment?.amount ?? 0)) }}
        </p>
      </div>
    </template>
  </UIConfirmModal>

  <ImagePreviewModal
    v-model:open="isSlipPreviewOpen"
    :title="slipPreview?.title || 'ดูหลักฐานการชำระเงิน'"
    :image-url="slipPreview?.url || null"
    :image-alt="slipPreview?.alt || 'หลักฐานการชำระเงิน'"
  />
</template>
