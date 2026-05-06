<script setup lang="ts">
const { isMember } = useMemberStatus()

const { data: dashboard, pending } = useFetch('/api/me')

const formatDaysLeft = (endAt: string | null) => {
  if (!endAt) return null
  const days = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return days
}
</script>

<template>
  <!-- Skeleton -->
  <div v-if="pending && isMember" class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <UCard v-for="i in 2" :key="i">
      <div class="space-y-3">
        <div class="h-5 w-32 rounded bg-elevated animate-pulse" />
        <div class="h-3 w-full rounded bg-elevated animate-pulse" />
        <div class="h-2 w-full rounded bg-elevated animate-pulse" />
        <div class="h-3 w-24 rounded bg-elevated animate-pulse" />
      </div>
    </UCard>
  </div>

  <!-- Member Package Cards -->
  <div
    v-else-if="isMember && dashboard && dashboard.activeEntitlements.length > 0"
    class="space-y-4"
  >
    <h2 class="text-xl font-semibold">แพ็กเกจของฉัน</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard
        v-for="ent in dashboard.activeEntitlements"
        :key="ent.id"
        class="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20"
      >
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-lg font-bold text-amber-600 dark:text-amber-400">
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
          class="mt-3 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5"
        >
          <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
          แพ็กเกจจะหมดอายุใน {{ formatDaysLeft(ent.endAt) }} วัน
        </div>

        <div class="mt-4 flex justify-between items-center text-sm">
          <span v-if="ent.endAt" class="text-gray-500">
            หมดอายุใน {{ formatDaysLeft(ent.endAt) }} วัน
          </span>
          <span v-else class="text-gray-500">ไม่มีวันหมดอายุ</span>

          <UButton
            :to="`/me/membership/usage?id=${ent.id}`"
            variant="link"
            color="warning"
            class="p-0"
          >
            ดูประวัติการใช้งาน
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
