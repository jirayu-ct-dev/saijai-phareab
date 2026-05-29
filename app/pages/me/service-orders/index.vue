<script setup lang="ts">
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

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

const serviceOrderStatusOptions = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];

const { orders, meta, page, pageSize, status: statusFilter, pending: isLoading, refresh } = useMyOrders();

const hydrated = ref(false);
const activatedOnce = ref(false);
onMounted(() => {
  hydrated.value = true;
});
const showSkeleton = computed(() => !hydrated.value || isLoading.value);
const route = useRoute();

onActivated(async () => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }
  await refresh();
});

const searchQuery = ref("");

watch(
  () => route.query.status,
  (value) => {
    const nextStatus = Array.isArray(value) ? value[0] : value;
    statusFilter.value = serviceOrderStatusOptions.some((item) => item.value === nextStatus) ? nextStatus : "ALL";
  },
  { immediate: true },
);

const filteredServiceOrders = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return (orders.value ?? []).filter((order: any) => {
    const matchKeyword = keyword
      ? [
          order.orderNo ?? "",
          order.customer?.name ?? "",
          order.customer?.email ?? "",
          order.customer?.phoneNumber ?? "",
          order.note ?? "",
          ...(order.items || []).map((item: any) => item.label),
        ].join(" ").toLowerCase().includes(keyword)
      : true;
    return matchKeyword;
  });
});

const filteredRowCount = computed(() => meta.value.total);

const setPage = (newPage: number) => {
  page.value = newPage;
};

const currentPageRange = computed(() => {
  const total = meta.value.total;
  if (!total) return { start: 0, end: 0, total: 0 };
  const start = (page.value - 1) * pageSize.value + 1;
  const end = Math.min(total, start + pageSize.value - 1);
  return { start, end, total };
});

const paginationSummary = computed(() => {
  const { start, end, total } = currentPageRange.value;
  if (!total) return "ไม่พบรายการ";
  return `แสดง ${start}-${end} จาก ${total} รายการ`;
});

const getAvatarProps = (customer?: any) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const formatItemSummary = (order: any) => {
  if (!order.items || !order.items.length) return [];
  const items = order.items.slice(0, 1).map((item: any) => `${item.label} x${item.quantity}`);
  if (order.items.length > 1) items.push(`+ อีก ${order.items.length - 1} รายการ`);
  return items;
};

const formatOptionalShortDate = (value: string | null | undefined) => value ? formatDate(value).replace(/\s+\d{4}$/, "") : "-";

const openDocument = (order: any) => {
  const paymentId = order.payment?.id;
  if (!paymentId) return navigateTo(`/me/service-orders/${order.id}`);
  const path = order.payment?.status === "PAID" ? "receipt" : "quotation";
  return navigateTo(`/me/receipts/${paymentId}`); // Assuming users go to /me/receipts
};

const openDetailPage = (order: any) => navigateTo(`/me/service-orders/${order.id}`);

const getActionItems = (order: any) => {
  const primaryItems: Array<Record<string, unknown>> = [
    order.payment?.status === "PAID"
      ? { label: "ดูใบเสร็จ", icon: "i-lucide-receipt", onSelect: () => openDocument(order) }
      : { label: "ดูใบแจ้งราคา", icon: "i-lucide-file-text", onSelect: () => openDocument(order) },
  ];
  return [primaryItems];
};

const columns: TableColumn<any>[] = [
  {
    accessorKey: "orderNo",
    header: "เลขรับผ้า",
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted cursor-pointer hover:underline", onClick: (e: MouseEvent) => { e.stopPropagation(); openDetailPage(row.original); } }, row.original.orderNo || row.original.id),
  },
  {
    accessorKey: "customer",
    header: "ลูกค้า",
    cell: ({ row }) => {
      const customer = row.original.customer || {};
      const entitlement = row.original.memberEntitlement;
      return h("div", { class: "flex items-center gap-3 cursor-pointer", onClick: (e: MouseEvent) => { e.stopPropagation(); openDetailPage(row.original); } }, [
        h(UAvatar, { ...getAvatarProps(customer) }),
        h("div", { class: "space-y-0.5" }, [
          h("div", { class: "flex flex-wrap items-center gap-1.5" }, [
            h("p", { class: "font-medium text-highlighted hover:underline" }, customer.name || "-"),
            entitlement ? h(UBadge, { color: "success", variant: "subtle", size: "xs" }, () => "รายเดือน") : null,
          ]),
          h("p", { class: "text-xs text-muted" }, customer.phoneNumber || customer.email),
        ]),
      ]);
    },
  },
  {
    id: "items",
    header: "รายการ",
    cell: ({ row }) => h("div", { class: "space-y-1" }, formatItemSummary(row.original).map((item: string) => h("p", { class: "text-sm text-highlighted" }, item))),
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
      const color = orderStatusColors[order.status as keyof typeof orderStatusColors] || "neutral";
      const label = orderStatusLabels[order.status as keyof typeof orderStatusLabels] || order.status;
      return h(UBadge, { color, variant: "subtle" }, () => label);
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
        h(UButton, { icon: "i-lucide-eye", size: "xs", color: "neutral", variant: "ghost", title: "ดูรายละเอียดรายการรับผ้า", onClick: () => openDetailPage(order) }),
        h(UDropdownMenu, { items: getActionItems(order), content: { align: "end" } }, {
          default: () => h(UButton, { icon: "i-lucide-ellipsis", size: "xs", color: "neutral", variant: "ghost", title: "เมนูเพิ่มเติม" }),
        }),
      ]);
    },
  },
];
</script>

<template>
  <UDashboardPanel id="my-service-orders">
    <template #header>
      <UDashboardNavbar title="รายการออเดอร์ของฉัน" icon="i-lucide-shopping-basket">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div :class="adminDashboardBodyClass">
        <section class="flex flex-col gap-1">
          <div :class="[adminFilterBarClass, 'space-y-2 px-3! py-2! md:flex md:items-center md:justify-between md:gap-3 md:space-y-0']">
            <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
              <UInput v-model="searchQuery" class="min-w-0 flex-1" icon="i-lucide-search" placeholder="ค้นหาเลขรับผ้า ลูกค้า เบอร์โทร หรือชื่อรายการ" />
              <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" class="shrink-0 md:hidden" :loading="isLoading" title="รีเฟรชรายการ" @click="refresh" />
            </div>

            <div class="grid grid-cols-1 gap-2 sm:flex sm:items-center md:justify-end">
              <USelect v-model="statusFilter" :items="[{ label: 'ทุกสถานะงาน', value: 'ALL' }, ...serviceOrderStatusOptions]" value-key="value" class="min-w-0 sm:w-40" />
              <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" class="hidden shrink-0 md:inline-flex" :loading="isLoading" title="รีเฟรชรายการ" @click="refresh" />
            </div>
          </div>

          <template v-if="showSkeleton">
            <div class="space-y-1 md:hidden">
              <div v-for="i in 5" :key="`so-mob-sk-${i}`" :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md']">
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
                      <USkeleton class="h-2.5 w-28 rounded" />
                      <USkeleton class="h-2.5 w-20 rounded" />
                    </div>
                    <USkeleton class="h-3 w-3/4 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div :class="[adminDashboardCardClass, 'hidden p-0! md:block']">
              <div class="space-y-2 p-3">
                <USkeleton v-for="i in 8" :key="`so-dt-sk-${i}`" class="h-12 w-full rounded-md" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="md:hidden">
              <div v-if="!filteredServiceOrders.length" :class="adminEmptyStateClass">
                <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
                <p>ไม่พบรายการรับผ้า</p>
              </div>

              <div v-else class="space-y-1">
                <div v-for="order in filteredServiceOrders" :key="order.id" :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md cursor-pointer']" @click="openDetailPage(order)">
                  <div class="flex items-center gap-2 p-2">
                    <UAvatar v-bind="getAvatarProps(order.customer)" size="sm" class="shrink-0" />

                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <span class="block max-w-full truncate text-left text-sm font-medium text-highlighted hover:underline">
                            {{ order.customer?.name || "-" }}
                          </span>
                          <span class="block max-w-full truncate font-mono text-[10px] text-muted">
                            {{ order.orderNo || order.id }}
                          </span>
                        </div>

                        <div class="flex shrink-0 flex-col items-end gap-1">
                          <UBadge :color="orderStatusColors[order.status as keyof typeof orderStatusColors]" variant="subtle" size="xs">
                            {{ orderStatusLabels[order.status as keyof typeof orderStatusLabels] || order.status }}
                          </UBadge>
                          <template v-if="order.memberEntitlement && Number(order.totalAmount ?? 0) === 0">
                            <span class="text-sm font-semibold leading-none text-success">ใช้เครดิต</span>
                            <span class="text-[10px] text-muted">{{ order.creditUsed ?? 0 }} เครดิต</span>
                          </template>
                          <span v-else class="text-sm font-semibold leading-none text-primary">{{ formatCurrency(Number(order.totalAmount ?? 0)) }}</span>
                        </div>
                      </div>

                      <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                        <span>รับ {{ formatOptionalShortDate(order.receivedAt) }}</span>
                        <span>{{ order.status === "COMPLETED" ? "ส่ง" : "นัด" }} {{ formatOptionalShortDate((order.status === "COMPLETED" ? order.payment?.paidAt : order.dueAt) || order.dueAt) }}</span>
                      </div>

                      <div class="mt-1 min-w-0">
                        <p class="truncate text-xs text-highlighted">
                          {{ formatItemSummary(order).join(" · ") || "ไม่มีรายการผ้า" }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div :class="[adminDashboardCardClass, 'hidden overflow-hidden p-0! md:block']">
              <UTable
                :data="filteredServiceOrders"
                :columns="columns"
                :loading="isLoading"
                :ui="adminTableUi"
              >
                <template #empty>
                  <div :class="adminEmptyStateClass">
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
            v-if="!showSkeleton && meta.total > pageSize"
            :page="page"
            :items-per-page="pageSize"
            :total="meta.total"
            @update:page="setPage"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
