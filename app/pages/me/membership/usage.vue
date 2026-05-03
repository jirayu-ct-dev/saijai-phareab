<script setup lang="ts">
import { formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

import type { TableColumn } from "@nuxt/ui";

definePageMeta({
  layout: "user",
  middleware: ["role-user", "role-member"],
});

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

const { entitlement, usages, pending } = useMyMembershipUsage(currentId);

const columns: TableColumn<any>[] = [
  { accessorKey: "index", header: "ครั้งที่" },
  { accessorKey: "receivedAt", header: "วันที่" },
  { accessorKey: "orderNo", header: "เลขรับผ้า" },
  { accessorKey: "itemCount", header: "จำนวนชิ้น" },
  { accessorKey: "creditUsed", header: "เครดิตที่ใช้" },
];

const mappedUsages = computed(() => usages.value.map((u, i) => ({ ...u, index: usages.value.length - i })));
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="ประวัติการใช้เครดิต">
        <template #right>
          <UButton color="neutral" variant="ghost" to="/me/membership" icon="i-lucide-arrow-left">กลับ</UButton>
        </template>
      </UDashboardNavbar>

      <div class="p-6 space-y-6">
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-500">เลือกแพ็กเกจ:</span>
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
          <USkeleton class="h-32 w-full" />
          <USkeleton class="h-64 w-full" />
        </div>
        
        <div v-else-if="!entitlement" class="text-center py-12">
          <p class="text-gray-500">ไม่พบข้อมูลแพ็กเกจ</p>
        </div>

        <div v-else class="space-y-6">
          <UCard class="bg-gray-50 dark:bg-gray-900/50">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p class="text-sm text-gray-500">แพ็กเกจ</p>
                <p class="font-bold text-lg">{{ entitlement.productName }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">สถานะ</p>
                <p class="font-bold">
                  <UBadge :color="entitlement.status === 'ACTIVE' ? 'success' : 'neutral'" variant="subtle">{{ entitlement.status }}</UBadge>
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-500">ใช้ไปแล้ว</p>
                <p class="font-bold text-lg text-amber-600">{{ (entitlement.creditInitial || 0) - (entitlement.creditRemaining || 0) }} ครั้ง</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">คงเหลือ</p>
                <p class="font-bold text-lg text-green-600">{{ entitlement.creditRemaining }} ครั้ง</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <UTable
              :data="mappedUsages"
              :columns="columns"
              :loading="pending"
            >
              <template #index-cell="{ row }">
                {{ row.original.index }}
              </template>
              
              <template #receivedAt-cell="{ row }">
                {{ formatDateTime(row.original.receivedAt) }}
              </template>
              
              <template #orderNo-cell="{ row }">
                <NuxtLink :to="`/me/orders/${row.original.orderId}`" class="text-primary hover:underline font-medium">
                  {{ row.original.orderNo || '-' }}
                </NuxtLink>
              </template>
              
              <template #itemCount-cell="{ row }">
                {{ row.original.itemCount }} ชิ้น
              </template>
              
              <template #creditUsed-cell="{ row }">
                <UBadge color="warning" variant="subtle">{{ row.original.creditUsed }} ครั้ง</UBadge>
              </template>

              <template #empty>
                <div class="flex flex-col items-center justify-center py-8 text-center">
                  <p class="text-gray-500">ยังไม่มีประวัติการใช้งาน</p>
                </div>
              </template>
            </UTable>
          </UCard>
        </div>
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
