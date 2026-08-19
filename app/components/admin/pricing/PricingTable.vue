<script setup lang="ts">
import { h, resolveComponent, ref, computed, watch } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { columnSortIcon, cycleColumnSorting } from '~~/shared/utils/table'

type PricingCategory = {
  id: string
  name: string
  description?: string | null
}
type PricingService = {
  id: string
  name: string
  description?: string | null
}
type PricingItem = {
  id: string
  name: string
  categoryId?: string | null
  description?: string | null
}
type PricingPrice = {
  storefrontItemId: string
  storefrontServiceId: string
  price: number
  priceMin?: number | null
  priceMax?: number | null
}
type PricingTableData = {
  items: PricingItem[]
  services: PricingService[]
  prices: PricingPrice[]
  categories: PricingCategory[]
}
type PricingTableRow = PricingItem & {
  index: number
  categoryName: string
  [key: string]: string | number | null | undefined
}
type PriceUpdatePayload = {
  itemId: string
  serviceId: string
  price: number
  priceMin?: number | null
  priceMax?: number | null
}
type SelectOption = {
  id: string
  name: string
  description?: string
}

const props = defineProps<{
  data: PricingTableData
  loading: boolean
  showSkeleton?: boolean
}>()

const isSkeleton = computed(() => Boolean(props.showSkeleton))

const emit = defineEmits<{
  refresh: []
  'delete-item': [id: string]
  'update-item': [item: PricingItem]
  'update-price': [payload: PriceUpdatePayload]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UCheckbox = resolveComponent('UCheckbox')

const sortableHeader = (
  label: string,
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (descending: boolean) => void; clearSorting: () => void },
  align = 'left'
) => h('button', {
  type: 'button',
  class: ['inline-flex w-full items-center gap-1.5', align === 'right' ? 'justify-end' : 'justify-start'],
  onClick: () => cycleColumnSorting(column)
}, [label, h(UIcon, { name: columnSortIcon(column.getIsSorted()), class: 'size-3.5 text-dimmed' })])

const notify = useNotify()

type TableRow<T> = { original: T; toggleSelected: (value: boolean) => void }
type TableApi = {
  getFilteredSelectedRowModel: () => { rows: TableRow<PricingTableRow>[] }
  getFilteredRowModel: () => { rows: TableRow<PricingTableRow>[] }
  getRowModel: () => { rows: TableRow<PricingTableRow>[] }
  resetRowSelection: () => void
}
type TableInstance = { tableApi?: TableApi }

const table = useTemplateRef<TableInstance>('table')
const columnVisibility = ref<Record<string, boolean>>({})
const rowSelection = ref<Record<string, boolean>>({})

const search = ref('')
const filterCategory = ref('all')
const filterService = ref('all')
const showBulkDeleteModal = ref(false)

const categoryOptions = computed<SelectOption[]>(() => [
  { id: 'all', name: 'ทุกประเภท' },
  ...(props.data?.categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description ?? undefined
  }))
])
const serviceOptions = computed<SelectOption[]>(() => [
  { id: 'all', name: 'ทุกบริการ' },
  ...(props.data?.services ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description ?? undefined
  }))
])
const visibleServices = computed(() => {
  if (filterService.value === 'all') return props.data?.services ?? []
  return (props.data?.services ?? []).filter((service) => service.id === filterService.value)
})

const getPrice = (itemId: string, serviceId: string) =>
  props.data?.prices?.find((p) => p.storefrontItemId === itemId && p.storefrontServiceId === serviceId)

const tableData = computed<PricingTableRow[]>(() => {
  if (!props.data?.items) return []

  let result = props.data.items.map<PricingTableRow>((item, index) => {
    const category = props.data?.categories?.find((c) => c.id === item.categoryId)
    const row: PricingTableRow = { ...item, index: index + 1, categoryName: category?.name ?? '-' }
    props.data.services?.forEach((service) => {
      const priceObj = getPrice(item.id, service.id)
      row[`service_${service.id}`] = priceObj ? Number(priceObj.price) : null
      row[`service_${service.id}_min`] = priceObj?.priceMin != null ? Number(priceObj.priceMin) : null
      row[`service_${service.id}_max`] = priceObj?.priceMax != null ? Number(priceObj.priceMax) : null
    })
    return row
  })

  const q = search.value.trim().toLowerCase()
  if (q) result = result.filter((r) => r.name.toLowerCase().includes(q))
  if (filterCategory.value !== 'all') result = result.filter((r) => r.categoryId === filterCategory.value)

  return result
})

watch([search, filterCategory, filterService, () => props.data], () => {
  table.value?.tableApi?.resetRowSelection()
})

const selectedRows = computed<TableRow<PricingTableRow>[]>(
  () => table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? []
)
const selectedItems = computed(() => selectedRows.value.map((r) => r.original))
const selectedCount = computed(() => selectedItems.value.length)
const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? tableData.value.length
)
const getMobileRowId = (index: number | string) => String(index)
const isMobileRowSelected = (index: number | string) => Boolean(rowSelection.value[getMobileRowId(index)])
const setMobileRowSelected = (index: number | string, value: boolean | 'indeterminate') => {
  const rowId = getMobileRowId(index)
  rowSelection.value = {
    ...rowSelection.value,
    [rowId]: !!value
  }
  if (!value) {
    const { [rowId]: _removedRow, ...next } = rowSelection.value
    rowSelection.value = next
  }
}

const formatPriceText = (item: PricingTableRow, service: PricingService) => {
  const price = item[`service_${service.id}`]
  if (price === null || price === undefined) return '-'

  const min = item[`service_${service.id}_min`]
  const max = item[`service_${service.id}_max`]
  if (min != null && max != null && min !== max) {
    return `฿${Number(min).toLocaleString()}-${Number(max).toLocaleString()}`
  }
  return `฿${Number(price).toLocaleString()}`
}

watch(selectedCount, (count) => {
  if (!count) showBulkDeleteModal.value = false
})

const handleItemDeselected = (item: PricingTableRow) => {
  const rows = table.value?.tableApi?.getRowModel().rows ?? []
  const row = rows.find((r) => r.original.id === item.id)
  row?.toggleSelected(false)
}

// ── Edit / Delete ────────────────────────────────────────────────────────────

const editItemModal = ref(false)
const deleteItemModal = ref(false)
const isProcessingItem = ref(false)
const activeItem = ref<PricingItem>({ id: '', name: '', categoryId: '', description: '' })
const activeItemPrices = ref<Record<string, number | string | undefined>>({})
const activeItemPricesMin = ref<Record<string, number | string | undefined>>({})
const activeItemPricesMax = ref<Record<string, number | string | undefined>>({})
const activeItemRangeEnabled = ref<Record<string, boolean>>({})

const openEditItem = (itemRow: PricingTableRow) => {
  activeItem.value = {
    id: itemRow.id,
    name: itemRow.name,
    categoryId: itemRow.categoryId ?? '',
    description: itemRow.description ?? ''
  }
  activeItemPrices.value = {}
  activeItemPricesMin.value = {}
  activeItemPricesMax.value = {}
  activeItemRangeEnabled.value = {}
  props.data?.services?.forEach((s) => {
    const priceObj = getPrice(itemRow.id, s.id)
    activeItemPrices.value[s.id] = itemRow[`service_${s.id}`] ?? undefined
    const hasMin = priceObj?.priceMin != null
    const hasMax = priceObj?.priceMax != null
    activeItemRangeEnabled.value[s.id] = hasMin || hasMax
    activeItemPricesMin.value[s.id] = hasMin ? Number(priceObj.priceMin) : undefined
    activeItemPricesMax.value[s.id] = hasMax ? Number(priceObj.priceMax) : undefined
  })
  editItemModal.value = true
}

const openDeleteItem = (itemRow: PricingTableRow) => {
  activeItem.value = { id: itemRow.id, name: itemRow.name }
  deleteItemModal.value = true
}

const saveEditItem = async () => {
  isProcessingItem.value = true
  try {
    await $fetch('/api/admin/pricing/item', {
      method: 'PUT',
      body: {
        id: activeItem.value.id,
        name: activeItem.value.name,
        categoryId: activeItem.value.categoryId,
        description: activeItem.value.description
      }
    })
    for (const service of props.data?.services ?? []) {
      const newPrice = activeItemPrices.value[service.id]
      if (newPrice !== null && newPrice !== undefined && newPrice !== '') {
        const isRange = activeItemRangeEnabled.value[service.id]
        const priceMin = isRange && activeItemPricesMin.value[service.id] !== undefined ? Number(activeItemPricesMin.value[service.id]) : null
        const priceMax = isRange && activeItemPricesMax.value[service.id] !== undefined ? Number(activeItemPricesMax.value[service.id]) : null
        await $fetch('/api/admin/pricing/price', {
          method: 'PUT',
          body: { storefrontItemId: activeItem.value.id, storefrontServiceId: service.id, price: Number(newPrice), priceMin, priceMax }
        })
        emit('update-price', { itemId: activeItem.value.id, serviceId: service.id, price: Number(newPrice), priceMin, priceMax })
      }
    }
    emit('update-item', { ...activeItem.value })
    emit('refresh')
    editItemModal.value = false
    notify.success('บันทึกข้อมูลเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isProcessingItem.value = false
  }
}

const confirmDeleteItem = async () => {
  isProcessingItem.value = true
  try {
    await $fetch('/api/admin/pricing/item', { method: 'DELETE', body: { id: activeItem.value.id } })
    emit('delete-item', activeItem.value.id)
    emit('refresh')
    deleteItemModal.value = false
    notify.success('ลบรายการเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isProcessingItem.value = false
  }
}

const isBulkDeleting = ref(false)
const handleBulkDelete = async () => {
  isBulkDeleting.value = true
  const targets = [...selectedItems.value]
  try {
    await Promise.all(targets.map((item) =>
      $fetch('/api/admin/pricing/item', { method: 'DELETE', body: { id: item.id } }),
    ))
    emit('refresh')
    table.value?.tableApi?.resetRowSelection()
    showBulkDeleteModal.value = false
    notify.success(`ลบ ${targets.length} รายการเรียบร้อยแล้ว`)
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    emit('refresh')
  } finally {
    isBulkDeleting.value = false
  }
}

// ── Columns ──────────────────────────────────────────────────────────────────

const columns = computed<TableColumn<PricingTableRow>[]>(() => {
  const serviceColumns: TableColumn<PricingTableRow>[] = visibleServices.value.map((service) => ({
    accessorKey: `service_${service.id}`,
    header: ({ column }) => sortableHeader(service.name, column),
    cell: ({ row }) => {
      const price = row.getValue(`service_${service.id}`)
      if (price === null || price === undefined) return h('span', { class: 'text-muted' }, '-')
      const min = row.original[`service_${service.id}_min`]
      const max = row.original[`service_${service.id}_max`]
      if (min != null && max != null && min !== max) {
        return h('span', { class: 'font-medium text-primary' }, `฿${Number(min).toLocaleString()}–${Number(max).toLocaleString()}`)
      }
      return h('span', { class: 'font-medium text-primary' }, `฿${Number(price).toLocaleString()}`)
    }
  }))

  return [
    {
      id: 'select',
      header: ({ table }) =>
        h('div', {}, [h(UCheckbox, {
          modelValue: table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
          ariaLabel: 'เลือกทั้งหมด'
        })]),
      cell: ({ row }) =>
        h('div', {}, [h(UCheckbox, {
          modelValue: row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
          ariaLabel: 'เลือกแถว'
        })])
    },
    {
      accessorKey: 'name',
      header: ({ column }) => sortableHeader('รายการ', column),
      cell: ({ row }) =>
        h('div', { class: 'flex items-center gap-2 px-2 py-1.5' }, [
          h(UIcon, { name: 'i-lucide-shirt', class: 'size-4 text-primary shrink-0 opacity-70' }),
          h('span', { class: 'font-medium text-highlighted truncate max-w-48' }, row.getValue('name'))
        ])
    },
    {
      accessorKey: 'categoryName',
      header: ({ column }) => sortableHeader('ประเภท', column),
      cell: ({ row }) =>
        h(UBadge, { variant: 'subtle', color: 'primary' }, () => row.getValue('categoryName'))
    },
    ...serviceColumns,
    {
      accessorKey: 'description',
      header: ({ column }) => sortableHeader('หมายเหตุ', column),
      cell: ({ row }) => {
        const desc = row.getValue('description') as string | null | undefined
        return h('span', { class: 'text-muted truncate block max-w-44', title: desc ?? '' }, desc || '-')
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        h('div', { class: 'flex items-center justify-end gap-1' }, [
          h(UButton, {
            icon: 'i-lucide-pencil',
            size: 'xs',
            color: 'neutral',
            variant: 'ghost',
            title: 'แก้ไขรายการ',
            onClick: () => openEditItem(row.original)
          }),
          h(UButton, {
            icon: 'i-lucide-trash-2',
            size: 'xs',
            color: 'error',
            variant: 'ghost',
            title: 'ลบรายการ',
            onClick: () => openDeleteItem(row.original)
          })
        ])
    }
  ]
})
</script>

<template>
  <section class="flex flex-col gap-1">
    <div class="-mx-2 border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 space-y-2 sm:mx-0 sm:rounded-lg md:flex md:items-center md:justify-between md:gap-3 md:space-y-0">
      <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
        <UInput
          v-model="search"
          class="min-w-0 flex-1"
          icon="i-lucide-search"
          placeholder="ค้นหารายการ..."
        />
        <UButton
          v-if="selectedCount"
          color="error"
          variant="subtle"
          icon="i-lucide-trash"
          class="shrink-0 md:hidden"
          :aria-label="`ลบ ${selectedCount} รายการ`"
          @click="showBulkDeleteModal = true"
        >
          <template #trailing>
            <UKbd class="hidden sm:inline-flex">{{ selectedCount }}</UKbd>
          </template>
        </UButton>
        <UIButtonRefresh class="shrink-0 md:hidden" :loading="loading" @refresh="emit('refresh')" />
      </div>

      <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
        <USelect
          v-model="filterCategory"
          :items="categoryOptions"
          label-key="name"
          value-key="id"
          class="min-w-0 sm:w-40"
        />
        <USelect
          v-model="filterService"
          :items="serviceOptions"
          label-key="name"
          value-key="id"
          class="min-w-0 sm:w-40"
        />
        <UButton
          v-if="selectedCount"
          color="error"
          variant="subtle"
          icon="i-lucide-trash"
          class="hidden shrink-0 md:inline-flex"
          :aria-label="`ลบ ${selectedCount} รายการ`"
          @click="showBulkDeleteModal = true"
        >
          <template #trailing>
            <UKbd class="hidden sm:inline-flex">{{ selectedCount }}</UKbd>
          </template>
        </UButton>
        <UIButtonRefresh class="hidden shrink-0 md:inline-flex" :loading="loading" @refresh="emit('refresh')" />
      </div>
    </div>

    <!-- Bulk delete modal -->
    <UModal
      v-model:open="showBulkDeleteModal"
      title="ลบรายการที่เลือก"
      :description="`ยืนยันการลบ ${selectedCount} รายการ`"
    >
      <template #body>
        <div v-if="selectedItems.length" class="max-h-72 space-y-3 overflow-auto pr-1">
          <div
            v-for="item in selectedItems"
            :key="item.id"
            class="flex items-center gap-3"
          >
            <UIcon name="i-lucide-shirt" class="size-4 text-primary shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-highlighted">{{ item.name }}</p>
              <p class="truncate text-sm text-muted">{{ item.categoryName }}</p>
            </div>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="xs"
              color="neutral"
              @click="handleItemDeselected(item)"
            />
          </div>
        </div>
        <p v-else class="py-6 text-center text-sm text-muted">
          ยังไม่มีรายการที่เลือก
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton label="ยกเลิก" color="neutral" variant="outline" @click="showBulkDeleteModal = false" />
          <UButton
            label="ลบ"
            color="error"
            :disabled="!selectedCount"
            :loading="isBulkDeleting"
            @click="handleBulkDelete"
          />
        </div>
      </template>
    </UModal>

    <template v-if="isSkeleton">
      <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
        <div
          v-for="i in 5"
          :key="`pr-mob-sk-${i}`"
          class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
        >
          <div class="flex items-center gap-2 p-2">
            <USkeleton class="size-4 rounded-lg shrink-0" />
            <USkeleton class="size-4 rounded-lg shrink-0" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1 space-y-1">
                  <USkeleton class="h-3.5 w-36 rounded-lg" />
                  <USkeleton class="h-2.5 w-28 rounded-lg" />
                </div>
                <USkeleton class="h-4 w-16 rounded-full" />
              </div>
              <div class="flex flex-wrap gap-2">
                <USkeleton class="h-2.5 w-20 rounded-lg" />
                <USkeleton class="h-2.5 w-20 rounded-lg" />
                <USkeleton class="h-2.5 w-20 rounded-lg" />
              </div>
              <div class="flex items-center justify-end gap-1">
                <USkeleton class="size-5 rounded-lg" />
                <USkeleton class="size-5 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
        <div class="space-y-2 p-3">
          <USkeleton v-for="i in 8" :key="`pr-dt-sk-${i}`" class="h-12 w-full rounded-lg" />
        </div>
      </div>
    </template>

    <template v-else>
    <div class="md:hidden">
      <div v-if="loading" class="-mx-2 space-y-1 sm:mx-0">
        <USkeleton v-for="i in 5" :key="i" class="h-24 w-full rounded-lg" />
      </div>

      <div v-else-if="!tableData.length" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
        <UIcon name="i-lucide-list-x" class="mb-3 size-10 opacity-60" />
        <p>{{ search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ' }}</p>
      </div>

      <div v-else class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="(item, index) in tableData"
          :key="item.id"
          class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
        >
          <div class="flex items-center gap-2 p-2">
            <UCheckbox
              :model-value="isMobileRowSelected(Number(index))"
              aria-label="เลือกแถว"
              class="shrink-0"
              @update:model-value="setMobileRowSelected(index, $event)"
            />
            <UIcon name="i-lucide-shirt" class="size-4 shrink-0 text-primary opacity-70" />

            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">{{ item.name }}</p>
                  <p class="truncate text-[11px] text-muted">{{ item.description || 'ไม่มีหมายเหตุ' }}</p>
                </div>
                <UBadge variant="subtle" color="primary" size="xs" class="shrink-0">
                  {{ item.categoryName }}
                </UBadge>
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                <span
                  v-for="service in visibleServices"
                  :key="service.id"
                >
                  {{ service.name }}:
                  <span
                    class="font-medium"
                    :class="formatPriceText(item, service) === '-' ? 'text-muted' : 'text-primary'"
                  >{{ formatPriceText(item, service) }}</span>
                </span>
              </div>

              <div class="mt-1 flex items-center justify-between gap-2">
                <div class="min-w-0 truncate text-[11px] text-muted">
                  {{ item.categoryName }}
                </div>
                <div class="flex shrink-0 items-center justify-end gap-1">
                  <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" aria-label="แก้ไขรายการ" @click="openEditItem(item)" />
                  <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" aria-label="ลบรายการ" @click="openDeleteItem(item)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hidden shrink-0 overflow-hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
      <UTable
        ref="table"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        :data="tableData"
        :columns="columns"
        :loading="loading"
        :ui="{
          root: 'relative overflow-x-auto',
          base: 'table-fixed border-separate border-spacing-0',
          thead: 'sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45',
          th: 'border-b border-default bg-default py-2.5 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80',
          td: 'border-b border-default py-2.5 transition-colors dark:border-default/25',
          separator: 'h-0',
        }"
      >
        <template #empty>
          <div v-if="loading" class="space-y-2 p-3">
            <USkeleton v-for="i in 6" :key="`pr-tbl-${i}`" class="h-12 w-full rounded-lg" />
          </div>
          <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
            <UIcon name="i-lucide-list-x" class="mb-3 size-10 opacity-60" />
            <p>{{ search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ' }}</p>
          </div>
        </template>
      </UTable>
    </div>
    </template>

    <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default/30 pt-4 dark:border-default/20">
      <div class="text-sm text-muted">
        <template v-if="isSkeleton">
          <span class="inline-flex items-center gap-2">
            <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
            กำลังโหลด...
          </span>
        </template>
        <template v-else>แสดง {{ filteredRowCount }} รายการ · เลือก {{ selectedCount }} รายการ</template>
      </div>
    </div>
  </section>

  <!-- Edit Modal -->
  <UModal
    v-model:open="editItemModal"
    title="แก้ไขรายการ"
    :description="`แก้ไขข้อมูลและราคา: ${activeItem.name}`"
    :ui="{
      content: 'max-w-3xl bg-default dark:bg-default',
      body: '!p-2 sm:p-4! bg-default dark:bg-default',
      header: 'bg-default dark:bg-default',
      footer: 'bg-default dark:bg-default',
    }"
  >
    <template #body>
      <div class="flex flex-col gap-3 sm:gap-4">
        <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <p class="mb-3 font-medium text-highlighted">ข้อมูลรายการ</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField label="ชื่อรายการ" required>
              <UInput v-model="activeItem.name" class="w-full" placeholder="เช่น เสื้อ, กางเกงยีนส์" />
            </UFormField>
            <UFormField label="ประเภท / หมวดหมู่">
              <USelect
                :model-value="activeItem.categoryId ?? undefined"
                :items="(data?.categories ?? []).map(c => ({ ...c, description: c.description ?? undefined }))"
                label-key="name"
                value-key="id"
                class="w-full"
                @update:model-value="activeItem.categoryId = $event"
              />
            </UFormField>
            <UFormField label="หมายเหตุ" class="sm:col-span-2">
              <UInput
                :model-value="activeItem.description ?? undefined"
                class="w-full"
                placeholder="เช่น คิดตามขนาด, 5 บาท/ตร.ม."
                @update:model-value="activeItem.description = $event"
              />
            </UFormField>
          </div>
        </div>

        <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <p class="mb-3 font-medium text-highlighted">ราคาตามบริการ</p>
          <div class="space-y-2">
            <div
              v-for="service in data?.services"
              :key="service.id"
              class="space-y-2 rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-highlighted">{{ service.name }}</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-muted">ช่วงราคา</span>
                  <USwitch v-model="activeItemRangeEnabled[service.id]" size="xs" />
                </div>
              </div>
              <UInput
                v-if="!activeItemRangeEnabled[service.id]"
                v-model.number="activeItemPrices[service.id]"
                type="number"
                class="w-full"
                placeholder="ราคา"
              />
              <div v-else class="grid grid-cols-3 items-end gap-2">
                <UFormField label="ต่ำสุด">
                  <UInput v-model.number="activeItemPricesMin[service.id]" type="number" class="w-full" placeholder="0" @update:model-value="activeItemPrices[service.id] = activeItemPricesMin[service.id]" />
                </UFormField>
                <UFormField label="สูงสุด">
                  <UInput v-model.number="activeItemPricesMax[service.id]" type="number" class="w-full" placeholder="0" />
                </UFormField>
                <UFormField label="ราคาเริ่มต้น">
                  <UInput v-model.number="activeItemPrices[service.id]" type="number" class="w-full" placeholder="ใช้ค่าต่ำสุด" />
                </UFormField>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton label="ยกเลิก" color="neutral" variant="outline" @click="editItemModal = false" />
        <UButton
          label="บันทึก"
          icon="i-lucide-check"
          color="primary"
          :disabled="!activeItem.name"
          :loading="isProcessingItem"
          @click="saveEditItem"
        />
      </div>
    </template>
  </UModal>

  <!-- Delete Confirm -->
  <UIConfirmModal
    v-model:open="deleteItemModal"
    title="ลบรายการ"
    description="ยืนยันการลบรายการออกจากระบบ"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบรายการ"
    confirm-color="error"
    :loading="isProcessingItem"
    @confirm="confirmDeleteItem"
  >
    <template #message>
      คุณต้องการลบรายการ
      <strong class="text-highlighted">{{ activeItem.name }}</strong>
      ใช่หรือไม่?
    </template>
  </UIConfirmModal>
</template>
