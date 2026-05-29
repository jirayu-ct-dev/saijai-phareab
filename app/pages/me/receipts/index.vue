<script setup lang="ts">
import { h, resolveComponent } from "vue";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";
import { paymentMethodLabels, paymentStatusColors, paymentStatusLabels } from "~~/shared/config/paymentConfig";

const adminDashboardBodyClass = adminUi.adminDashboardBodyClass ?? "admin-dashboard flex flex-col gap-3 p-2 sm:p-6";
const adminDashboardCardClass = adminUi.adminDashboardCardClass ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55";
const adminFilterBarClass = adminUi.adminFilterBarClass ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55";
const adminEmptyStateClass = adminUi.adminEmptyStateClass ?? "flex flex-col items-center justify-center rounded-sm border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30";
const adminMobileListCardClass = adminUi.adminMobileListCardClass ?? "overflow-hidden rounded-sm border border-default/30 bg-default transition-[background-color,border-color,box-shadow] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70";
const adminTableUi = adminUi.adminTableUi;

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const { user } = useUser();
const { receipts: payments, pending: isLoading, refresh } = useMyReceipts();

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
const getAvatarProps = (customer?: any) => ({
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

const filteredPayments = computed<any[]>(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return (payments.value ?? []).filter((payment) => {
    const matchKeyword = keyword
      ? [
          payment.paymentNo ?? "",
          payment.customer?.name ?? "",
          payment.customer?.email ?? "",
          payment.customer?.phoneNumber ?? "",
          payment.packageSale?.productName ?? "",
          ...(payment.packageSale?.items ?? []).map((item: any) => item.productName),
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

const openPaymentDetail = (payment: any) => navigateTo(`/me/receipts/${payment.id}`);
const openReceipt = (payment: any) => {
  // Normally it would be receipt vs quotation. Since the user asked for `/me/receipts`, we just go to the detail view which will handle the receipt display.
  return navigateTo(`/me/receipts/${payment.id}`);
};
const openServiceOrderDetail = (serviceOrderId: string) => navigateTo(`/me/service-orders/${serviceOrderId}`);

const isServiceMember = (payment: any) =>
  Boolean(payment.serviceOrder?.id) && Boolean(payment.serviceOrder?.memberEntitlementId);

const getSaleType = (payment: any) => {
  if (payment.serviceOrder?.id) {
    return isServiceMember(payment) ? "SERVICE_MEMBER" : "SERVICE";
  }
  return "PACKAGE";
};
const getSaleTypeLabel = (payment: any) => {
  const type = getSaleType(payment);
  if (type === "SERVICE_MEMBER") return "งานซักรีด (รายเดือน)";
  if (type === "SERVICE") return "งานซักรีด";
  return "แพ็กเกจ";
};
const getSaleTypeColor = (payment: any) => {
  const type = getSaleType(payment);
  if (type === "SERVICE_MEMBER") return "success";
  if (type === "SERVICE") return "warning";
  return "primary";
};

const formatPaymentItems = (payment: any) => {
  if (payment.packageSale?.items?.length) {
    const items = payment.packageSale.items.slice(0, 2).map((item: any) => `${item.productName} x${item.quantity}`);
    if (payment.packageSale.items.length > 2) items.push(`+ อีก ${payment.packageSale.items.length - 2} รายการ`);
    return items;
  }
  return [`รายการผ้า ${payment.serviceOrder?.itemCount ?? 0} รายการ`];
};

const getPaymentMethodLabel = (payment: any) => (
  payment.method ? paymentMethodLabels[payment.method as keyof typeof paymentMethodLabels] : "ยังไม่ชำระ"
);

const getActionItems = (payment: any) => {
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

const columns: TableColumn<any>[] = [
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
      const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (serviceOrderId) openServiceOrderDetail(serviceOrderId);
        else openPaymentDetail(payment);
      };

      if (items.length > 0) {
        return h(
          "div",
          { class: "space-y-1 cursor-pointer", onClick: handleClick },
          items.map((item: any) =>
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
      const color = paymentStatusColors[payment.status as keyof typeof paymentStatusColors] ?? "neutral";
      const label = paymentStatusLabels[payment.status as keyof typeof paymentStatusLabels] ?? payment.status;
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
      <UDashboardNavbar title="รายการชำระเงิน" icon="i-lucide-receipt">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
        <div :class="adminDashboardBodyClass">
          <section class="flex flex-col gap-1">
            <div :class="[adminFilterBarClass, 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3! py-2!']">
              <div class="flex min-w-0 flex-1 md:max-w-xl">
                <UInput
                  v-model="searchQuery"
                  class="min-w-0 flex-1"
                  icon="i-lucide-search"
                  placeholder="ค้นหาเลขชำระ เลขรับผ้า หรือชื่อรายการ"
                />
              </div>

              <div class="flex shrink-0 items-center justify-end gap-1.5">
                <USelect v-model="saleTypeFilter" :items="saleTypeOptions" value-key="value" class="w-28 shrink-0 sm:w-40" />

                <UButton
                  icon="i-lucide-refresh-cw"
                  color="neutral"
                  variant="outline"
                  title="รีเฟรชรายการ"
                  class="shrink-0 md:hidden"
                  :loading="isLoading"
                  @click="refresh"
                />
              </div>
            </div>

            <template v-if="showSkeleton">
              <div class="space-y-1 md:hidden">
                <div v-for="i in 5" :key="`mob-sk-${i}`" :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md']">
                  <div class="flex items-center gap-2 p-2">
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
                        <USkeleton class="h-3.5 w-14 rounded-full" />
                        <USkeleton class="h-2.5 w-16 rounded" />
                        <USkeleton class="h-2.5 w-20 rounded" />
                      </div>
                      <div class="space-y-1">
                        <USkeleton class="h-3 w-3/4 rounded" />
                        <USkeleton class="h-3 w-1/2 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div :class="[adminDashboardCardClass, 'hidden p-0! md:block']">
                <div class="space-y-2 p-3">
                  <USkeleton v-for="i in 8" :key="`dt-sk-${i}`" class="h-12 w-full rounded-md" />
                </div>
              </div>
            </template>

            <template v-else>
            <div class="md:hidden">
            <div v-if="!paginatedPayments.length" :class="adminEmptyStateClass">
              <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบรายการชำระเงิน</p>
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="(payment, index) in paginatedPayments"
                :key="payment.id"
                :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md cursor-pointer']"
                @click="openPaymentDetail(payment)"
              >
                <div class="flex items-center gap-2 p-2">
                  <UAvatar v-bind="getAvatarProps(payment.customer)" size="sm" class="shrink-0" />

                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <span class="block max-w-full truncate text-left text-sm font-medium text-highlighted hover:underline">
                          {{ payment.customer?.name || "-" }}
                        </span>
                        <span class="block max-w-full truncate font-mono text-[10px] text-muted hover:underline">
                          {{ payment.paymentNo || payment.id }}
                        </span>
                      </div>

                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <UBadge :color="paymentStatusColors[payment.status as keyof typeof paymentStatusColors] || 'neutral'" variant="subtle" size="xs">
                          {{ paymentStatusLabels[payment.status as keyof typeof paymentStatusLabels] || payment.status }}
                        </UBadge>
                        <template v-if="isServiceMember(payment) && Number(payment.amount ?? 0) === 0">
                          <span class="text-sm font-semibold leading-none text-success">ใช้เครดิต</span>
                          <span class="text-[10px] text-muted">{{ Number(payment.serviceOrder?.creditUsed ?? 0) }} เครดิต</span>
                        </template>
                        <span v-else class="text-sm font-semibold leading-none text-primary">{{ formatCurrency(payment.amount) }}</span>
                      </div>
                    </div>

                    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                      <UBadge :color="getSaleTypeColor(payment)" variant="subtle" size="xs">
                        {{ getSaleTypeLabel(payment) }}
                      </UBadge>
                      <span>{{ getPaymentMethodLabel(payment) }}</span>
                      <span>{{ formatDateTime(payment.createdAt) }}</span>
                    </div>

                    <div class="mt-1 min-w-0 space-y-0.5">
                      <p v-for="item in formatPaymentItems(payment)" :key="item" class="truncate text-xs text-highlighted">
                        {{ item }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

            <div :class="[adminDashboardCardClass, 'hidden overflow-hidden p-0! md:block']">
            <UTable
              :data="paginatedPayments"
              :columns="columns"
              :loading="isLoading"
              :ui="adminTableUi"
            >
              <template #empty>
                <div :class="adminEmptyStateClass">
                  <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                  <p>ไม่พบรายการชำระเงิน</p>
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
