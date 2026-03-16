<script setup lang="ts">
import { sub } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Period, Range } from '~~/shared/types/dashboard'


const items = [[{
  label: 'เพิ่มออเดอร์',
  icon: 'i-lucide-shopping-basket',
  to: '/admin/orders'
}, {
  label: 'เพิ่มผู้ใช้',
  icon: 'i-lucide-user-plus',
  to: '/admin/users'
}]] satisfies DropdownMenuItem[][]

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date()
})
const period = ref<Period>('daily')
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>

          <UDropdownMenu :items="items">
            <UButton icon="i-lucide-plus" size="md" class="rounded-full" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <!-- NOTE: The `-ms-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
          <div class="flex flex-wrap gap-2 -ms-1">
            <AdminDashboardDateRangePicker v-model="range" />
            <AdminDashboardPeriodSelect v-model="period" :range="range" />
          </div>
        </template>
      </UDashboardToolbar>
      
    </template>

    <template #body>
      <AdminDashboardStats :period="period" :range="range" />
      <AdminDashboardChart :period="period" :range="range" />
      <!-- รายการล่าสุด: ชำระเงิน + ออเดอร์ -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AdminDashboardRecentPayments :period="period" :range="range" />
        <AdminDashboardSales :period="period" :range="range" />
      </div>
    </template>
  </UDashboardPanel>
</template>