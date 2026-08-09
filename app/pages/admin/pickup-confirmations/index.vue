<script setup lang="ts">
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatDateTime } from "~~/shared/utils/format";

type PickupResponse = "HOME_PICKUP" | "SELF_DROPOFF" | "SKIP" | "CONTACT_REQUESTED";
type BadgeColor = "success" | "info" | "error" | "neutral" | "primary" | "secondary" | "warning";
type PickupConfirmationRow = {
  id: string;
  revision: number;
  status: "ACTIVE" | "CLOSED" | "CANCELLED";
  response: PickupResponse | null;
  respondedAt: string | null;
  responseCount: number;
  dueAt: string | null;
  updatedAt: string;
  order: { id: string; orderNo: string | null; status: ServiceOrderStatus };
  customer: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    image: string | null;
    lineUserId: string | null;
    address: string | null;
  };
  initialNotification: {
    status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "UNREACHABLE" | "SKIPPED_TOO_LATE" | "CANCELLED";
    scheduledFor: string;
    sentAt: string | null;
  } | null;
  latestResponse: {
    id: string;
    response: PickupResponse;
    createdAt: string;
    staffNotifiedAt: string | null;
    staffNotifyAttempts: number;
    staffNotifyError: string | null;
  } | null;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const responseLabels: Record<PickupResponse, string> = {
  HOME_PICKUP: "มีผ้าให้รับกลับจากบ้าน",
  SELF_DROPOFF: "นำผ้ามาส่งที่ร้านเอง",
  SKIP: "ไม่มีผ้ารอบนี้",
  CONTACT_REQUESTED: "ขอเลื่อน / ติดต่อร้าน",
};
const responseColors: Record<PickupResponse, BadgeColor> = {
  HOME_PICKUP: "success",
  SELF_DROPOFF: "info",
  SKIP: "neutral",
  CONTACT_REQUESTED: "warning",
};
const responseFilterItems = [
  { label: "ทุกคำตอบ", value: "ALL" },
  { label: "มีผ้าให้รับจากบ้าน", value: "HOME_PICKUP" },
  { label: "ส่งที่ร้านเอง", value: "SELF_DROPOFF" },
  { label: "ไม่มีผ้ารอบนี้", value: "SKIP" },
  { label: "ขอให้ติดต่อ", value: "CONTACT_REQUESTED" },
  { label: "ยังไม่ตอบ", value: "NO_RESPONSE" },
];

const searchQuery = ref("");
const responseFilter = ref("ALL");
const hydrated = ref(false);
onMounted(() => { hydrated.value = true; });

const { data, pending, status, refresh, error } = useFetch<PickupConfirmationRow[]>("/api/admin/pickup-confirmations", {
  server: false,
  lazy: true,
});
const rows = computed(() => data.value ?? []);
const isLoading = computed(() => !hydrated.value || pending.value || status.value === "idle");
const filteredRows = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase("th");
  return rows.value.filter((row) => {
    const matchesResponse = responseFilter.value === "ALL"
      || (responseFilter.value === "NO_RESPONSE" ? !row.response : row.response === responseFilter.value);
    if (!matchesResponse) return false;
    if (!query) return true;
    return [
      row.order.orderNo,
      row.customer.name,
      row.customer.phoneNumber,
      row.customer.address,
      row.response ? responseLabels[row.response] : "ยังไม่ตอบ",
    ].some((value) => value?.toLocaleLowerCase("th").includes(query));
  });
});
const summary = computed(() => ({
  total: rows.value.length,
  homePickup: rows.value.filter((row) => row.response === "HOME_PICKUP").length,
  contact: rows.value.filter((row) => row.response === "CONTACT_REQUESTED").length,
  noResponse: rows.value.filter((row) => !row.response).length,
}));

const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;
const answerLabel = (row: PickupConfirmationRow) => row.response ? responseLabels[row.response] : "ยังไม่ตอบ";
const answerColor = (row: PickupConfirmationRow): BadgeColor => row.response ? responseColors[row.response] : "neutral";
const customerInitial = (name: string) => name.trim().charAt(0) || "ล";
const goToOrder = (row: PickupConfirmationRow) => navigateTo(`/admin/service-orders/${row.order.id}`);
</script>

<template>
  <UDashboardPanel id="pickup-confirmations">
    <template #header>
      <UDashboardNavbar title="คำตอบรับผ้ารอบถัดไป" icon="i-lucide-messages-square">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #right>
          <UButton
            label="รายการรับผ้า"
            icon="i-lucide-shopping-basket"
            color="neutral"
            variant="outline"
            to="/admin/service-orders"
            :ui="{ label: 'hidden sm:inline' }"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4 p-2 sm:p-6">
        <section>
          <h1 class="text-xl font-semibold text-highlighted">ภาพรวมคำตอบลูกค้า</h1>
          <p class="mt-1 text-sm text-muted">ดูได้ในหน้าเดียวว่าบ้านไหนตอบอะไร และติดต่อกลับได้ทันที</p>
        </section>

        <section class="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div class="rounded-lg border border-default/40 bg-default p-3">
            <p class="text-xs text-muted">ออเดอร์ทั้งหมด</p>
            <p class="mt-1 text-2xl font-semibold text-highlighted">{{ summary.total }}</p>
          </div>
          <div class="rounded-lg border border-default/40 bg-default p-3">
            <p class="text-xs text-muted">ไปรับผ้าที่บ้าน</p>
            <p class="mt-1 text-2xl font-semibold text-highlighted">{{ summary.homePickup }}</p>
          </div>
          <div class="rounded-lg border border-default/40 bg-default p-3">
            <p class="text-xs text-muted">ต้องติดต่อกลับ</p>
            <p class="mt-1 text-2xl font-semibold text-highlighted">{{ summary.contact }}</p>
          </div>
          <div class="rounded-lg border border-default/40 bg-default p-3">
            <p class="text-xs text-muted">ยังไม่ตอบ</p>
            <p class="mt-1 text-2xl font-semibold text-highlighted">{{ summary.noResponse }}</p>
          </div>
        </section>

        <section class="rounded-lg border border-default/40 bg-default">
          <div class="grid gap-2 border-b border-default/40 p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
            <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="ค้นหาออเดอร์ ลูกค้า เบอร์โทร หรือที่อยู่" />
            <USelect v-model="responseFilter" :items="responseFilterItems" value-key="value" />
            <UIButtonRefresh :loading="isLoading" class="justify-self-end" @refresh="() => refresh()" />
          </div>

          <div v-if="isLoading" class="space-y-2 p-4">
            <USkeleton v-for="index in 5" :key="index" class="h-16 w-full" />
          </div>
          <div v-else-if="error" class="p-8 text-center">
            <UIcon name="i-lucide-circle-alert" class="mx-auto size-8 text-error" />
            <p class="mt-2 text-sm font-medium">โหลดข้อมูลคำตอบไม่สำเร็จ</p>
            <UButton class="mt-3" color="neutral" variant="outline" size="sm" @click="() => refresh()">ลองใหม่</UButton>
          </div>
          <div v-else-if="!filteredRows.length" class="p-10 text-center text-sm text-muted">
            <UIcon name="i-lucide-message-circle-off" class="mx-auto mb-2 size-8" />
            ไม่พบคำตอบที่ตรงกับตัวกรอง
          </div>

          <template v-else>
            <div class="hidden overflow-x-auto md:block">
              <table class="w-full min-w-[1100px] text-left text-sm">
                <thead class="border-b border-default/40 bg-elevated/40 text-xs text-muted">
                  <tr>
                    <th class="px-4 py-3 font-medium">ออเดอร์ / วันนัด</th>
                    <th class="px-4 py-3 font-medium">ลูกค้า / บ้าน</th>
                    <th class="px-4 py-3 font-medium">คำตอบล่าสุด</th>
                    <th class="px-4 py-3 font-medium">สถานะแจ้งทีม</th>
                    <th class="px-4 py-3 text-right font-medium">ติดต่อ</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default/35">
                  <tr v-for="row in filteredRows" :key="row.id" class="align-top hover:bg-elevated/30">
                    <td class="px-4 py-3">
                      <button class="font-mono text-xs font-semibold text-primary hover:underline" @click="goToOrder(row)">
                        {{ row.order.orderNo || row.order.id }}
                      </button>
                      <div class="mt-1 flex flex-wrap items-center gap-1.5">
                        <UBadge :color="orderStatusBadgeColors[row.order.status]" variant="soft" size="xs">{{ orderStatusLabels[row.order.status] }}</UBadge>
                        <span class="text-xs text-muted">นัด {{ row.dueAt ? formatDateTime(row.dueAt) : '-' }}</span>
                      </div>
                    </td>
                    <td class="max-w-[300px] px-4 py-3">
                      <div class="flex items-start gap-2.5">
                        <UAvatar :src="row.customer.image || undefined" :alt="row.customer.name" :text="customerInitial(row.customer.name)" size="sm" />
                        <div class="min-w-0">
                          <p class="font-medium text-highlighted">{{ row.customer.name }}</p>
                          <p class="mt-0.5 text-xs text-muted">{{ row.customer.phoneNumber || 'ไม่มีเบอร์โทร' }}</p>
                          <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted">{{ row.customer.address || 'ยังไม่มีที่อยู่รับ–ส่ง' }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <UBadge :color="answerColor(row)" variant="soft">{{ answerLabel(row) }}</UBadge>
                      <p class="mt-1.5 text-xs text-muted">{{ row.respondedAt ? formatDateTime(row.respondedAt) : 'รอคำตอบจากลูกค้า' }}</p>
                      <p v-if="row.responseCount > 1" class="mt-1 text-xs text-muted">แก้ไขคำตอบ {{ row.responseCount - 1 }} ครั้ง</p>
                    </td>
                    <td class="px-4 py-3">
                      <template v-if="row.latestResponse">
                        <p :class="row.latestResponse.staffNotifiedAt ? 'text-success' : 'text-warning'" class="text-xs font-medium">
                          {{ row.latestResponse.staffNotifiedAt ? 'แจ้งทีมแล้ว' : 'รอแจ้งทีม' }}
                        </p>
                        <p class="mt-1 text-xs text-muted">
                          {{ row.latestResponse.staffNotifiedAt ? formatDateTime(row.latestResponse.staffNotifiedAt) : `พยายาม ${row.latestResponse.staffNotifyAttempts} ครั้ง` }}
                        </p>
                      </template>
                      <p v-else class="text-xs text-muted">ยังไม่มีคำตอบ</p>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end gap-1">
                        <UButton
                          :to="row.customer.phoneNumber ? `tel:${row.customer.phoneNumber}` : undefined"
                          :disabled="!row.customer.phoneNumber"
                          icon="i-lucide-phone"
                          color="neutral"
                          variant="ghost"
                          size="sm"
                          :title="row.customer.phoneNumber ? 'โทรหาลูกค้า' : 'ลูกค้ายังไม่มีเบอร์โทร'"
                        />
                        <UIButtonChatLine v-if="row.customer.lineUserId" :line-user-id="row.customer.lineUserId" icon-only size="sm" />
                        <UButton :to="`/admin/service-orders/${row.order.id}`" icon="i-lucide-eye" color="neutral" variant="ghost" size="sm" title="ดูออเดอร์" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="divide-y divide-default/35 md:hidden">
              <article v-for="row in filteredRows" :key="row.id" class="space-y-3 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <button class="font-mono text-xs font-semibold text-primary hover:underline" @click="goToOrder(row)">
                      {{ row.order.orderNo || row.order.id }}
                    </button>
                    <p class="mt-1 font-medium text-highlighted">{{ row.customer.name }}</p>
                  </div>
                  <UBadge :color="answerColor(row)" variant="soft" class="shrink-0">{{ answerLabel(row) }}</UBadge>
                </div>
                <div class="rounded-md bg-elevated/50 p-3 text-xs leading-5 text-muted">
                  <p><span class="font-medium text-highlighted">บ้าน:</span> {{ row.customer.address || 'ยังไม่มีที่อยู่รับ–ส่ง' }}</p>
                  <p><span class="font-medium text-highlighted">วันนัด:</span> {{ row.dueAt ? formatDateTime(row.dueAt) : '-' }}</p>
                  <p><span class="font-medium text-highlighted">ตอบเมื่อ:</span> {{ row.respondedAt ? formatDateTime(row.respondedAt) : 'ยังไม่ตอบ' }}</p>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <p v-if="row.latestResponse" class="text-xs" :class="row.latestResponse.staffNotifiedAt ? 'text-success' : 'text-warning'">
                    {{ row.latestResponse.staffNotifiedAt ? 'แจ้งทีมแล้ว' : 'รอแจ้งทีม' }}
                  </p>
                  <p v-else class="text-xs text-muted">ยังไม่มีคำตอบ</p>
                  <div class="flex gap-1">
                    <UButton
                      :to="row.customer.phoneNumber ? `tel:${row.customer.phoneNumber}` : undefined"
                      :disabled="!row.customer.phoneNumber"
                      icon="i-lucide-phone"
                      color="neutral"
                      variant="outline"
                      size="sm"
                      :title="row.customer.phoneNumber ? 'โทรหาลูกค้า' : 'ลูกค้ายังไม่มีเบอร์โทร'"
                    />
                    <UIButtonChatLine v-if="row.customer.lineUserId" :line-user-id="row.customer.lineUserId" icon-only size="sm" />
                    <UButton :to="`/admin/service-orders/${row.order.id}`" icon="i-lucide-eye" color="neutral" variant="outline" size="sm" title="ดูออเดอร์" />
                  </div>
                </div>
              </article>
            </div>
          </template>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
