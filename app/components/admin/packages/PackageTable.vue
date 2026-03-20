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
import {
    formatCredits,
    formatCurrency,
    formatDays,
    formatDateTime,
} from "~~/shared/utils/format";
import { cycleColumnSorting } from "~~/shared/utils/table";

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
    packages: Package[];
    loading?: boolean;
}>();

const emit = defineEmits<{
    edit: [pkg: Package];
    delete: [pkg: Package];
    bonus: [pkg: Package];
    bundle: [pkg: Package];
    "bulk-delete": [packages: Package[]];
    refresh: [];
}>();

// ============================================================
// Resolved Components
// ============================================================

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UIcon = resolveComponent("UIcon");
const UDropdownMenu = resolveComponent("UDropdownMenu");

// ============================================================
// Table State
// ============================================================

const table = useTemplateRef<any>("table");
const columnVisibility = ref<Record<string, boolean>>({});
const rowSelection = ref<Record<string, boolean>>({});
const expanded = ref<Record<string, boolean>>({});

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

watch([searchQuery, statusFilter, () => props.packages], () => {
    table.value?.tableApi?.resetRowSelection();
    pagination.value.pageIndex = 0;
});

// ============================================================
// Selection Helpers
// ============================================================

const selectedRows = computed<any[]>(
    () => table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [],
);
const selectedPackages = computed<Package[]>(() =>
    selectedRows.value.map((r) => r.original),
);
const selectedRowsCount = computed(() => selectedRows.value.length);
const filteredRowCount = computed(
    () =>
        table.value?.tableApi?.getFilteredRowModel().rows.length ??
        filteredPackages.value.length,
);

const handleBulkDelete = () => emit("bulk-delete", selectedPackages.value);

// ============================================================
// Column Definitions
// ============================================================

const columns: TableColumn<Package>[] = [
    // Checkbox
    {
        id: "select",
        header: ({ table }) =>
            h(
                "div",
                h(UCheckbox, {
                    modelValue: table.getIsSomePageRowsSelected()
                        ? "indeterminate"
                        : table.getIsAllPageRowsSelected(),
                    "onUpdate:modelValue": (v: boolean | "indeterminate") =>
                        table.toggleAllPageRowsSelected(!!v),
                    ariaLabel: "Select all",
                }),
            ),
        cell: ({ row }) =>
            h(
                "div",
                h(UCheckbox, {
                    modelValue: row.getIsSelected(),
                    "onUpdate:modelValue": (v: boolean | "indeterminate") =>
                        row.toggleSelected(!!v),
                    ariaLabel: "Select row",
                }),
            ),
    },

    // ชื่อ + ไอคอน + คำอธิบาย
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
                        ],
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

    // ประเภท
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

    // ราคา
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

    // เครดิต + โบนัส
    {
        accessorKey: "credits",
        header: "เครดิต",
        cell: ({ row }) => {
            const pkg = row.original;
            const base = formatCredits(pkg.credits);
            const bonus = pkg.bonusCredits ?? 0;

            if (base === "—" && bonus === 0)
                return h("span", { class: "text-muted text-xs" }, "—");

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

    // ระยะเวลา
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

    // โบนัส
    {
        id: "bonuses",
        header: "โบนัส",
        cell: ({ row }) => {
            const count = row.original.packageBonuses?.length ?? 0;
            if (count === 0)
                return h("span", { class: "text-muted text-xs" }, "—");
            return h(
                "div",
                {
                    class: "flex items-center gap-1.5 cursor-pointer",
                    onClick: () => emit("bonus", row.original),
                },
                [
                    h(UIcon, {
                        name: "i-lucide-gift",
                        class: "size-4 text-success",
                    }),
                    h(
                        UBadge,
                        { color: "success", variant: "subtle", size: "sm" },
                        () => `${count} รายการ`,
                    ),
                ],
            );
        },
    },

    // จัดเซ็ท
    {
        id: "bundles",
        header: "จัดเซ็ท",
        cell: ({ row }) => {
            const count = row.original.bundledAddons?.length ?? 0;
            if (count === 0)
                return h("span", { class: "text-muted text-xs" }, "—");
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
                ],
            );
        },
    },

    // สถานะ
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

    // Actions
    {
        id: "actions",
        header: "",
        cell: ({ row }) => {
            const pkg = row.original;
            const isExpanded = row.getIsExpanded();

            return h("div", { class: "flex items-center justify-end gap-1" }, [
                // Expand toggle
                h(UButton, {
                    icon: "i-lucide-chevron-down",
                    size: "xs",
                    color: "neutral",
                    variant: isExpanded ? "subtle" : "ghost",
                    "aria-label": "ดูรายละเอียด",
                    ui: {
                        leadingIcon: [
                            "transition-transform duration-200",
                            isExpanded ? "rotate-180" : "",
                        ],
                    },
                    onClick: () => row.toggleExpanded(),
                }),

                // Edit
                h(UButton, {
                    icon: "i-lucide-pencil",
                    size: "xs",
                    color: "neutral",
                    variant: "ghost",
                    "aria-label": "แก้ไข",
                    onClick: () => emit("edit", pkg),
                }),

                // Delete
                h(UButton, {
                    icon: "i-lucide-trash-2",
                    size: "xs",
                    color: "error",
                    variant: "ghost",
                    "aria-label": "ลบ",
                    onClick: () => emit("delete", pkg),
                }),

                // Dropdown — MAIN only (Bundle + Bonus)
                pkg.packageType === "MAIN"
                    ? h(
                          UDropdownMenu,
                          {
                              content: { align: "end" },
                              items: [
                                  {
                                      label: "จัดเซ็ท Bundle",
                                      icon: "i-lucide-layers",
                                      onSelect: () => emit("bundle", pkg),
                                  },
                                  {
                                      label: "โบนัสแพ็กเกจ",
                                      icon: "i-lucide-gift",
                                      onSelect: () => emit("bonus", pkg),
                                  },
                              ],
                          },
                          {
                              default: () =>
                                  h(UButton, {
                                      icon: "i-lucide-ellipsis-vertical",
                                      size: "xs",
                                      color: "neutral",
                                      variant: "ghost",
                                      "aria-label": "เพิ่มเติม",
                                  }),
                          },
                      )
                    : null,
            ]);
        },
    },
];
</script>

<template>
    <div class="flex flex-col gap-4">
        <!-- Toolbar -->
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
                    placeholder="สถานะ"
                    class="min-w-36"
                    :ui="{
                        trailingIcon:
                            'group-data-[state=open]:rotate-180 transition-transform duration-200',
                    }"
                />

                <UIButtonRefresh
                    :loading="loading"
                    @refresh="emit('refresh')"
                />
            </div>
        </div>

        <!-- Table -->
        <UTable
            ref="table"
            v-model:column-visibility="columnVisibility"
            v-model:row-selection="rowSelection"
            v-model:pagination="pagination"
            v-model:expanded="expanded"
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
            <!-- Empty state -->
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

            <!-- Expanded row -->
            <template #expanded="{ row }">
                <div class="px-4 py-4 bg-elevated/40 border-t border-default">
                    <div
                        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        <!-- คำอธิบาย + ข้อมูลพื้นฐาน -->
                        <div class="space-y-3 min-w-0">
                            <p
                                class="text-xs font-semibold text-muted uppercase tracking-wide"
                            >
                                ข้อมูลทั่วไป
                            </p>
                            <div class="space-y-2">
                                <div class="flex items-center gap-2">
                                    <UIcon
                                        name="i-lucide-package"
                                        class="size-4 text-muted shrink-0"
                                    />
                                    <span
                                        class="text-sm font-medium text-highlighted truncate"
                                    >
                                        {{ row.original.name }}
                                    </span>
                                </div>
                                <div class="flex items-start gap-2 min-w-0">
                                    <UIcon
                                        name="i-lucide-file-text"
                                        class="size-4 text-muted mt-0.5 shrink-0"
                                    />
                                    <p
                                        class="text-sm whitespace-pre-wrap wrap-break-word flex-1 min-w-0"
                                    >
                                        {{
                                            row.original.description ||
                                            "ไม่มีคำอธิบาย"
                                        }}
                                    </p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon
                                        name="i-lucide-clock"
                                        class="size-4 text-muted shrink-0"
                                    />
                                    <span class="text-sm">
                                        <span class="text-muted"
                                            >ระยะเวลา:</span
                                        >
                                        <span
                                            class="ml-1 font-medium text-highlighted"
                                        >
                                            {{
                                                formatDays(
                                                    row.original.validityDays,
                                                )
                                            }}
                                        </span>
                                    </span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon
                                        name="i-lucide-coins"
                                        class="size-4 text-muted shrink-0"
                                    />
                                    <span class="text-sm">
                                        <span class="text-muted"
                                            >เครดิตโบนัส:</span
                                        >
                                        <span
                                            class="ml-1 font-medium text-success"
                                        >
                                            {{
                                                row.original.bonusCredits
                                                    ? `+${row.original.bonusCredits.toLocaleString("th-TH")} เครดิต`
                                                    : "ไม่มี"
                                            }}
                                        </span>
                                    </span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon
                                        name="i-lucide-calendar"
                                        class="size-4 text-muted shrink-0"
                                    />
                                    <span class="text-sm">
                                        <span class="text-muted"
                                            >สร้างเมื่อ:</span
                                        >
                                        <span
                                            class="ml-1 font-medium text-highlighted"
                                        >
                                            {{
                                                formatDateTime(
                                                    row.original.createdAt,
                                                )
                                            }}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- โบนัสแพ็กเกจ -->
                        <div class="space-y-3 min-w-0">
                            <div class="flex items-center justify-between">
                                <p
                                    class="text-xs font-semibold text-muted uppercase tracking-wide"
                                >
                                    โบนัสแพ็กเกจ (ของแถม)
                                </p>
                                <UBadge
                                    color="success"
                                    variant="subtle"
                                    size="xs"
                                >
                                    {{
                                        row.original.packageBonuses?.length ?? 0
                                    }}
                                    รายการ
                                </UBadge>
                            </div>

                            <div
                                v-if="row.original.packageBonuses?.length"
                                class="space-y-1.5"
                            >
                                <div
                                    v-for="bonus in row.original.packageBonuses"
                                    :key="bonus.id"
                                    class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-success/5 border border-success/15"
                                >
                                    <UIcon
                                        name="i-lucide-gift"
                                        class="size-3.5 text-success shrink-0"
                                    />
                                    <span class="text-sm flex-1 truncate">
                                        {{
                                            bonus.storefrontPrice
                                                ?.storefrontService?.name
                                        }}
                                        {{
                                            bonus.storefrontPrice
                                                ?.storefrontItem?.name
                                        }}
                                    </span>
                                    <UBadge
                                        color="success"
                                        variant="subtle"
                                        size="xs"
                                    >
                                        × {{ bonus.quantity }}
                                    </UBadge>
                                </div>
                            </div>
                            <p v-else class="text-sm text-muted italic">
                                ไม่มีโบนัส
                            </p>
                        </div>

                        <!-- จัดเซ็ท Bundle (MAIN only) -->
                        <div
                            v-if="row.original.packageType === 'MAIN'"
                            class="space-y-3 min-w-0"
                        >
                            <div class="flex items-center justify-between">
                                <p
                                    class="text-xs font-semibold text-muted uppercase tracking-wide"
                                >
                                    จัดเซ็ท Bundle
                                </p>
                                <UBadge
                                    color="secondary"
                                    variant="subtle"
                                    size="xs"
                                >
                                    {{
                                        row.original.bundledAddons?.length ?? 0
                                    }}
                                    เสริม
                                </UBadge>
                            </div>

                            <div
                                v-if="row.original.bundledAddons?.length"
                                class="space-y-1.5"
                            >
                                <div
                                    v-for="addon in row.original.bundledAddons"
                                    :key="addon.id"
                                    class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-elevated border border-default"
                                >
                                    <UIcon
                                        name="i-lucide-puzzle"
                                        class="size-3.5 text-secondary shrink-0"
                                    />
                                    <span class="text-sm flex-1 truncate">
                                        {{
                                            addon.addonPackage?.name ??
                                            addon.addonPackageId
                                        }}
                                    </span>
                                    <UBadge
                                        color="secondary"
                                        variant="subtle"
                                        size="xs"
                                    >
                                        × {{ addon.quantity }}
                                    </UBadge>
                                </div>
                            </div>
                            <p v-else class="text-sm text-muted italic">
                                ไม่มี Bundle
                            </p>
                        </div>
                    </div>
                </div>
            </template>
        </UTable>

        <!-- Pagination -->
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
                        table?.tableApi?.getPageCount()
                    "
                    :default-page="
                        (table?.tableApi?.getState().pagination.pageIndex ||
                            0) + 1
                    "
                    :items-per-page="
                        table?.tableApi?.getState().pagination.pageSize
                    "
                    :total="filteredRowCount"
                    @update:page="
                        (p: number) => table?.tableApi?.setPageIndex(p - 1)
                    "
                />
            </div>
        </div>
    </div>
</template>
