<script setup lang="ts">
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const UAvatar = resolveComponent("UAvatar");
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const serviceOrderStatusOptions: Array<{ label: string; value: ServiceOrderStatus }> = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];

const { orders, meta, page, pageSize, status: statusFilter, pending: isLoading, refresh } = useMyOrders();
type MyServiceOrder = (typeof orders.value)[number];

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
    const nextStatus = (Array.isArray(value) ? value[0] : value) || "";
    statusFilter.value = serviceOrderStatusOptions.some((item) => item.value === nextStatus) ? nextStatus : "ALL";
  },
  { immediate: true },
);

watch([searchQuery, statusFilter], () => {
  page.value = 1;
});

const filteredServiceOrders = computed<MyServiceOrder[]>(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return (orders.value ?? []).filter((order) => {
    if (!keyword) return true;
    return [
      order.orderNo ?? "",
      order.customer?.name ?? "",
      order.customer?.email ?? "",
      order.customer?.phoneNumber ?? "",
      order.note ?? "",
      ...(order.items || []).map((item) => item.label),
    ].join(" ").toLowerCase().includes(keyword);
  });
});

const filteredRowCount = computed(() => searchQuery.value.trim() ? filteredServiceOrders.value.length : meta.value.total);

const setPage = (newPage: number) => {
  page.value = newPage;
};

const currentPageRange = computed(() => {
  const total = filteredRowCount.value;
  if (!total) return { start: 0, end: 0, total: 0 };
  const start = searchQuery.value.trim() ? 1 : (page.value - 1) * pageSize.value + 1;
  const end = searchQuery.value.trim()
    ? filteredServiceOrders.value.length
    : Math.min(total, start + pageSize.value - 1);
  return { start, end, total };
});

const paginationSummary = computed(() => {
  const { start, end, total } = currentPageRange.value;
  if (!total) return "ไม่พบรายการ";
  return `แสดง ${start}-${end} จาก ${total} รายการ`;
});

const getAvatarProps = (customer?: MyServiceOrder["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const formatItemSummary = (order: MyServiceOrder) => {
  const sourceItems = order.items || [];
  const items = sourceItems.slice(0, 1).map((item) => `${item.label} x${item.quantity}`);
  if (sourceItems.length > 1) items.push(`+ อีก ${sourceItems.length - 1} รายการ`);
  return items;
};

const formatOptionalShortDate = (value: string | null | undefined) => value ? formatDate(value).replace(/\s+\d{4}$/, "") : "-";

const openDocument = (order: MyServiceOrder) => {
  const paymentId = order.payment?.id;
  if (!paymentId) return navigateTo(`/me/service-orders/${order.id}`);
  return navigateTo(`/me/receipts/${paymentId}`);
};

const openDetailPage = (order: MyServiceOrder) => navigateTo(`/me/service-orders/${order.id}`);

const getActionItems = (order: MyServiceOrder) => {
  const primaryItems: Array<Record<string, unknown>> = [
    { label: "ดูรายละเอียด", icon: "i-lucide-eye", onSelect: () => openDetailPage(order) },
    order.payment?.status === "PAID"
      ? { label: "ดูใบเสร็จ", icon: "i-lucide-receipt", onSelect: () => openDocument(order) }
      : { label: "ดูใบแจ้งราคา", icon: "i-lucide-file-text", onSelect: () => openDocument(order) },
  ];
  return [primaryItems];
};

const columns: TableColumn<MyServiceOrder>[] = [
  {
    accessorKey: "orderNo",
    header: "เลขรับผ้า",
    cell: ({ row }) => h("div", {
      class: "font-mono text-xs text-muted cursor-pointer hover:underline",
      onClick: (event: MouseEvent) => {
        event.stopPropagation();
        openDetailPage(row.original);
      },
    }, row.original.orderNo || row.original.id),
  },
  {
    accessorKey: "customer",
    header: "ลูกค้า",
    cell: ({ row }) => {
      const customer = row.original.customer;
      const entitlement = row.original.memberEntitlement;
      return h("div", { class: "flex items-center gap-3 cursor-pointer", onClick: () => openDetailPage(row.original) }, [
        h(UAvatar, { ...getAvatarProps(customer) }),
        h("div", { class: "space-y-0.5" }, [
          h("div", { class: "flex flex-wrap items-center gap-1.5" }, [
            h("p", { class: "font-medium text-highlighted hover:underline" }, customer?.name || "-"),
            entitlement ? h(UBadge, { color: "success", variant: "subtle", size: "xs" }, () => "รายเดือน") : null,
          ]),
          h("p", { class: "text-xs text-muted" }, customer?.phoneNumber || customer?.email || "-"),
        ]),
      ]);
    },
  },
  {
    id: "items",
    header: "รายการ",
    cell: ({ row }) => h(
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
    cell: ({ row }) => h(
      UBadge,
      { color: orderStatusColors[row.original.status as ServiceOrderStatus], variant: "subtle" },
      () => orderStatusLabels[row.original.status as ServiceOrderStatus],
    ),
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
        h(
          UDropdownMenu,
          { items: getActionItems(order), content: { align: "end" } },
          {
            default: () => h(UButton, {
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
  <UDashboardPanel id="my-service-orders">
    <template #header>
      <UDashboardNavbar title="รายการออเดอร์ของฉัน" icon="i-lucide-shopping-basket">
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
                placeholder="ค้นหาเลขรับผ้า ลูกค้า เบอร์โทร หรือชื่อรายการ"
              />

              <UIButtonRefresh class="shrink-0 md:hidden" :loading="isLoading" @refresh="refresh" />
            </div>

            <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
              <USelect
                v-model="statusFilter"
                :items="[{ label: 'ทุกสถานะงาน', value: 'ALL' }, ...serviceOrderStatusOptions]"
                value-key="value"
                class="min-w-0 sm:w-40"
              />

              <UIButtonRefresh class="hidden shrink-0 md:inline-flex" :loading="isLoading" @refresh="refresh" />
            </div>
          </div>

          <template v-if="showSkeleton">
            <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
              <div
                v-for="i in 5"
                :key="`so-mob-sk-${i}`"
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
                      <div class="flex shrink-0 flex-col items-end gap-1.5">
                        <USkeleton class="h-4 w-16 rounded-full" />
                        <USkeleton class="h-3 w-14 rounded-lg" />
                      </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <USkeleton class="h-2.5 w-28 rounded-lg" />
                      <USkeleton class="h-2.5 w-20 rounded-lg" />
                    </div>
                    <USkeleton class="h-3 w-3/4 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
            <div class="hidden rounded-lg border border-default/30 bg-default p-4 p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
              <div class="space-y-2 p-3">
                <USkeleton v-for="i in 8" :key="`so-dt-sk-${i}`" class="h-12 w-full rounded-lg" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="md:hidden">
              <div v-if="!filteredServiceOrders.length" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
                <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
                <p>ไม่พบรายการรับผ้า</p>
              </div>

              <div v-else class="-mx-2 space-y-1 sm:mx-0">
                <div
                  v-for="order in filteredServiceOrders"
                  :key="order.id"
                  class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
                >
                  <div class="flex items-center gap-2 p-2">
                    <UAvatar v-bind="getAvatarProps(order.customer)" size="sm" class="shrink-0" />

                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <button
                            type="button"
                            class="block max-w-full truncate text-left text-sm font-medium text-highlighted hover:underline"
                            @click="openDetailPage(order)"
                          >
                            {{ order.customer?.name || "-" }}
                            <span class="text-[11px] font-normal text-muted">· {{ order.customer?.phoneNumber || order.customer?.email || "-" }}</span>
                          </button>
                          <button
                            type="button"
                            class="block max-w-full truncate font-mono text-[10px] text-muted hover:underline"
                            @click="openDetailPage(order)"
                          >
                            {{ order.orderNo || order.id }}
                          </button>
                        </div>

                        <div class="flex shrink-0 flex-col items-end gap-1.5">
                          <UBadge :color="orderStatusColors[order.status as ServiceOrderStatus]" variant="soft" size="xs" class="font-medium">
                            {{ orderStatusLabels[order.status as ServiceOrderStatus] }}
                          </UBadge>
                          <template v-if="order.memberEntitlement && Number(order.totalAmount ?? 0) === 0">
                            <span class="text-[13px] font-semibold leading-none text-success">ใช้เครดิต</span>
                            <span class="text-[10px] text-muted">{{ order.creditUsed ?? 0 }} เครดิต</span>
                          </template>
                          <span v-else class="text-[13px] font-semibold leading-none tabular-nums text-primary">{{ formatCurrency(Number(order.totalAmount ?? 0)) }}</span>
                        </div>
                      </div>

                      <div class="mt-1 min-w-0">
                        <p class="truncate text-xs text-highlighted">
                          {{ formatItemSummary(order).join(" · ") || "ไม่มีรายการผ้า" }}
                        </p>
                      </div>

                      <div class="mt-1 flex items-center justify-between gap-2">
                        <div class="min-w-0 truncate text-[11px] text-muted">
                          รับ {{ formatOptionalShortDate(order.receivedAt) }} · {{ order.status === "COMPLETED" ? "ส่ง" : "นัด" }} {{ formatOptionalShortDate((order.status === "COMPLETED" ? order.payment?.paidAt : order.dueAt) || order.dueAt) }}
                        </div>
                        <div class="flex shrink-0 items-center justify-end gap-1">
                          <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายละเอียด" @click="openDetailPage(order)" />
                          <UDropdownMenu :items="getActionItems(order)" :content="{ align: 'end' }">
                            <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" aria-label="เมนูเพิ่มเติม" />
                          </UDropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default p-4 p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
              <UTable
                :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
                :data="filteredServiceOrders"
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
                    <USkeleton v-for="i in 6" :key="`so-tbl-${i}`" class="h-12 w-full rounded-lg" />
                  </div>
                  <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
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
            v-if="!showSkeleton && !searchQuery.trim() && meta.total > pageSize"
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
