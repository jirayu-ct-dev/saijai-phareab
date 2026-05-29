<script setup lang="ts">
import { formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";
const adminDashboardBodyClass = adminUi.adminDashboardBodyClass;

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

const { entitlements, pending } = useMyMembership();

const formatDaysLeft = (endAt: string | null) => {
  if (!endAt) return null;
  const days = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "กำลังใช้งาน",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกแล้ว",
};

const activeEntitlements = computed(() => entitlements.value.filter(e => e.status === "ACTIVE"));
const inactiveEntitlements = computed(() => entitlements.value.filter(e => e.status !== "ACTIVE"));

const items = [
  { key: 'active', label: 'กำลังใช้งาน', icon: 'i-lucide-check-circle' },
  { key: 'inactive', label: 'หมดอายุ/ยกเลิก', icon: 'i-lucide-history' }
];
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="แพ็กเกจของฉัน">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div :class="adminDashboardBodyClass || 'flex flex-col gap-3 p-2 sm:p-6'">
          <div v-if="pending">
            <USkeleton class="h-64 w-full rounded-md" />
          </div>

          <div v-else>
            <UTabs :items="items" class="w-full">
          <template #content="{ item }">
            <div v-if="item.key === 'active'" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="activeEntitlements.length === 0" class="col-span-full py-12 text-center border border-dashed border-default rounded-md bg-elevated">
                <UIcon name="i-lucide-package-x" class="h-12 w-12 text-dimmed mx-auto mb-4" />
                <p class="text-muted">คุณยังไม่มีแพ็กเกจที่กำลังใช้งาน</p>
                <UButton to="/me/packages" color="primary" class="mt-4">เลือกซื้อแพ็กเกจ</UButton>
              </div>
              
              <UCard v-for="ent in activeEntitlements" :key="ent.id" class="border-primary/20 bg-primary/5">
                <div class="flex justify-between items-start mb-4">
                  <h3 class="text-lg font-bold text-primary">{{ ent.productName }}</h3>
                  <UBadge color="success" variant="subtle">กำลังใช้งาน</UBadge>
                </div>
                
                <UAlert
                  v-if="formatDaysLeft(ent.endAt) !== null && formatDaysLeft(ent.endAt)! <= 7"
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-alert-triangle"
                  title="ใกล้หมดอายุ!"
                  :description="`แพ็กเกจนี้จะหมดอายุในอีก ${formatDaysLeft(ent.endAt)} วัน`"
                  class="mb-4"
                />
                
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-toned">เครดิตคงเหลือ</span>
                    <span class="font-bold text-highlighted">{{ ent.creditRemaining }} / {{ ent.creditInitial }} ครั้ง</span>
                  </div>
                  <UProgress 
                    :value="ent.creditRemaining || 0" 
                    :max="ent.creditInitial || 1" 
                    color="warning"
                    size="sm"
                  />
                </div>
                
                <div class="mt-4 text-sm text-muted space-y-1">
                  <p>วันที่เริ่ม: {{ formatDateTime(ent.startAt ?? '') }}</p>
                  <p>วันหมดอายุ: {{ ent.endAt ? formatDateTime(ent.endAt ?? '') : 'ไม่มีวันหมดอายุ' }} <span v-if="ent.endAt" class="text-warning-600">({{ formatDaysLeft(ent.endAt) }} วัน)</span></p>
                </div>
                
                <div class="mt-6">
                  <UButton :to="`/me/membership/usage?id=${ent.id}`" block color="warning" variant="soft">ดูประวัติการใช้งาน</UButton>
                </div>
              </UCard>
            </div>

            <div v-else-if="item.key === 'inactive'" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="inactiveEntitlements.length === 0" class="col-span-full py-12 text-center border border-dashed border-default rounded-md bg-elevated">
                <p class="text-muted">ไม่มีประวัติแพ็กเกจที่หมดอายุหรือถูกยกเลิก</p>
              </div>
              
              <UCard v-for="ent in inactiveEntitlements" :key="ent.id" class="bg-elevated border-default/50">
                <div class="flex justify-between items-start mb-4">
                  <h3 class="text-lg font-bold text-highlighted">{{ ent.productName }}</h3>
                  <UBadge :color="ent.status === 'EXPIRED' ? 'neutral' : (ent.status === 'CANCELLED' ? 'error' : 'warning')" variant="subtle">
                    {{ statusLabels[ent.status] || ent.status }}
                  </UBadge>
                </div>
                
                <div class="space-y-2 opacity-60">
                  <div class="flex justify-between text-sm">
                    <span class="text-toned">เครดิตคงเหลือ</span>
                    <span class="font-bold text-highlighted">{{ ent.creditRemaining }} / {{ ent.creditInitial }} ครั้ง</span>
                  </div>
                  <UProgress 
                    :value="ent.creditRemaining || 0" 
                    :max="ent.creditInitial || 1" 
                    color="neutral"
                    size="sm"
                  />
                </div>
                
                <div class="mt-4 text-sm text-muted space-y-1">
                  <p>วันที่เริ่ม: {{ formatDateTime(ent.startAt ?? '') }}</p>
                  <p>วันหมดอายุ: {{ ent.endAt ? formatDateTime(ent.endAt ?? '') : 'ไม่มีวันหมดอายุ' }}</p>
                </div>
                
                <div class="mt-6">
                  <UButton :to="`/me/membership/usage?id=${ent.id}`" block color="neutral" variant="soft">ดูประวัติการใช้งาน</UButton>
                </div>
              </UCard>
            </div>
          </template>
        </UTabs>
          </div>
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardPage>
</template>
