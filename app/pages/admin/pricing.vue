<script setup lang="ts">
import { ref } from 'vue'
import { mockServicesData, mockItemsData, mockPricesData, mockCategoriesData } from '~~/shared/data/mockPricing'

const mockServices = ref([...mockServicesData])
const mockItems = ref([...mockItemsData])
const mockPrices = ref([...mockPricesData])
const mockCategories = ref([...mockCategoriesData])

const pageData = ref({
    items: mockItems.value,
    services: mockServices.value,
    prices: mockPrices.value,
    categories: mockCategories.value
})

const pending = ref(false)

const handleUpdatePrice = (payload: { itemId: string, serviceId: string, price: number }) => {
    const existingPrice = mockPrices.value.find(p => p.storefrontItemId === payload.itemId && p.storefrontServiceId === payload.serviceId)
    if (existingPrice) {
        existingPrice.price = payload.price
    } else {
        mockPrices.value.push({
            storefrontItemId: payload.itemId,
            storefrontServiceId: payload.serviceId,
            price: payload.price
        })
    }
    pageData.value.prices = [...mockPrices.value]
}

const handleUpdateItem = (payload: { id: string, name: string, categoryId: string }) => {
    const item = mockItems.value.find(i => i.id === payload.id)
    if (item) {
        item.name = payload.name
        item.categoryId = payload.categoryId
    }
    pageData.value.items = [...mockItems.value]
}

const handleDeleteItem = (id: string) => {
    mockItems.value = mockItems.value.filter(i => i.id !== id)
    pageData.value.items = [...mockItems.value]
}

// -----------------------------------------------------------------
// Add Item Modal
// -----------------------------------------------------------------
const isAddItemModalOpen = ref(false)
const isSavingItem = ref(false)
const newItemData = ref({ name: '', categoryId: 'c1', description: '' })
const newItemPrices = ref<Record<string, number | string | undefined>>({})

const saveNewItem = async () => {
    if (!newItemData.value.name) return

    try {
        isSavingItem.value = true
        
        let createdItemId = 'mock-' + Date.now()
        
        // 1. Create item via API
        try {
            const createdItem = await $fetch<any>('/api/admin/pricing/item', {
                method: 'POST',
                body: {
                    name: newItemData.value.name,
                    categoryId: newItemData.value.categoryId,
                    description: newItemData.value.description
                }
            })
            if (createdItem && createdItem.id) {
                createdItemId = createdItem.id
            }
        } catch(e) {
            console.error(e)
        }
        
        // 2. Add prices via API
        if (pageData.value.services) {
            for (const service of pageData.value.services) {
                const newPrice = newItemPrices.value[service.id]
                if (newPrice !== null && newPrice !== undefined && newPrice !== '') {
                    try {
                        await $fetch('/api/admin/pricing/price', {
                            method: 'PUT',
                            body: {
                                storefrontItemId: createdItemId,
                                storefrontServiceId: service.id,
                                price: Number(newPrice)
                            }
                        })
                    } catch(e) {
                        console.error(e)
                    }
                }
            }
        }

        // Local UI mock update
        mockItems.value.push({
            id: createdItemId,
            name: newItemData.value.name,
            categoryId: newItemData.value.categoryId,
            description: newItemData.value.description
        } as any)
        
        if (pageData.value.services) {
            for (const service of pageData.value.services) {
                const newPrice = newItemPrices.value[service.id]
                if (newPrice !== null && newPrice !== undefined && newPrice !== '') {
                    mockPrices.value.push({
                        storefrontItemId: createdItemId,
                        storefrontServiceId: service.id,
                        price: Number(newPrice)
                    })
                }
            }
        }

        pageData.value.items = [...mockItems.value]
        pageData.value.prices = [...mockPrices.value]
        
        isAddItemModalOpen.value = false
        newItemData.value = { name: '', categoryId: 'c1', description: '' }
        newItemPrices.value = {}
    } catch (err) {
        console.error(err)
    } finally {
        isSavingItem.value = false
    }
}
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar title="ราคาหน้าร้าน" icon="i-lucide-tags">
                <template #leading>
                    <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
                </template>
                <template #right>
                    <UButton
                        label="เพิ่มรายการ"
                        icon="i-lucide-plus"
                        color="primary"
                        @click="isAddItemModalOpen = true"
                    />
                </template>
            </UDashboardNavbar>
        </template>
        
        <template #body>
            <AdminPricingTable 
                :data="pageData" 
                :loading="pending" 
                @update-price="handleUpdatePrice"
                @update-item="handleUpdateItem"
                @delete-item="handleDeleteItem"
            />
        </template>
    </UDashboardPanel>

    <!-- Add Item Modal -->
    <UModal v-model:open="isAddItemModalOpen" title="เพิ่มรายการซักใหม่">
        <template #body>
            <div class="space-y-4">
               <UFormField label="ชื่อรายการ" required>
                  <UInput v-model="newItemData.name" class="w-full" />
               </UFormField>
               
               <UFormField label="ประเภท / หมวดหมู่">
                  <USelect v-model="newItemData.categoryId" :items="pageData.categories" label-key="name" value-key="id" class="w-full" />
               </UFormField>

               <!-- Price Grid -->
               <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <UFormField v-for="service in pageData.services" :key="service.id" :label="service.name">
                       <UInput type="number" v-model.number="newItemPrices[service.id]" class="w-full" placeholder="-" />
                   </UFormField>
               </div>
               
               <!-- Note -->
               <UFormField label="หมายเหตุ">
                  <UInput v-model="newItemData.description" class="w-full" placeholder="เช่น คิดตามขนาด, 5 บาท/ตร.ม." />
               </UFormField>
            </div>
        </template>
        <template #footer>
            <div class="flex justify-end gap-3 w-full">
                <UButton label="ยกเลิก" variant="outline" color="neutral" @click="isAddItemModalOpen = false" />
                <UButton label="บันทึก" color="primary" :loading="isSavingItem" :disabled="!newItemData.name" @click="saveNewItem" />
            </div>
        </template>
    </UModal>
</template>
