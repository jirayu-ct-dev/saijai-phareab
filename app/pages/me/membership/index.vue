<script setup lang="ts">
import { formatDateTime } from "~~/shared/utils/format";

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
      <UDashboardNavbar title="แพ็กเกจของฉัน" />

      <div v-if="pending" class="p-6">
        <USkeleton class="h-64 w-full" />
      </div>

      <div v-else class="p-6">
        <UTabs :items="items" class="w-full">
          <template #content="{ item }">
            <div v-if="item.key === 'active'" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="activeEntitlements.length === 0" class="col-span-full py-12 text-center border rounded-lg border-dashed">
                <UIcon name="i-lucide-package-x" class="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p class="text-gray-500">คุณยังไม่มีแพ็กเกจที่กำลังใช้งาน</p>
                <UButton to="/me/packages" color="primary" class="mt-4">เลือกซื้อแพ็กเกจ</UButton>
              </div>
              
              <UCard v-for="ent in activeEntitlements" :key="ent.id" class="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                <div class="flex justify-between items-start mb-4">
                  <h3 class="text-lg font-bold text-amber-600 dark:text-amber-400">{{ ent.productName }}</h3>
                  <UBadge color="success" variant="subtle">ACTIVE</UBadge>
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
                
                <div class="mt-4 text-sm text-gray-500 space-y-1">
                  <p>วันที่เริ่ม: {{ formatDateTime(ent.startAt ?? '') }}</p>
                  <p>วันหมดอายุ: {{ ent.endAt ? formatDateTime(ent.endAt ?? '') : 'ไม่มีวันหมดอายุ' }} <span v-if="ent.endAt" class="text-amber-600">({{ formatDaysLeft(ent.endAt) }} วัน)</span></p>
                </div>
                
                <div class="mt-6">
                  <UButton :to="`/me/membership/usage?id=${ent.id}`" block color="warning" variant="soft">ดูประวัติการใช้งาน</UButton>
                </div>
              </UCard>
            </div>

            <div v-else-if="item.key === 'inactive'" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="inactiveEntitlements.length === 0" class="col-span-full py-12 text-center border rounded-lg border-dashed">
                <p class="text-gray-500">ไม่มีประวัติแพ็กเกจที่หมดอายุหรือถูกยกเลิก</p>
              </div>
              
              <UCard v-for="ent in inactiveEntitlements" :key="ent.id" class="bg-gray-50 dark:bg-gray-900/50">
                <div class="flex justify-between items-start mb-4">
                  <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300">{{ ent.productName }}</h3>
                  <UBadge :color="ent.status === 'EXPIRED' ? 'neutral' : (ent.status === 'CANCELLED' ? 'error' : 'warning')" variant="subtle">
                    {{ ent.status }}
                  </UBadge>
                </div>
                
                <div class="space-y-2 opacity-60">
                  <div class="flex justify-between text-sm">
                    <span>เครดิตคงเหลือ</span>
                    <span class="font-bold">{{ ent.creditRemaining }} / {{ ent.creditInitial }} ครั้ง</span>
                  </div>
                  <UProgress 
                    :value="ent.creditRemaining || 0" 
                    :max="ent.creditInitial || 1" 
                    color="neutral"
                    size="sm"
                  />
                </div>
                
                <div class="mt-4 text-sm text-gray-500 space-y-1">
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
    </UDashboardPanel>
  </UDashboardPage>
</template>
