<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
    data: any
    loading: boolean
}>()
const emit = defineEmits(['refresh', 'delete-item', 'update-item', 'update-price'])

const search = ref('')
const selected = ref([])
const filterCategory = ref('all')
const categoryOptions = computed(() => [
    { id: 'all', name: 'ทุกประเภท' },
    ...(props.data?.categories || [])
])

// Quick lookup for prices
const getPrice = (itemId: string, serviceId: string) => {
    return props.data?.prices?.find((p: any) => p.storefrontItemId === itemId && p.storefrontServiceId === serviceId)
}

// Convert data to table rows
const tableData = computed(() => {
    if (!props.data?.items) return []
    
    let result = props.data.items.map((item: any, index: number) => {
        const category = props.data?.categories?.find((c: any) => c.id === item.categoryId)
        const row: any = { 
            ...item, 
            index: index + 1,
            categoryName: category ? category.name : '-'
        }
        
        // attach prices for dynamic columns
        props.data.services?.forEach((service: any) => {
            const priceObj = getPrice(item.id, service.id)
            row[`service_${service.id}`] = priceObj ? priceObj.price : null
        })
        
        return row
    })
    
    // search filter
    if (search.value) {
        const q = search.value.toLowerCase()
        result = result.filter((r: any) => r.name.toLowerCase().includes(q))
    }
    
    // category filter
    if (filterCategory.value && filterCategory.value !== 'all') {
        result = result.filter((r: any) => r.categoryId === filterCategory.value)
    }
    
    return result
})

// Build dynamic columns for UTable
const columns = computed(() => {
    const cols: any[] = [
        { accessorKey: 'index', header: 'ลำดับ', sortable: true, cell: ({ row }: any) => row.getValue('index') },
        { accessorKey: 'name', header: 'รายการ', sortable: true },
        { accessorKey: 'categoryName', header: 'ประเภท', sortable: true }
    ]
    
    props.data?.services?.forEach((service: any) => {
        cols.push({
            accessorKey: `service_${service.id}`,
            header: `${service.name} (บาท)`,
            sortable: true
        })
    })
    
    cols.push({ accessorKey: 'description', header: 'หมายเหตุ', sortable: true })
    cols.push({ accessorKey: 'actions', header: '' })
    
    return cols
})

// ----------------------------------------------------
// Edit / Delete Item
// ----------------------------------------------------
const editItemModal = ref(false)
const deleteItemModal = ref(false)
const isProcessingItem = ref(false)
const activeItem = ref<any>({ id: '', name: '', categoryId: '', description: '' })
const activeItemPrices = ref<Record<string, number | string | undefined>>({})

const openEditItem = (itemRow: any) => {
    activeItem.value = { 
       id: itemRow.id, 
       name: itemRow.name, 
       categoryId: itemRow.categoryId || 'c1',
       description: itemRow.description || ''
    }
    
    activeItemPrices.value = {}
    props.data?.services?.forEach((s: any) => {
       activeItemPrices.value[s.id] = itemRow[`service_${s.id}`] ?? undefined
    })
    
    editItemModal.value = true
}

const openDeleteItem = (itemRow: any) => {
    activeItem.value = { id: itemRow.id, name: itemRow.name, categoryId: itemRow.categoryId || 'c1' }
    deleteItemModal.value = true
}

const saveEditItem = async () => {
    try {
        isProcessingItem.value = true
        // 1. Update item information
        await $fetch('/api/admin/pricing/item', {
            method: 'PUT',
            body: {
                id: activeItem.value.id,
                name: activeItem.value.name,
                categoryId: activeItem.value.categoryId,
                description: activeItem.value.description
            }
        })
        
        // 2. Update prices
        if (props.data?.services) {
            for (const service of props.data.services) {
                const newPrice = activeItemPrices.value[service.id]
                if (newPrice !== null && newPrice !== undefined && newPrice !== '') {
                    await $fetch('/api/admin/pricing/price', {
                        method: 'PUT',
                        body: {
                            storefrontItemId: activeItem.value.id,
                            storefrontServiceId: service.id,
                            price: Number(newPrice)
                        }
                    })
                }
            }
        }
        
        editItemModal.value = false
        emit('update-item', { 
            id: activeItem.value.id, 
            name: activeItem.value.name, 
            categoryId: activeItem.value.categoryId,
            description: activeItem.value.description
        })
        if (props.data?.services) {
            for (const service of props.data.services) {
                const newPrice = activeItemPrices.value[service.id]
                if (newPrice !== null && newPrice !== undefined && newPrice !== '') {
                    emit('update-price', { itemId: activeItem.value.id, serviceId: service.id, price: Number(newPrice) })
                }
            }
        }
        emit('refresh')
    } catch(err) {
        console.error(err)
    } finally {
        isProcessingItem.value = false
    }
}

const confirmDeleteItem = async () => {
    try {
        isProcessingItem.value = true
        await $fetch('/api/admin/pricing/item', {
            method: 'DELETE',
            body: {
                id: activeItem.value.id
            }
        })
        deleteItemModal.value = false
        emit('delete-item', activeItem.value.id)
        emit('refresh')
    } catch(err) {
        console.error(err)
    } finally {
        isProcessingItem.value = false
    }
}

const getDropdownItems = (row: any) => {
    return [
        [
            { label: 'แก้ไขข้อมูล', icon: 'i-lucide-pencil', onSelect: () => openEditItem(row) },
            { label: 'ลบรายการ', icon: 'i-lucide-trash', color: 'error', onSelect: () => openDeleteItem(row) }
        ]
    ]
}

</script>

<template>
  <div class="flex flex-col gap-4">
      
      <!-- Toolbox Header: Search & Columns -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 pt-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="ค้นหารายการ..."
          size="sm"
          class="w-full sm:w-64"
        />
        <USelect
          v-model="filterCategory"
          :items="categoryOptions"
          label-key="name"
          value-key="id"
          icon="i-lucide-filter"
          class="w-full sm:w-48 hidden sm:flex"
        />
      </div>

      <div v-if="loading" class="p-4 space-y-4">
         <USkeleton class="h-10 w-full" />
         <USkeleton class="h-64 w-full" />
      </div>

      <!-- Main UTable component -->
      <div v-else class="px-4 pb-4">
          <UTable
              v-model="selected"
              :data="tableData"
              :columns="columns"
              class="w-full"
              :ui="{
                  base: 'table-fixed border-separate border-spacing-0',
                  thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
                  tbody: '[&>tr]:last:[&>td]:border-b-0',
                  th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r font-medium text-muted-foreground whitespace-nowrap',
                  td: 'border-b border-default'
              }"
          >
              <template #index-cell="{ row }">
                 <span class="text-muted-foreground">{{ row.getValue('index') }}</span>
              </template>

              <!-- Cell for Name: include icon -->
              <template #name-cell="{ row }">
                 <div class="flex items-center gap-2 font-medium cursor-pointer hover:text-primary transition-colors" @click="openEditItem(row.original)">
                     <UIcon name="i-lucide-shirt" class="text-primary size-5 opacity-80" />
                     <span>{{ row.getValue('name') }}</span>
                 </div>
              </template>

              <!-- Cell for Category -->
              <template #categoryName-cell="{ row }">
                 <UBadge variant="subtle" color="primary">{{ row.getValue('categoryName') }}</UBadge>
              </template>

              <!-- Dynamic Service Columns loop for cells -->
              <template v-for="service in data?.services" :key="service.id" #[`service_${service.id}-cell`]="{ row }">
                  <span v-if="row.getValue(`service_${service.id}`) !== null && row.getValue(`service_${service.id}`) !== undefined" class="text-primary font-medium text-base">
                      ฿{{ row.getValue(`service_${service.id}`) }}
                  </span>
                  <span v-else class="text-muted opacity-50">-</span>
              </template>

              <template #description-cell="{ row }">
                  <span class="text-muted-foreground truncate block max-w-[200px]" :title="row.getValue('description')">
                     {{ row.getValue('description') || '-' }}
                  </span>
              </template>

              <template #actions-cell="{ row }">
                  <div class="flex justify-end">
                      <UDropdownMenu :items="getDropdownItems(row.original)">
                          <UButton icon="i-lucide-more-vertical" color="neutral" variant="ghost" size="sm" />
                      </UDropdownMenu>
                  </div>
              </template>

          </UTable>
      </div>

      <!-- Modals -->

      <!-- Edit Item Modal -->
      <UModal v-model:open="editItemModal" title="แก้ไขรายการ" :description="`แก้ไขราคา ${activeItem.name}`">
         <template #body>
            <div class="space-y-4">
               
               <UFormField label="ชื่อรายการ" required>
                  <UInput v-model="activeItem.name" class="w-full" />
               </UFormField>

               <UFormField label="ประเภท / หมวดหมู่">
                  <USelect v-model="activeItem.categoryId" :items="data?.categories || []" label-key="name" value-key="id" class="w-full" />
               </UFormField>
               
               <!-- Price Grid -->
               <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <UFormField v-for="service in data?.services" :key="service.id" :label="service.name">
                       <UInput type="number" v-model.number="activeItemPrices[service.id]" class="w-full" placeholder="-" />
                   </UFormField>
               </div>
               
               <!-- Note -->
               <UFormField label="หมายเหตุ">
                  <UInput v-model="activeItem.description" class="w-full" placeholder="เช่น คิดตามขนาด, 5 บาท/ตร.ม." />
               </UFormField>
               
            </div>
         </template>
         <template #footer>
            <div class="flex justify-end gap-3 w-full">
               <UButton label="ยกเลิก" variant="outline" color="neutral" @click="editItemModal = false" />
               <UButton label="บันทึก" color="primary" icon="i-lucide-check" :disabled="!activeItem.name" :loading="isProcessingItem" @click="saveEditItem" />
            </div>
         </template>
      </UModal>

      <!-- Delete Item Modal -->
      <UModal v-model:open="deleteItemModal" title="ลบรายการซัก" :description="`คุณแน่ใจหรือไม่ว่าต้องการลบ '${activeItem.name}'?`">
         <template #body>
             <p class="text-sm text-error mb-2">คำเตือน: การลบรายการนี้จะทำให้ข้อมูลราคาที่ตั้งค่าไว้ถูกซ่อนและยกเลิกไปด้วย</p>
         </template>
         <template #footer>
            <div class="flex justify-end gap-3 w-full">
               <UButton label="ยกเลิก" variant="outline" color="neutral" @click="deleteItemModal = false" />
               <UButton label="ยืนยันการลบ" color="error" :loading="isProcessingItem" @click="confirmDeleteItem" />
            </div>
         </template>
      </UModal>
  </div>
</template>
