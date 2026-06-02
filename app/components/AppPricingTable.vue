<script setup lang="ts">
import { computed, h } from 'vue'

const { data: pricingData, pending, error } = useFetch<any>('/api/public/pricing')

// services as columns
const columns = computed(() => {
  if (!pricingData.value?.services) return []
  return [
    { 
      accessorKey: 'item', 
      header: 'รายการผ้า',
      cell: ({ row }: any) => h('span', { class: 'font-medium text-[#1a2b4c] dark:text-gray-200' }, row.getValue('item'))
    },
    ...pricingData.value.services.map((s: any) => ({
      accessorKey: s.id,
      header: s.name
    }))
  ] as any[]
})

// items as rows
const rows = computed(() => {
  if (!pricingData.value?.items || !pricingData.value?.prices) return []
  
  return pricingData.value.items.map((item: any) => {
    const row: any = {
      id: item.id,
      item: item.name
    }
    
    // Fill in prices for each service
    pricingData.value.services.forEach((service: any) => {
      const priceRecord = pricingData.value.prices.find(
        (p: any) => p.storefrontItemId === item.id && p.storefrontServiceId === service.id
      )
      
      if (!priceRecord) {
        row[service.id] = '-'
        return
      }

      const { price, priceMin, priceMax } = priceRecord
      if (priceMin != null && priceMax != null && priceMin !== priceMax) {
        row[service.id] = `${Number(priceMin).toLocaleString()} - ${Number(priceMax).toLocaleString()} ฿`
      } else {
        row[service.id] = `${Number(price).toLocaleString()} ฿`
      }
    })
    
    return row
  })
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-8 w-[250px]" />
      <div class="space-y-2">
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-10 w-full" />
      </div>
    </div>
    
    <div v-else-if="error" class="text-center py-8 text-red-500">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>เกิดข้อผิดพลาดในการโหลดข้อมูลราคา</p>
    </div>
    
    <div v-else-if="rows.length === 0" class="text-center py-8 text-gray-500">
      ไม่พบข้อมูลราคา
    </div>
    
    <div v-else class="overflow-hidden">
      <UTable 
        :columns="columns" 
        :data="rows"
        class="w-full"
        :ui="{
          thead: 'bg-gray-50 dark:bg-gray-800/70',
          th: 'py-3.5 px-5 font-semibold text-[#1a2b4c] dark:text-gray-200 text-sm border-b border-gray-200 dark:border-gray-700 text-left',
          td: 'py-3.5 px-5 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800/60 transition-colors'
        }"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center py-8 text-gray-500">
            <UIcon name="i-lucide-search" class="w-12 h-12 mb-2 opacity-50" />
            <span>ไม่พบรายการ</span>
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
