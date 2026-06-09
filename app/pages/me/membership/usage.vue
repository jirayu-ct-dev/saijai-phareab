<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

type MembershipUsageRow = {
  index: number;
  orderId: string;
  orderNo?: string | null;
  receivedAt: string;
  itemCount: number;
  creditUsed: number;
  status?: string;
};

const route = useRoute();
const entitlementId = computed(() => (route.query.id as string) || "");
const currentId = ref(entitlementId.value);

const { entitlements } = useMyMembership();

watch(entitlements, (newEntitlements) => {
  if (currentId.value || newEntitlements.length === 0) return;
  const active = newEntitlements.find((ent) => ent.status === "ACTIVE");
  currentId.value = active?.id ?? newEntitlements[0]?.id ?? "";
}, { immediate: true });

const { entitlement, usages, pending, refresh, error } = useMyMembershipUsage(currentId);

const statusLabels: Record<string, string> = {
  ACTIVE: "กำลังใช้งาน",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกแล้ว",
};

const entitlementOptions = computed(() =>
  entitlements.value.map((ent) => ({
    id: ent.id,
    label: ent.productName,
  })),
);

const mappedUsages = computed<MembershipUsageRow[]>(() =>
  usages.value.map((usage, index) => ({
    ...usage,
    index: usages.value.length - index,
  })),
);

const usedCredits = computed(() =>
  entitlement.value ? Math.max(Number(entitlement.value.creditInitial || 0) - Number(entitlement.value.creditRemaining || 0), 0) : 0,
);
const creditPercent = computed(() => entitlement.value ? getCreditPercent(entitlement.value) : 0);

const columns: TableColumn<MembershipUsageRow>[] = [
  { accessorKey: "index", header: "ครั้งที่" },
  { accessorKey: "receivedAt", header: "วันที่" },
  { accessorKey: "orderNo", header: "เลขรับผ้า" },
  { accessorKey: "itemCount", header: "จำนวนชิ้น" },
  { accessorKey: "creditUsed", header: "เครดิตที่ใช้" },
];

function getCreditPercent(entitlement: { creditInitial?: number | null; creditRemaining?: number | null }) {
  const initial = Number(entitlement.creditInitial || 0);
  if (initial <= 0) return 0;
  const remaining = Math.max(Number(entitlement.creditRemaining || 0), 0);
  return Math.min(Math.round((remaining / initial) * 100), 100);
}

function getCreditBarColor(percent: number, status = "ACTIVE") {
  if (status !== "ACTIVE") return "bg-muted";
  if (percent <= 20) return "bg-error";
  if (percent <= 50) return "bg-warning";
  return "bg-success";
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="ประวัติการใช้เครดิต" icon="i-lucide-history">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <div class="flex items-center gap-2">
              <UButton color="neutral" variant="outline" to="/me/membership" icon="i-lucide-arrow-left" class="shrink-0">
                <span class="hidden sm:inline">กลับ</span>
              </UButton>
              <UIButtonRefresh
                class="shrink-0 border-default/40 bg-elevated/60 text-toned hover:bg-elevated"
                :loading="pending"
                @refresh="refresh"
              />
            </div>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-3 p-2 sm:p-6">
          <section class="flex flex-col gap-1">
            <div class="-mx-2 rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 sm:mx-0 md:flex md:items-center md:justify-between md:gap-3">
              <div class="min-w-0 md:max-w-sm md:flex-1">
                <USelect
                  v-model="currentId"
                  :items="entitlementOptions"
                  label-key="label"
                  value-key="id"
                  class="w-full"
                  placeholder="เลือกแพ็กเกจ"
                />
              </div>
              <p class="mt-2 text-xs text-muted md:mt-0">
                ประวัติทั้งหมด {{ mappedUsages.length }} รายการ
              </p>
            </div>
          </section>

          <template v-if="pending">
            <section class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
              <div
                v-for="i in 4"
                :key="`membership-usage-dashboard-skeleton-${i}`"
                class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20"
              >
                <USkeleton class="h-4 w-20 rounded-lg" />
                <USkeleton class="mt-4 h-7 w-16 rounded-lg" />
                <USkeleton class="mt-2 h-3 w-24 rounded-lg" />
              </div>
            </section>
            <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
              <div
                v-for="i in 5"
                :key="`membership-usage-mobile-skeleton-${i}`"
                class="border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55"
              >
                <USkeleton class="h-4 w-36 rounded-lg" />
                <USkeleton class="mt-2 h-3 w-48 rounded-lg" />
              </div>
            </div>
            <div class="hidden rounded-lg border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 md:block">
              <USkeleton v-for="i in 6" :key="`membership-usage-table-skeleton-${i}`" class="mb-2 h-12 w-full rounded-lg last:mb-0" />
            </div>
          </template>

          <div
            v-else-if="error || !entitlement"
            class="-mx-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30 sm:mx-0"
          >
            <UIcon name="i-lucide-package-x" class="mb-3 size-10 opacity-60" />
            <p class="text-sm">{{ error ? "เกิดข้อผิดพลาดในการโหลดประวัติการใช้งาน" : "ไม่พบข้อมูลแพ็กเกจ" }}</p>
            <UButton label="กลับไปแพ็กเกจของฉัน" icon="i-lucide-arrow-left" color="neutral" variant="outline" to="/me/membership" class="mt-3" />
          </div>

          <template v-else>
            <section class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
              <div class="col-span-2 min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20 xl:col-span-1">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-muted">แพ็กเกจ</p>
                  <UBadge :color="entitlement.status === 'ACTIVE' ? 'success' : 'neutral'" variant="subtle">
                    {{ statusLabels[entitlement.status] || entitlement.status }}
                  </UBadge>
                </div>
                <p class="mt-3 truncate text-lg font-semibold text-highlighted">{{ entitlement.productName }}</p>
                <p class="mt-1 text-xs text-muted">{{ entitlement.endAt ? `หมดอายุ ${formatDateTime(entitlement.endAt)}` : "ไม่มีวันหมดอายุ" }}</p>
              </div>
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <p class="text-xs text-muted">ใช้ไปแล้ว</p>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-warning">{{ usedCredits }}</p>
                <p class="mt-1 text-xs text-muted">เครดิต</p>
              </div>
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <p class="text-xs text-muted">คงเหลือ</p>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-success">{{ entitlement.creditRemaining }}</p>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-elevated dark:bg-default/80">
                  <div
                    class="h-full rounded-full transition-[width] duration-500 ease-out"
                    :class="getCreditBarColor(creditPercent, entitlement.status)"
                    :style="{ width: `${creditPercent}%` }"
                  />
                </div>
                <p class="mt-1 text-xs text-muted">{{ creditPercent }}% คงเหลือ</p>
              </div>
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <p class="text-xs text-muted">รายการใช้งาน</p>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-highlighted">{{ mappedUsages.length }}</p>
                <p class="mt-1 text-xs text-muted">ออเดอร์</p>
              </div>
            </section>

            <section class="flex flex-col gap-1">
              <div v-if="mappedUsages.length === 0" class="-mx-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30 sm:mx-0">
                <UIcon name="i-lucide-history" class="mb-3 size-10 opacity-60" />
                <p class="text-sm">ยังไม่มีประวัติการใช้งาน</p>
              </div>

              <template v-else>
                <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
                  <article
                    v-for="usage in mappedUsages"
                    :key="usage.orderId"
                    class="border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-highlighted">ครั้งที่ {{ usage.index }}</p>
                        <NuxtLink :to="`/me/service-orders/${usage.orderId}`" class="mt-0.5 block truncate font-mono text-[11px] text-primary hover:underline">
                          {{ usage.orderNo || "-" }}
                        </NuxtLink>
                      </div>
                      <UBadge color="warning" variant="subtle" size="xs" class="shrink-0">
                        {{ usage.creditUsed }} เครดิต
                      </UBadge>
                    </div>
                    <div class="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                      <span class="min-w-0 truncate">{{ formatDateTime(usage.receivedAt) }}</span>
                      <span class="shrink-0">{{ usage.itemCount }} ชิ้น</span>
                    </div>
                  </article>
                </div>

                <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 md:block">
                  <UTable
                    :data="mappedUsages"
                    :columns="columns"
                    :ui="{
                      root: 'relative overflow-x-auto',
                      base: 'table-fixed border-separate border-spacing-0',
                      thead: 'sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80 [&>tr]:after:content-none',
                      tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45',
                      th: 'border-b border-default bg-default py-2.5 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80',
                      td: 'border-b border-default py-2.5 text-sm transition-colors dark:border-default/25',
                      separator: 'h-0',
                    }"
                    class="w-full"
                  >
                    <template #receivedAt-cell="{ row }">
                      {{ formatDateTime(row.original.receivedAt) }}
                    </template>
                    <template #orderNo-cell="{ row }">
                      <NuxtLink :to="`/me/service-orders/${row.original.orderId}`" class="font-mono text-primary hover:underline">
                        {{ row.original.orderNo || "-" }}
                      </NuxtLink>
                    </template>
                    <template #itemCount-cell="{ row }">
                      {{ row.original.itemCount }} ชิ้น
                    </template>
                    <template #creditUsed-cell="{ row }">
                      <UBadge color="warning" variant="subtle">{{ row.original.creditUsed }} เครดิต</UBadge>
                    </template>
                  </UTable>
                </div>
              </template>
            </section>
          </template>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
