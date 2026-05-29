<script setup lang="ts">
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

const adminTableUi = adminUi.adminTableUi;
const adminMobileListCardClass = adminUi.adminMobileListCardClass;
const adminFilterBarClass = adminUi.adminFilterBarClass;

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

import type { TableColumn } from "@nuxt/ui";
const { orders, meta, page, pageSize, status, pending, refresh } = useMyOrders();

const statusOptions = [
  { label: "สถานะทั้งหมด", value: "ALL" },
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];

const columns: TableColumn<any>[] = [
  { accessorKey: "orderNo", header: "เลขรับผ้า" },
  { accessorKey: "receivedAt", header: "วันที่รับ" },
  { accessorKey: "itemCount", header: "จำนวนชิ้น" },
  { accessorKey: "status", header: "สถานะ" },
  { accessorKey: "totalAmount", header: "ยอดรวม" },
  { accessorKey: "actions", header: "" },
];
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="รายการออเดอร์ของฉัน">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UButton icon="i-lucide-refresh-cw" :loading="pending" variant="ghost" color="neutral" @click="() => refresh()" />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div :class="adminUi.adminDashboardBodyClass">
          <ClientOnly>
            <section class="flex flex-col gap-1">
              <UDashboardToolbar :class="adminFilterBarClass">
                <template #left>
                  <USelect
                    v-model="status"
                    :items="statusOptions"
                    class="w-48"
                  />
                </template>
              </UDashboardToolbar>
              <p class="text-sm text-muted px-2 pb-2">รายการทั้งหมด: {{ meta.total }} รายการ</p>

              <!-- Mobile View -->
              <div class="md:hidden space-y-2 p-2">
                <div v-for="order in orders" :key="order.id" :class="adminMobileListCardClass" class="p-3">
                  <div class="flex justify-between items-start mb-2">
                    <span class="font-medium text-highlighted">{{ order.orderNo || '-' }}</span>
                    <UBadge :color="orderStatusColors[order.status as keyof typeof orderStatusColors] as any" variant="subtle">
                      {{ orderStatusLabels[order.status as keyof typeof orderStatusLabels] }}
                    </UBadge>
                  </div>
                  <div class="text-sm text-muted mb-2">
                    <p>{{ formatDateTime(order.receivedAt) }}</p>
                    <p>{{ order.itemCount }} ชิ้น</p>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-highlighted">{{ formatCurrency(order.totalAmount) }}</span>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-chevron-right"
                      :to="`/me/service-orders/${order.id}`"
                      size="sm"
                    />
                  </div>
                </div>
                <div v-if="!orders.length && !pending" class="flex flex-col items-center justify-center py-12 text-center text-muted">
                  <UIcon name="i-lucide-inbox" class="h-12 w-12 opacity-50 mb-4" />
                  <p>ยังไม่มีรายการออเดอร์</p>
                  <UButton to="/me/packages" color="primary" variant="link">ดูแพ็กเกจของเรา</UButton>
                </div>
              </div>

              <UTable
                :data="orders"
                :columns="columns"
                :loading="pending"
                :ui="adminTableUi"
                class="hidden md:table w-full"
              >
                <template #orderNo-cell="{ row }">
                  <span class="font-medium">{{ row.original.orderNo || '-' }}</span>
                </template>

                <template #receivedAt-cell="{ row }">
                  {{ formatDateTime(row.original.receivedAt) }}
                </template>

                <template #itemCount-cell="{ row }">
                  {{ row.original.itemCount }} ชิ้น
                </template>

                <template #status-cell="{ row }">
                  <UBadge :color="orderStatusColors[row.original.status as keyof typeof orderStatusColors] as any" variant="subtle">
                    {{ orderStatusLabels[row.original.status as keyof typeof orderStatusLabels] }}
                  </UBadge>
                </template>

                <template #totalAmount-cell="{ row }">
                  {{ formatCurrency(row.original.totalAmount) }}
                </template>

                <template #actions-cell="{ row }">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-chevron-right"
                    :to="`/me/service-orders/${row.original.id}`"
                  />
                </template>

                <template #empty>
                  <div class="flex flex-col items-center justify-center py-12 text-center">
                    <UIcon name="i-lucide-inbox" class="h-12 w-12 text-dimmed mb-4" />
                    <p class="text-muted mb-4">ยังไม่มีรายการออเดอร์</p>
                    <UButton to="/me/packages" color="primary">ดูแพ็กเกจของเรา</UButton>
                  </div>
                </template>
              </UTable>

              <div v-if="meta.total > pageSize" class="flex justify-end p-4 border-t border-default">
                <UPagination
                  v-model:page="page"
                  :total="meta.total"
                  :items-per-page="pageSize"
                  show-edges
                />
              </div>
            </section>
            <template #fallback>
              <div class="flex flex-col items-center justify-center py-24 text-center">
                <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary mb-2" />
                <p class="text-sm text-muted">กำลังโหลดข้อมูลออเดอร์...</p>
              </div>
            </template>
          </ClientOnly>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
