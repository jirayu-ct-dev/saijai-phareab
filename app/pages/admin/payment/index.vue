<script setup lang="ts">
import { h, resolveComponent } from "vue";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import type { AdminPaymentRecord } from "~~/app/composables/useAdminPayments";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type { Role } from "~~/shared/types/enums";
import { paymentMethodLabels, paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import ConfirmPaymentModal from "~~/app/components/admin/payment/ConfirmPaymentModal.vue";
import EditPaymentStateModal from "~~/app/components/admin/payment/EditPaymentStateModal.vue";

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const { user } = useUser();
const isAdmin = computed(() => (user.value?.role as Role | undefined) === "ADMIN");
const { payments, isLoading, refresh, deletePayment } = useAdminPayments();

const confirmModalOpen = ref(false);
const confirmTarget = ref<AdminPaymentRecord | null>(null);
const canConfirmPayment = (payment: AdminPaymentRecord) => payment.status !== "PAID" && payment.status !== "CANCELLED";
const openConfirmModal = (payment: AdminPaymentRecord) => {
  if (!canConfirmPayment(payment)) return;
  confirmTarget.value = payment;
  confirmModalOpen.value = true;
};
const onConfirmedFromList = async () => {
  await refresh();
};
const editStateModalOpen = ref(false);
const editStateTarget = ref<AdminPaymentRecord | null>(null);
const openEditStateModal = (payment: AdminPaymentRecord) => {
  editStateTarget.value = payment;
  editStateModalOpen.value = true;
};
const onStateUpdatedFromList = async () => {
  await refresh();
};
const canManagePaymentState = (payment: AdminPaymentRecord) => isAdmin.value || canConfirmPayment(payment);
const getPaymentStateActionTitle = (payment: AdminPaymentRecord) => {
  if (isAdmin.value) return "คลิกเพื่อแก้ไขสถานะ";
  if (canConfirmPayment(payment)) return "คลิกเพื่อยืนยันการชำระเงิน";
  return undefined;
};
const handlePaymentStateClick = (payment: AdminPaymentRecord) => {
  if (isAdmin.value) {
    openEditStateModal(payment);
    return;
  }
  if (canConfirmPayment(payment)) {
    openConfirmModal(payment);
  }
};

onActivated(async () => {
  await refresh();
});

const saleTypeOptions: Array<{ label: string; value: "all" | "PACKAGE" | "SERVICE" | "SERVICE_MEMBER" }> = [
  { label: "ทุกประเภท", value: "all" },
  { label: "แพ็กเกจ", value: "PACKAGE" },
  { label: "งานซักรีด", value: "SERVICE" },
  { label: "งานซักรีด (รายเดือน)", value: "SERVICE_MEMBER" },
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
  getRowModel: () => { rows: TableRow<AdminPaymentRecord>[] };
  resetRowSelection: () => void;
};
type TableInstance = { tableApi?: TableApi };

const table = useTemplateRef<TableInstance>("table");
const rowSelection = ref<Record<string, boolean>>({});
const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});

const searchQuery = ref("");
const saleTypeFilter = ref<(typeof saleTypeOptions)[number]["value"]>("all");

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

    const matchSaleType = (() => {
      if (saleTypeFilter.value === "all") return true;
      const isService = Boolean(payment.serviceOrder?.id);
      if (saleTypeFilter.value === "PACKAGE") return !isService;
      if (saleTypeFilter.value === "SERVICE") return isService;
      if (saleTypeFilter.value === "SERVICE_MEMBER") {
        return isService && Boolean(payment.serviceOrder?.memberEntitlementId);
      }
      return true;
    })();

    return matchKeyword && matchSaleType;
  });
});

const selectedRows = computed<TableRow<AdminPaymentRecord>[]>(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [];
});

const selectedPayments = computed<AdminPaymentRecord[]>(() => selectedRows.value.map((row) => row.original));
const selectedRowsCount = computed(() => selectedRows.value.length);
const filteredRowCount = computed(() => filteredPayments.value.length);
const paginatedPayments = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize;
  return filteredPayments.value.slice(start, start + pagination.value.pageSize);
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

const setPage = (page: number) => {
  pagination.value = { ...pagination.value, pageIndex: page - 1 };
};

watch([searchQuery, saleTypeFilter], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 };
  rowSelection.value = {};
});

watch(() => pagination.value.pageIndex, () => {
  rowSelection.value = {};
});

const openPaymentDetail = (payment: AdminPaymentRecord) => navigateTo(`/admin/payment/${payment.id}`);
const openReceipt = (payment: AdminPaymentRecord) => {
  const target = payment.status === "PAID" ? "receipt" : "quotation";
  return navigateTo(`/admin/payment/${payment.id}/${target}`);
};
const openMemberDetail = (payment: AdminPaymentRecord) => navigateTo(`/admin/users/${payment.customer.id}`);
const openServiceOrderDetail = (serviceOrderId: string) => navigateTo(`/admin/service-orders/${serviceOrderId}`);

const isServiceMember = (payment: AdminPaymentRecord) =>
  Boolean(payment.serviceOrder?.id) && Boolean(payment.serviceOrder?.memberEntitlementId);
const getSaleType = (payment: AdminPaymentRecord) => {
  if (payment.serviceOrder?.id) {
    return isServiceMember(payment) ? "SERVICE_MEMBER" : "SERVICE";
  }
  return "PACKAGE";
};
const getSaleTypeLabel = (payment: AdminPaymentRecord) => {
  const type = getSaleType(payment);
  if (type === "SERVICE_MEMBER") return "งานซักรีด (รายเดือน)";
  if (type === "SERVICE") return "งานซักรีด";
  return "แพ็กเกจ";
};
const getSaleTypeColor = (payment: AdminPaymentRecord) => {
  const type = getSaleType(payment);
  if (type === "SERVICE_MEMBER") return "success";
  if (type === "SERVICE") return "warning";
  return "primary";
};

const formatPaymentItems = (payment: AdminPaymentRecord) => {
  const items = payment.packageSale.items.slice(0, 2).map((item) => `${item.productName} x${item.quantity}`);
  if (payment.packageSale.items.length > 2) items.push(`+ อีก ${payment.packageSale.items.length - 2} รายการ`);
  if (items.length) return items;
  return [`รายการผ้า ${payment.serviceOrder?.itemCount ?? 0} รายการ`];
};

const getPaymentMethodLabel = (payment: AdminPaymentRecord) => (
  payment.method ? paymentMethodLabels[payment.method] : "-"
);

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
  if (rowIndex >= 0) rows[rowIndex]?.toggleSelected(false);
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
    { label: payment.status === "PAID" ? "ใบเสร็จ" : "ใบแจ้งราคา", icon: "i-lucide-receipt", onSelect: () => openReceipt(payment) },
  ];

  const serviceOrderId = payment.serviceOrder?.id;
  if (serviceOrderId) {
    primaryItems.push({
      label: `เลขออเดอร์ ${payment.serviceOrder?.orderNo || serviceOrderId}`,
      icon: "i-lucide-package-search",
      onSelect: () => openServiceOrderDetail(serviceOrderId),
    });
  } else {
    primaryItems.push({ label: "ดูข้อมูลลูกค้า", icon: "i-lucide-user-round-search", onSelect: () => openMemberDetail(payment) });
  }

  if (isAdmin.value) {
    return [
      primaryItems,
      [{ label: "ลบรายการ", icon: "i-lucide-trash-2", color: "error", onSelect: () => openDeleteModal(payment) }],
    ];
  }

  return [primaryItems];
};

const columns: TableColumn<AdminPaymentRecord>[] = [
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
    accessorKey: "paymentNo",
    header: "เลขชำระ",
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted cursor-pointer hover:underline", onClick: (e: MouseEvent) => { e.stopPropagation(); openPaymentDetail(row.original); } }, row.original.paymentNo || "-"),
  },
  {
    accessorKey: "customer",
    header: "ลูกค้า",
    cell: ({ row }) => {
      const customer = row.original.customer;
      return h("div", { class: "flex min-w-0 items-center gap-3 cursor-pointer", onClick: (e: MouseEvent) => { e.stopPropagation(); openMemberDetail(row.original); } }, [
        h(UAvatar, { ...getAvatarProps(customer) }),
        h("div", { class: "min-w-0 max-w-60 space-y-0.5" }, [
          h("p", { class: "truncate font-medium text-highlighted hover:underline" }, customer.name || "-"),
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

      const serviceOrderId = payment.serviceOrder?.id;
      const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (serviceOrderId) openServiceOrderDetail(serviceOrderId);
        else openPaymentDetail(payment);
      };

      if (items.length > 0) {
        return h(
          "div",
          { class: "space-y-1 cursor-pointer", onClick: handleClick },
          items.map((item) =>
            h("div", { key: `${item.productId}-${item.quantity}`, class: "flex items-center gap-3 text-sm" }, [
              h("span", { class: "text-highlighted" }, item.productName),
              h("span", { class: "shrink-0 whitespace-nowrap text-muted" }, `x${item.quantity}`),
            ]),
          ),
        );
      }

      return h("div", { class: "flex items-center gap-3 text-sm cursor-pointer", onClick: handleClick }, [
        h("span", { class: "text-highlighted" }, "รายการผ้า"),
        h("span", { class: "shrink-0 whitespace-nowrap text-muted" }, `${payment.serviceOrder?.itemCount ?? 0} รายการ`),
      ]);
    },
  },
  {
    accessorKey: "amount",
    header: () => h("div", { class: "text-right" }, "จำนวนเงิน"),
    cell: ({ row }) => {
      const payment = row.original;
      const isMemberZero = isServiceMember(payment) && Number(payment.amount ?? 0) === 0;
      if (isMemberZero) {
        const credits = Number(payment.serviceOrder?.creditUsed ?? 0);
        return h("div", { class: "space-y-0.5 text-right" }, [
          h("p", { class: "text-sm font-medium text-success" }, "ใช้เครดิต"),
          h("p", { class: "text-xs text-muted" }, `${credits} เครดิต`),
        ]);
      }
      return h("div", { class: "text-right font-medium" }, formatCurrency(payment.amount));
    },
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) => {
      const payment = row.original;
      const color = paymentStatusColors[payment.status] ?? "neutral";
      const label = paymentStatusLabels[payment.status] ?? payment.status;
      return h(
        "div",
        {
          class: canManagePaymentState(payment) ? "inline-flex cursor-pointer" : "inline-flex",
          title: getPaymentStateActionTitle(payment),
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            handlePaymentStateClick(payment);
          },
        },
        [h(UBadge, { color, variant: "soft", size: "sm" }, () => label)],
      );
    },
  },
  {
    accessorKey: "method",
    header: "วิธีชำระ",
    cell: ({ row }) => h("span", { class: "text-sm text-muted" }, getPaymentMethodLabel(row.original)),
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
      const confirmButton = canConfirmPayment(row.original)
        ? h(UButton, {
            icon: "i-lucide-check",
            size: "xs",
            color: "success",
            variant: "ghost",
            title: "ยืนยันการชำระเงิน",
            onClick: (e: MouseEvent) => {
              e.stopPropagation();
              openConfirmModal(row.original);
            },
          })
        : null;
      const detailButton = h(UButton, {
        icon: "i-lucide-eye",
        size: "xs",
        color: "neutral",
        variant: "ghost",
        title: "ดูรายละเอียดการชำระเงิน",
        onClick: (e: MouseEvent) => {
          e.stopPropagation();
          openPaymentDetail(row.original);
        },
      });

      const menuButton = h(UButton, {
        icon: "i-lucide-ellipsis",
        size: "xs",
        color: "neutral",
        variant: "ghost",
        title: "เมนูเพิ่มเติม",
      });

      return h("div", { class: "flex items-center justify-end gap-1" }, [
        confirmButton,
        detailButton,
        h(
          UDropdownMenu,
          { items: getActionItems(row.original), content: { align: "end" } },
          { default: () => menuButton },
        ),
      ].filter(Boolean));
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
          <UButton
            label="ไปหน้ารายการขาย"
            icon="i-lucide-shopping-cart"
            color="primary"
            class="shrink-0"
            aria-label="ไปหน้ารายการขาย"
            :ui="{ label: 'hidden sm:inline' }"
            @click="navigateTo('/admin/sales')"
          />
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
              placeholder="ค้นหาลูกค้า เลขชำระ เลขรับผ้า หรือชื่อรายการ"
            />

            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="isAdmin && selectedRowsCount"
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

              <USelect v-model="saleTypeFilter" :items="saleTypeOptions" value-key="value" class="min-w-36" />
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                title="รีเฟรชรายการ"
                :loading="isLoading"
                @click="refresh"
              />
            </div>
          </div>

          <div class="md:hidden">
            <div v-if="isLoading" class="space-y-3">
              <USkeleton v-for="i in 5" :key="i" class="h-40 w-full rounded-xl" />
            </div>

            <div v-else-if="!paginatedPayments.length" class="flex flex-col items-center justify-center rounded-xl border border-dashed border-default py-12 text-center text-muted">
              <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบรายการชำระเงิน</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(payment, index) in paginatedPayments"
                :key="payment.id"
                class="rounded-xl border border-default bg-default p-3"
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
                          @click="openPaymentDetail(payment)"
                        >
                          {{ payment.paymentNo || payment.id }}
                        </button>
                        <button
                          type="button"
                          class="mt-1 flex min-w-0 items-center gap-2 text-left"
                          @click="openMemberDetail(payment)"
                        >
                          <UAvatar v-bind="getAvatarProps(payment.customer)" size="sm" class="shrink-0" />
                          <span class="min-w-0">
                            <span class="block truncate text-sm font-medium text-highlighted">{{ payment.customer.name || "-" }}</span>
                            <span class="block truncate text-xs text-muted">{{ payment.customer.email }}</span>
                          </span>
                        </button>
                      </div>

                      <UBadge :color="getSaleTypeColor(payment)" variant="subtle" class="shrink-0">
                        {{ getSaleTypeLabel(payment) }}
                      </UBadge>
                    </div>

                    <div class="mt-3 space-y-1 border-t border-default pt-3">
                      <p v-for="item in formatPaymentItems(payment)" :key="item" class="text-sm text-highlighted">
                        {{ item }}
                      </p>
                    </div>

                    <div class="mt-3 grid grid-cols-2 gap-2 border-t border-default pt-3 text-xs">
                      <div>
                        <p class="text-muted">ยอดชำระ</p>
                        <template v-if="isServiceMember(payment) && Number(payment.amount ?? 0) === 0">
                          <p class="mt-1 font-semibold text-success">ใช้เครดิต</p>
                          <p class="mt-0.5 text-success">{{ Number(payment.serviceOrder?.creditUsed ?? 0) }} เครดิต</p>
                        </template>
                        <p v-else class="mt-1 font-semibold text-highlighted">{{ formatCurrency(payment.amount) }}</p>
                      </div>
                      <div>
                        <p class="text-muted">วันที่สร้าง</p>
                        <p class="mt-1 text-highlighted">{{ formatDateTime(payment.createdAt) }}</p>
                      </div>
                      <div>
                        <p class="text-muted">สถานะ</p>
                        <button
                          type="button"
                          class="mt-1 inline-flex"
                          :class="canManagePaymentState(payment) ? 'cursor-pointer' : 'cursor-default'"
                          :title="getPaymentStateActionTitle(payment)"
                          @click="handlePaymentStateClick(payment)"
                        >
                          <UBadge :color="paymentStatusColors[payment.status]" variant="soft" size="sm">
                            {{ paymentStatusLabels[payment.status] }}
                          </UBadge>
                        </button>
                      </div>
                      <div>
                        <p class="text-muted">วิธีชำระ</p>
                        <p class="mt-1 text-highlighted">{{ getPaymentMethodLabel(payment) }}</p>
                      </div>
                    </div>

                    <div class="mt-3 flex items-center justify-end gap-1 border-t border-default pt-3">
                      <UButton
                        v-if="canConfirmPayment(payment)"
                        icon="i-lucide-check"
                        size="xs"
                        color="success"
                        variant="ghost"
                        aria-label="ยืนยันการชำระเงิน"
                        @click="openConfirmModal(payment)"
                      />
                      <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายละเอียดการชำระเงิน" @click="openPaymentDetail(payment)" />
                      <UButton icon="i-lucide-receipt" size="xs" color="primary" variant="ghost" aria-label="ดูใบเสร็จ" @click="openReceipt(payment)" />
                      <UDropdownMenu :items="getActionItems(payment)" :content="{ align: 'end' }">
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
            class="hidden md:block"
            :data="filteredPayments"
            :columns="columns"
            :loading="isLoading"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:transition-colors [&>tr]:hover:bg-elevated/60',
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
      v-if="isAdmin"
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
          <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isBulkDeleteOpen = false" />
          <UButton label="ลบ" color="error" :disabled="!selectedRowsCount" :loading="isDeleting" @click="confirmBulkDelete" />
        </div>
      </template>
    </UModal>

    <UIConfirmModal
      v-if="isAdmin"
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
          <p class="text-sm text-muted">เลขชำระ: {{ deletingPayment?.paymentNo || "-" }}</p>
          <p class="text-sm text-muted">
            รายการขาย:
            {{ deletingPayment?.packageSale.items.map((item) => `${item.productName} x${item.quantity}`).join(", ") || (deletingPayment?.serviceOrder?.orderNo || deletingPayment?.serviceOrder?.id || "-") }}
          </p>
          <p class="text-sm text-muted">จำนวนเงิน: {{ formatCurrency(Number(deletingPayment?.amount ?? 0)) }}</p>
        </div>
      </template>
    </UIConfirmModal>
  </ClientOnly>

  <ConfirmPaymentModal
    v-if="confirmTarget"
    v-model:open="confirmModalOpen"
    :payment-id="confirmTarget.id"
    :amount="Number(confirmTarget.amount ?? 0)"
    @confirmed="onConfirmedFromList"
  />

  <EditPaymentStateModal
    v-if="editStateTarget && isAdmin"
    v-model:open="editStateModalOpen"
    :payment-id="editStateTarget.id"
    :payment-no="editStateTarget.paymentNo"
    :amount="Number(editStateTarget.amount ?? 0)"
    :status="editStateTarget.status"
    :method="editStateTarget.method"
    @updated="onStateUpdatedFromList"
  />
</template>
