<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatDate, formatDateTime } from "~~/shared/utils/format";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");

interface MembershipUsage {
  orderId: string;
  orderNo: string | null;
  receivedAt: string;
  creditUsed: number | null;
  itemCount: number;
  status: string;
}

interface MembershipEntitlement {
  id: string;
  productName: string;
  packageType: string;
  creditInitial: number | null;
  creditRemaining: number | null;
  status: string;
  startAt: string | null;
  endAt: string | null;
}

const entitlementStatusLabels: Record<string, string> = {
  ACTIVE: "กำลังใช้งาน",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกแล้ว",
};

const route = useRoute();
const router = useRouter();
const entitlementId = computed(() => (route.query.id as string) || "");

const { entitlements } = useMyMembership();
const currentId = ref(entitlementId.value);

watch(entitlements, (newEntitlements) => {
  if (!currentId.value && newEntitlements.length > 0) {
    const active = newEntitlements.find((e) => e.status === "ACTIVE");
    currentId.value = active ? active.id : (newEntitlements[0]?.id ?? "");
  }
}, { immediate: true });

watch(currentId, (id) => {
  if (id && id !== entitlementId.value) {
    router.replace({ query: { ...route.query, id } });
  }
});

const { entitlement, usages, pending: isLoading, refresh } = useMyMembershipUsage(currentId);

const activatedOnce = ref(false);
const hydrated = ref(false);
onMounted(() => {
  hydrated.value = true;
});
const showSkeleton = computed(() => !hydrated.value || isLoading.value);

onActivated(async () => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }
  await refresh();
});

const statusFilter = ref("ALL");
const searchQuery = ref("");
const page = ref(1);
const pageSize = 10;

const orderStatusOptions = (["RECEIVED", "PROCESSING", "DELIVERING", "COMPLETED", "CANCELLED"] as ServiceOrderStatus[])
  .map((status) => ({ label: orderStatusLabels[status], value: status }));

const packageOptions = computed(() =>
  entitlements.value.map((e) => ({
    label: entitlementStatusLabels[e.status]
      ? `${e.productName} · ${entitlementStatusLabels[e.status]}`
      : e.productName,
    value: e.id,
  })),
);

watch([searchQuery, statusFilter, currentId], () => {
  page.value = 1;
});

const filteredUsages = computed<MembershipUsage[]>(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return (usages.value ?? []).filter((usage) => {
    if (statusFilter.value !== "ALL" && usage.status !== statusFilter.value) return false;
    if (!keyword) return true;
    return (usage.orderNo ?? "").toLowerCase().includes(keyword);
  });
});

const sorting = ref<Array<{ id: string; desc: boolean }>>([{ id: "receivedAt", desc: true }]);

const sortedUsages = computed<MembershipUsage[]>(() => {
  const list = [...filteredUsages.value];
  const sort = sorting.value[0];
  if (!sort) return list;
  const direction = sort.desc ? -1 : 1;
  return list.sort((a, b) => {
    const getValue = (usage: MembershipUsage) => {
      if (sort.id === "creditUsed") return usage.creditUsed ?? 0;
      if (sort.id === "itemCount") return usage.itemCount;
      if (sort.id === "orderNo") return usage.orderNo ?? "";
      return usage.receivedAt;
    };
    const aVal = getValue(a);
    const bVal = getValue(b);
    if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * direction;
    return String(aVal).localeCompare(String(bVal)) * direction;
  });
});

const pagedUsages = computed<MembershipUsage[]>(() => {
  const start = (page.value - 1) * pageSize;
  return sortedUsages.value.slice(start, start + pageSize);
});

const paginationSummary = computed(() => {
  const total = filteredUsages.value.length;
  if (!total) return "ไม่พบรายการ";
  const start = (page.value - 1) * pageSize + 1;
  const end = Math.min(total, start + pageSize - 1);
  return `แสดง ${start}-${end} จาก ${total} รายการ`;
});

const hasActiveFilters = computed(() => Boolean(searchQuery.value.trim()) || statusFilter.value !== "ALL");

const clearFilters = () => {
  searchQuery.value = "";
  statusFilter.value = "ALL";
};

const usageRankById = computed(() => {
  const chronological = [...(usages.value ?? [])].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const rankById = new Map<string, number>();
  chronological.forEach((usage, index) => rankById.set(usage.orderId, chronological.length - index));
  return rankById;
});

const openOrderDetail = (usage: MembershipUsage) => navigateTo(`/me/service-orders/${usage.orderId}`);

const toggleSort = (id: string) => {
  const current = sorting.value[0];
  sorting.value = [current?.id === id ? { id, desc: !current.desc } : { id, desc: true }];
};

const getSortIcon = (id: string) => {
  const sort = sorting.value[0];
  if (!sort || sort.id !== id) return "i-lucide-chevrons-up-down";
  return sort.desc ? "i-lucide-arrow-down" : "i-lucide-arrow-up";
};

const sortableHeader = (label: string, id: string, alignRight = false) => () => h(UButton, {
  label,
  icon: getSortIcon(id),
  trailing: true,
  size: "xs",
  color: "neutral",
  variant: "ghost",
  class: alignRight ? "flex-row-reverse -mr-1.5" : "-ml-1.5",
  "aria-label": `เรียงตาม${label}`,
  onClick: () => toggleSort(id),
});

const columns: TableColumn<MembershipUsage>[] = [
  {
    id: "index",
    header: "ครั้งที่",
    cell: ({ row }) => h("span", { class: "text-sm text-muted tabular-nums" }, `#${usageRankById.value.get(row.original.orderId) ?? "-"}`),
  },
  {
    accessorKey: "receivedAt",
    header: sortableHeader("วันที่รับผ้า", "receivedAt"),
    cell: ({ row }) => h("span", { class: "text-sm text-highlighted whitespace-nowrap" }, formatDateTime(row.original.receivedAt)),
  },
  {
    accessorKey: "orderNo",
    header: sortableHeader("เลขรับผ้า", "orderNo"),
    cell: ({ row }) => h("button", {
      type: "button",
      class: "font-mono text-xs text-primary hover:underline cursor-pointer",
      onClick: () => openOrderDetail(row.original),
    }, row.original.orderNo || "-"),
  },
  {
    accessorKey: "itemCount",
    header: sortableHeader("จำนวนชิ้น", "itemCount", true),
    cell: ({ row }) => h("div", { class: "text-sm text-highlighted text-right tabular-nums" }, `${row.original.itemCount} ชิ้น`),
  },
  {
    accessorKey: "creditUsed",
    header: sortableHeader("เครดิตที่ใช้", "creditUsed", true),
    cell: ({ row }) => h("div", { class: "text-right" }, h(
      UBadge,
      { color: "primary", variant: "subtle", size: "sm" },
      () => `${row.original.creditUsed ?? 0} ครั้ง`,
    )),
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) => h(
      UBadge,
      { color: orderStatusColors[row.original.status as ServiceOrderStatus], variant: "subtle" },
      () => orderStatusLabels[row.original.status as ServiceOrderStatus],
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => h("div", { class: "flex justify-end" }, h(UButton, {
      icon: "i-lucide-eye",
      size: "xs",
      color: "neutral",
      variant: "ghost",
      title: "ดูรายละเอียดรายการรับผ้า",
      onClick: () => openOrderDetail(row.original),
    })),
  },
];

const creditInitial = computed(() => Math.max(0, Number(entitlement.value?.creditInitial) || 0));
const creditRemaining = computed(() => Math.max(0, Number(entitlement.value?.creditRemaining) || 0));
const creditUsed = computed(() => Math.max(0, creditInitial.value - creditRemaining.value));

const entitlementPeriod = computed(() => {
  const data = entitlement.value as MembershipEntitlement | null;
  if (!data?.startAt && !data?.endAt) return "-";
  return `${data.startAt ? formatDate(data.startAt) : "-"} ถึง ${data.endAt ? formatDate(data.endAt) : "-"}`;
});

const emptyState = computed(() => {
  if (!(usages.value ?? []).length) {
    return { icon: "i-lucide-receipt-text", title: "ยังไม่มีประวัติการใช้งาน", description: "เมื่อใช้บริการด้วยแพ็กเกจนี้ รายการจะแสดงที่นี่" };
  }
  return { icon: "i-lucide-search-x", title: "ไม่พบรายการที่ค้นหา", description: "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" };
});
</script>

<template>
  <UDashboardPanel id="my-membership-usage" grow>
    <template #header>
      <UDashboardNavbar title="ประวัติการใช้เครดิต" icon="i-lucide-receipt-text">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton color="neutral" variant="ghost" to="/me/membership" icon="i-lucide-arrow-left">
            กลับ
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <!-- Filter bar -->
        <div class="rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 space-y-2 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0">
          <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
            <USelectMenu
              v-model="currentId"
              :items="packageOptions"
              value-key="value"
              placeholder="เลือกแพ็กเกจ"
              class="min-w-0 flex-1"
            />
          </div>

          <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="ค้นหาเลขรับผ้า"
              class="min-w-0 sm:w-48"
            />

            <USelect
              v-model="statusFilter"
              :items="[{ label: 'ทุกสถานะงาน', value: 'ALL' }, ...orderStatusOptions]"
              value-key="value"
              class="min-w-0 sm:w-40"
            />

            <UIButtonRefresh class="shrink-0" :loading="isLoading" @refresh="refresh" />
          </div>
        </div>

        <div v-if="showSkeleton" class="space-y-3">
          <USkeleton class="h-24 w-full rounded-lg" />
          <USkeleton class="h-64 w-full rounded-lg" />
        </div>

        <div v-else-if="!entitlement" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
          <UIcon name="i-lucide-package-x" class="mb-3 size-10 opacity-60" />
          <p>ไม่พบข้อมูลแพ็กเกจ</p>
        </div>

        <template v-else>
          <!-- Package summary -->
          <section class="rounded-lg border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="truncate font-semibold text-highlighted">{{ entitlement.productName }}</h2>
                  <UBadge :color="entitlement.status === 'ACTIVE' ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ entitlementStatusLabels[entitlement.status] || entitlement.status }}
                  </UBadge>
                </div>
                <p class="text-xs text-muted">อายุการใช้งาน: {{ entitlementPeriod }}</p>
              </div>

              <div class="min-w-0 sm:w-64">
                <div class="flex items-baseline justify-between gap-2 text-sm">
                  <span class="text-muted">ใช้ไป {{ creditUsed }} / {{ creditInitial }} ครั้ง</span>
                  <span class="font-semibold" :class="entitlement.status === 'ACTIVE' ? 'text-primary' : 'text-dimmed'">เหลือ {{ creditRemaining }}</span>
                </div>
                <UProgress
                  v-if="creditInitial > 0"
                  :model-value="creditRemaining"
                  :max="creditInitial"
                  color="primary"
                  size="sm"
                  class="mt-2"
                />
              </div>
            </div>
          </section>

          <!-- Mobile cards -->
          <div class="md:hidden">
            <div
              v-if="!pagedUsages.length"
              class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30"
            >
              <UIcon :name="emptyState.icon" class="mb-3 size-10 opacity-60" />
              <p>{{ emptyState.title }}</p>
            </div>

            <div v-else class="-mx-2 space-y-1 sm:mx-0">
              <div
                v-for="usage in pagedUsages"
                :key="usage.orderId"
                class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
              >
                <div class="flex items-center gap-2 p-2">
                  <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-[11px] text-muted">
                    #{{ usageRankById.get(usage.orderId) ?? "-" }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <button
                        type="button"
                        class="block max-w-full truncate text-left font-mono text-[11px] text-primary hover:underline"
                        @click="openOrderDetail(usage)"
                      >
                        {{ usage.orderNo || usage.orderId }}
                      </button>

                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <UBadge color="primary" variant="subtle" size="xs" class="font-medium">
                          ใช้ {{ usage.creditUsed ?? 0 }} ครั้ง
                        </UBadge>
                        <UBadge :color="orderStatusColors[usage.status as ServiceOrderStatus]" variant="soft" size="xs">
                          {{ orderStatusLabels[usage.status as ServiceOrderStatus] }}
                        </UBadge>
                      </div>
                    </div>

                    <div class="mt-1 flex items-center justify-between gap-2">
                      <span class="min-w-0 truncate text-[11px] text-muted">{{ formatDateTime(usage.receivedAt) }}</span>
                      <span class="shrink-0 text-[11px] text-muted tabular-nums">{{ usage.itemCount }} ชิ้น</span>
                    </div>
                  </div>

                  <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายละเอียดรายการรับผ้า" @click="openOrderDetail(usage)" />
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop table -->
          <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
            <UTable
              v-model:sorting="sorting"
              :data="pagedUsages"
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
                <div class="flex flex-col items-center justify-center py-8 text-center">
                  <UIcon :name="emptyState.icon" class="mb-3 size-10 opacity-60" />
                  <p class="text-highlighted">{{ emptyState.title }}</p>
                  <p class="mt-1 text-sm text-muted">{{ emptyState.description }}</p>
                  <UButton
                    v-if="hasActiveFilters"
                    label="ล้างตัวกรอง"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    icon="i-lucide-filter-x"
                    class="mt-3"
                    @click="clearFilters"
                  />
                </div>
              </template>
            </UTable>
          </div>

          <!-- Pagination -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
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
              v-if="!showSkeleton && filteredUsages.length > pageSize"
              :page="page"
              :items-per-page="pageSize"
              :total="filteredUsages.length"
              @update:page="(newPage: number) => (page = newPage)"
            />
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
