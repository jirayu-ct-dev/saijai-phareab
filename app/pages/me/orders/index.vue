<script setup lang="ts">
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

import type { TableColumn } from "@nuxt/ui";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { orders, meta, page, pageSize, status, pending } = useMyOrders();

const statusOptions = [
  { label: "ทั้งหมด", value: "" },
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
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="รายการออเดอร์" />

      <UDashboardToolbar>
        <template #left>
          <USelectMenu
            v-model="status"
            :options="statusOptions"
            option-attribute="label"
            value-attribute="value"
            placeholder="สถานะทั้งหมด"
            class="w-48"
          />
        </template>
      </UDashboardToolbar>

      <UTable
        :data="orders"
        :columns="columns"
        :loading="pending"
        class="w-full"
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
            :to="`/me/orders/${row.original.id}`"
          />
        </template>

        <template #empty>
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <UIcon name="i-lucide-inbox" class="h-12 w-12 text-gray-400 mb-4" />
            <p class="text-gray-500 mb-4">ยังไม่มีรายการออเดอร์</p>
            <UButton to="/me/packages" color="primary">ดูแพ็กเกจของเรา</UButton>
          </div>
        </template>
      </UTable>

      <div v-if="meta.total > pageSize" class="flex justify-end p-4 border-t border-gray-200 dark:border-gray-800">
        <UPagination
          v-model="page"
          :page-count="pageSize"
          :total="meta.total"
        />
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
