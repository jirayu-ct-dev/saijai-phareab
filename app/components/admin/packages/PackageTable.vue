<script setup lang="ts">
import { h, resolveComponent, ref, computed, watch } from "vue";
import { getPaginationRowModel } from "@tanstack/table-core";
import type { TableColumn } from "@nuxt/ui";

import type { Package } from "~~/shared/types/package";
import type { PackageType } from "~~/shared/types/enums";
import {
  packageTypeLabels,
  packageTypeColors,
  packageActiveConfig,
} from "~~/shared/config/packageConfig";
import {
  formatCredits,
  formatCurrency,
  formatDays,
  formatDateTime,
} from "~~/shared/utils/format";
import { cycleColumnSorting } from "~~/shared/utils/table";
import * as adminUi from "~~/shared/config/adminUi";

const adminDashboardCardClass =
  adminUi.adminDashboardCardClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55";
const adminFilterBarClass =
  adminUi.adminFilterBarClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55";
const adminEmptyStateClass = adminUi.adminEmptyStateClass;
const adminMobileListCardClass = adminUi.adminMobileListCardClass;
const adminTableUi = adminUi.adminTableUi;

const props = defineProps<{
  packages: Package[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  edit: [pkg: Package];
  delete: [pkg: Package];
  "bulk-delete": [packages: Package[]];
  refresh: [];
}>();

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UIcon = resolveComponent("UIcon");

const table = useTemplateRef<any>("table");
const columnVisibility = ref<Record<string, boolean>>({});
const rowSelection = ref<Record<string, boolean>>({});
const expanded = ref<Record<string, boolean>>({});
const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
});

const searchQuery = ref("");
const statusFilter = ref<"all" | "active" | "inactive">("all");

const STATUS_OPTIONS = [
  { label: "ทุกสถานะ", value: "all" },
  { label: "เปิดใช้งาน", value: "active" },
  { label: "ปิดใช้งาน", value: "inactive" },
];

const filteredPackages = computed<Package[]>(() => {
  let result = props.packages;

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(q) ||
        (pkg.description?.toLowerCase().includes(q) ?? false) ||
        pkg.id.toLowerCase().includes(q),
    );
  }

  if (statusFilter.value === "active") result = result.filter((pkg) => pkg.isActive);
  if (statusFilter.value === "inactive") result = result.filter((pkg) => !pkg.isActive);

  return result;
});

watch([searchQuery, statusFilter, () => props.packages], () => {
  table.value?.tableApi?.resetRowSelection();
  pagination.value.pageIndex = 0;
});

const selectedRows = computed<any[]>(
  () => table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [],
);
const selectedPackages = computed<Package[]>(() =>
  selectedRows.value.map((row) => row.original),
);
const selectedRowsCount = computed(() => selectedRows.value.length);
const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? filteredPackages.value.length,
);
const paginatedPackages = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize;
  return filteredPackages.value.slice(start, start + pagination.value.pageSize);
});

const getMobileRowId = (index: number) => String(pagination.value.pageIndex * pagination.value.pageSize + index);
const isMobileRowSelected = (index: number) => Boolean(rowSelection.value[getMobileRowId(index)]);
const setMobileRowSelected = (index: number, value: boolean | "indeterminate") => {
  const rowId = getMobileRowId(index);
  rowSelection.value = {
    ...rowSelection.value,
    [rowId]: !!value,
  };
  if (!value) {
    const next = { ...rowSelection.value };
    delete next[rowId];
    rowSelection.value = next;
  }
};

const getPackagePriceLabel = (pkg: Package) => {
  const price = Number(pkg.price);
  return price === 0 ? "ฟรี" : formatCurrency(price);
};

const getDeductOnLabel = (pkg: Package) => {
  if (pkg.packageType !== "ADDON") return "—";
  return pkg.deductOn === "CREATED" ? "รับผ้า" : "จัดส่ง";
};

const handleBulkDelete = () => emit("bulk-delete", selectedPackages.value);

const columns: TableColumn<Package>[] = [
  {
    id: "select",
    header: ({ table }) =>
      h(
        "div",
        h(UCheckbox, {
          modelValue: table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : table.getIsAllPageRowsSelected(),
          "onUpdate:modelValue": (value: boolean | "indeterminate") =>
            table.toggleAllPageRowsSelected(!!value),
          ariaLabel: "Select all",
        }),
      ),
    cell: ({ row }) =>
      h(
        "div",
        h(UCheckbox, {
          modelValue: row.getIsSelected(),
          "onUpdate:modelValue": (value: boolean | "indeterminate") =>
            row.toggleSelected(!!value),
          ariaLabel: "Select row",
        }),
      ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      const icon = !isSorted
        ? "i-lucide-arrow-up-down"
        : isSorted === "asc"
          ? "i-lucide-arrow-up-narrow-wide"
          : "i-lucide-arrow-down-wide-narrow";

      return h(UButton, {
        label: "ชื่อแพ็กเกจ",
        color: "neutral",
        variant: "ghost",
        class: "-mx-2.5",
        icon,
        onClick: () => cycleColumnSorting(column),
      });
    },
    cell: ({ row }) => {
      const pkg = row.original;

      return h("div", { class: "flex items-center gap-3 cursor-pointer", onClick: (e: MouseEvent) => { e.stopPropagation(); row.toggleExpanded(); } }, [
        h(
          "div",
          {
            class: [
              "size-10 rounded-md flex items-center justify-center shrink-0",
              pkg.packageType === "MAIN" ? "bg-primary/10" : "bg-info/10",
            ],
          },
          [
            h(UIcon, {
              name: pkg.packageType === "MAIN" ? "i-lucide-package" : "i-lucide-puzzle",
              class: pkg.packageType === "MAIN" ? "size-5 text-primary" : "size-5 text-info",
            }),
          ],
        ),
        h("div", { class: "min-w-0" }, [
          h("div", { class: "flex items-center gap-1.5 min-w-0" }, [
            h("p", { class: "font-semibold text-highlighted truncate" }, pkg.name),
            pkg.isDelivery && pkg.packageType === "ADDON"
              ? h(UBadge, { color: "info", variant: "subtle", size: "xs" }, () => "รับ-ส่ง")
              : null,
          ]),
          h(
            "p",
            { class: "text-xs text-muted truncate max-w-48" },
            pkg.description || "ไม่มีคำอธิบาย",
          ),
        ]),
      ]);
    },
  },
  {
    accessorKey: "packageType",
    header: "ประเภท",
    cell: ({ row }) => {
      const type = row.getValue("packageType") as PackageType;
      return h(UBadge, { variant: "subtle", color: packageTypeColors[type] }, () => packageTypeLabels[type]);
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      const icon = !isSorted
        ? "i-lucide-arrow-up-down"
        : isSorted === "asc"
          ? "i-lucide-arrow-up-narrow-wide"
          : "i-lucide-arrow-down-wide-narrow";

      return h(UButton, {
        label: "ราคา",
        color: "neutral",
        variant: "ghost",
        class: "-mx-2.5",
        icon,
        onClick: () => cycleColumnSorting(column),
      });
    },
    cell: ({ row }) => {
      const price = Number(row.original.price);
      return h(
        "span",
        { class: price === 0 ? "text-success font-medium" : "font-medium" },
        price === 0 ? "ฟรี" : formatCurrency(price),
      );
    },
  },
  {
    accessorKey: "credits",
    header: "เครดิต",
    cell: ({ row }) =>
      h("span", { class: "font-medium text-primary" }, formatCredits(row.original.credits)),
  },
  {
    accessorKey: "validityDays",
    header: "ระยะเวลา",
    cell: ({ row }) =>
      h("span", { class: "text-muted" }, formatDays(row.getValue("validityDays") as number | null)),
  },
  {
    accessorKey: "deductOn",
    header: "หักเครดิตเมื่อ",
    cell: ({ row }) => {
      const pkg = row.original;
      if (pkg.packageType !== "ADDON") return h("span", { class: "text-muted text-xs" }, "—");
      const isCreated = pkg.deductOn === "CREATED";
      return h(UBadge, { variant: "subtle", color: isCreated ? "info" : "warning" }, () =>
        isCreated ? "รับผ้า" : "จัดส่ง"
      );
    },
  },
  {
    accessorKey: "isActive",
    header: "สถานะ",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean;
      const config = isActive ? packageActiveConfig.active : packageActiveConfig.inactive;
      return h(UBadge, { variant: "subtle", color: config.color }, () => config.label);
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h("div", { class: "flex items-center justify-end gap-1" }, [
        h(UButton, {
          icon: "i-lucide-chevron-down",
          size: "xs",
          color: "neutral",
          variant: row.getIsExpanded() ? "subtle" : "ghost",
          "aria-label": "ดูรายละเอียด",
          ui: {
            leadingIcon: [
              "transition-transform duration-200",
              row.getIsExpanded() ? "rotate-180" : "",
            ],
          },
          onClick: () => row.toggleExpanded(),
        }),
        h(UButton, {
          icon: "i-lucide-pencil",
          size: "xs",
          color: "neutral",
          variant: "ghost",
          "aria-label": "แก้ไข",
          onClick: () => emit("edit", row.original),
        }),
        h(UButton, {
          icon: "i-lucide-trash-2",
          size: "xs",
          color: "error",
          variant: "ghost",
          "aria-label": "ลบ",
          onClick: () => emit("delete", row.original),
        }),
      ]),
  },
];
</script>

<template>
  <section class="flex flex-col gap-1">
    <div :class="[adminFilterBarClass, '!px-3 !py-3 flex flex-wrap items-center gap-1.5']">
      <UInput
        v-model="searchQuery"
        class="min-w-0 flex-1 md:max-w-sm"
        icon="i-lucide-search"
        placeholder="ค้นหาชื่อหรือรายละเอียด..."
      />
      <UButton
        v-if="selectedRowsCount > 0"
        label="ลบ"
        color="error"
        variant="subtle"
        icon="i-lucide-trash"
        @click="handleBulkDelete"
      >
        <template #trailing>
          <UKbd>{{ selectedRowsCount }}</UKbd>
        </template>
      </UButton>
      <USelect
        v-model="statusFilter"
        :items="STATUS_OPTIONS"
        value-key="value"
        class="min-w-0 sm:min-w-36"
      />
      <UIButtonRefresh :loading="loading" @refresh="emit('refresh')" />
    </div>

    <ClientOnly>
    <div class="md:hidden">
      <div v-if="loading" class="space-y-1">
        <USkeleton v-for="i in 5" :key="i" class="h-24 w-full rounded-md" />
      </div>

      <div v-else-if="!paginatedPackages.length" :class="adminEmptyStateClass">
        <UIcon name="i-lucide-package-x" class="mb-3 size-10 opacity-60" />
        <p class="font-medium">ไม่พบแพ็กเกจ</p>
        <p class="mt-1 text-sm">
          {{ searchQuery ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "ยังไม่มีแพ็กเกจในหมวดนี้" }}
        </p>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="(pkg, index) in paginatedPackages"
          :key="pkg.id"
          :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md']"
        >
          <div class="flex items-center gap-2 p-2">
            <UCheckbox
              :model-value="isMobileRowSelected(index)"
              aria-label="เลือกแพ็กเกจ"
              class="shrink-0"
              @update:model-value="setMobileRowSelected(index, $event)"
            />
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-md"
              :class="pkg.packageType === 'MAIN' ? 'bg-primary/10' : 'bg-info/10'"
            >
              <UIcon
                :name="pkg.packageType === 'MAIN' ? 'i-lucide-package' : 'i-lucide-puzzle'"
                :class="pkg.packageType === 'MAIN' ? 'size-5 text-primary' : 'size-5 text-info'"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">{{ pkg.name }}</p>
                  <p class="truncate text-[11px] text-muted">{{ pkg.description || "ไม่มีคำอธิบาย" }}</p>
                </div>

                <div class="flex shrink-0 flex-col items-end gap-1">
                  <UBadge
                    :color="pkg.isActive ? packageActiveConfig.active.color : packageActiveConfig.inactive.color"
                    variant="subtle"
                    size="xs"
                  >
                    {{ pkg.isActive ? packageActiveConfig.active.label : packageActiveConfig.inactive.label }}
                  </UBadge>
                  <span
                    class="text-sm font-semibold leading-none"
                    :class="Number(pkg.price) === 0 ? 'text-success' : 'text-primary'"
                  >
                    {{ getPackagePriceLabel(pkg) }}
                  </span>
                </div>
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                <span>{{ packageTypeLabels[pkg.packageType] }}</span>
                <span>{{ formatCredits(pkg.credits) }}</span>
                <span>{{ formatDays(pkg.validityDays) }}</span>
                <span v-if="pkg.packageType === 'ADDON'">หัก: {{ getDeductOnLabel(pkg) }}</span>
              </div>

              <div class="mt-1 flex items-center justify-end gap-1">
                <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" aria-label="แก้ไขแพ็กเกจ" @click="emit('edit', pkg)" />
                <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" aria-label="ลบแพ็กเกจ" @click="emit('delete', pkg)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div :class="[adminDashboardCardClass, 'hidden shrink-0 overflow-hidden !p-0 md:block']">
    <UTable
      ref="table"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      v-model:pagination="pagination"
      v-model:expanded="expanded"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      :data="filteredPackages"
      :columns="columns"
      :loading="loading"
      :ui="adminTableUi"
    >
      <template #empty>
        <div :class="adminEmptyStateClass">
          <UIcon name="i-lucide-package-x" class="size-10 mb-3 opacity-60" />
          <p class="font-medium">ไม่พบแพ็กเกจ</p>
          <p class="text-sm mt-1">
            {{ searchQuery ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "ยังไม่มีแพ็กเกจในหมวดนี้" }}
          </p>
        </div>
      </template>

      <template #expanded="{ row }">
        <div class="px-4 py-4 bg-elevated/40 border-t border-default">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3 min-w-0">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide">ข้อมูลทั่วไป</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-package" class="size-4 text-muted shrink-0" />
                  <span class="text-sm font-medium text-highlighted truncate">
                    {{ row.original.name }}
                  </span>
                </div>
                <div class="flex items-start gap-2 min-w-0">
                  <UIcon name="i-lucide-file-text" class="size-4 text-muted mt-0.5 shrink-0" />
                  <p class="text-sm whitespace-pre-wrap wrap-break-word flex-1 min-w-0">
                    {{ row.original.description || "ไม่มีคำอธิบาย" }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-clock" class="size-4 text-muted shrink-0" />
                  <span class="text-sm">
                    <span class="text-muted">ระยะเวลา:</span>
                    <span class="ml-1 font-medium text-highlighted">
                      {{ formatDays(row.original.validityDays) }}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-3 min-w-0">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide">ข้อมูลการใช้งาน</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-coins" class="size-4 text-muted shrink-0" />
                  <span class="text-sm">
                    <span class="text-muted">เครดิต:</span>
                    <span class="ml-1 font-medium text-primary">
                      {{ formatCredits(row.original.credits) }}
                    </span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calendar" class="size-4 text-muted shrink-0" />
                  <span class="text-sm">
                    <span class="text-muted">สร้างเมื่อ:</span>
                    <span class="ml-1 font-medium text-highlighted">
                      {{ formatDateTime(row.original.createdAt) }}
                    </span>
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-tag" class="size-4 text-muted shrink-0" />
                  <span class="text-sm">
                    <span class="text-muted">ราคา:</span>
                    <span class="ml-1 font-medium text-highlighted">
                      {{ Number(row.original.price) === 0 ? "ฟรี" : formatCurrency(Number(row.original.price)) }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UTable>
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto flex-wrap">
      <div class="text-sm text-muted">
        เลือก {{ selectedRowsCount }} จาก {{ filteredRowCount }} แถวทั้งหมด
      </div>

      <div class="flex items-center gap-1.5">
        <UPagination
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
          :total="filteredRowCount"
          @update:page="(page: number) => { pagination = { ...pagination, pageIndex: page - 1 } }"
        />
      </div>
    </div>
    </ClientOnly>
  </section>
</template>
