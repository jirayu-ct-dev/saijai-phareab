<script setup lang="ts">
import { formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

const { entitlements, pending, refresh, error } = useMyMembership();

const activeTab = ref<"active" | "inactive">("active");

const statusLabels: Record<string, string> = {
  ACTIVE: "กำลังใช้งาน",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกแล้ว",
};

const activeEntitlements = computed(() => entitlements.value.filter((ent) => ent.status === "ACTIVE"));
const inactiveEntitlements = computed(() => entitlements.value.filter((ent) => ent.status !== "ACTIVE"));
const visibleEntitlements = computed(() => activeTab.value === "active" ? activeEntitlements.value : inactiveEntitlements.value);

const totalRemainingCredits = computed(() =>
  activeEntitlements.value.reduce((sum, ent) => sum + Number(ent.creditRemaining || 0), 0),
);
const totalInitialCredits = computed(() =>
  activeEntitlements.value.reduce((sum, ent) => sum + Number(ent.creditInitial || 0), 0),
);
const totalCreditPercent = computed(() => getCreditPercent({
  creditInitial: totalInitialCredits.value,
  creditRemaining: totalRemainingCredits.value,
}));
const expiringSoonCount = computed(() =>
  activeEntitlements.value.filter((ent) => {
    const daysLeft = getDaysLeft(ent.endAt);
    return daysLeft !== null && daysLeft <= 7;
  }).length,
);

const tabs = [
  { key: "active" as const, label: "กำลังใช้งาน", icon: "i-lucide-check-circle" },
  { key: "inactive" as const, label: "หมดอายุ/ยกเลิก", icon: "i-lucide-history" },
];

function getDaysLeft(endAt: string | null) {
  if (!endAt) return null;
  return Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getUsedCredits(entitlement: { creditInitial?: number | null; creditRemaining?: number | null }) {
  return Math.max(Number(entitlement.creditInitial || 0) - Number(entitlement.creditRemaining || 0), 0);
}

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

function getStatusColor(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "CANCELLED") return "error";
  return "neutral";
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="แพ็กเกจของฉัน" icon="i-lucide-package">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UIButtonRefresh
              class="shrink-0 border-default/40 bg-elevated/60 text-toned hover:bg-elevated"
              :loading="pending"
              @refresh="refresh"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-3 p-2 sm:p-6">
          <template v-if="pending">
            <section class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
              <div
                v-for="i in 4"
                :key="`membership-dashboard-skeleton-${i}`"
                class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20"
              >
                <USkeleton class="h-4 w-20 rounded-lg" />
                <USkeleton class="mt-4 h-7 w-16 rounded-lg" />
                <USkeleton class="mt-2 h-3 w-24 rounded-lg" />
              </div>
            </section>

            <section class="flex flex-col gap-1">
              <div class="-mx-2 rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 sm:mx-0">
                <USkeleton class="h-8 w-full rounded-lg sm:w-72" />
              </div>
              <div class="-mx-2 space-y-1 sm:mx-0 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
                <div
                  v-for="i in 4"
                  :key="`membership-card-skeleton-${i}`"
                  class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
                >
                  <USkeleton class="h-5 w-40 rounded-lg" />
                  <USkeleton class="mt-2 h-3 w-32 rounded-lg" />
                  <USkeleton class="mt-5 h-2 w-full rounded-full" />
                  <USkeleton class="mt-5 h-9 w-full rounded-lg" />
                </div>
              </div>
            </section>
          </template>

          <template v-else>
            <section class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-muted">แพ็กเกจที่ใช้งาน</p>
                  <UIcon name="i-lucide-check-circle" class="size-4 text-success" />
                </div>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-highlighted">{{ activeEntitlements.length }}</p>
                <p class="mt-1 text-xs text-muted">รายการ</p>
              </div>
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-muted">เครดิตคงเหลือ</p>
                  <UIcon name="i-lucide-ticket" class="size-4 text-primary" />
                </div>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-highlighted">{{ totalRemainingCredits }}</p>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-elevated dark:bg-default/80">
                  <div
                    class="h-full rounded-full transition-[width] duration-500 ease-out"
                    :class="getCreditBarColor(totalCreditPercent)"
                    :style="{ width: `${totalCreditPercent}%` }"
                  />
                </div>
                <p class="mt-1 text-xs text-muted">{{ totalInitialCredits ? `${totalCreditPercent}% คงเหลือ` : "ยังไม่มีเครดิต" }}</p>
              </div>
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-muted">ใกล้หมดอายุ</p>
                  <UIcon name="i-lucide-alert-triangle" class="size-4 text-warning" />
                </div>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-highlighted">{{ expiringSoonCount }}</p>
                <p class="mt-1 text-xs text-muted">ภายใน 7 วัน</p>
              </div>
              <div class="min-h-24 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-muted">ประวัติแพ็กเกจ</p>
                  <UIcon name="i-lucide-history" class="size-4 text-muted" />
                </div>
                <p class="mt-3 text-2xl font-semibold tabular-nums text-highlighted">{{ inactiveEntitlements.length }}</p>
                <p class="mt-1 text-xs text-muted">หมดอายุ/ยกเลิก</p>
              </div>
            </section>

            <section class="flex flex-col gap-1">
              <div class="-mx-2 rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 sm:mx-0 md:flex md:items-center md:justify-between md:gap-3">
                <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <UButton
                    v-for="tab in tabs"
                    :key="tab.key"
                    :icon="tab.icon"
                    :color="activeTab === tab.key ? 'primary' : 'neutral'"
                    :variant="activeTab === tab.key ? 'soft' : 'ghost'"
                    class="justify-center"
                    @click="activeTab = tab.key"
                  >
                    {{ tab.label }}
                  </UButton>
                </div>
                <p class="mt-2 text-xs text-muted md:mt-0">
                  ทั้งหมด {{ visibleEntitlements.length }} รายการ
                </p>
              </div>

              <div
                v-if="error"
                class="-mx-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30 sm:mx-0"
              >
                <UIcon name="i-lucide-alert-circle" class="mb-3 size-10 opacity-60" />
                <p class="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูลแพ็กเกจ</p>
                <UButton label="ลองใหม่" icon="i-lucide-refresh-cw" color="neutral" variant="outline" class="mt-3" @click="refresh()" />
              </div>

              <div
                v-else-if="visibleEntitlements.length === 0"
                class="-mx-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30 sm:mx-0"
              >
                <UIcon :name="activeTab === 'active' ? 'i-lucide-package-x' : 'i-lucide-history'" class="mb-3 size-10 opacity-60" />
                <p class="text-sm">
                  {{ activeTab === "active" ? "คุณยังไม่มีแพ็กเกจที่กำลังใช้งาน" : "ไม่มีประวัติแพ็กเกจที่หมดอายุหรือถูกยกเลิก" }}
                </p>
                <UButton
                  v-if="activeTab === 'active'"
                  to="/packages"
                  color="primary"
                  class="mt-3"
                >
                  ดูแพ็กเกจบริการ
                </UButton>
              </div>

              <div v-else class="-mx-2 space-y-1 sm:mx-0 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
                <article
                  v-for="ent in visibleEntitlements"
                  :key="ent.id"
                  class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-base font-semibold text-highlighted">{{ ent.productName }}</p>
                      <p class="mt-0.5 text-xs text-muted">
                        {{ ent.endAt ? `หมดอายุ ${formatDateTime(ent.endAt)}` : "ไม่มีวันหมดอายุ" }}
                      </p>
                    </div>
                    <UBadge :color="getStatusColor(ent.status)" variant="subtle" class="shrink-0">
                      {{ statusLabels[ent.status] || ent.status }}
                    </UBadge>
                  </div>

                  <div
                    v-if="ent.status === 'ACTIVE' && getDaysLeft(ent.endAt) !== null && getDaysLeft(ent.endAt)! <= 7"
                    class="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning"
                  >
                    <div class="flex items-start gap-2">
                      <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-4 shrink-0" />
                      <span>แพ็กเกจนี้จะหมดอายุในอีก {{ getDaysLeft(ent.endAt) }} วัน</span>
                    </div>
                  </div>

                  <div class="mt-4 space-y-2">
                    <div class="flex items-center justify-between gap-3 text-sm">
                      <span class="text-muted">เครดิตคงเหลือ</span>
                      <span class="font-semibold tabular-nums text-highlighted">
                        {{ ent.creditRemaining }} / {{ ent.creditInitial }} เครดิต
                      </span>
                    </div>
                    <div class="h-2.5 overflow-hidden rounded-full bg-elevated dark:bg-default/80">
                      <div
                        class="h-full rounded-full transition-[width] duration-500 ease-out"
                        :class="getCreditBarColor(getCreditPercent(ent), ent.status)"
                        :style="{ width: `${getCreditPercent(ent)}%` }"
                      />
                    </div>
                    <p class="text-[11px] text-muted">
                      ใช้ไปแล้ว {{ getUsedCredits(ent) }} เครดิต เหลือ {{ getCreditPercent(ent) }}%
                    </p>
                  </div>

                  <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div class="rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25">
                      <p class="text-[11px] text-muted">ใช้ไปแล้ว</p>
                      <p class="mt-1 font-semibold tabular-nums text-highlighted">{{ getUsedCredits(ent) }} เครดิต</p>
                    </div>
                    <div class="rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25">
                      <p class="text-[11px] text-muted">วันที่เริ่ม</p>
                      <p class="mt-1 truncate font-semibold text-highlighted">{{ ent.startAt ? formatDateTime(ent.startAt) : "-" }}</p>
                    </div>
                  </div>

                  <UButton
                    :to="`/me/membership/usage?id=${ent.id}`"
                    block
                    color="primary"
                    variant="soft"
                    class="mt-4"
                    icon="i-lucide-history"
                  >
                    ดูประวัติการใช้งาน
                  </UButton>
                </article>
              </div>
            </section>
          </template>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
