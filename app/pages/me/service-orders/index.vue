<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
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

const { orders, meta, page, pageSize, status, pending, refresh } = useMyOrders();

const statusOptions = [
  { label: "สถานะทั้งหมด", value: "ALL" },
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];

const openDetailPage = (order: any) => navigateTo(`/me/service-orders/${order.id}`);

const columns: TableColumn<any>[] = [
  {
    accessorKey: "orderNo",
    header: "เลขรับผ้า",
    cell: ({ row }) => h("div", { class: "font-mono text-xs text-muted cursor-pointer hover:underline", onClick: (e: MouseEvent) => { e.stopPropagation(); openDetailPage(row.original); } }, row.original.orderNo || row.original.id),
  },
  {
    accessorKey: "itemCount",
    header: "จำนวนชิ้น",
    cell: ({ row }) => h("span", { class: "text-sm text-highlighted" }, `${row.original.itemCount} ชิ้น`),
  },
  {
    accessorKey: "totalAmount",
    header: () => h("div", { class: "text-right" }, "ยอดรวม"),
    cell: ({ row }) => h("div", { class: "text-right font-medium text-highlighted" }, formatCurrency(row.original.totalAmount)),
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) => {
      const color = orderStatusColors[row.original.status as keyof typeof orderStatusColors] || "neutral";
      const label = orderStatusLabels[row.original.status as keyof typeof orderStatusLabels] || row.original.status;
      return h(resolveComponent("UBadge"), { color, variant: "subtle" }, () => label);
    },
  },
  {
    accessorKey: "receivedAt",
    header: "วันที่รับ",
    cell: ({ row }) => h("div", { class: "text-sm text-muted" }, formatDateTime(row.original.receivedAt)),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => h("div", { class: "flex justify-end" }, [
      h(resolveComponent("UButton"), {
        icon: "i-lucide-chevron-right",
        color: "neutral",
        variant: "ghost",
        onClick: () => openDetailPage(row.original)
      })
    ])
  }
];
</script>

<template>
  <UDashboardPanel grow id="my-service-orders">
    <template #header>
      <UDashboardNavbar title="รายการออเดอร์ของฉัน" icon="i-lucide-shopping-basket">
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
          <div :class="[adminFilterBarClass, 'space-y-2 px-3! py-2! md:flex md:items-center md:justify-between md:gap-3 md:space-y-0']">
            <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">ตัวกรอง:</span>
            </div>
            <div class="grid grid-cols-1 gap-2 sm:flex sm:items-center md:justify-end">
              <USelect
                v-model="status"
                :items="statusOptions"
                class="w-full sm:w-48"
              />
              <UIButtonRefresh class="hidden shrink-0 md:inline-flex" :loading="pending" @refresh="refresh" />
            </div>
          </div>

          <template v-if="pending && !orders.length">
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
              <div v-if="!orders.length" :class="adminEmptyStateClass">
                <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
                <p>ยังไม่มีรายการออเดอร์</p>
                <UButton to="/me/packages" color="primary" variant="link" class="mt-2">ดูแพ็กเกจของเรา</UButton>
              </div>

              <div v-else class="space-y-1">
                <div
                  v-for="order in orders"
                  :key="order.id"
                  :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md cursor-pointer']"
                  @click="openDetailPage(order)"
                >
                  <div class="flex flex-col gap-2 p-3">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <span class="block font-mono text-[11px] font-medium text-highlighted">
                          {{ order.orderNo || order.id }}
                        </span>
                        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                          <span>รับ {{ formatDateTime(order.receivedAt) }}</span>
                        </div>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <UBadge :color="orderStatusColors[order.status as keyof typeof orderStatusColors] as any" variant="subtle" size="xs">
                          {{ orderStatusLabels[order.status as keyof typeof orderStatusLabels] || order.status }}
                        </UBadge>
                        <span class="text-sm font-semibold leading-none text-primary">{{ formatCurrency(order.totalAmount) }}</span>
                      </div>
                    </div>
                    <div class="min-w-0">
                      <p class="truncate text-xs text-muted">จำนวน {{ order.itemCount }} ชิ้น</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop Table -->
            <div :class="[adminDashboardCardClass, 'hidden overflow-hidden p-0! md:block']">
              <UTable
                :data="orders"
                :columns="columns"
                :loading="pending"
                :ui="adminTableUi"
              >
                <template #empty>
                  <div :class="adminEmptyStateClass">
                    <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-60" />
                    <p>ยังไม่มีรายการออเดอร์</p>
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
              แสดง {{ orders.length ? (page - 1) * pageSize + 1 : 0 }}-{{ (page - 1) * pageSize + orders.length }} จาก {{ meta.total }} รายการ
            </template>
          </div>

          <UPagination
            v-if="!pending && meta.total > pageSize"
            v-model:page="page"
            :items-per-page="pageSize"
            :total="meta.total"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
