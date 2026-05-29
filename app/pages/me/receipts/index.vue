<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

const adminDashboardBodyClass = adminUi.adminDashboardBodyClass;
const adminDashboardCardClass = adminUi.adminDashboardCardClass;
const adminFilterBarClass = adminUi.adminFilterBarClass;
const adminEmptyStateClass = adminUi.adminEmptyStateClass;
const adminMobileListCardClass = adminUi.adminMobileListCardClass;
const adminTableUi = adminUi.adminTableUi;

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { receipts, pending, total, page, pageSize, refresh } = useMyReceipts(10);

const openReceiptDetail = (receipt: any) => navigateTo(`/me/receipts/${receipt.id}`);

const columns: TableColumn<any>[] = [
  {
    accessorKey: "paymentNo",
    header: "เลขที่บิล",
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted cursor-pointer hover:underline", onClick: (e: MouseEvent) => { e.stopPropagation(); openReceiptDetail(row.original); } }, row.original.paymentNo || '-'),
  },
  {
    accessorKey: "type",
    header: "ประเภท",
    cell: ({ row }) => h(resolveComponent("UBadge"), { color: row.original.type === 'ซื้อแพ็กเกจ' ? 'warning' : 'info', variant: "subtle" }, () => row.original.type),
  },
  {
    accessorKey: "detail",
    header: "รายละเอียด",
    cell: ({ row }) => h("span", { class: "text-sm text-highlighted truncate block max-w-xs" }, row.original.detail),
  },
  {
    accessorKey: "amount",
    header: () => h("div", { class: "text-right" }, "ยอดเงิน"),
    cell: ({ row }) => h("div", { class: "text-right font-medium text-highlighted" }, formatCurrency(row.original.amount)),
  },
  {
    accessorKey: "paidAt",
    header: "วันที่",
    cell: ({ row }) => h("div", { class: "text-sm text-muted" }, formatDateTime(row.original.paidAt)),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => h("div", { class: "flex justify-end" }, [
      h(resolveComponent("UButton"), {
        icon: "i-lucide-receipt",
        color: "neutral",
        variant: "ghost",
        onClick: () => openReceiptDetail(row.original)
      })
    ])
  }
];
</script>

<template>
  <UDashboardPanel grow id="my-receipts">
    <template #header>
      <UDashboardNavbar title="รายการใบเสร็จ" icon="i-lucide-receipt">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #right>
          <UButton icon="i-lucide-refresh-cw" :loading="pending" variant="ghost" color="neutral" @click="() => refresh()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div :class="adminDashboardBodyClass">
        <section class="flex flex-col gap-1">
          <div :class="[adminFilterBarClass, 'flex items-center justify-between gap-1.5 px-3! py-2!']">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">ตัวกรองรายการชำระเงิน</span>
            <div class="flex shrink-0 items-center justify-end gap-1.5">
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                title="รีเฟรชรายการ"
                class="shrink-0"
                :loading="pending"
                @click="refresh"
              />
            </div>
          </div>

          <template v-if="pending && !receipts.length">
            <div class="space-y-1 md:hidden">
              <div v-for="i in 5" :key="`mob-sk-${i}`" :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md']">
                <div class="flex flex-col gap-2 p-3">
                  <div class="flex justify-between items-start">
                    <USkeleton class="h-4 w-24 rounded" />
                    <USkeleton class="h-5 w-20 rounded-full" />
                  </div>
                  <div class="space-y-1">
                    <USkeleton class="h-3 w-32 rounded" />
                    <USkeleton class="h-3 w-16 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div :class="[adminDashboardCardClass, 'hidden p-0! md:block']">
              <div class="space-y-2 p-3">
                <USkeleton v-for="i in 6" :key="`dt-sk-${i}`" class="h-12 w-full rounded-md" />
              </div>
            </div>
          </template>

          <template v-else>
            <!-- Mobile View -->
            <div class="md:hidden">
              <div v-if="!receipts.length" :class="adminEmptyStateClass">
                <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                <p>ยังไม่มีรายการใบเสร็จ</p>
                <UButton to="/me/packages" color="primary" variant="link" class="mt-2">ดูแพ็กเกจของเรา</UButton>
              </div>

              <div v-else class="space-y-1">
                <div
                  v-for="receipt in receipts"
                  :key="receipt.id"
                  :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md cursor-pointer']"
                  @click="openReceiptDetail(receipt)"
                >
                  <div class="flex flex-col gap-2 p-3">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <span class="block font-mono text-[11px] font-medium text-highlighted">
                          {{ receipt.paymentNo || receipt.id }}
                        </span>
                        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                          <span>{{ formatDateTime(receipt.paidAt) }}</span>
                        </div>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <UBadge :color="receipt.type === 'ซื้อแพ็กเกจ' ? 'warning' : 'info'" variant="subtle" size="xs">
                          {{ receipt.type }}
                        </UBadge>
                        <span class="text-sm font-semibold leading-none text-primary">{{ formatCurrency(receipt.amount) }}</span>
                      </div>
                    </div>
                    <div class="min-w-0">
                      <p class="truncate text-xs text-muted">{{ receipt.detail }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop Table -->
            <div :class="[adminDashboardCardClass, 'hidden overflow-hidden p-0! md:block']">
              <UTable
                :data="receipts"
                :columns="columns"
                :loading="pending"
                :ui="adminTableUi"
              >
                <template #empty>
                  <div :class="adminEmptyStateClass">
                    <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                    <p>ยังไม่มีรายการใบเสร็จ</p>
                    <UButton to="/me/packages" color="primary" variant="link" class="mt-2">ดูแพ็กเกจของเรา</UButton>
                  </div>
                </template>
              </UTable>
            </div>
          </template>
        </section>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            <template v-if="pending">
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
                กำลังโหลด...
              </span>
            </template>
            <template v-else>
              แสดง {{ receipts.length ? (page - 1) * pageSize + 1 : 0 }}-{{ (page - 1) * pageSize + receipts.length }} จาก {{ total }} รายการ
            </template>
          </div>

          <UPagination
            v-if="!pending && total > pageSize"
            v-model:page="page"
            :items-per-page="pageSize"
            :total="total"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
