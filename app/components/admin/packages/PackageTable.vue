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

      return h("div", { class: "flex items-center gap-3" }, [
        h(
          "div",
          {
            class: [
              "size-10 rounded-lg flex items-center justify-center shrink-0",
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
          h("p", { class: "font-semibold text-highlighted truncate" }, pkg.name),
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
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-1.5">
      <div class="flex items-center gap-1.5 w-full md:w-auto">
        <UInput
          v-model="searchQuery"
          class="w-full md:max-w-sm"
          icon="i-lucide-search"
          placeholder="ค้นหาชื่อหรือรายละเอียด..."
        />
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
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
          class="min-w-36"
        />

        <UIButtonRefresh :loading="loading" @refresh="emit('refresh')" />
      </div>
    </div>

    <ClientOnly>
    <UTable
      ref="table"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      v-model:pagination="pagination"
      v-model:expanded="expanded"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      class="shrink-0"
      :data="filteredPackages"
      :columns="columns"
      :loading="loading"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:transition-colors [&>tr]:hover:bg-elevated/60',
        th: 'py-2 font-medium first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0',
      }"
      @select="(_e: Event, row) => row.toggleExpanded()"
    >
      <template #empty>
        <div class="flex flex-col items-center justify-center py-12 text-center text-muted">
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
  </div>
</template>
