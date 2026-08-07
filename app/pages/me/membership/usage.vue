<script setup lang="ts">
import { formatDateTime } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

const adminTableUi = adminUi.adminTableUi;
const adminMobileListCardClass = adminUi.adminMobileListCardClass;

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

import type { TableColumn } from "@nuxt/ui";

const route = useRoute();
const entitlementId = computed(() => (route.query.id as string) || "");

const { entitlements } = useMyMembership();
const currentId = ref(entitlementId.value);

watch(entitlements, (newEntitlements) => {
  if (!currentId.value && newEntitlements.length > 0) {
    const active = newEntitlements.find(e => e.status === 'ACTIVE');
    currentId.value = active ? active.id : (newEntitlements[0]?.id ?? "");
  }
}, { immediate: true });

const { entitlement, usages, pending, refresh } = useMyMembershipUsage(currentId);

const columns: TableColumn<any>[] = [
  { accessorKey: "index", header: "ครั้งที่" },
  { accessorKey: "receivedAt", header: "วันที่" },
  { accessorKey: "orderNo", header: "เลขรับผ้า" },
  { accessorKey: "itemCount", header: "จำนวนชิ้น" },
  { accessorKey: "creditUsed", header: "เครดิตที่ใช้" },
];

const mappedUsages = computed(() => usages.value.map((u, i) => ({ ...u, index: usages.value.length - i })));

const statusLabels: Record<string, string> = {
  ACTIVE: "กำลังใช้งาน",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกแล้ว",
};
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="ประวัติการใช้เครดิต">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <div class="flex items-center gap-2">
              <UButton icon="i-lucide-refresh-cw" :loading="pending" variant="ghost" color="neutral" @click="() => refresh()" />
              <UButton color="neutral" variant="ghost" to="/me/membership" icon="i-lucide-arrow-left">กลับ</UButton>
            </div>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div :class="adminUi.adminDashboardBodyClass">
          <section class="flex flex-col gap-3">
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-muted">เลือกแพ็กเกจ:</span>
          <USelectMenu
            v-model="currentId"
            :options="entitlements"
            option-attribute="productName"
            value-attribute="id"
            placeholder="เลือกแพ็กเกจ"
            class="w-64"
          />
        </div>

        <div v-if="pending" class="space-y-4">
          <USkeleton class="h-32 w-full rounded-md" />
          <USkeleton class="h-64 w-full rounded-md" />
        </div>
        
        <div v-else-if="!entitlement" class="text-center py-12">
          <p class="text-muted">ไม่พบข้อมูลแพ็กเกจ</p>
        </div>

        <div v-else class="space-y-6">
          <UCard class="bg-elevated border-default/50">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p class="text-sm text-muted">แพ็กเกจ</p>
                <p class="font-bold text-lg text-highlighted">{{ entitlement.productName }}</p>
              </div>
              <div>
                <p class="text-sm text-muted">สถานะ</p>
                <p class="font-bold">
                  <UBadge :color="entitlement.status === 'ACTIVE' ? 'success' : 'neutral'" variant="subtle">
                    {{ statusLabels[entitlement.status] || entitlement.status }}
                  </UBadge>
                </p>
              </div>
              <div>
                <p class="text-sm text-muted">ใช้ไปแล้ว</p>
                <p class="font-bold text-lg text-primary">{{ (entitlement.creditInitial || 0) - (entitlement.creditRemaining || 0) }} ครั้ง</p>
              </div>
              <div>
                <p class="text-sm text-muted">คงเหลือ</p>
                <p class="font-bold text-lg text-success">{{ entitlement.creditRemaining }} ครั้ง</p>
              </div>
            </div>
          </UCard>

          <!-- Mobile View -->
          <div class="md:hidden space-y-2">
            <div v-for="usage in mappedUsages" :key="usage.orderId" :class="adminMobileListCardClass" class="p-3">
              <div class="flex justify-between items-start mb-2">
                <span class="font-medium text-highlighted">ครั้งที่ {{ usage.index }}</span>
                <UBadge color="primary" variant="subtle">{{ usage.creditUsed }} ครั้ง</UBadge>
              </div>
              <div class="text-sm text-muted">
                <p>วันที่: {{ formatDateTime(usage.receivedAt) }}</p>
                <p>ออเดอร์: 
                  <NuxtLink :to="`/me/service-orders/${usage.orderId}`" class="text-primary hover:underline">
                    {{ usage.orderNo || '-' }}
                  </NuxtLink>
                </p>
                <p>จำนวน: {{ usage.itemCount }} ชิ้น</p>
              </div>
            </div>
            <div v-if="!mappedUsages.length && !pending" class="text-center py-12 text-muted">
              ยังไม่มีประวัติการใช้งาน
            </div>
          </div>

          <UTable
            :data="mappedUsages"
            :columns="columns"
            :loading="pending"
            :ui="adminTableUi"
            class="hidden md:table w-full"
          >
            <template #index-cell="{ row }">
              {{ row.original.index }}
            </template>
            
            <template #receivedAt-cell="{ row }">
              {{ formatDateTime(row.original.receivedAt) }}
            </template>
            
            <template #orderNo-cell="{ row }">
              <NuxtLink :to="`/me/service-orders/${row.original.orderId}`" class="text-primary hover:underline font-medium">
                {{ row.original.orderNo || '-' }}
              </NuxtLink>
            </template>
            
            <template #itemCount-cell="{ row }">
              {{ row.original.itemCount }} ชิ้น
            </template>
            
            <template #creditUsed-cell="{ row }">
              <UBadge color="primary" variant="subtle">{{ row.original.creditUsed }} ครั้ง</UBadge>
            </template>

            <template #empty>
              <div class="flex flex-col items-center justify-center py-8 text-center">
                <p class="text-muted">ยังไม่มีประวัติการใช้งาน</p>
              </div>
            </template>
          </UTable>
        </div>
      </section>
    </div>
  </template>
    </UDashboardPanel>
  </div>
</template>
