<script setup lang="ts">
import { h, resolveComponent } from "vue";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import { paymentMethodLabels, paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

type MyReceiptRecord = {
  id: string;
  paymentNo: string | null;
  receiptNo: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  isVerified: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  quotationNo: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  packageSale: {
    memberEntitlementId: string | null;
    packageSaleId: string | null;
    productId: string | null;
    productName: string | null;
    packageType: string | null;
    credits: number | null;
    validityDays: number | null;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      packageType: string;
      quantity: number;
      totalPrice: number;
    }>;
  };
  serviceOrder: {
    id: string;
    orderNo: string | null;
    itemCount: number;
    creditUsed: number;
    memberEntitlementId: string | null;
    memberProductName: string | null;
  } | null;
  slipImage: { id: string; secureUrl: string | null; url: string | null } | null;
};

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const { payments, pending: isLoading, refresh } = useMyPayments();

const hydrated = ref(false);
const activatedOnce = ref(false);
onMounted(() => { hydrated.value = true; });

onActivated(async () => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }
  await refresh();
});

const showSkeleton = computed(() => !hydrated.value || isLoading.value);

const saleTypeOptions: Array<{ label: string; value: "all" | "PACKAGE" | "SERVICE" | "SERVICE_MEMBER" }> = [
  { label: "ทุกประเภท", value: "all" },
  { label: "แพ็กเกจ", value: "PACKAGE" },
  { label: "งานซักรีด", value: "SERVICE" },
  { label: "งานซักรีด (รายเดือน)", value: "SERVICE_MEMBER" },
];

const getAvatarProps = (customer?: MyReceiptRecord["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});

const searchQuery = ref("");
const saleTypeFilter = ref<(typeof saleTypeOptions)[number]["value"]>("all");

const typedPayments = computed<MyReceiptRecord[]>(() => payments.value as unknown as MyReceiptRecord[]);

const isServiceMember = (payment: MyReceiptRecord) =>
  Boolean(payment.serviceOrder?.id) && Boolean(payment.serviceOrder?.memberEntitlementId);

const getSaleType = (payment: MyReceiptRecord) => {
  if (payment.serviceOrder?.id) {
    return isServiceMember(payment) ? "SERVICE_MEMBER" : "SERVICE";
  }
  return "PACKAGE";
};

const filteredPayments = computed<MyReceiptRecord[]>(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return typedPayments.value.filter((payment) => {
    const matchKeyword = keyword
      ? [
          payment.paymentNo ?? "",
          payment.receiptNo ?? "",
          payment.quotationNo ?? "",
          payment.customer?.name ?? "",
          payment.customer?.email ?? "",
          payment.customer?.phoneNumber ?? "",
          payment.packageSale?.productName ?? "",
          ...(payment.packageSale?.items ?? []).map((item) => item.productName),
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
      if (saleTypeFilter.value === "SERVICE_MEMBER") return isService && Boolean(payment.serviceOrder?.memberEntitlementId);
      return true;
    })();

    return matchKeyword && matchSaleType;
  });
});

const filteredRowCount = computed(() => filteredPayments.value.length);
const paginatedPayments = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize;
  return filteredPayments.value.slice(start, start + pagination.value.pageSize);
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
  return `แสดง ${start}-${end} จาก ${total} รายการ`;
});

const setPage = (page: number) => {
  pagination.value = { ...pagination.value, pageIndex: page - 1 };
};

watch([searchQuery, saleTypeFilter], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 };
});

const getDocumentPath = (payment: MyReceiptRecord) => payment.status === "PAID" ? "receipt" : "quotation";
const openPaymentDetail = (payment: MyReceiptRecord) => navigateTo(`/me/payment/${payment.id}`);
const openReceipt = (payment: MyReceiptRecord) => navigateTo(`/me/payment/${payment.id}/${getDocumentPath(payment)}`);
const openServiceOrderDetail = (serviceOrderId: string) => navigateTo(`/me/service-orders/${serviceOrderId}`);

const getSaleTypeLabel = (payment: MyReceiptRecord) => {
  const type = getSaleType(payment);
  if (type === "SERVICE_MEMBER") return "งานซักรีด (รายเดือน)";
  if (type === "SERVICE") return "งานซักรีด";
  return "แพ็กเกจ";
};
const getSaleTypeColor = (payment: MyReceiptRecord) => {
  const type = getSaleType(payment);
  if (type === "SERVICE_MEMBER") return "success";
  if (type === "SERVICE") return "warning";
  return "primary";
};

const formatPaymentItems = (payment: MyReceiptRecord) => {
  const packageItems = payment.packageSale?.items ?? [];
  if (packageItems.length) {
    const items = packageItems.slice(0, 2).map((item) => `${item.productName} x${item.quantity}`);
    if (packageItems.length > 2) items.push(`+ อีก ${packageItems.length - 2} รายการ`);
    return items;
  }
  return [`รายการผ้า ${payment.serviceOrder?.itemCount ?? 0} รายการ`];
};

const formatMobilePaymentItem = (payment: MyReceiptRecord) => formatPaymentItems(payment)[0] ?? "-";

const formatOptionalShortDate = (value: string | null | undefined) => value ? formatDate(value) : "-";

const getPaymentMethodLabel = (payment: MyReceiptRecord) => (
  payment.method ? paymentMethodLabels[payment.method] : "-"
);

const getMobilePaymentMeta = (payment: MyReceiptRecord) => {
  const date = formatOptionalShortDate(payment.createdAt);
  return payment.method ? `${getPaymentMethodLabel(payment)} · ${date}` : date;
};

const getActionItems = (payment: MyReceiptRecord) => {
  const primaryItems: Array<Record<string, unknown>> = [
    { label: "ดูรายละเอียด", icon: "i-lucide-eye", onSelect: () => openPaymentDetail(payment) },
    payment.status === "PAID"
      ? { label: "ดูใบเสร็จ", icon: "i-lucide-receipt", onSelect: () => openReceipt(payment) }
      : { label: "ดูใบแจ้งราคา", icon: "i-lucide-file-text", onSelect: () => openReceipt(payment) },
  ];

  const serviceOrderId = payment.serviceOrder?.id;
  if (serviceOrderId) {
    primaryItems.push({
      label: `เลขออเดอร์ ${payment.serviceOrder?.orderNo || serviceOrderId}`,
      icon: "i-lucide-package-search",
      onSelect: () => openServiceOrderDetail(serviceOrderId),
    });
  }

  return [primaryItems];
};

const columns: TableColumn<MyReceiptRecord>[] = [
  {
    accessorKey: "paymentNo",
    header: "เลขชำระ",
    cell: ({ row }) => h("div", {
      class: "font-mono text-xs text-muted cursor-pointer hover:underline",
      onClick: (event: MouseEvent) => {
        event.stopPropagation();
        openPaymentDetail(row.original);
      },
    }, row.original.paymentNo || "-"),
  },
  {
    accessorKey: "customer",
    header: "ลูกค้า",
    cell: ({ row }) => {
      const customer = row.original.customer;
      return h("div", { class: "flex min-w-0 items-center gap-3" }, [
        h(UAvatar, { ...getAvatarProps(customer) }),
        h("div", { class: "min-w-0 max-w-60 space-y-0.5" }, [
          h("p", { class: "truncate font-medium text-highlighted" }, customer?.name || "-"),
          h("p", { class: "truncate text-sm text-muted" }, customer?.email || ""),
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
      const items = payment.packageSale?.items ?? [];
      const serviceOrderId = payment.serviceOrder?.id;
      const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
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
      return h("div", { class: "inline-flex" }, [h(UBadge, { color, variant: "soft", size: "md" }, () => label)]);
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
      const detailButton = h(UButton, {
        icon: "i-lucide-eye",
        size: "xs",
        color: "neutral",
        variant: "ghost",
        title: "ดูรายละเอียด",
        onClick: (event: MouseEvent) => {
          event.stopPropagation();
          openPaymentDetail(row.original);
        },
      });

      const documentButton = h(UButton, {
        icon: row.original.status === "PAID" ? "i-lucide-receipt" : "i-lucide-file-text",
        size: "xs",
        color: "primary",
        variant: "ghost",
        title: row.original.status === "PAID" ? "ดูใบเสร็จ" : "ดูใบแจ้งราคา",
        onClick: (event: MouseEvent) => {
          event.stopPropagation();
          openReceipt(row.original);
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
        documentButton,
        detailButton,
        h(UDropdownMenu, { items: getActionItems(row.original), content: { align: "end" } }, { default: () => menuButton }),
      ]);
    },
  },
];
</script>

<template>
  <UDashboardPanel id="my-payments">
    <template #header>
      <UDashboardNavbar title="ประวัติการชำระเงิน" icon="i-lucide-receipt">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <section class="flex flex-col gap-1">
          <div class="-mx-2 rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 space-y-2 sm:mx-0 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0">
            <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
              <UInput
                v-model="searchQuery"
                class="min-w-0 flex-1"
                icon="i-lucide-search"
                placeholder="ค้นหาเลขชำระ เลขรับผ้า หรือชื่อรายการ"
              />

              <UIButtonRefresh class="shrink-0 md:hidden" :loading="isLoading" @refresh="refresh" />
            </div>

            <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
              <USelect v-model="saleTypeFilter" :items="saleTypeOptions" value-key="value" class="min-w-0 sm:w-44" />
              <UIButtonRefresh class="hidden shrink-0 md:inline-flex" :loading="isLoading" @refresh="refresh" />
            </div>
          </div>

          <template v-if="showSkeleton">
            <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
              <div
                v-for="i in 5"
                :key="`mob-sk-${i}`"
                class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
              >
                <div class="flex items-center gap-2 p-2">
                  <USkeleton class="size-8 rounded-full shrink-0" />
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1 space-y-1">
                        <USkeleton class="h-3.5 w-32 rounded-lg" />
                        <USkeleton class="h-2.5 w-24 rounded-lg" />
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <USkeleton class="h-4 w-16 rounded-full" />
                        <USkeleton class="h-3 w-14 rounded-lg" />
                      </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <USkeleton class="h-3.5 w-14 rounded-full" />
                      <USkeleton class="h-2.5 w-16 rounded-lg" />
                      <USkeleton class="h-2.5 w-20 rounded-lg" />
                    </div>
                    <div class="space-y-1">
                      <USkeleton class="h-3 w-3/4 rounded-lg" />
                      <USkeleton class="h-3 w-1/2 rounded-lg" />
                    </div>
                    <div class="flex items-center justify-end gap-1">
                      <USkeleton class="size-5 rounded-lg" />
                      <USkeleton class="size-5 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
              <div class="space-y-2 p-3">
                <USkeleton v-for="i in 8" :key="`dt-sk-${i}`" class="h-12 w-full rounded-lg" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="md:hidden">
              <div v-if="!paginatedPayments.length" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
                <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                <p>ไม่พบประวัติการชำระเงิน</p>
              </div>

              <div v-else class="-mx-2 space-y-1 sm:mx-0">
                <div
                  v-for="payment in paginatedPayments"
                  :key="payment.id"
                  class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
                >
                  <div class="flex items-start gap-2 p-2">
                    <UAvatar v-bind="getAvatarProps(payment.customer)" size="sm" class="mt-0.5 shrink-0" />

                    <div class="min-w-0 flex-1 space-y-1">
                      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <button
                          type="button"
                          class="min-w-0 truncate text-left text-sm font-medium text-highlighted hover:underline"
                          @click="openPaymentDetail(payment)"
                        >
                          {{ payment.customer.name || "-" }}
                        </button>
                        <div class="shrink-0 text-right">
                          <template v-if="isServiceMember(payment) && Number(payment.amount ?? 0) === 0">
                            <p class="text-[13px] font-semibold leading-none text-success">ใช้เครดิต</p>
                            <p class="mt-0.5 text-[10px] leading-none text-muted">{{ Number(payment.serviceOrder?.creditUsed ?? 0) }} เครดิต</p>
                          </template>
                          <p v-else class="text-[13px] font-semibold leading-none tabular-nums text-primary">{{ formatCurrency(payment.amount) }}</p>
                        </div>
                      </div>

                      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <button
                          type="button"
                          class="min-w-0 truncate text-left font-mono text-[10px] leading-4 text-muted hover:underline"
                          @click="openPaymentDetail(payment)"
                        >
                          {{ payment.paymentNo || payment.id }}
                        </button>
                        <div class="flex shrink-0 items-center justify-end gap-1">
                          <UBadge :color="getSaleTypeColor(payment)" variant="subtle" size="xs">
                            {{ getSaleTypeLabel(payment) }}
                          </UBadge>
                          <UBadge :color="paymentStatusColors[payment.status] || 'neutral'" variant="subtle" size="xs">
                            {{ paymentStatusLabels[payment.status] || payment.status }}
                          </UBadge>
                        </div>
                      </div>

                      <div class="min-w-0">
                        <p class="min-w-0 truncate text-xs text-highlighted">{{ formatMobilePaymentItem(payment) }}</p>
                      </div>

                      <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0 truncate text-[11px] text-muted">
                          {{ getMobilePaymentMeta(payment) }}
                        </div>
                        <div class="flex shrink-0 items-center justify-end gap-1">
                          <UButton
                            :icon="payment.status === 'PAID' ? 'i-lucide-receipt' : 'i-lucide-file-text'"
                            size="xs"
                            color="primary"
                            variant="ghost"
                            :aria-label="payment.status === 'PAID' ? 'ดูใบเสร็จ' : 'ดูใบแจ้งราคา'"
                            @click="openReceipt(payment)"
                          />
                          <UDropdownMenu :items="getActionItems(payment)" :content="{ align: 'end' }">
                            <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" aria-label="เมนูเพิ่มเติม" />
                          </UDropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
              <UTable
                :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
                :data="filteredPayments"
                :columns="columns"
                :loading="isLoading"
                :ui="{
                  root: 'relative overflow-x-auto',
                  base: 'table-fixed border-separate border-spacing-0',
                  thead: 'sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80 [&>tr]:after:content-none',
                  tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45',
                  th: 'border-b border-default bg-default py-2.5 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80',
                  td: 'border-b border-default py-2.5 transition-colors dark:border-default/25',
                  separator: 'h-0',
                }"
              >
                <template #empty>
                  <div v-if="isLoading" class="space-y-2 p-3">
                    <USkeleton v-for="i in 6" :key="`tbl-${i}`" class="h-12 w-full rounded-lg" />
                  </div>
                  <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
                    <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                    <p>ไม่พบประวัติการชำระเงิน</p>
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
            v-if="!showSkeleton && filteredRowCount > pagination.pageSize"
            :page="pagination.pageIndex + 1"
            :items-per-page="pagination.pageSize"
            :total="filteredRowCount"
            @update:page="setPage"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
