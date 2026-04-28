<script setup lang="ts">
import { h, resolveComponent, ref, computed, watch } from 'vue'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { TableColumn } from '@nuxt/ui'
import { cycleColumnSorting } from '~~/shared/utils/table'

const props = defineProps<{
  data: any
  loading: boolean
}>()

const emit = defineEmits(['refresh', 'delete-item', 'update-item', 'update-price'])

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UCheckbox = resolveComponent('UCheckbox')

const notify = useNotify()

type TableRow<T> = { original: T; toggleSelected: (value: boolean) => void }
type TableApi = {
  getFilteredSelectedRowModel: () => { rows: TableRow<any>[] }
  getFilteredRowModel: () => { rows: TableRow<any>[] }
  getRowModel: () => { rows: TableRow<any>[] }
  resetRowSelection: () => void
  getState: () => { pagination: { pageIndex: number; pageSize: number } }
  setPageIndex: (pageIndex: number) => void
}
type TableInstance = { tableApi?: TableApi }

const table = useTemplateRef<TableInstance>('table')
const columnVisibility = ref<Record<string, boolean>>({})
const rowSelection = ref<Record<string, boolean>>({})
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const search = ref('')
const filterCategory = ref('all')
const showBulkDeleteModal = ref(false)

const categoryOptions = computed(() => [
  { id: 'all', name: 'ทุกประเภท' },
  ...(props.data?.categories ?? [])
])

const getPrice = (itemId: string, serviceId: string) =>
  props.data?.prices?.find((p: any) => p.storefrontItemId === itemId && p.storefrontServiceId === serviceId)

const tableData = computed(() => {
  if (!props.data?.items) return []

  let result = props.data.items.map((item: any, index: number) => {
    const category = props.data?.categories?.find((c: any) => c.id === item.categoryId)
    const row: any = { ...item, index: index + 1, categoryName: category?.name ?? '-' }
    props.data.services?.forEach((service: any) => {
      const priceObj = getPrice(item.id, service.id)
      row[`service_${service.id}`] = priceObj ? Number(priceObj.price) : null
    })
    return row
  })

  const q = search.value.trim().toLowerCase()
  if (q) result = result.filter((r: any) => r.name.toLowerCase().includes(q))
  if (filterCategory.value !== 'all') result = result.filter((r: any) => r.categoryId === filterCategory.value)

  return result
})

watch([search, filterCategory, () => props.data], () => {
  table.value?.tableApi?.resetRowSelection()
  pagination.value.pageIndex = 0
})

const selectedRows = computed<TableRow<any>[]>(
  () => table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? []
)
const selectedItems = computed(() => selectedRows.value.map((r) => r.original))
const selectedCount = computed(() => selectedItems.value.length)
const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? tableData.value.length
)

watch(selectedCount, (count) => {
  if (!count) showBulkDeleteModal.value = false
})

const handleItemDeselected = (item: any) => {
  const rows = table.value?.tableApi?.getRowModel().rows ?? []
  const row = rows.find((r) => r.original.id === item.id)
  row?.toggleSelected(false)
}

// ── Edit / Delete ────────────────────────────────────────────────────────────

const editItemModal = ref(false)
const deleteItemModal = ref(false)
const isProcessingItem = ref(false)
const activeItem = ref<any>({ id: '', name: '', categoryId: '', description: '' })
const activeItemPrices = ref<Record<string, number | string | undefined>>({})

const openEditItem = (itemRow: any) => {
  activeItem.value = {
    id: itemRow.id,
    name: itemRow.name,
    categoryId: itemRow.categoryId ?? '',
    description: itemRow.description ?? ''
  }
  activeItemPrices.value = {}
  props.data?.services?.forEach((s: any) => {
    activeItemPrices.value[s.id] = itemRow[`service_${s.id}`] ?? undefined
  })
  editItemModal.value = true
}

const openDeleteItem = (itemRow: any) => {
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
        await $fetch('/api/admin/pricing/price', {
          method: 'PUT',
          body: { storefrontItemId: activeItem.value.id, storefrontServiceId: service.id, price: Number(newPrice) }
        })
        emit('update-price', { itemId: activeItem.value.id, serviceId: service.id, price: Number(newPrice) })
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
  try {
    for (const item of selectedItems.value) {
      await $fetch('/api/admin/pricing/item', { method: 'DELETE', body: { id: item.id } })
      emit('delete-item', item.id)
    }
    emit('refresh')
    table.value?.tableApi?.resetRowSelection()
    showBulkDeleteModal.value = false
    notify.success('ลบรายการที่เลือกเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isBulkDeleting.value = false
  }
}

// ── Columns ──────────────────────────────────────────────────────────────────

const columns = computed<TableColumn<any>[]>(() => {
  const serviceColumns: TableColumn<any>[] = (props.data?.services ?? []).map((service: any) => ({
    accessorKey: `service_${service.id}`,
    header: ({ column }: any) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down' : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'
      return h(UButton, {
        label: service.name,
        color: 'neutral',
        variant: 'ghost',
        class: '-mx-2.5',
        icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }: any) => {
      const price = row.getValue(`service_${service.id}`)
      if (price === null || price === undefined) return h('span', { class: 'text-muted' }, '-')
      return h('span', { class: 'font-medium text-primary' }, `฿${Number(price).toLocaleString()}`)
    }
  }))

  return [
    {
      id: 'select',
      header: ({ table }: any) =>
        h('div', h(UCheckbox, {
          modelValue: table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
          ariaLabel: 'เลือกทั้งหมด'
        })),
      cell: ({ row }: any) =>
        h('div', h(UCheckbox, {
          modelValue: row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
          ariaLabel: 'เลือกแถว'
        }))
    },
    {
      accessorKey: 'name',
      header: ({ column }: any) => {
        const isSorted = column.getIsSorted()
        const icon = !isSorted ? 'i-lucide-arrow-up-down' : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'
        return h(UButton, {
          label: 'รายการ',
          color: 'neutral',
          variant: 'ghost',
          class: '-mx-2.5',
          icon,
          onClick: () => cycleColumnSorting(column)
        })
      },
      cell: ({ row }: any) =>
        h('div', { class: 'flex items-center gap-2' }, [
          h(UIcon, { name: 'i-lucide-shirt', class: 'size-4 text-primary shrink-0 opacity-70' }),
          h('span', { class: 'font-medium text-highlighted truncate max-w-48' }, row.getValue('name'))
        ])
    },
    {
      accessorKey: 'categoryName',
      header: 'ประเภท',
      cell: ({ row }: any) =>
        h(UBadge, { variant: 'subtle', color: 'primary' }, () => row.getValue('categoryName'))
    },
    ...serviceColumns,
    {
      accessorKey: 'description',
      header: 'หมายเหตุ',
      cell: ({ row }: any) => {
        const desc = row.getValue('description')
        return h('span', { class: 'text-muted truncate block max-w-44', title: desc ?? '' }, desc || '-')
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) =>
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
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-1.5">
      <div class="w-full md:w-auto">
        <UInput
          v-model="search"
          class="w-full md:max-w-sm"
          icon="i-lucide-search"
          placeholder="ค้นหารายการ..."
        />
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <UButton
          v-if="selectedCount"
          label="ลบ"
          color="error"
          variant="subtle"
          icon="i-lucide-trash"
          @click="showBulkDeleteModal = true"
        >
          <template #trailing>
            <UKbd>{{ selectedCount }}</UKbd>
          </template>
        </UButton>

        <USelect
          v-model="filterCategory"
          :items="categoryOptions"
          label-key="name"
          value-key="id"
          class="min-w-36"
        />

        <UIButtonRefresh :loading="loading" @refresh="emit('refresh')" />
      </div>
    </div>

    <ClientOnly>
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

    <UTable
      ref="table"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      v-model:pagination="pagination"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      class="shrink-0"
      :data="tableData"
      :columns="columns"
      :loading="loading"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 font-medium first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    >
      <template #empty>
        <div class="flex flex-col items-center justify-center py-12 text-center text-muted">
          <UIcon name="i-lucide-list-x" class="mb-3 size-10 opacity-60" />
          <p>{{ search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ' }}</p>
        </div>
      </template>
    </UTable>

    <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
      <div class="text-sm text-muted">
        เลือก {{ selectedCount }} จาก {{ filteredRowCount }} แถวทั้งหมด
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

  <!-- Edit Modal -->
  <UModal
    v-model:open="editItemModal"
    title="แก้ไขรายการ"
    :description="`แก้ไขข้อมูลและราคา: ${activeItem.name}`"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="ชื่อรายการ" required>
          <UInput v-model="activeItem.name" class="w-full" placeholder="เช่น เสื้อ, กางเกงยีนส์" />
        </UFormField>

        <UFormField label="ประเภท / หมวดหมู่">
          <USelect
            v-model="activeItem.categoryId"
            :items="data?.categories ?? []"
            label-key="name"
            value-key="id"
            class="w-full"
          />
        </UFormField>

        <UFormField label="ราคาตามบริการ">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField
              v-for="service in data?.services"
              :key="service.id"
              :label="service.name"
            >
              <UInput
                v-model.number="activeItemPrices[service.id]"
                type="number"
                class="w-full"
                placeholder="-"
              />
            </UFormField>
          </div>
        </UFormField>

        <UFormField label="หมายเหตุ">
          <UInput
            v-model="activeItem.description"
            class="w-full"
            placeholder="เช่น คิดตามขนาด, 5 บาท/ตร.ม."
          />
        </UFormField>
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
