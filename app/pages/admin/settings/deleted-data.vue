<script setup lang="ts">
import * as adminUi from "~~/shared/config/adminUi";
import { formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "admin",
  middleware: ["role-admin"],
});

type DeletedDataType =
  | "user"
  | "service_order"
  | "package_sale"
  | "payment_record"
  | "member_entitlement"
  | "storefront_price";

type DeletedDataItem = {
  id: string;
  type: DeletedDataType;
  title: string;
  description: string;
  amount?: number;
  deletedAt: string;
  deletedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  impact: string[];
};

type DeletedDataResponse = {
  items: DeletedDataItem[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
};

const adminDashboardCardClass = adminUi.adminDashboardCardClass;
const adminFilterBarClass = adminUi.adminFilterBarClass;
const adminMobileListCardClass = adminUi.adminMobileListCardClass;
const adminEmptyStateClass = adminUi.adminEmptyStateClass;

const notify = useNotify();

const typeOptions: Array<{ label: string; value: DeletedDataType | "all" }> = [
  { label: "ทั้งหมด", value: "all" },
  { label: "ผู้ใช้งาน", value: "user" },
  { label: "รายการรับผ้า", value: "service_order" },
  { label: "รายการขายแพ็กเกจ", value: "package_sale" },
  { label: "การชำระเงิน", value: "payment_record" },
  { label: "แพ็กเกจสมาชิก", value: "member_entitlement" },
  { label: "ราคาหน้าร้าน", value: "storefront_price" },
];

const typeLabelMap = Object.fromEntries(typeOptions.map((item) => [item.value, item.label])) as Record<DeletedDataType | "all", string>;
const typeIconMap: Record<DeletedDataType, string> = {
  user: "i-lucide-user",
  service_order: "i-lucide-shopping-basket",
  package_sale: "i-lucide-package-check",
  payment_record: "i-lucide-receipt",
  member_entitlement: "i-lucide-badge-check",
  storefront_price: "i-lucide-tags",
};
const typeColorMap: Record<DeletedDataType, "primary" | "secondary" | "info" | "warning" | "success" | "neutral"> = {
  user: "primary",
  service_order: "warning",
  package_sale: "secondary",
  payment_record: "success",
  member_entitlement: "info",
  storefront_price: "neutral",
};

const selectedType = ref<DeletedDataType | "all">("all");
const search = ref("");
const page = ref(1);
const limit = ref(20);
const restoreId = ref<string | null>(null);
const restoreOpen = ref(false);
const restoreTarget = ref<DeletedDataItem | null>(null);
const restoreTargets = ref<DeletedDataItem[]>([]);
const isBulkRestoring = ref(false);
const hardDeleteOpen = ref(false);
const hardDeleteTarget = ref<DeletedDataItem | null>(null);
const hardDeleteTargets = ref<DeletedDataItem[]>([]);
const hardDeleteText = ref("");
const isHardDeleting = ref(false);
const selectedRows = ref<Record<string, boolean>>({});

const confirmationText = "ยืนยันการลบข้อมูล";

const query = computed(() => ({
  type: selectedType.value,
  search: search.value,
  page: page.value,
  limit: limit.value,
}));

const { data, status, refresh } = await useFetch<DeletedDataResponse>("/api/admin/deleted", {
  query,
  default: () => ({ items: [], total: 0, page: 1, limit: 20, pageCount: 1 }),
});

const isLoading = computed(() => status.value === "pending");
const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const pageCount = computed(() => data.value?.pageCount ?? 1);
const getRowKey = (item: DeletedDataItem) => `${item.type}:${item.id}`;
const visibleRowKeys = computed(() => items.value.map(getRowKey));
const selectedCount = computed(() => Object.values(selectedRows.value).filter(Boolean).length);
const selectedItems = computed(() => items.value.filter((item) => selectedRows.value[getRowKey(item)]));
const isAllVisibleSelected = computed(() =>
  visibleRowKeys.value.length > 0 && visibleRowKeys.value.every((key) => selectedRows.value[key]),
);
const paginationSummary = computed(() => {
  if (!total.value) return "0 รายการ";
  const start = (page.value - 1) * limit.value + 1;
  const end = Math.min(total.value, page.value * limit.value);
  return `${start}-${end} / ${total.value}`;
});
const selectionSummary = computed(() => {
  if (!total.value) return "0 รายการ";
  if (selectedCount.value) return `เลือก ${selectedCount.value} / ${total.value}`;
  return paginationSummary.value;
});
const hardDeleteItemCount = computed(() => hardDeleteTargets.value.length || (hardDeleteTarget.value ? 1 : 0));
const hardDeleteTitle = computed(() => {
  if (hardDeleteTargets.value.length) return `${hardDeleteTargets.value.length} รายการที่เลือก`;
  return hardDeleteTarget.value?.title ?? "";
});
const hardDeleteImpact = computed(() => {
  if (hardDeleteTargets.value.length) {
    return hardDeleteTargets.value.map((item) => `${typeLabelMap[item.type]}: ${item.title}`);
  }
  return hardDeleteTarget.value?.impact ?? [];
});
const restoreItemCount = computed(() => restoreTargets.value.length || (restoreTarget.value ? 1 : 0));
const restoreTitle = computed(() => {
  if (restoreTargets.value.length) return `${restoreTargets.value.length} รายการที่เลือก`;
  return restoreTarget.value?.title ?? "";
});
const restoreDescription = computed(() => {
  if (restoreTargets.value.length) return "รายการที่เลือกจะกลับไปแสดงในหน้าจัดการตามประเภทข้อมูลเดิม";
  return restoreTarget.value?.description || "ข้อมูลนี้จะกลับไปแสดงในหน้าจัดการตามประเภทข้อมูลเดิม";
});
const canHardDelete = computed(() => hardDeleteText.value === confirmationText && hardDeleteItemCount.value > 0);

watch([selectedType, search], () => {
  page.value = 1;
  selectedRows.value = {};
});

watch(items, () => {
  const visible = new Set(visibleRowKeys.value);
  selectedRows.value = Object.fromEntries(
    Object.entries(selectedRows.value).filter(([key, selected]) => selected && visible.has(key)),
  );
});

const handleRefresh = async () => {
  await refresh();
};

const toggleRow = (item: DeletedDataItem, selected: boolean) => {
  const key = getRowKey(item);
  selectedRows.value = {
    ...selectedRows.value,
    [key]: selected,
  };
};

const toggleAllVisible = (selected: boolean) => {
  selectedRows.value = {
    ...selectedRows.value,
    ...Object.fromEntries(visibleRowKeys.value.map((key) => [key, selected])),
  };
};

const clearSelection = () => {
  selectedRows.value = {};
};

const openRestore = (item: DeletedDataItem) => {
  restoreTarget.value = item;
  restoreTargets.value = [];
  restoreOpen.value = true;
};

const openBulkRestore = () => {
  if (!selectedItems.value.length) return;
  restoreTarget.value = null;
  restoreTargets.value = [...selectedItems.value];
  restoreOpen.value = true;
};

const closeRestore = () => {
  if (isBulkRestoring.value) return;
  resetRestoreState();
};

const resetRestoreState = () => {
  restoreOpen.value = false;
  restoreTarget.value = null;
  restoreTargets.value = [];
};

const confirmRestore = async () => {
  const targets = restoreTargets.value.length
    ? restoreTargets.value
    : (restoreTarget.value ? [restoreTarget.value] : []);
  if (!targets.length) return;
  restoreId.value = targets.length === 1 ? targets[0]?.id ?? null : null;
  isBulkRestoring.value = targets.length > 1;
  try {
    await Promise.all(targets.map((item) =>
      $fetch(`/api/admin/deleted/${item.id}/restore`, {
        method: "POST",
        body: { type: item.type },
      }),
    ));
    notify.success(targets.length > 1 ? `กู้คืน ${targets.length} รายการแล้ว` : "กู้คืนข้อมูลแล้ว");
    clearSelection();
    resetRestoreState();
    await refresh();
  } catch (error: any) {
    notify.error(error?.statusMessage || "ไม่สามารถกู้คืนข้อมูลได้");
  } finally {
    restoreId.value = null;
    isBulkRestoring.value = false;
  }
};

const openHardDelete = (item: DeletedDataItem) => {
  hardDeleteTarget.value = item;
  hardDeleteTargets.value = [];
  hardDeleteText.value = "";
  hardDeleteOpen.value = true;
};

const openBulkHardDelete = () => {
  if (!selectedItems.value.length) return;
  hardDeleteTarget.value = null;
  hardDeleteTargets.value = [...selectedItems.value];
  hardDeleteText.value = "";
  hardDeleteOpen.value = true;
};

const closeHardDelete = () => {
  if (isHardDeleting.value) return;
  resetHardDeleteState();
};

const resetHardDeleteState = () => {
  hardDeleteOpen.value = false;
  hardDeleteTarget.value = null;
  hardDeleteTargets.value = [];
  hardDeleteText.value = "";
};

const confirmHardDelete = async () => {
  if (!canHardDelete.value) return;
  const targets = hardDeleteTargets.value.length
    ? hardDeleteTargets.value
    : (hardDeleteTarget.value ? [hardDeleteTarget.value] : []);
  isHardDeleting.value = true;
  try {
    await Promise.all(targets.map((item) =>
      $fetch(`/api/admin/deleted/${item.id}`, {
        method: "DELETE",
        body: {
          type: item.type,
          confirmation: hardDeleteText.value,
        },
      }),
    ));
    notify.success(targets.length > 1 ? `ลบถาวร ${targets.length} รายการแล้ว` : "ลบถาวรแล้ว");
    clearSelection();
    resetHardDeleteState();
    await refresh();
  } catch (error: any) {
    notify.error(error?.statusMessage || "ไม่สามารถลบถาวรได้");
  } finally {
    isHardDeleting.value = false;
  }
};
</script>

<template>
  <UDashboardPanel id="deleted-data">
    <div class="mx-auto w-full max-w-6xl space-y-3 p-2 sm:p-6">
      <section :class="adminDashboardCardClass">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-xl font-semibold text-highlighted">จัดการข้อมูลที่ถูกลบ</h1>
            <p class="mt-1 text-sm text-muted">กู้คืนหรือลบถาวรข้อมูล soft-deleted ทั้งระบบ</p>
          </div>
          <UBadge color="warning" variant="subtle" class="shrink-0">
            {{ selectionSummary }}
          </UBadge>
        </div>
      </section>

      <section class="flex flex-col gap-1">
        <div :class="[adminFilterBarClass, 'px-3! py-3! flex flex-col gap-1.5 sm:flex-row sm:items-center']">
          <div class="flex min-w-0 flex-1 items-center gap-1.5">
            <UCheckbox
              :model-value="isAllVisibleSelected"
              :disabled="!items.length"
              aria-label="เลือกรายการทั้งหมดในหน้านี้"
              class="shrink-0"
              @update:model-value="toggleAllVisible(Boolean($event))"
            />
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="ค้นหาชื่อ อีเมล เลขออเดอร์ หรือเลขชำระ"
              class="min-w-0 flex-1"
            />
            <UButton
              v-if="selectedCount"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              aria-label="กู้คืนที่เลือก"
              :loading="isBulkRestoring"
              @click="openBulkRestore"
            />
            <UButton
              v-if="selectedCount"
              icon="i-lucide-trash-2"
              color="error"
              variant="subtle"
              aria-label="ลบที่เลือก"
              @click="openBulkHardDelete"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              :loading="isLoading"
              @click="handleRefresh"
            />
          </div>
          <div class="flex shrink-0 items-center justify-end gap-1.5">
            <USelect
              v-model="selectedType"
              :items="typeOptions"
              value-key="value"
              class="w-43 shrink-0"
            />
          </div>
        </div>

        <div v-if="isLoading" class="space-y-1">
          <div
            v-for="i in 5"
            :key="`deleted-sk-${i}`"
            :class="[adminMobileListCardClass, 'p-3']"
          >
            <div class="flex items-center gap-3">
              <USkeleton class="size-10 rounded-md" />
              <div class="min-w-0 flex-1 space-y-2">
                <USkeleton class="h-4 w-48 rounded" />
                <USkeleton class="h-3 w-72 max-w-full rounded" />
              </div>
              <USkeleton class="h-7 w-20 rounded-md" />
            </div>
          </div>
        </div>

        <div v-else-if="!items.length" :class="adminEmptyStateClass">
          ไม่พบข้อมูลที่ถูกลบ
        </div>

        <div v-else class="space-y-1">
          <div
            v-for="item in items"
            :key="`${item.type}-${item.id}`"
            :class="[adminMobileListCardClass, 'p-3']"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div class="flex min-w-0 gap-3">
                <UCheckbox
                  :model-value="Boolean(selectedRows[getRowKey(item)])"
                  :aria-label="`เลือกรายการ ${item.title}`"
                  class="mt-2 shrink-0"
                  @update:model-value="toggleRow(item, Boolean($event))"
                />
                <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-elevated text-muted">
                  <UIcon :name="typeIconMap[item.type]" class="size-5" />
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="truncate font-semibold text-highlighted">{{ item.title }}</p>
                    <UBadge :color="typeColorMap[item.type]" variant="subtle" size="xs">
                      {{ typeLabelMap[item.type] }}
                    </UBadge>
                  </div>
                  <p class="mt-0.5 truncate text-sm text-muted">{{ item.description || "-" }}</p>
                  <p class="mt-1 text-xs text-muted">
                    ถูกลบ {{ formatDateTime(item.deletedAt) }}
                    <span v-if="item.deletedBy"> โดย {{ item.deletedBy.name || item.deletedBy.email }}</span>
                  </p>
                  <div v-if="item.impact.length" class="mt-2 flex flex-wrap gap-1">
                    <UBadge
                      v-for="impact in item.impact.slice(0, 3)"
                      :key="impact"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    >
                      {{ impact }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-1.5 md:shrink-0">
                <UButton
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="restoreId === item.id"
                  @click="openRestore(item)"
                >
                  กู้คืน
                </UButton>
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="subtle"
                  size="sm"
                  @click="openHardDelete(item)"
                >
                  ลบถาวร
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2 px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-muted">{{ paginationSummary }}</p>
          <UPagination
            :page="page"
            :items-per-page="limit"
            :total="total"
            @update:page="(nextPage: number) => page = nextPage"
          />
        </div>
      </section>

      <UIConfirmModal
        v-model:open="restoreOpen"
        title="ยืนยันการกู้คืน"
        icon="i-lucide-rotate-ccw"
        icon-color="success"
        confirm-color="success"
        confirm-label="กู้คืน"
        :loading="Boolean(restoreId) || isBulkRestoring"
        @confirm="confirmRestore"
        @cancel="closeRestore"
      >
        <template #message>
          คุณต้องการกู้คืน
          <span class="font-semibold text-highlighted">{{ restoreTitle }}</span>
          ใช่หรือไม่?
        </template>
        <template #subMessage>
          {{ restoreDescription }}
        </template>
      </UIConfirmModal>

      <UModal
        v-model:open="hardDeleteOpen"
        title="ลบข้อมูลถาวร"
        :ui="{ body: '!bg-default p-4! dark:!bg-elevated/55' }"
      >
        <template #body>
          <div class="space-y-4">
            <div class="flex gap-3">
              <div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
                <UIcon name="i-lucide-triangle-alert" class="size-5" />
              </div>
              <div class="min-w-0 space-y-2">
                <p class="text-sm text-muted">
                  ลบ
                  <span class="font-semibold text-highlighted">{{ hardDeleteTitle }}</span>
                  ออกจากระบบอย่างถาวร
                </p>
                <div class="rounded-md border border-error/25 bg-error/5 p-3 text-xs text-error">
                  <p class="font-semibold">ข้อมูลที่จะหายไปตลอดกาล:</p>
                  <ul class="mt-2 space-y-1">
                    <li v-for="impact in hardDeleteImpact" :key="impact">• {{ impact }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <UFormField :label="`พิมพ์ '${confirmationText}' เพื่อดำเนินการ`">
              <UInput v-model="hardDeleteText" class="w-full" :placeholder="confirmationText" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-between gap-2">
            <UButton color="neutral" variant="ghost" :disabled="isHardDeleting" @click="closeHardDelete">
              ยกเลิก
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              :disabled="!canHardDelete"
              :loading="isHardDeleting"
              @click="confirmHardDelete"
            >
              ลบถาวร
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </UDashboardPanel>
</template>
