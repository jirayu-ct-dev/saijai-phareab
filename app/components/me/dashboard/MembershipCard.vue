<script setup lang="ts">
const props = withDefaults(defineProps<{
  refreshing?: boolean
}>(), {
  refreshing: false,
})

const { isMember } = useMemberStatus()

const { data: dashboard, pending, status } = useFetch('/api/me', {
  key: 'me-dashboard-summary',
  lazy: true,
  server: false,
  default: () => ({ stats: null, recentOrders: [], activeEntitlements: [] }),
})

const isPending = computed(() => pending.value || status.value === 'idle' || props.refreshing)

const formatDaysLeft = (endAt: string | null) => {
  if (!endAt) return null
  const days = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return days
}
</script>

<template>
  <!-- Skeleton -->
  <div v-if="isPending && isMember" class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2">
    <div
      v-for="i in 2"
      :key="i"
      class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
    >
      <div class="space-y-3">
        <USkeleton class="h-5 w-32 rounded-lg" />
        <USkeleton class="h-3 w-full rounded-lg" />
        <USkeleton class="h-2 w-full rounded-lg" />
        <USkeleton class="h-3 w-24 rounded-lg" />
      </div>
    </div>
  </div>

  <!-- Member Package Cards -->
  <div
    v-else-if="isMember && dashboard && dashboard.activeEntitlements.length > 0"
    class="flex flex-col gap-1"
  >
    <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <div class="flex items-center gap-2">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-default/30 bg-elevated/30 text-primary dark:border-default/20 dark:bg-default/80">
          <UIcon name="i-lucide-package-check" class="size-4" />
        </div>
        <div class="min-w-0">
          <p class="text-base font-semibold text-highlighted">แพ็กเกจของฉัน</p>
          <p class="mt-0.5 text-sm text-muted">สิทธิ์ที่กำลังใช้งานอยู่</p>
        </div>
      </div>
    </div>

    <div class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2">
      <div
        v-for="ent in dashboard.activeEntitlements"
        :key="ent.id"
        class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <h3 class="truncate text-base font-semibold text-highlighted">
            {{ ent.productName }}
          </h3>
          <UBadge color="warning" variant="subtle">กำลังใช้งาน</UBadge>
        </div>

        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span>เครดิตคงเหลือ</span>
            <span class="font-bold">{{ ent.creditRemaining }} / {{ ent.creditInitial }} ครั้ง</span>
          </div>
          <UProgress
            :value="ent.creditRemaining || 0"
            :max="ent.creditInitial || 1"
            color="warning"
            size="sm"
          />
        </div>

        <!-- Warning banner -->
        <div
          v-if="ent.endAt && (formatDaysLeft(ent.endAt) ?? 999) < 7"
          class="mt-3 flex items-center gap-1.5 rounded-lg border border-error/25 bg-error/10 p-2 text-xs text-error"
        >
          <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
          แพ็กเกจจะหมดอายุใน {{ formatDaysLeft(ent.endAt) }} วัน
        </div>

        <div class="mt-4 flex items-center justify-between gap-2 text-sm">
          <span v-if="ent.endAt" class="text-muted">
            หมดอายุใน {{ formatDaysLeft(ent.endAt) }} วัน
          </span>
          <span v-else class="text-muted">ไม่มีวันหมดอายุ</span>

          <UButton
            :to="`/me/membership/usage?id=${ent.id}`"
            variant="link"
            color="warning"
            class="p-0"
          >
            ดูประวัติการใช้งาน
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
