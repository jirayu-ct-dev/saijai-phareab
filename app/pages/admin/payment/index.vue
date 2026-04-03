<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import type { PaymentMethod, PaymentStatus, Role } from "~~/shared/types/enums";
import { paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type { AdminPaymentRecord } from "~~/app/composables/useAdminPayments";

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const { user } = useUser();
const isAdmin = computed(() => (user.value?.role as Role | undefined) === "ADMIN");

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

type TableApi = {
  getState: () => { pagination: { pageIndex: number; pageSize: number } };
  setPageIndex: (pageIndex: number) => void;
};

type TableInstance = { tableApi?: TableApi };

const { payments, isLoading, refresh, deletePayment } = useAdminPayments();

const table = useTemplateRef<TableInstance>("table");
const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});

const searchQuery = ref("");
const statusFilter = ref<PaymentStatus | "all">("all");
const methodFilter = ref<PaymentMethod | "all">("all");

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
          payment.referenceNo ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      : true;

    const matchStatus = statusFilter.value === "all" ? true : payment.status === statusFilter.value;
    const matchMethod = methodFilter.value === "all" ? true : payment.paymentMethod === methodFilter.value;

    return matchKeyword && matchStatus && matchMethod;
  });
});

const openSlipPreview = (payment: AdminPaymentRecord) => {
  const url = payment.slipImage?.secureUrl || payment.slipImage?.url;
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const openReceipt = (payment: AdminPaymentRecord) => navigateTo(`/admin/payment/${payment.id}/receipt`);

const isDeleteOpen = ref(false);
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

const columns: TableColumn<AdminPaymentRecord>[] = [
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
      return h("div", { class: "flex items-center gap-3 min-w-0" }, [
        h(UAvatar, {
          src: customer.image || undefined,
          alt: customer.name ?? customer.email,
        }),
        h("div", { class: "min-w-0 max-w-60 space-y-0.5" }, [
          h("p", { class: "font-medium text-highlighted truncate" }, customer.name || "-"),
          h("p", { class: "text-sm text-muted truncate" }, customer.email),
        ]),
      ]);
    },
  },
  {
    accessorKey: "packageSale.items",
    header: "รายการขาย",
    cell: ({ row }) => {
      const items = row.original.packageSale.items;

      return h(
        "div",
        { class: "space-y-1 max-w-80" },
        items.length > 0
          ? items.map((item) =>
              h("div", { class: "flex items-center justify-between gap-3 text-sm" }, [
                h("span", { class: "truncate text-highlighted" }, `${item.productName} x${item.quantity}`),
                h("span", { class: "text-muted whitespace-nowrap" }, formatCurrency(item.totalPrice)),
              ]),
            )
          : [h("span", { class: "text-sm text-muted" }, row.original.packageSale.productName || "-")],
      );
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
    header: "วันที่",
    cell: ({ row }) =>
      h("div", { class: "space-y-0.5" }, [
        h("p", { class: "text-sm" }, formatDateTime(row.original.createdAt)),
        h("p", { class: "text-xs text-muted" }, row.original.referenceNo || "-"),
      ]),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h("div", { class: "flex items-center justify-end gap-1" }, [
        h(UButton, {
          icon: "i-lucide-receipt",
          size: "xs",
          color: "neutral",
          variant: "ghost",
          onClick: () => openReceipt(row.original),
        }),
        h(UButton, {
          icon: "i-lucide-image",
          size: "xs",
          color: "neutral",
          variant: "ghost",
          disabled: !row.original.slipImage,
          onClick: () => openSlipPreview(row.original),
        }),
        ...(isAdmin.value
          ? [
              h(UButton, {
                icon: "i-lucide-trash-2",
                size: "xs",
                color: "error",
                variant: "ghost",
                onClick: () => openDeleteModal(row.original),
              }),
            ]
          : []),
      ]),
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
            placeholder="ค้นหาลูกค้า package เลขชำระ หรือเลขอ้างอิง"
          />

          <div class="flex flex-wrap items-center gap-2">
            <USelect
              v-model="methodFilter"
              :items="[
                { label: 'ทุกช่องทาง', value: 'all' },
                ...PAYMENT_METHOD_OPTIONS,
              ]"
              value-key="value"
              class="min-w-32"
            />
            <USelect
              v-model="statusFilter"
              :items="[
                { label: 'ทุกสถานะ', value: 'all' },
                ...PAYMENT_STATUS_OPTIONS,
              ]"
              value-key="value"
              class="min-w-32"
            />
            <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="isLoading" @click="refresh" />
          </div>
        </div>

        <UTable
          ref="table"
          v-model:pagination="pagination"
          :data="filteredPayments"
          :columns="columns"
          :loading="isLoading"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 font-medium first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default',
            separator: 'h-0'
          }"
        >
          <template #empty>
            <div class="flex flex-col items-center justify-center py-12 text-center text-muted">
              <UIcon name="i-lucide-receipt" class="size-10 mb-3 opacity-60" />
              <p>ไม่พบรายการชำระเงิน</p>
            </div>
          </template>
        </UTable>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            ทั้งหมด {{ filteredPayments.length }} รายการ
          </div>

          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="filteredPayments.length"
            @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

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
        <p class="text-sm text-muted">
          เลขชำระ: {{ deletingPayment?.paymentNo || "-" }}
        </p>
        <p class="text-sm text-muted">
          รายการขาย: {{ deletingPayment?.packageSale.items.map((item) => `${item.productName} x${item.quantity}`).join(", ") || deletingPayment?.packageSale.productName || "-" }}
        </p>
        <p class="text-sm text-muted">
          จำนวนเงิน: {{ formatCurrency(Number(deletingPayment?.amount ?? 0)) }}
        </p>
      </div>
    </template>
  </UIConfirmModal>
</template>
