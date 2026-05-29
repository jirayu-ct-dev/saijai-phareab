<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

const adminTableUi = adminUi.adminTableUi;
const adminMobileListCardClass = adminUi.adminMobileListCardClass;

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { receipts, pending, total, page, pageSize, refresh } = useMyReceipts(10);

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
      <template #header>
        <UDashboardNavbar title="รายการใบเสร็จ">
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
          <section class="flex flex-col gap-1">
            <p class="text-sm text-muted px-2 pb-2">รายการทั้งหมด: {{ total }} รายการ</p>

            <!-- Mobile View -->
      <div class="md:hidden space-y-2 p-2">
        <div v-for="receipt in receipts" :key="receipt.id" :class="adminMobileListCardClass" class="p-3">
          <div class="flex justify-between items-start mb-2">
            <span class="font-medium text-highlighted">{{ receipt.paymentNo || '-' }}</span>
            <UBadge :color="receipt.type === 'ซื้อแพ็กเกจ' ? 'warning' : 'info'" variant="subtle">
              {{ receipt.type }}
            </UBadge>
          </div>
          <div class="text-sm text-muted mb-2">
            <p>{{ formatDateTime(receipt.paidAt) }}</p>
            <p>{{ receipt.detail }}</p>
          </div>
          <div class="flex justify-between items-center">
            <span class="font-bold text-highlighted">{{ formatCurrency(receipt.amount) }}</span>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-receipt"
              :to="`/me/receipts/${receipt.id}`"
              size="sm"
            />
          </div>
        </div>
        <div v-if="!receipts.length && !pending" class="flex flex-col items-center justify-center py-12 text-center text-muted">
          <UIcon name="i-lucide-receipt" class="h-12 w-12 opacity-50 mb-4" />
          <p>ยังไม่มีรายการใบเสร็จ</p>
          <UButton to="/me/packages" color="primary" variant="link">ดูแพ็กเกจ</UButton>
        </div>
      </div>

      <UTable
        :data="receipts"
        :columns="columns"
        :loading="pending"
        :ui="adminTableUi"
        class="hidden md:table w-full"
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
            <UIcon name="i-lucide-receipt" class="h-12 w-12 text-dimmed mb-4" />
            <p class="text-muted mb-4">ยังไม่มีรายการใบเสร็จ</p>
            <UButton to="/me/packages" color="primary">ดูแพ็กเกจของเรา</UButton>
          </div>
        </template>
      </UTable>

      <div v-if="total > pageSize" class="flex justify-end px-4 py-3 border-t border-default">
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="pageSize"
          show-edges
        />
      </div>
          </section>
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardPage>
</template>

