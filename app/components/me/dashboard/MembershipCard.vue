<script setup lang="ts">
const props = withDefaults(defineProps<{
  refreshing?: boolean
}>(), {
  refreshing: false,
})

const { isMember, loading: memberStatusPending } = useMemberStatus()
const { data: dashboard, pending, error, refresh } = useFetch('/api/me')

const isPending = computed(() => pending.value || memberStatusPending.value || props.refreshing)

const normalizeCredits = (value: number | null | undefined) => Math.max(0, Number(value) || 0)
const formatCreditValue = (value: number | null | undefined, max: number) => `${normalizeCredits(value)} จาก ${max} ครั้ง`

const creditMeta = (initial: number | null, remaining: number | null) => {
  const total = normalizeCredits(initial)
  const left = Math.min(normalizeCredits(remaining), total)
  const ratio = total ? left / total : 0

  return { total, left, ratio }
}

const daysLeft = (endAt: string | null) => {
  if (!endAt) return null
  return Math.ceil((new Date(endAt).getTime() - Date.now()) / 86_400_000)
}

const expiryLabel = (endAt: string | null) => {
  const days = daysLeft(endAt)
  if (days === null) return 'ไม่มีวันหมดอายุ'
  if (days < 0) return 'แพ็กเกจหมดอายุแล้ว'
  if (days === 0) return 'หมดอายุวันนี้'
  if (days === 1) return 'เหลืออีก 1 วัน'
  return `เหลืออีก ${days} วัน`
}

const packageState = (endAt: string | null, initial: number | null, remaining: number | null) => {
  const days = daysLeft(endAt)
  const credits = creditMeta(initial, remaining)

  if (days !== null && days < 0) {
    return { label: 'หมดอายุ', color: 'neutral' as const }
  }
  if (credits.left === 0) {
    return { label: 'เครดิตหมด', color: 'error' as const }
  }
  if (days !== null && days <= 7) {
    return { label: 'ใกล้หมดอายุ', color: 'warning' as const }
  }
  if (credits.ratio <= 0.2) {
    return { label: 'เครดิตใกล้หมด', color: 'warning' as const }
  }
  return { label: 'กำลังใช้งาน', color: 'primary' as const }
}

</script>

<template>
  <div v-if="isPending" class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2">
    <div
      v-for="i in 2"
      :key="i"
      class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
    >
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <USkeleton class="h-5 w-32 rounded-lg" />
          <USkeleton class="h-5 w-20 rounded-full" />
        </div>
        <USkeleton class="h-12 w-full rounded-lg" />
        <USkeleton class="h-4 w-40 rounded-lg" />
      </div>
    </div>
  </div>

  <div
    v-else-if="error && isMember"
    class="-mx-2 flex items-center justify-between gap-3 border border-error/25 bg-error/5 p-4 sm:mx-0 sm:rounded-lg"
  >
    <div class="flex min-w-0 items-center gap-3">
      <UIcon name="i-lucide-circle-alert" class="size-5 shrink-0 text-error" />
      <div class="min-w-0">
        <p class="text-sm font-medium text-highlighted">โหลดข้อมูลแพ็กเกจไม่สำเร็จ</p>
        <p class="text-xs text-muted">กรุณาลองใหม่อีกครั้ง</p>
      </div>
    </div>
    <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-refresh-cw" @click="refresh()">
      ลองใหม่
    </UButton>
  </div>

  <div v-else-if="isMember && dashboard" class="flex flex-col gap-1">
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

    <div
      v-if="dashboard.activeEntitlements.length === 0"
      class="-mx-2 border border-dashed border-default bg-elevated/40 px-4 py-8 text-center sm:mx-0 sm:rounded-lg"
    >
      <UIcon name="i-lucide-package-open" class="mx-auto size-8 text-dimmed" />
      <p class="mt-2 text-sm font-medium text-highlighted">ยังไม่มีแพ็กเกจที่ใช้งานได้</p>
      <p class="mt-1 text-xs text-muted">แพ็กเกจใหม่จะแสดงที่นี่หลังเปิดใช้งาน</p>
    </div>

    <div v-else class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2">
      <article
        v-for="(ent, index) in dashboard.activeEntitlements"
        :key="ent.id"
        class="flex flex-col border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
        :class="{
          'md:col-span-2': dashboard.activeEntitlements.length % 2 === 1
            && index === dashboard.activeEntitlements.length - 1,
        }"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="min-w-0 text-base font-semibold text-highlighted">
            {{ ent.productName }}
          </h3>
          <UBadge
            :color="packageState(ent.endAt, ent.creditInitial, ent.creditRemaining).color"
            variant="subtle"
            class="shrink-0"
          >
            {{ packageState(ent.endAt, ent.creditInitial, ent.creditRemaining).label }}
          </UBadge>
        </div>

        <div class="mt-4 rounded-lg border border-default/40 bg-elevated/40 p-3">
          <div class="flex items-end justify-between gap-3">
            <span class="text-sm text-muted">เครดิตคงเหลือ</span>
            <p class="shrink-0 text-right text-highlighted">
              <span class="text-2xl font-bold tabular-nums">{{ creditMeta(ent.creditInitial, ent.creditRemaining).left }}</span>
              <span class="ml-1 text-sm text-muted">/ {{ creditMeta(ent.creditInitial, ent.creditRemaining).total }} ครั้ง</span>
            </p>
          </div>

          <UProgress
            v-if="creditMeta(ent.creditInitial, ent.creditRemaining).total > 0"
            class="mt-3"
            :model-value="creditMeta(ent.creditInitial, ent.creditRemaining).left"
            :max="creditMeta(ent.creditInitial, ent.creditRemaining).total"
            :color="packageState(ent.endAt, ent.creditInitial, ent.creditRemaining).color"
            size="lg"
            :get-value-text="formatCreditValue"
          />
          <div
            v-else
            class="mt-3 flex h-9 items-center justify-center rounded-lg border border-dashed border-default text-xs text-muted"
          >
            ไม่มีเครดิตในแพ็กเกจนี้
          </div>
        </div>

        <div
          v-if="daysLeft(ent.endAt) !== null && (daysLeft(ent.endAt) ?? 999) <= 7"
          class="mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs"
          :class="(daysLeft(ent.endAt) ?? 0) < 0
            ? 'border-error/25 bg-error/10 text-error'
            : 'border-warning/25 bg-warning/10 text-warning'"
        >
          <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
          {{ expiryLabel(ent.endAt) }}
        </div>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4 text-sm">
          <span class="flex items-center gap-1.5 text-muted">
            <UIcon name="i-lucide-calendar-clock" class="size-4 shrink-0" />
            {{ expiryLabel(ent.endAt) }}
          </span>
          <UButton
            :to="`/me/membership/usage?id=${ent.id}`"
            variant="link"
            color="primary"
            class="p-0"
          >
            ดูประวัติการใช้งาน
          </UButton>
        </div>
      </article>
    </div>
  </div>
</template>
