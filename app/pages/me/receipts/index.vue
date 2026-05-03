<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { receipts, pending } = useMyReceipts();

const columns: TableColumn<any>[] = [
  { accessorKey: "paymentNo", header: "เลขที่บิล" },
  { accessorKey: "paidAt", header: "วันที่" },
  { accessorKey: "type", header: "ประเภท" },
  { accessorKey: "detail", header: "รายละเอียด" },
  { accessorKey: "amount", header: "ยอดเงิน" },
  { accessorKey: "actions", header: "" },
];
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="รายการใบเสร็จ" />

      <UTable
        :data="receipts"
        :columns="columns"
        :loading="pending"
        class="w-full"
      >
        <template #paymentNo-cell="{ row }">
          <span class="font-medium">{{ row.original.paymentNo || '-' }}</span>
        </template>

        <template #paidAt-cell="{ row }">
          {{ formatDateTime(row.original.paidAt) }}
        </template>
        
        <template #type-cell="{ row }">
          <UBadge :color="row.original.type === 'ซื้อแพ็กเกจ' ? 'warning' : 'info'" variant="subtle">
            {{ row.original.type }}
          </UBadge>
        </template>
        
        <template #detail-cell="{ row }">
          {{ row.original.detail }}
        </template>

        <template #amount-cell="{ row }">
          {{ formatCurrency(row.original.amount) }}
        </template>

        <template #actions-cell="{ row }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-receipt"
            :to="`/me/receipts/${row.original.id}`"
          />
        </template>

        <template #empty>
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <UIcon name="i-lucide-receipt" class="h-12 w-12 text-gray-400 mb-4" />
            <p class="text-gray-500">ยังไม่มีรายการใบเสร็จ</p>
          </div>
        </template>
      </UTable>
    </UDashboardPanel>
  </UDashboardPage>
</template>
