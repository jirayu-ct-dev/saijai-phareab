<script setup lang="ts">
import { ref, watch } from 'vue'

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
type PricingResponse = {
  items: PricingItem[]
  services: PricingService[]
  prices: PricingPrice[]
  categories: PricingCategory[]
}
type EditableCategory = PricingCategory
type EditableService = PricingService

definePageMeta({
  layout: 'admin',
  middleware: ['role-employee']
})

const notify = useNotify()

const { data, pending, status, refresh } = useFetch<PricingResponse>('/api/admin/pricing', {
  server: false,
  lazy: true,
})

const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const isLoading = computed(() => pending.value || status.value === 'idle')
const showSkeleton = computed(() => !hydrated.value || isLoading.value)

const mockServices = ref<PricingService[]>([])
const mockItems = ref<PricingItem[]>([])
const mockPrices = ref<PricingPrice[]>([])
const mockCategories = ref<PricingCategory[]>([])

const pageData = ref({
  items: [] as PricingItem[],
  services: [] as PricingService[],
  prices: [] as PricingPrice[],
  categories: [] as PricingCategory[]
})

watch(data, (newVal) => {
  if (newVal) {
    mockServices.value = newVal.services || []
    mockItems.value = newVal.items || []
    mockPrices.value = newVal.prices ? newVal.prices.map((p) => ({ ...p, price: Number(p.price) })) : []
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
const newItemPricesMin = ref<Record<string, number | string | undefined>>({})
const newItemPricesMax = ref<Record<string, number | string | undefined>>({})
const newItemRangeEnabled = ref<Record<string, boolean>>({})

const resetNewItemForm = () => {
  newItemData.value = { name: '', categoryId: '', description: '' }
  newItemPrices.value = {}
  newItemPricesMin.value = {}
  newItemPricesMax.value = {}
  newItemRangeEnabled.value = {}
}

watch(isAddItemModalOpen, (open) => {
  if (!open) resetNewItemForm()
})

const saveNewItem = async () => {
  if (!newItemData.value.name) return
  isSavingItem.value = true
  try {
    const created = await $fetch<PricingItem>('/api/admin/pricing/item', {
      method: 'POST',
      body: {
        name: newItemData.value.name,
        categoryId: newItemData.value.categoryId || undefined,
        description: newItemData.value.description || undefined
      }
    })

    for (const service of pageData.value.services) {
      const newPrice = newItemPrices.value[service.id]
      if (newPrice === null || newPrice === undefined || newPrice === '') continue
      const isRange = newItemRangeEnabled.value[service.id]
      const priceMin = isRange && newItemPricesMin.value[service.id] !== undefined && newItemPricesMin.value[service.id] !== ''
        ? Number(newItemPricesMin.value[service.id])
        : null
      const priceMax = isRange && newItemPricesMax.value[service.id] !== undefined && newItemPricesMax.value[service.id] !== ''
        ? Number(newItemPricesMax.value[service.id])
        : null
      await $fetch('/api/admin/pricing/price', {
        method: 'PUT',
        body: { storefrontItemId: created.id, storefrontServiceId: service.id, price: Number(newPrice), priceMin, priceMax }
      })
      mockPrices.value.push({ storefrontItemId: created.id, storefrontServiceId: service.id, price: Number(newPrice), priceMin, priceMax })
    }

    mockItems.value.push(created)
    pageData.value.items = [...mockItems.value]
    pageData.value.prices = [...mockPrices.value]
    isAddItemModalOpen.value = false
    resetNewItemForm()
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
const editingCategory = ref<EditableCategory | null>(null)

const openAddCategory = () => {
  editingCategory.value = null
  categoryForm.value = { name: '', description: '' }
}

const openEditCategory = (cat: PricingCategory) => {
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
      const updated = await $fetch<PricingCategory>('/api/admin/pricing/category', {
        method: 'PUT',
        body: { id: editingCategory.value.id, name: categoryForm.value.name, description: categoryForm.value.description || undefined }
      })
      const idx = mockCategories.value.findIndex((c) => c.id === updated.id)
      if (idx >= 0) mockCategories.value[idx] = updated
    } else {
      const created = await $fetch<PricingCategory>('/api/admin/pricing/category', {
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

const deleteCategory = async (cat: PricingCategory) => {
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
const editingService = ref<EditableService | null>(null)

const openAddService = () => {
  editingService.value = null
  serviceForm.value = { name: '', description: '' }
}

const openEditService = (svc: PricingService) => {
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
      const updated = await $fetch<PricingService>('/api/admin/pricing/service', {
        method: 'PUT',
        body: { id: editingService.value.id, name: serviceForm.value.name, description: serviceForm.value.description || undefined }
      })
      const idx = mockServices.value.findIndex((s) => s.id === updated.id)
      if (idx >= 0) mockServices.value[idx] = updated
    } else {
      const created = await $fetch<PricingService>('/api/admin/pricing/service', {
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

const deleteService = async (svc: PricingService) => {
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
  <div class="contents">
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
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <AdminPricingTable
          :data="pageData"
          :loading="isLoading"
          :show-skeleton="showSkeleton"
          @update-price="handleUpdatePrice"
          @update-item="handleUpdateItem"
          @delete-item="handleDeleteItem"
          @refresh="refresh"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Item Modal -->
  <UModal
    v-model:open="isAddItemModalOpen"
    title="เพิ่มรายการซักใหม่"
    description="กำหนดชื่อ ประเภท และราคาตามบริการ"
    :ui="{
      content: 'max-w-3xl bg-default dark:bg-default',
      body: '!p-2 sm:p-4! bg-default dark:bg-default',
      header: 'bg-default dark:bg-default',
      footer: 'bg-default dark:bg-default',
    }"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <p class="mb-3 font-medium text-highlighted">ข้อมูลรายการ</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <UFormField label="หมายเหตุ" class="sm:col-span-2">
              <UInput v-model="newItemData.description" class="w-full" placeholder="เช่น คิดตามขนาด, 5 บาท/ตร.ม." />
            </UFormField>
          </div>
        </div>

        <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <p class="mb-3 font-medium text-highlighted">ราคาตามบริการ</p>
          <div class="space-y-2">
            <div
              v-for="service in pageData.services"
              :key="service.id"
              class="space-y-2 rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-highlighted">{{ service.name }}</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-muted">ช่วงราคา</span>
                  <USwitch v-model="newItemRangeEnabled[service.id]" size="xs" />
                </div>
              </div>
              <UInput
                v-if="!newItemRangeEnabled[service.id]"
                v-model.number="newItemPrices[service.id]"
                type="number"
                class="w-full"
                placeholder="ราคา"
              />
              <div v-else class="grid grid-cols-3 items-end gap-2">
                <UFormField label="ต่ำสุด">
                  <UInput v-model.number="newItemPricesMin[service.id]" type="number" class="w-full" placeholder="0" @update:model-value="newItemPrices[service.id] = newItemPricesMin[service.id]" />
                </UFormField>
                <UFormField label="สูงสุด">
                  <UInput v-model.number="newItemPricesMax[service.id]" type="number" class="w-full" placeholder="0" />
                </UFormField>
                <UFormField label="ราคาเริ่มต้น">
                  <UInput v-model.number="newItemPrices[service.id]" type="number" class="w-full" placeholder="ใช้ค่าต่ำสุด" />
                </UFormField>
              </div>
            </div>
          </div>
        </div>
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
    :ui="{
      content: 'max-w-3xl bg-default dark:bg-default',
      body: '!p-2 sm:p-4! bg-default dark:bg-default',
      header: 'bg-default dark:bg-default',
      footer: 'bg-default dark:bg-default',
    }"
  >
    <template #body>
      <UTabs
        v-model="manageTab"
        color="neutral"
        variant="link"
        :items="[
          { label: 'ประเภทสินค้า', value: 'category', slot: 'category', icon: 'i-lucide-layers' },
          { label: 'บริการ', value: 'service', slot: 'service', icon: 'i-lucide-sparkles' }
        ]"
        :ui="{ list: '-mx-2 border border-default/30 bg-default px-3! dark:border-default/40 dark:bg-default/80 sm:mx-0 sm:rounded-lg' }"
        class="w-full"
      >
        <!-- ── Category Tab ── -->
        <template #category>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <!-- List -->
            <div class="-mx-2 space-y-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">รายการประเภท</p>
              <div v-if="pageData.categories.length" class="space-y-1">
                <div
                  v-for="cat in pageData.categories"
                  :key="cat.id"
                  class="flex items-center gap-2 border px-3 py-2 transition-colors sm:rounded-lg"
                  :class="editingCategory?.id === cat.id
                    ? 'border-primary/30 bg-primary/5 dark:border-primary/25 dark:bg-elevated/65'
                    : 'border-default/25 bg-elevated/30 hover:border-default/40 hover:bg-elevated/50 dark:border-default/15 dark:bg-elevated/25 dark:hover:bg-elevated/45'"
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
              <p v-else class="rounded-lg border border-dashed border-default/30 p-4 text-center text-sm text-muted dark:border-default/20">
                ยังไม่มีประเภทสินค้า
              </p>
            </div>

            <!-- Form -->
            <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
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
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <!-- List -->
            <div class="-mx-2 space-y-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">รายการบริการ</p>
              <div v-if="pageData.services.length" class="space-y-1">
                <div
                  v-for="svc in pageData.services"
                  :key="svc.id"
                  class="flex items-center gap-2 border px-3 py-2 transition-colors sm:rounded-lg"
                  :class="editingService?.id === svc.id
                    ? 'border-info/30 bg-info/5 dark:border-info/25 dark:bg-elevated/65'
                    : 'border-default/25 bg-elevated/30 hover:border-default/40 hover:bg-elevated/50 dark:border-default/15 dark:bg-elevated/25 dark:hover:bg-elevated/45'"
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
              <p v-else class="rounded-lg border border-dashed border-default/30 p-4 text-center text-sm text-muted dark:border-default/20">
                ยังไม่มีบริการ
              </p>
            </div>

            <!-- Form -->
            <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
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
  </div>
</template>
