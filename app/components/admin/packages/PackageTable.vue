<script setup lang="ts">
import { h, resolveComponent, ref, computed, watch } from "vue";
import type { TableColumn } from "@nuxt/ui";

import type { Package } from "~~/shared/types/package";
import type { PackageType } from "~~/shared/types/enums";
import {
    packageTypeLabels,
    packageTypeColors,
    packageActiveConfig,
} from "~~/shared/config/packageConfig";
import { formatCredits, formatCurrency, formatDays } from "~~/shared/utils/format";
import { cycleColumnSorting } from "~~/shared/utils/table";

// Define local helper avoiding scule import
const upperFirst = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

// ============================================================
// Props & Emits
// ============================================================
const props = defineProps<{
    /** แพ็กเกจที่ถูก filter Tab แล้วจาก Parent */
    packages: Package[];
    loading?: boolean;
}>();

const emit = defineEmits<{
    edit: [pkg: Package];
    delete: [pkg: Package];
    bonus: [pkg: Package];
    bundle: [pkg: Package];
    "bulk-delete": [packages: Package[]];
}>();

// ============================================================
// Resolved Components
// ============================================================
const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UIcon = resolveComponent("UIcon");

// ============================================================
// Table State (TanStack)
// ============================================================
const table = useTemplateRef<any>("table");
const columnVisibility = ref<Record<string, boolean>>({});
const rowSelection = ref<Record<string, boolean>>({});

const pagination = ref({
    pageIndex: 0,
    pageSize: 10,
});

// ============================================================
// Toolbar State
// ============================================================
const searchQuery = ref("");
const statusFilter = ref<"all" | "active" | "inactive">("all");

const STATUS_OPTIONS = [
    { label: "ทุกสถานะ", value: "all" },
    { label: "เปิดใช้งาน", value: "active" },
    { label: "ปิดการใช้งาน", value: "inactive" },
];


// ============================================================
// Filter Data
// ============================================================
const filteredPackages = computed<Package[]>(() => {
    let result = props.packages;

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        result = result.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.description?.toLowerCase().includes(q) ?? false) ||
                p.id.toLowerCase().includes(q),
        );
    }

    if (statusFilter.value === "active")
        result = result.filter((p) => p.isActive);
    if (statusFilter.value === "inactive")
        result = result.filter((p) => !p.isActive);

    return result;
});

// Reset row selection when data or filters change
watch([searchQuery, statusFilter, () => props.packages], () => {
    table.value?.tableApi?.resetRowSelection();
    pagination.value.pageIndex = 0;
});

// ============================================================
// Selection Helpers
// ============================================================
const selectedRows = computed<any[]>(() => {
    return table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [];
});

const selectedPackages = computed<Package[]>(() =>
    selectedRows.value.map((row) => row.original),
);
const selectedRowsCount = computed(() => selectedRows.value.length);
const filteredRowCount = computed(
    () =>
        table.value?.tableApi?.getFilteredRowModel().rows.length ??
        filteredPackages.value.length,
);

function handleBulkDelete() {
    emit("bulk-delete", selectedPackages.value);
}
// ============================================================
// Column Definitions
// ============================================================
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
                            pkg.packageType === "MAIN"
                                ? "bg-primary/10"
                                : "bg-info/10",
                        ]
                    },
                    [
                        h(UIcon, {
                            name:
                                pkg.packageType === "MAIN"
                                    ? "i-lucide-package"
                                    : "i-lucide-puzzle",
                            class:
                                pkg.packageType === "MAIN"
                                    ? "size-5 text-primary"
                                    : "size-5 text-info",
                        }),
                    ],
                ),
                h("div", { class: "min-w-0" }, [
                    h(
                        "p",
                        { class: "font-semibold text-highlighted truncate" },
                        pkg.name,
                    ),
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
            return h(
                UBadge,
                { variant: "subtle", color: packageTypeColors[type] },
                () => packageTypeLabels[type],
            );
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
                {
                    class:
                        price === 0
                            ? "text-success font-medium"
                            : "font-medium",
                },
                price === 0 ? "ฟรี" : formatCurrency(price),
            );
        },
    },
    {
        accessorKey: "credits",
        header: "เครดิต",
        cell: ({ row }) => {
            const pkg = row.original;
            const base = formatCredits(pkg.credits);
            const bonus = pkg.bonusCredits ?? 0;

            if (base === "—" && bonus === 0) {
                return h("span", { class: "text-muted text-xs" }, "—");
            }

            return h("div", { class: "flex items-center gap-1.5" }, [
                h(UIcon, {
                    name: "i-lucide-coins",
                    class: "size-4 text-primary",
                }),
                h("span", { class: "font-medium text-primary" }, base),
                bonus > 0
                    ? h(
                          UBadge,
                          { color: "success", variant: "subtle", size: "sm" },
                          () => `+${bonus.toLocaleString("th-TH")}`,
                      )
                    : null,
            ]);
        },
    },
    {
        accessorKey: "validityDays",
        header: "ระยะเวลา",
        cell: ({ row }) =>
            h(
                "span",
                { class: "text-muted" },
                formatDays(row.getValue("validityDays") as number | null),
            ),
    },
    {
        id: "bonuses",
        header: "โบนัส",
        cell: ({ row }) => {
            const count = row.original.packageBonuses?.length ?? 0;
            if (count === 0) {
                return h("span", { class: "text-muted text-xs" }, "ไม่มี");
            }
            return h(
                "div",
                {
                    class: "flex items-center gap-1.5 cursor-pointer",
                    onClick: () => emit("bonus", row.original),
                },
                [
                    h(UIcon, { name: "i-lucide-gift", class: "size-4 text-success" }),
                    h(UBadge, { color: "success", variant: "subtle", size: "sm" }, () => `${count} รายการ`),
                ],
            );
        },
    },
    {
        id: "bundles",
        header: "จัดเซ็ทแพ็กเกจ",
        cell: ({ row }) => {
            const count = row.original.bundledAddons?.length ?? 0;
            if (count === 0) {
                return h("span", { class: "text-muted text-xs" }, "ไม่มี");
            }
            return h(
                "div",
                { 
                    class: "flex items-center gap-1.5 cursor-pointer",
                    onClick: () => emit("bundle", row.original),
                },
                [
                    h(UIcon, {
                        name: "i-lucide-layers",
                        class: "size-4 text-secondary",
                    }),
                    h(
                        UBadge,
                        { color: "secondary", variant: "subtle", size: "sm" },
                        () => `${count} เสริม`,
                    ),
                ]
            );
        },
    },
    {
        accessorKey: "isActive",
        header: "สถานะ",
        cell: ({ row }) => {
            const isActive = row.getValue("isActive") as boolean;
            const config = isActive
                ? packageActiveConfig.active
                : packageActiveConfig.inactive;
            return h(
                UBadge,
                { variant: "subtle", color: config.color },
                () => config.label,
            );
        },
    },
    {
        id: "actions",
        header: "",
        cell: ({ row }) => {
            const pkg = row.original;
            return h("div", { class: "flex items-center justify-end gap-1" }, [
                pkg.packageType === "MAIN"
                    ? h(UButton, {
                          icon: "i-lucide-layers",
                          size: "xs",
                          color: "secondary",
                          variant: "ghost",
                          "aria-label": "จัดเซ็ท",
                          onClick: () => emit("bundle", pkg),
                      })
                    : null,
                pkg.packageType === "MAIN"
                    ? h(UButton, {
                          icon: "i-lucide-gift",
                          size: "xs",
                          color: "success",
                          variant: "ghost",
                          "aria-label": "แพ็กเกจแถม",
                          onClick: () => emit("bonus", pkg),
                      })
                    : null,
                h(UButton, {
                    icon: "i-lucide-pencil",
                    size: "xs",
                    color: "neutral",
                    variant: "ghost",
                    "aria-label": "แก้ไข",
                    onClick: () => emit("edit", pkg),
                }),
                h(UButton, {
                    icon: "i-lucide-trash-2",
                    size: "xs",
                    color: "error",
                    variant: "ghost",
                    "aria-label": "ลบ",
                    onClick: () => emit("delete", pkg),
                }),
            ]);
        },
    },
];
</script>

<template>
    <div class="flex flex-col gap-4">
        <!-- ============================================================ -->
        <!-- Toolbar                                                        -->
        <!-- ============================================================ -->
        <div class="flex flex-wrap items-center justify-between gap-1.5">
            <!-- ← ฝั่งซ้าย: Search -->
            <div class="flex items-center gap-1.5 w-full md:w-auto">
                <UInput
                    v-model="searchQuery"
                    class="w-full md:max-w-sm"
                    icon="i-lucide-search"
                    placeholder="ค้นหาชื่อหรือรายละเอียด..."
                />
            </div>

            <!-- → ฝั่งขวา: Bulk Delete + Status Filter + Columns -->
            <div class="flex flex-wrap items-center gap-1.5">
                <!-- Bulk Delete -->
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

                <!-- Status Filter -->
                <USelect
                    v-model="statusFilter"
                    :items="STATUS_OPTIONS"
                    value-key="value"
                    placeholder="สถานะ"
                    class="min-w-36"
                    :ui="{
                        trailingIcon:
                            'group-data-[state=open]:rotate-180 transition-transform duration-200',
                    }"
                />

                <!-- Column Visibility Dropdown -->
                <UDropdownMenu
                    class="cursor-pointer"
                    :items="
                        table?.tableApi
                            ?.getAllColumns()
                            .filter((column: any) => column.getCanHide())
                            .map((column: any) => ({
                                label: upperFirst(column.id),
                                type: 'checkbox',
                                checked: column.getIsVisible(),
                                onUpdateChecked(checked: boolean) {
                                    table?.tableApi
                                        ?.getColumn(column.id)
                                        ?.toggleVisibility(!!checked);
                                },
                                onSelect(e?: Event) {
                                    e?.preventDefault();
                                },
                            })) || []
                    "
                    :content="{ align: 'end' }"
                >
                    <UButton
                        label="คอลัมน์"
                        color="neutral"
                        variant="outline"
                        trailing-icon="i-lucide-settings-2"
                    />
                </UDropdownMenu>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- Data Table                                                     -->
        <!-- ============================================================ -->
        <UTable
            ref="table"
            v-model:column-visibility="columnVisibility"
            v-model:row-selection="rowSelection"
            v-model:pagination="pagination"
            class="shrink-0"
            :data="filteredPackages"
            :columns="columns"
            :loading="loading"
            :ui="{
                base: 'table-fixed border-separate border-spacing-0',
                thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
                tbody: '[&>tr]:last:[&>td]:border-b-0',
                th: 'py-2 font-medium first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
                td: 'border-b border-default',
                separator: 'h-0',
            }"
        >
            <template #empty>
                <div
                    class="flex flex-col items-center justify-center py-12 text-center text-muted"
                >
                    <UIcon
                        name="i-lucide-package-x"
                        class="size-10 mb-3 opacity-60"
                    />
                    <p class="font-medium">ไม่พบแพ็กเกจ</p>
                    <p class="text-sm mt-1">
                        {{
                            searchQuery
                                ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                                : "ยังไม่มีแพ็กเกจในหมวดนี้"
                        }}
                    </p>
                </div>
            </template>
        </UTable>

        <!-- ============================================================ -->
        <!-- Pagination                                                     -->
        <!-- ============================================================ -->
        <div
            class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto flex-wrap"
        >
            <div class="text-sm text-muted">
                เลือก {{ selectedRowsCount }} จาก
                {{
                    table?.tableApi?.getFilteredRowModel()?.rows?.length ??
                    filteredPackages.length
                }}
                แถวทั้งหมด
            </div>

            <div class="flex items-center gap-1.5">
                <UPagination
                    v-if="
                        table?.tableApi?.getPageCount() &&
                        table.tableApi.getPageCount() > 1
                    "
                    :default-page="
                        (table?.tableApi?.getState().pagination.pageIndex ||
                            0) + 1
                    "
                    :items-per-page="
                        table?.tableApi?.getState().pagination.pageSize
                    "
                    :total="filteredRowCount"
                    @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)
                    "
                />
            </div>
        </div>
    </div>
</template>

