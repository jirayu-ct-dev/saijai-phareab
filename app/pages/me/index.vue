<script setup lang="ts">
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: dashboard, pending } = useFetch("/api/me");
const { isMember } = useMemberStatus();

const formatDaysLeft = (endAt: string | null) => {
  if (!endAt) return null;
  const days = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days;
};
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="แดชบอร์ด" />

      <div v-if="pending" class="p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USkeleton class="h-32 w-full" />
          <USkeleton class="h-32 w-full" />
          <USkeleton class="h-32 w-full" />
        </div>
        <USkeleton class="h-64 w-full" />
      </div>

      <div v-else-if="dashboard" class="p-6 space-y-6">
        <!-- Member Area -->
        <div v-if="isMember && dashboard.activeEntitlements.length > 0" class="space-y-4">
          <h2 class="text-xl font-semibold">แพ็กเกจของฉัน</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UCard v-for="ent in dashboard.activeEntitlements" :key="ent.id" class="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
              <div class="flex justify-between items-start mb-4">
                <h3 class="text-lg font-bold text-amber-600 dark:text-amber-400">{{ ent.productName }}</h3>
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
              
              <div class="mt-4 flex justify-between items-center text-sm">
                <span class="text-gray-500" v-if="ent.endAt">
                  หมดอายุใน {{ formatDaysLeft(ent.endAt) }} วัน
                </span>
                <span v-else class="text-gray-500">ไม่มีวันหมดอายุ</span>
                
                <UButton :to="`/me/membership/usage?id=${ent.id}`" variant="link" color="warning" class="p-0">ดูประวัติการใช้งาน</UButton>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                <UIcon name="i-lucide-shopping-basket" class="w-6 h-6" />
              </div>
              <div>
                <p class="text-sm text-gray-500">ออเดอร์ทั้งหมด</p>
                <p class="text-2xl font-bold">{{ dashboard.stats.totalOrders }}</p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg text-yellow-600 dark:text-yellow-400">
                <UIcon name="i-lucide-loader" class="w-6 h-6" />
              </div>
              <div>
                <p class="text-sm text-gray-500">กำลังดำเนินการ</p>
                <p class="text-2xl font-bold">{{ dashboard.stats.activeOrders }}</p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg text-green-600 dark:text-green-400">
                <UIcon name="i-lucide-coins" class="w-6 h-6" />
              </div>
              <div>
                <p class="text-sm text-gray-500">ยอดใช้จ่ายรวม</p>
                <p class="text-2xl font-bold">{{ formatCurrency(dashboard.stats.totalSpent) }}</p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Recent Orders -->
        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">ออเดอร์ล่าสุด</h3>
              <UButton to="/me/orders" variant="soft" color="neutral" size="sm">ดูทั้งหมด</UButton>
            </div>
          </template>
          
          <div v-if="dashboard.recentOrders.length === 0" class="text-center py-8 text-gray-500">
            ยังไม่มีรายการออเดอร์
          </div>
          <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
            <div v-for="order in dashboard.recentOrders" :key="order.id" class="py-4 flex justify-between items-center">
              <div>
                <p class="font-medium hover:text-primary cursor-pointer" @click="navigateTo(`/me/orders/${order.id}`)">
                  {{ order.orderNo || 'ไม่ระบุ' }}
                </p>
                <p class="text-sm text-gray-500">{{ formatDateTime(order.receivedAt) }}</p>
              </div>
              <div class="text-right">
                <p class="font-semibold">{{ formatCurrency(order.totalAmount) }}</p>
                <UBadge :color="orderStatusColors[order.status] as any" variant="subtle" size="sm">
                  {{ orderStatusLabels[order.status] }}
                </UBadge>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
