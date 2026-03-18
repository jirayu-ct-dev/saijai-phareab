<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { upperFirst } from 'scule'
import type { Package, PackageBonus, PackageType } from '~/types'
import { formatCurrency, formatDateTime, formatCredits, formatDays } from '~/utils/format'
import {
  PACKAGE_STATUS_BADGE_MAP,
  PACKAGE_STATUS_FILTER_OPTIONS,
  getPackageStatusKey,
  type PackageStatusFilterValue
} from '~/constants/package'

/**
 * Admin - แพ็คเกจรายเดือน
 * หน้าจัดการแพ็คเกจ: แพ็คเกจหลัก (MAIN) + แพ็คเกจเสริม (ADDON)
 * รวมถึงจัดการ Bonus สำหรับแพ็คเกจหลัก
 */

useSeoMeta({
  title: 'แพ็คเกจรายเดือน'
})

// Resolve components for render functions
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const UIcon = resolveComponent('UIcon')

const notify = useNotify()
const table = useTemplateRef<any>('table')
const columnVisibility = ref<Record<string, boolean>>({})
const rowSelection = ref<Record<string, boolean>>({})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

// ============================================================
// Tab / Filter State
// ============================================================

const activeTab = ref<'MAIN' | 'ADDON'>('MAIN')
const searchQuery = ref('')
const statusFilter = ref<PackageStatusFilterValue>('all')

// ============================================================
// Modal State
// ============================================================

const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showBulkDeleteModal = ref(false)
const showBonusModal = ref(false)

const editingPackage = ref<Package | null>(null)
const deletingPackage = ref<Package | null>(null)
const bonusPackage = ref<Package | null>(null)
const isSubmitting = ref(false)

// ============================================================
// Form State
// ============================================================

// Form state for add/edit MAIN package
const packageForm = reactive({
  name: '',
  description: '',
  price: 0,
  credits: 0,
  validityDays: 30,
  isActive: true
})

// Form state for add/edit ADDON package
const addonForm = reactive({
  name: '',
  description: '',
  price: 0,
  validityDays: 30,
  isActive: true
})

// Form state for bonus management
const bonusForm = reactive({
  description: '',
  quantity: 1,
  storefrontPriceId: ''
})

const blurActiveElement = () => {
  if (typeof document === 'undefined') return
  const active = document.activeElement as HTMLElement | null
  active?.blur()
}

// ============================================================
// Data Fetching
// ============================================================

const { data: packages, status, refresh } = useAsyncData<Package[]>(
  'admin-packages',
  async () => {
    const response = await $fetch<Package[]>('/api/package')
    return response
  },
  { default: () => [] }
)

// ============================================================
// Computed
// ============================================================

/** แพ็คเกจที่ตรงกับ tab + filter */
const filteredPackages = computed<Package[]>(() => {
  if (!packages.value) return []

  const keyword = searchQuery.value.trim().toLowerCase()
  const activeFilter = statusFilter.value

  return packages.value.filter((pkg) => {
    // Filter by tab (MAIN/ADDON)
    if (pkg.packageType !== activeTab.value) return false

    const matchKeyword = keyword
      ? pkg.name.toLowerCase().includes(keyword) || pkg.id.toLowerCase().includes(keyword)
      || (pkg.description?.toLowerCase().includes(keyword) ?? false)
      : true

    const matchStatus = activeFilter === 'all'
      ? true
      : activeFilter === 'active'
        ? pkg.isActive
        : !pkg.isActive

    return matchKeyword && matchStatus
  })
})

// Stats
const mainPackageCount = computed(() => packages.value?.filter(p => p.packageType === 'MAIN').length ?? 0)
const addonPackageCount = computed(() => packages.value?.filter(p => p.packageType === 'ADDON').length ?? 0)

// Selected rows
const selectedRows = computed<Row<Package>[]>(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? []
})

const selectedPackages = computed<Package[]>(() => selectedRows.value.map((row) => row.original))
const selectedRowsCount = computed(() => selectedRows.value.length)
const filteredRowCount = computed(() => table.value?.tableApi?.getFilteredRowModel().rows.length ?? filteredPackages.value.length)

// Watch for selection changes
watch(selectedRowsCount, (count) => {
  if (!count) showBulkDeleteModal.value = false
})

// Reset row selection when switching tabs
watch(activeTab, () => {
  table.value?.tableApi?.resetRowSelection()
  pagination.value.pageIndex = 0
  searchQuery.value = ''
  statusFilter.value = 'all'
})

// ============================================================
// Reset Forms
// ============================================================

const resetMainForm = () => {
  packageForm.name = ''
  packageForm.description = ''
  packageForm.price = 0
  packageForm.credits = 0
  packageForm.validityDays = 30
  packageForm.isActive = true
}

const resetAddonForm = () => {
  addonForm.name = ''
  addonForm.description = ''
  addonForm.price = 0
  addonForm.validityDays = 30
  addonForm.isActive = true
}

const resetBonusForm = () => {
  bonusForm.description = ''
  bonusForm.quantity = 1
  bonusForm.storefrontPriceId = ''
}

// ============================================================
// Actions - Modal Openers
// ============================================================

const openAddModal = () => {
  blurActiveElement()
  if (activeTab.value === 'MAIN') {
    resetMainForm()
  } else {
    resetAddonForm()
  }
  showAddModal.value = true
}

const openEditModal = (pkg: Package) => {
  setTimeout(() => {
    blurActiveElement()
    editingPackage.value = pkg
    if (pkg.packageType === 'MAIN') {
      packageForm.name = pkg.name
      packageForm.description = pkg.description ?? ''
      packageForm.price = pkg.price
      packageForm.credits = pkg.credits
      packageForm.validityDays = pkg.validityDays
      packageForm.isActive = pkg.isActive
    } else {
      addonForm.name = pkg.name
      addonForm.description = pkg.description ?? ''
      addonForm.price = pkg.price
      addonForm.validityDays = pkg.validityDays
      addonForm.isActive = pkg.isActive
    }
    showEditModal.value = true
  }, 100)
}

const openDeleteModal = (pkg: Package) => {
  setTimeout(() => {
    blurActiveElement()
    deletingPackage.value = pkg
    showDeleteModal.value = true
  }, 100)
}

const openBulkDeleteModal = () => {
  blurActiveElement()
  showBulkDeleteModal.value = true
}

const openBonusModal = (pkg: Package) => {
  setTimeout(() => {
    blurActiveElement()
    bonusPackage.value = pkg
    resetBonusForm()
    showBonusModal.value = true
  }, 100)
}

// ============================================================
// Actions - CRUD
// ============================================================

const handleCreatePackage = async () => {
  const form = activeTab.value === 'MAIN' ? packageForm : addonForm
  if (!form.name.trim()) {
    notify.warning('กรุณากรอกชื่อแพ็คเกจ')
    return
  }

  try {
    isSubmitting.value = true
    // TODO: เชื่อมต่อ API POST /api/package
    await new Promise(resolve => setTimeout(resolve, 600))
    notify.created(activeTab.value === 'MAIN' ? 'แพ็คเกจหลัก' : 'แพ็คเกจเสริม')
    showAddModal.value = false
    resetMainForm()
    resetAddonForm()
    refresh()
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdatePackage = async () => {
  if (!editingPackage.value) return
  const form = editingPackage.value.packageType === 'MAIN' ? packageForm : addonForm
  if (!form.name.trim()) {
    notify.warning('กรุณากรอกชื่อแพ็คเกจ')
    return
  }

  try {
    isSubmitting.value = true
    // TODO: เชื่อมต่อ API PUT /api/package/:id
    await new Promise(resolve => setTimeout(resolve, 600))
    notify.updated('แพ็คเกจ')
    showEditModal.value = false
    editingPackage.value = null
    resetMainForm()
    resetAddonForm()
    refresh()
  } finally {
    isSubmitting.value = false
  }
}

const confirmDeletePackage = async () => {
  if (!deletingPackage.value) return

  try {
    isSubmitting.value = true
    // TODO: เชื่อมต่อ API DELETE /api/package/:id
    await new Promise(resolve => setTimeout(resolve, 600))

    if (packages.value) {
      packages.value = packages.value.filter(p => p.id !== deletingPackage.value?.id)
    }

    notify.deleted('แพ็คเกจ')
    showDeleteModal.value = false
    deletingPackage.value = null
  } finally {
    isSubmitting.value = false
  }
}

const confirmBulkDelete = async () => {
  if (!selectedPackages.value.length) return

  try {
    isSubmitting.value = true
    // TODO: เชื่อมต่อ API DELETE /api/package (bulk)
    await new Promise(resolve => setTimeout(resolve, 600))

    const deleteIds = new Set(selectedPackages.value.map(p => p.id))
    if (packages.value) {
      packages.value = packages.value.filter(p => !deleteIds.has(p.id))
    }

    table.value?.tableApi?.resetRowSelection()
    notify.deleted(`แพ็คเกจ ${selectedPackages.value.length} รายการ`)
    showBulkDeleteModal.value = false
  } finally {
    isSubmitting.value = false
  }
}

// ============================================================
// Actions - Bonus CRUD
// ============================================================

const handleAddBonus = async () => {
  if (!bonusPackage.value) return
  if (!bonusForm.description.trim()) {
    notify.warning('กรุณากรอกคำอธิบายโบนัส')
    return
  }

  try {
    isSubmitting.value = true
    // TODO: เชื่อมต่อ API POST /api/package/:id/bonus
    await new Promise(resolve => setTimeout(resolve, 400))

    // Mock: เพิ่ม bonus เข้า local data
    const newBonus: PackageBonus = {
      id: `bonus_${Date.now()}`,
      storefrontPriceId: bonusForm.storefrontPriceId || 'sp_default',
      quantity: bonusForm.quantity,
      description: bonusForm.description
    }

    if (!bonusPackage.value.packageBonuses) {
      bonusPackage.value.packageBonuses = []
    }
    bonusPackage.value.packageBonuses.push(newBonus)

    notify.created('โบนัส')
    resetBonusForm()
  } finally {
    isSubmitting.value = false
  }
}

const handleRemoveBonus = async (bonusId: string) => {
  if (!bonusPackage.value?.packageBonuses) return

  try {
    // TODO: เชื่อมต่อ API DELETE /api/package/:id/bonus/:bonusId
    await new Promise(resolve => setTimeout(resolve, 300))

    bonusPackage.value.packageBonuses = bonusPackage.value.packageBonuses.filter(b => b.id !== bonusId)
    notify.deleted('โบนัส')
  } catch {
    notify.error('ลบโบนัสไม่สำเร็จ')
  }
}

// ============================================================
// Row Helpers
// ============================================================

const handlePackageDeselected = (pkg: Package) => {
  const rows: Row<Package>[] = table.value?.tableApi?.getRowModel().rows ?? []
  const rowIndex = rows.findIndex((row) => row.original.id === pkg.id)
  if (rowIndex >= 0) {
    rows[rowIndex]?.toggleSelected(false)
  }
}

const cycleColumnSorting = (column: any) => {
  const current = column.getIsSorted?.()
  if (!current) {
    column.toggleSorting?.(false)
  } else if (current === 'asc') {
    column.toggleSorting?.(true)
  } else {
    column.clearSorting?.()
  }
}

const getRowItems = (row: Row<Package>) => {
  const items: any[] = [
    { type: 'label', label: 'การดำเนินการ' },
    {
      label: 'คัดลอก ID',
      icon: 'i-lucide-copy',
      onSelect() {
        if (typeof window === 'undefined') return
        navigator.clipboard.writeText(row.original.id)
        notify.info('คัดลอกรหัสแพ็คเกจแล้ว')
      }
    },
    { type: 'separator' },
    {
      label: 'แก้ไข',
      icon: 'i-lucide-pencil',
      onSelect() { openEditModal(row.original) }
    }
  ]

  // เฉพาะ MAIN ถึงจัดการ Bonus ได้
  if (row.original.packageType === 'MAIN') {
    items.push({
      label: 'จัดการโบนัส',
      icon: 'i-lucide-gift',
      onSelect() { openBonusModal(row.original) }
    })
  }

  items.push(
    { type: 'separator' },
    {
      label: 'ลบ',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect() { openDeleteModal(row.original) }
    }
  )

  return items
}

// ============================================================
// Table Columns — MAIN
// ============================================================

const mainColumns: TableColumn<Package>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h('div', h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all'
      })),
    cell: ({ row }) =>
      h('div', h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      }))
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down'
        : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'
      return h(UButton, {
        label: 'ชื่อแพ็คเกจ', color: 'neutral', variant: 'ghost', class: '-mx-2.5', icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: 'size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0' }, [
          h(UIcon, { name: 'i-lucide-package', class: 'size-5 text-primary' })
        ]),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'font-semibold text-highlighted truncate' }, row.original.name),
          h('p', { class: 'text-xs text-muted truncate max-w-48' }, row.original.description || row.original.id)
        ])
      ])
    }
  },
  {
    accessorKey: 'price',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down'
        : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'
      return h(UButton, {
        label: 'ราคา', color: 'neutral', variant: 'ghost', class: '-mx-2.5', icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }) => {
      const price = row.original.price
      return h('span', { class: price === 0 ? 'text-success font-medium' : 'font-medium' },
        price === 0 ? 'ฟรี' : formatCurrency(price))
    }
  },
  {
    accessorKey: 'credits',
    header: 'เครดิต',
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h(UIcon, { name: 'i-lucide-coins', class: 'size-4 text-primary' }),
        h('span', { class: 'font-medium text-primary' }, formatCredits(row.original.credits))
      ])
    }
  },
  {
    accessorKey: 'validityDays',
    header: 'ระยะเวลา',
    cell: ({ row }) => h('span', { class: 'text-muted' }, formatDays(row.original.validityDays))
  },
  {
    id: 'bonuses',
    header: 'โบนัส',
    cell: ({ row }) => {
      const count = row.original.packageBonuses?.length ?? 0
      if (count === 0) {
        return h('span', { class: 'text-muted text-xs' }, 'ไม่มี')
      }
      return h('div', { class: 'flex items-center gap-1.5 cursor-pointer', onClick: () => openBonusModal(row.original) }, [
        h(UIcon, { name: 'i-lucide-gift', class: 'size-4 text-success' }),
        h(UBadge, { color: 'success', variant: 'subtle', size: 'sm' }, () => `${count} รายการ`)
      ])
    }
  },
  {
    accessorKey: 'isActive',
    header: 'สถานะ',
    cell: ({ row }) => {
      const key = getPackageStatusKey(row.original)
      const badge = PACKAGE_STATUS_BADGE_MAP[key]
      return h(UBadge, { color: badge.color, variant: 'subtle' }, () => badge.label)
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h('div', { class: 'text-right' },
        h(UDropdownMenu, { content: { align: 'end' }, items: getRowItems(row) },
          () => h(UButton, { icon: 'i-lucide-ellipsis-vertical', color: 'neutral', variant: 'ghost', class: 'ml-auto' })
        )
      )
    }
  }
]

// ============================================================
// Table Columns — ADDON
// ============================================================

const addonColumns: TableColumn<Package>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h('div', h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all'
      })),
    cell: ({ row }) =>
      h('div', h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      }))
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down'
        : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'
      return h(UButton, {
        label: 'ชื่อแพ็คเกจเสริม', color: 'neutral', variant: 'ghost', class: '-mx-2.5', icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: 'size-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0' }, [
          h(UIcon, { name: 'i-lucide-puzzle', class: 'size-5 text-info' })
        ]),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'font-semibold text-highlighted truncate' }, row.original.name),
          h('p', { class: 'text-xs text-muted truncate max-w-64' }, row.original.description || row.original.id)
        ])
      ])
    }
  },
  {
    accessorKey: 'price',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down'
        : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'
      return h(UButton, {
        label: 'ราคา', color: 'neutral', variant: 'ghost', class: '-mx-2.5', icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }) => {
      const price = row.original.price
      return h('span', { class: price === 0 ? 'text-success font-medium' : 'font-medium' },
        price === 0 ? 'ฟรี' : formatCurrency(price))
    }
  },
  {
    accessorKey: 'validityDays',
    header: 'ระยะเวลา',
    cell: ({ row }) => h('span', { class: 'text-muted' }, formatDays(row.original.validityDays))
  },
  {
    accessorKey: 'isActive',
    header: 'สถานะ',
    cell: ({ row }) => {
      const key = getPackageStatusKey(row.original)
      const badge = PACKAGE_STATUS_BADGE_MAP[key]
      return h(UBadge, { color: badge.color, variant: 'subtle' }, () => badge.label)
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'วันที่สร้าง',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDateTime(row.original.createdAt ?? ''))
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h('div', { class: 'text-right' },
        h(UDropdownMenu, { content: { align: 'end' }, items: getRowItems(row) },
          () => h(UButton, { icon: 'i-lucide-ellipsis-vertical', color: 'neutral', variant: 'ghost', class: 'ml-auto' })
        )
      )
    }
  }
]

/** Columns ตาม tab ที่เลือก */
const columns = computed(() => activeTab.value === 'MAIN' ? mainColumns : addonColumns)
</script>

<template>
  <UDashboardPanel id="packages">
    <!-- Navbar -->
    <template #header>
      <UDashboardNavbar title="แพ็คเกจรายเดือน" icon="i-lucide-package">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #right>
          <UButton :label="activeTab === 'MAIN' ? 'เพิ่มแพ็คเกจหลัก' : 'เพิ่มแพ็คเกจเสริม'"
            :icon="activeTab === 'MAIN' ? 'i-lucide-package' : 'i-lucide-puzzle'" trailing-icon="i-lucide-plus"
            color="primary" @click="openAddModal" />
        </template>
      </UDashboardNavbar>
    </template>

    <!-- Content -->
    <template #body>
      <div class="flex flex-col gap-4">

        <!-- ============================================================ -->
        <!-- Tab Switch: MAIN / ADDON -->
        <!-- ============================================================ -->
        <div class="flex items-center gap-2 border-b border-default -mt-1">
          <button type="button" class="relative px-4 py-2.5 text-sm font-medium transition-colors" :class="activeTab === 'MAIN'
            ? 'text-primary'
            : 'text-muted hover:text-highlighted'" @click="activeTab = 'MAIN'">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-package" class="size-4" />
              แพ็คเกจหลัก
              <UBadge color="primary" variant="subtle" size="xs">{{ mainPackageCount }}</UBadge>
            </div>
            <div v-if="activeTab === 'MAIN'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          </button>
          <button type="button" class="relative px-4 py-2.5 text-sm font-medium transition-colors" :class="activeTab === 'ADDON'
            ? 'text-info'
            : 'text-muted hover:text-highlighted'" @click="activeTab = 'ADDON'">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-puzzle" class="size-4" />
              แพ็คเกจเสริม
              <UBadge color="info" variant="subtle" size="xs">{{ addonPackageCount }}</UBadge>
            </div>
            <div v-if="activeTab === 'ADDON'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-info rounded-t" />
          </button>
        </div>

        <!-- ============================================================ -->
        <!-- Toolbar -->
        <!-- ============================================================ -->
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 w-full md:w-auto">
            <UInput v-model="searchQuery" class="w-full md:max-w-sm" icon="i-lucide-search"
              :placeholder="activeTab === 'MAIN' ? 'ค้นหาแพ็คเกจหลัก...' : 'ค้นหาแพ็คเกจเสริม...'" />
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <UButton v-if="selectedRowsCount" label="ลบ" color="error" variant="subtle" icon="i-lucide-trash"
              @click="openBulkDeleteModal">
              <template #trailing>
                <UKbd>{{ selectedRowsCount }}</UKbd>
              </template>
            </UButton>

            <USelect v-model="statusFilter" :items="PACKAGE_STATUS_FILTER_OPTIONS"
              :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
              placeholder="สถานะ" class="min-w-36" />

            <UDropdownMenu class="cursor-pointer" :items="table?.tableApi
              ?.getAllColumns()
              .filter((column: any) => column.getCanHide())
              .map((column: any) => ({
                label: upperFirst(column.id),
                type: 'checkbox',
                checked: column.getIsVisible(),
                onUpdateChecked(checked: boolean) {
                  table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
                },
                onSelect(e?: Event) {
                  e?.preventDefault()
                }
              }))
              " :content="{ align: 'end' }">
              <UButton label="แสดงคอลัมน์" color="neutral" variant="outline" trailing-icon="i-lucide-settings-2" />
            </UDropdownMenu>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- Add Package Modal -->
        <!-- ============================================================ -->
        <UModal v-model:open="showAddModal" :title="activeTab === 'MAIN' ? 'เพิ่มแพ็คเกจหลัก' : 'เพิ่มแพ็คเกจเสริม'"
          :description="activeTab === 'MAIN' ? 'กรอกข้อมูลเพื่อสร้างแพ็คเกจหลักใหม่' : 'กรอกข้อมูลเพื่อสร้างแพ็คเกจเสริมใหม่'">
          <template #body>
            <!-- MAIN Form -->
            <div v-if="activeTab === 'MAIN'" class="space-y-4">
              <UFormField name="name" label="ชื่อแพ็คเกจ" required>
                <UInput v-model="packageForm.name" placeholder="เช่น Basic, Standard, Premium" class="w-full" />
              </UFormField>
              <UFormField name="description" label="รายละเอียด">
                <UTextarea v-model="packageForm.description" placeholder="อธิบายจุดเด่นของแพ็คเกจ..." :rows="2"
                  class="w-full" />
              </UFormField>
              <div class="grid grid-cols-2 gap-4">
                <UFormField name="price" label="ราคา (บาท)" required>
                  <UInput v-model.number="packageForm.price" type="number" :min="0" placeholder="0" class="w-full" />
                </UFormField>
                <UFormField name="credits" label="เครดิตซักผ้า" required>
                  <UInput v-model.number="packageForm.credits" type="number" :min="1" placeholder="50" class="w-full" />
                </UFormField>
              </div>
              <UFormField name="validityDays" label="ระยะเวลา (วัน)" required>
                <UInput v-model.number="packageForm.validityDays" type="number" :min="1" placeholder="30"
                  class="w-full" />
              </UFormField>
              <div class="flex items-center gap-6">
                <UCheckbox v-model="packageForm.isActive" label="เปิดใช้งาน" />
              </div>
            </div>

            <!-- ADDON Form -->
            <div v-else class="space-y-4">
              <UFormField name="name" label="ชื่อแพ็คเกจเสริม" required>
                <UInput v-model="addonForm.name" placeholder="เช่น ซักด่วน, รีดผ้าพรีเมียม" class="w-full" />
              </UFormField>
              <UFormField name="description" label="รายละเอียด">
                <UTextarea v-model="addonForm.description" placeholder="อธิบายบริการเสริม..." :rows="2"
                  class="w-full" />
              </UFormField>
              <UFormField name="price" label="ราคา (บาท)" required>
                <UInput v-model.number="addonForm.price" type="number" :min="0" placeholder="0" class="w-full" />
              </UFormField>
              <UFormField name="validityDays" label="ระยะเวลา (วัน)" required>
                <UInput v-model.number="addonForm.validityDays" type="number" :min="1" placeholder="30"
                  class="w-full" />
              </UFormField>
              <div class="flex items-center gap-6">
                <UCheckbox v-model="addonForm.isActive" label="เปิดใช้งาน" />
              </div>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end gap-3 w-full">
              <UButton label="ยกเลิก" color="neutral" variant="outline" @click="showAddModal = false" />
              <UButton :label="activeTab === 'MAIN' ? 'สร้างแพ็คเกจ' : 'สร้างแพ็คเกจเสริม'" color="primary"
                icon="i-lucide-check" :loading="isSubmitting" @click="handleCreatePackage" />
            </div>
          </template>
        </UModal>

        <!-- ============================================================ -->
        <!-- Edit Package Modal -->
        <!-- ============================================================ -->
        <UModal v-model:open="showEditModal" title="แก้ไขแพ็คเกจ"
          :description="`แก้ไขข้อมูลแพ็คเกจ ${editingPackage?.name || ''}`">
          <template #body>
            <!-- MAIN Form -->
            <div v-if="editingPackage?.packageType === 'MAIN'" class="space-y-4">
              <UFormField name="name" label="ชื่อแพ็คเกจ" required>
                <UInput v-model="packageForm.name" placeholder="เช่น Basic, Standard, Premium" class="w-full" />
              </UFormField>
              <UFormField name="description" label="รายละเอียด">
                <UTextarea v-model="packageForm.description" placeholder="อธิบายจุดเด่นของแพ็คเกจ..." :rows="2"
                  class="w-full" />
              </UFormField>
              <div class="grid grid-cols-2 gap-4">
                <UFormField name="price" label="ราคา (บาท)" required>
                  <UInput v-model.number="packageForm.price" type="number" :min="0" placeholder="0" class="w-full" />
                </UFormField>
                <UFormField name="credits" label="เครดิตซักผ้า" required>
                  <UInput v-model.number="packageForm.credits" type="number" :min="1" placeholder="50" class="w-full" />
                </UFormField>
              </div>
              <UFormField name="validityDays" label="ระยะเวลา (วัน)" required>
                <UInput v-model.number="packageForm.validityDays" type="number" :min="1" placeholder="30"
                  class="w-full" />
              </UFormField>
              <div class="flex items-center gap-6">
                <UCheckbox v-model="packageForm.isActive" label="เปิดใช้งาน" />
              </div>
            </div>

            <!-- ADDON Form -->
            <div v-else class="space-y-4">
              <UFormField name="name" label="ชื่อแพ็คเกจเสริม" required>
                <UInput v-model="addonForm.name" placeholder="เช่น ซักด่วน, รีดผ้าพรีเมียม" class="w-full" />
              </UFormField>
              <UFormField name="description" label="รายละเอียด">
                <UTextarea v-model="addonForm.description" placeholder="อธิบายบริการเสริม..." :rows="2"
                  class="w-full" />
              </UFormField>
              <UFormField name="price" label="ราคา (บาท)" required>
                <UInput v-model.number="addonForm.price" type="number" :min="0" placeholder="0" class="w-full" />
              </UFormField>
              <UFormField name="validityDays" label="ระยะเวลา (วัน)" required>
                <UInput v-model.number="addonForm.validityDays" type="number" :min="1" placeholder="30"
                  class="w-full" />
              </UFormField>
              <div class="flex items-center gap-6">
                <UCheckbox v-model="addonForm.isActive" label="เปิดใช้งาน" />
              </div>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end gap-3 w-full">
              <UButton label="ยกเลิก" color="neutral" variant="outline" @click="showEditModal = false" />
              <UButton label="บันทึก" color="primary" icon="i-lucide-check" :loading="isSubmitting"
                @click="handleUpdatePackage" />
            </div>
          </template>
        </UModal>

        <!-- ============================================================ -->
        <!-- Bonus Management Modal (เฉพาะ MAIN) -->
        <!-- ============================================================ -->
        <UModal v-model:open="showBonusModal" title="จัดการโบนัส"
          :description="`โบนัสของแพ็คเกจ ${bonusPackage?.name || ''}`">
          <template #body>
            <div v-if="bonusPackage" class="space-y-5">

              <!-- Package Summary -->
              <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
                <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <UIcon name="i-lucide-package" class="size-5 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-highlighted truncate">{{ bonusPackage.name }}</p>
                  <p class="text-xs text-muted">{{ formatCurrency(bonusPackage.price) }} / {{
                    formatCredits(bonusPackage.credits) }} / {{ formatDays(bonusPackage.validityDays) }}</p>
                </div>
              </div>

              <!-- Existing Bonuses -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-gift" class="size-4 text-success" />
                    โบนัสปัจจุบัน
                  </h4>
                  <UBadge color="success" variant="subtle" size="xs">
                    {{ bonusPackage.packageBonuses?.length ?? 0 }} รายการ
                  </UBadge>
                </div>

                <div v-if="bonusPackage.packageBonuses?.length" class="space-y-2">
                  <div v-for="bonus in bonusPackage.packageBonuses" :key="bonus.id"
                    class="flex items-center justify-between gap-2 p-3 bg-success/5 border border-success/15 rounded-lg group">
                    <div class="flex items-center gap-2 min-w-0">
                      <UIcon name="i-lucide-sparkles" class="size-4 text-success shrink-0" />
                      <span class="text-sm truncate">{{ bonus.description }}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <UBadge color="success" variant="subtle" size="sm">× {{ bonus.quantity }}</UBadge>
                      <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs"
                        class="opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="handleRemoveBonus(bonus.id)" />
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-6 text-muted">
                  <UIcon name="i-lucide-gift" class="size-8 mx-auto mb-2 opacity-40" />
                  <p class="text-sm">ยังไม่มีโบนัส</p>
                </div>
              </div>

              <!-- Add New Bonus -->
              <div class="border-t border-default pt-4 space-y-3">
                <h4 class="text-sm font-medium flex items-center gap-2">
                  <UIcon name="i-lucide-plus-circle" class="size-4 text-primary" />
                  เพิ่มโบนัสใหม่
                </h4>
                <UFormField name="bonusDescription" label="คำอธิบาย" required>
                  <UInput v-model="bonusForm.description" placeholder="เช่น แถมซักเสื้อเชิ้ต 5 ตัว" class="w-full" />
                </UFormField>
                <UFormField name="bonusQuantity" label="จำนวน" required>
                  <UInput v-model.number="bonusForm.quantity" type="number" :min="1" placeholder="1" class="w-full" />
                </UFormField>
                <UButton label="เพิ่มโบนัส" color="success" variant="subtle" icon="i-lucide-plus" class="w-full"
                  :loading="isSubmitting" :disabled="!bonusForm.description.trim() || bonusForm.quantity < 1"
                  @click="handleAddBonus" />
              </div>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end w-full">
              <UButton label="ปิด" color="neutral" variant="outline" @click="showBonusModal = false" />
            </div>
          </template>
        </UModal>

        <!-- ============================================================ -->
        <!-- Single Delete Modal -->
        <!-- ============================================================ -->
        <UIConfirmModal v-model:open="showDeleteModal" title="ลบแพ็คเกจ" description="ยืนยันการลบแพ็คเกจนี้"
          icon="i-lucide-trash-2" icon-color="error" confirm-label="ลบแพ็คเกจ" confirm-color="error"
          :loading="isSubmitting" @confirm="confirmDeletePackage">
          <template #message>
            คุณต้องการลบแพ็คเกจ <strong class="text-highlighted">{{ deletingPackage?.name }}</strong> หรือไม่?
          </template>
          <template #subMessage>
            <div class="space-y-1">
              <p>
                <span class="text-muted">ประเภท:</span>
                <UBadge :color="deletingPackage?.packageType === 'MAIN' ? 'primary' : 'info'" variant="subtle" size="sm"
                  class="ml-1">
                  {{ deletingPackage?.packageType === 'MAIN' ? 'แพ็คเกจหลัก' : 'แพ็คเกจเสริม' }}
                </UBadge>
              </p>
              <p>
                <span class="text-muted">ราคา:</span>
                <strong class="text-highlighted ml-1">{{ deletingPackage?.price === 0 ? 'ฟรี' :
                  formatCurrency(deletingPackage?.price || 0) }}</strong>
              </p>
              <p v-if="deletingPackage?.packageType === 'MAIN'">
                <span class="text-muted">เครดิต:</span>
                <strong class="text-highlighted ml-1">{{ formatCredits(deletingPackage?.credits || 0) }}</strong>
              </p>
            </div>
          </template>
        </UIConfirmModal>

        <!-- ============================================================ -->
        <!-- Bulk Delete Modal -->
        <!-- ============================================================ -->
        <UModal v-model:open="showBulkDeleteModal" title="ลบแพ็คเกจที่เลือก"
          :description="`ยืนยันการลบแพ็คเกจ ${selectedRowsCount} รายการ`">
          <template #body>
            <div v-if="selectedPackages.length" class="space-y-3 max-h-72 overflow-auto pr-1">
              <div v-for="pkg in selectedPackages" :key="pkg.id" class="flex items-center gap-3">
                <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
                  :class="pkg.packageType === 'MAIN' ? 'bg-primary/10' : 'bg-info/10'">
                  <UIcon :name="pkg.packageType === 'MAIN' ? 'i-lucide-package' : 'i-lucide-puzzle'"
                    :class="pkg.packageType === 'MAIN' ? 'size-5 text-primary' : 'size-5 text-info'" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-highlighted truncate">{{ pkg.name }}</p>
                  <p class="text-sm text-muted truncate">
                    {{ pkg.price === 0 ? 'ฟรี' : formatCurrency(pkg.price) }}
                    <template v-if="pkg.packageType === 'MAIN'"> - {{ formatCredits(pkg.credits) }}</template>
                  </p>
                </div>
                <UButton icon="i-lucide-x" variant="ghost" size="xs" color="neutral"
                  @click="handlePackageDeselected(pkg)" />
              </div>
            </div>
            <p v-else class="text-sm text-muted text-center py-6">ยังไม่มีแพ็คเกจที่เลือก</p>
          </template>

          <template #footer>
            <div class="flex justify-end gap-3 w-full">
              <UButton label="ยกเลิก" color="neutral" variant="outline" @click="showBulkDeleteModal = false" />
              <UButton label="ลบ" color="error" :disabled="!selectedRowsCount" :loading="isSubmitting"
                @click="confirmBulkDelete" />
            </div>
          </template>
        </UModal>

        <!-- ============================================================ -->
        <!-- Data Table -->
        <!-- ============================================================ -->
        <UTable ref="table" v-model:column-visibility="columnVisibility" v-model:row-selection="rowSelection"
          v-model:pagination="pagination" :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          class="shrink-0" :data="filteredPackages" :columns="columns" :loading="status === 'pending'" :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 font-medium first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default',
            separator: 'h-0'
          }">
          <template #empty>
            <div class="flex flex-col items-center justify-center py-12 text-center text-muted">
              <UIcon :name="activeTab === 'MAIN' ? 'i-lucide-package' : 'i-lucide-puzzle'"
                class="size-10 mb-3 opacity-60" />
              <p>ยังไม่มี{{ activeTab === 'MAIN' ? 'แพ็คเกจหลัก' : 'แพ็คเกจเสริม' }}ที่ตรงกับการค้นหา</p>
            </div>
          </template>
        </UTable>

        <!-- ============================================================ -->
        <!-- Pagination -->
        <!-- ============================================================ -->
        <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto flex-wrap">
          <div class="text-sm text-muted">
            เลือก {{ selectedRowsCount }} จาก {{ filteredRowCount }} แถวทั้งหมด
          </div>

          <div class="flex items-center gap-1.5">
            <UPagination :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
              :items-per-page="table?.tableApi?.getState().pagination.pageSize" :total="filteredRowCount"
              @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)" />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>