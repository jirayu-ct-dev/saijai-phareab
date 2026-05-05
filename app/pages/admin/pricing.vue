<script setup lang="ts">
definePageMeta({
  middleware: ['role-employee']
})

import { ref, watch } from 'vue'

const notify = useNotify()

const { data, pending, refresh } = useFetch<any>('/api/admin/pricing')

const mockServices = ref<any[]>([])
const mockItems = ref<any[]>([])
const mockPrices = ref<any[]>([])
const mockCategories = ref<any[]>([])

const pageData = ref({
  items: [] as any[],
  services: [] as any[],
  prices: [] as any[],
  categories: [] as any[]
})

watch(data, (newVal) => {
  if (newVal) {
    mockServices.value = newVal.services || []
    mockItems.value = newVal.items || []
    mockPrices.value = newVal.prices ? newVal.prices.map((p: any) => ({ ...p, price: Number(p.price) })) : []
    mockCategories.value = newVal.categories || []
    pageData.value = {
      items: mockItems.value,
      services: mockServices.value,
      prices: mockPrices.value,
      categories: mockCategories.value
    }
  }
}, { immediate: true })

const handleUpdatePrice = (payload: { itemId: string; serviceId: string; price: number }) => {
  const existingPrice = mockPrices.value.find(
    (p) => p.storefrontItemId === payload.itemId && p.storefrontServiceId === payload.serviceId
  )
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

const handleUpdateItem = (payload: { id: string; name: string; categoryId: string }) => {
  const item = mockItems.value.find((i) => i.id === payload.id)
  if (item) Object.assign(item, payload)
  pageData.value.items = [...mockItems.value]
}

const handleDeleteItem = (id: string) => {
  mockItems.value = mockItems.value.filter((i) => i.id !== id)
  pageData.value.items = [...mockItems.value]
}

// ── Add Item ──────────────────────────────────────────────────────────────────

const isAddItemModalOpen = ref(false)
const isSavingItem = ref(false)
const newItemData = ref({ name: '', categoryId: '', description: '' })
const newItemPrices = ref<Record<string, number | string | undefined>>({})

const saveNewItem = async () => {
  if (!newItemData.value.name) return
  isSavingItem.value = true
  try {
    const created = await $fetch<any>('/api/admin/pricing/item', {
      method: 'POST',
      body: {
        name: newItemData.value.name,
        categoryId: newItemData.value.categoryId || undefined,
        description: newItemData.value.description || undefined
      }
    })

    for (const service of pageData.value.services) {
      const newPrice = newItemPrices.value[service.id]
      if (newPrice !== null && newPrice !== undefined && newPrice !== '') {
        await $fetch('/api/admin/pricing/price', {
          method: 'PUT',
          body: { storefrontItemId: created.id, storefrontServiceId: service.id, price: Number(newPrice) }
        })
        mockPrices.value.push({ storefrontItemId: created.id, storefrontServiceId: service.id, price: Number(newPrice) })
      }
    }

    mockItems.value.push(created)
    pageData.value.items = [...mockItems.value]
    pageData.value.prices = [...mockPrices.value]
    isAddItemModalOpen.value = false
    newItemData.value = { name: '', categoryId: '', description: '' }
    newItemPrices.value = {}
    notify.success('เพิ่มรายการเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isSavingItem.value = false
  }
}

// ── Manage Modal (Categories & Services) ─────────────────────────────────────

const isManageOpen = ref(false)
const manageTab = ref<'category' | 'service'>('category')

// Category
const isSavingCategory = ref(false)
const isDeletingCategoryId = ref<string | null>(null)
const categoryForm = ref({ name: '', description: '' })
const editingCategory = ref<any | null>(null)

const openAddCategory = () => {
  editingCategory.value = null
  categoryForm.value = { name: '', description: '' }
}

const openEditCategory = (cat: any) => {
  editingCategory.value = cat
  categoryForm.value = { name: cat.name, description: cat.description || '' }
}

const saveCategory = async () => {
  if (!categoryForm.value.name.trim()) {
    notify.error('กรุณากรอกชื่อประเภท')
    return
  }
  isSavingCategory.value = true
  try {
    if (editingCategory.value) {
      const updated = await $fetch<any>('/api/admin/pricing/category', {
        method: 'PUT',
        body: { id: editingCategory.value.id, name: categoryForm.value.name, description: categoryForm.value.description || undefined }
      })
      const idx = mockCategories.value.findIndex((c) => c.id === updated.id)
      if (idx >= 0) mockCategories.value[idx] = updated
    } else {
      const created = await $fetch<any>('/api/admin/pricing/category', {
        method: 'POST',
        body: { name: categoryForm.value.name, description: categoryForm.value.description || undefined }
      })
      mockCategories.value.push(created)
    }
    pageData.value.categories = [...mockCategories.value]
    openAddCategory()
    notify.success('บันทึกประเภทเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isSavingCategory.value = false
  }
}

const deleteCategory = async (cat: any) => {
  isDeletingCategoryId.value = cat.id
  try {
    await $fetch('/api/admin/pricing/category', { method: 'DELETE', body: { id: cat.id } })
    mockCategories.value = mockCategories.value.filter((c) => c.id !== cat.id)
    pageData.value.categories = [...mockCategories.value]
    if (editingCategory.value?.id === cat.id) openAddCategory()
    notify.success('ลบประเภทเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isDeletingCategoryId.value = null
  }
}

// Service
const isSavingService = ref(false)
const isDeletingServiceId = ref<string | null>(null)
const serviceForm = ref({ name: '', description: '' })
const editingService = ref<any | null>(null)

const openAddService = () => {
  editingService.value = null
  serviceForm.value = { name: '', description: '' }
}

const openEditService = (svc: any) => {
  editingService.value = svc
  serviceForm.value = { name: svc.name, description: svc.description || '' }
}

const saveService = async () => {
  if (!serviceForm.value.name.trim()) {
    notify.error('กรุณากรอกชื่อบริการ')
    return
  }
  isSavingService.value = true
  try {
    if (editingService.value) {
      const updated = await $fetch<any>('/api/admin/pricing/service', {
        method: 'PUT',
        body: { id: editingService.value.id, name: serviceForm.value.name, description: serviceForm.value.description || undefined }
      })
      const idx = mockServices.value.findIndex((s) => s.id === updated.id)
      if (idx >= 0) mockServices.value[idx] = updated
    } else {
      const created = await $fetch<any>('/api/admin/pricing/service', {
        method: 'POST',
        body: { name: serviceForm.value.name, description: serviceForm.value.description || undefined }
      })
      mockServices.value.push(created)
    }
    pageData.value.services = [...mockServices.value]
    openAddService()
    notify.success('บันทึกบริการเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isSavingService.value = false
  }
}

const deleteService = async (svc: any) => {
  isDeletingServiceId.value = svc.id
  try {
    await $fetch('/api/admin/pricing/service', { method: 'DELETE', body: { id: svc.id } })
    mockServices.value = mockServices.value.filter((s) => s.id !== svc.id)
    pageData.value.services = [...mockServices.value]
    if (editingService.value?.id === svc.id) openAddService()
    notify.success('ลบบริการเรียบร้อยแล้ว')
  } catch {
    notify.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    isDeletingServiceId.value = null
  }
}

watch(isManageOpen, (open) => {
  if (open) {
    openAddCategory()
    openAddService()
  }
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="ราคาหน้าร้าน" icon="i-lucide-tags">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="จัดการประเภท / บริการ"
              icon="i-lucide-settings-2"
              color="neutral"
              variant="outline"
              class="shrink-0"
              aria-label="จัดการประเภท / บริการ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="isManageOpen = true"
            />
            <UButton
              label="เพิ่มรายการ"
              icon="i-lucide-plus"
              color="primary"
              class="shrink-0"
              aria-label="เพิ่มรายการ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="isAddItemModalOpen = true"
            />
          </div>
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
        @refresh="refresh"
      />
    </template>
  </UDashboardPanel>

  <!-- Add Item Modal -->
  <UModal v-model:open="isAddItemModalOpen" title="เพิ่มรายการซักใหม่" description="กำหนดชื่อ ประเภท และราคาตามบริการ">
    <template #body>
      <div class="space-y-4">
        <UFormField label="ชื่อรายการ" required>
          <UInput v-model="newItemData.name" class="w-full" placeholder="เช่น เสื้อ, กางเกงยีนส์" />
        </UFormField>

        <UFormField label="ประเภท / หมวดหมู่">
          <USelect
            v-model="newItemData.categoryId"
            :items="pageData.categories"
            label-key="name"
            value-key="id"
            class="w-full"
            placeholder="เลือกประเภท"
          />
        </UFormField>

        <UFormField label="ราคาตามบริการ">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField v-for="service in pageData.services" :key="service.id" :label="service.name">
              <UInput v-model.number="newItemPrices[service.id]" type="number" class="w-full" placeholder="-" />
            </UFormField>
          </div>
        </UFormField>

        <UFormField label="หมายเหตุ">
          <UInput v-model="newItemData.description" class="w-full" placeholder="เช่น คิดตามขนาด, 5 บาท/ตร.ม." />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton label="ยกเลิก" variant="outline" color="neutral" @click="isAddItemModalOpen = false" />
        <UButton label="บันทึก" color="primary" icon="i-lucide-check" :loading="isSavingItem" :disabled="!newItemData.name" @click="saveNewItem" />
      </div>
    </template>
  </UModal>

  <!-- Manage Categories & Services Modal -->
  <UModal
    v-model:open="isManageOpen"
    title="จัดการประเภทและบริการ"
    description="เพิ่ม แก้ไข หรือลบประเภทสินค้าและประเภทบริการ"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UTabs
        v-model="manageTab"
        :items="[
          { label: 'ประเภทสินค้า', value: 'category', slot: 'category', icon: 'i-lucide-layers' },
          { label: 'บริการ', value: 'service', slot: 'service', icon: 'i-lucide-sparkles' }
        ]"
        class="w-full"
      >
        <!-- ── Category Tab ── -->
        <template #category>
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- List -->
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">รายการประเภท</p>
              <div v-if="pageData.categories.length" class="space-y-1">
                <div
                  v-for="cat in pageData.categories"
                  :key="cat.id"
                  class="flex items-center gap-2 rounded-lg border border-default px-3 py-2 transition-colors"
                  :class="editingCategory?.id === cat.id ? 'border-primary/50 bg-primary/5' : 'hover:bg-elevated/50'"
                >
                  <div class="min-w-0 flex-1 cursor-pointer" @click="openEditCategory(cat)">
                    <p class="truncate text-sm font-medium text-highlighted">{{ cat.name }}</p>
                    <p v-if="cat.description" class="truncate text-xs text-muted">{{ cat.description }}</p>
                  </div>
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    :loading="isDeletingCategoryId === cat.id"
                    @click="deleteCategory(cat)"
                  />
                </div>
              </div>
              <p v-else class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted">
                ยังไม่มีประเภทสินค้า
              </p>
            </div>

            <!-- Form -->
            <div class="space-y-3 rounded-xl border border-default p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                {{ editingCategory ? 'แก้ไขประเภท' : 'เพิ่มประเภทใหม่' }}
              </p>
              <UFormField label="ชื่อประเภท" required>
                <UInput v-model="categoryForm.name" class="w-full" placeholder="เช่น เสื้อผ้า, ผ้าปูที่นอน" />
              </UFormField>
              <UFormField label="คำอธิบาย">
                <UInput v-model="categoryForm.description" class="w-full" placeholder="ไม่บังคับ" />
              </UFormField>
              <div class="flex gap-2">
                <UButton
                  v-if="editingCategory"
                  label="ยกเลิก"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="openAddCategory"
                />
                <UButton
                  :label="editingCategory ? 'บันทึกการแก้ไข' : 'เพิ่มประเภท'"
                  :icon="editingCategory ? 'i-lucide-check' : 'i-lucide-plus'"
                  color="primary"
                  size="sm"
                  :loading="isSavingCategory"
                  @click="saveCategory"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- ── Service Tab ── -->
        <template #service>
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- List -->
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">รายการบริการ</p>
              <div v-if="pageData.services.length" class="space-y-1">
                <div
                  v-for="svc in pageData.services"
                  :key="svc.id"
                  class="flex items-center gap-2 rounded-lg border border-default px-3 py-2 transition-colors"
                  :class="editingService?.id === svc.id ? 'border-primary/50 bg-primary/5' : 'hover:bg-elevated/50'"
                >
                  <div class="min-w-0 flex-1 cursor-pointer" @click="openEditService(svc)">
                    <p class="truncate text-sm font-medium text-highlighted">{{ svc.name }}</p>
                    <p v-if="svc.description" class="truncate text-xs text-muted">{{ svc.description }}</p>
                  </div>
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    :loading="isDeletingServiceId === svc.id"
                    @click="deleteService(svc)"
                  />
                </div>
              </div>
              <p v-else class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted">
                ยังไม่มีบริการ
              </p>
            </div>

            <!-- Form -->
            <div class="space-y-3 rounded-xl border border-default p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                {{ editingService ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่' }}
              </p>
              <UFormField label="ชื่อบริการ" required>
                <UInput v-model="serviceForm.name" class="w-full" placeholder="เช่น ซักแห้ง, ซักพร้อมรีด" />
              </UFormField>
              <UFormField label="คำอธิบาย">
                <UInput v-model="serviceForm.description" class="w-full" placeholder="ไม่บังคับ" />
              </UFormField>
              <div class="flex gap-2">
                <UButton
                  v-if="editingService"
                  label="ยกเลิก"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="openAddService"
                />
                <UButton
                  :label="editingService ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ'"
                  :icon="editingService ? 'i-lucide-check' : 'i-lucide-plus'"
                  color="primary"
                  size="sm"
                  :loading="isSavingService"
                  @click="saveService"
                />
              </div>
            </div>
          </div>
        </template>
      </UTabs>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton label="ปิด" color="neutral" variant="outline" @click="isManageOpen = false" />
      </div>
    </template>
  </UModal>
</template>
