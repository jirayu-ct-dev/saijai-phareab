<script setup lang="ts">
import { sub, format } from 'date-fns'
import type { Period, Range } from '~~/shared/types/dashboard'
import type { ExpenseItem, ExpenseCategory, FinanceSummary, ExpenseListResponse } from '~~/shared/types/expense'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'

definePageMeta({
  middleware: ['role-admin'],
  layout: 'admin',
})

const {
  categories,
  isLoadingCategories,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createExpense,
  updateExpense,
  deleteExpense,
  deleteExpensesBulk,
} = useExpenses()

const toast = useToast()
const route = useRoute()

// Date range state
const range = shallowRef<Range>({
  start: sub(new Date(), { days: 30 }),
  end: new Date(),
})
const period = ref<Period>('daily')

// Pagination and filter state
const page = ref(1)
const pageSize = ref(10)
const search = ref('')
const selectedCategoryId = ref<string>('all')

const isRefreshing = ref(false)

// Row Selection State (Matching admin/users pattern)
const selectedRows = ref<Record<string, boolean>>({})

const selectedRowsCount = computed(() =>
  Object.values(selectedRows.value).filter(Boolean).length
)

const selectedExpenses = computed(() =>
  (expenseData.value?.items ?? []).filter((item) => selectedRows.value[item.id])
)

const selectedTotalAmount = computed(() =>
  selectedExpenses.value.reduce((sum, item) => sum + item.amount, 0)
)

const isAllSelected = computed(() => {
  const items = expenseData.value?.items ?? []
  return items.length > 0 && items.every((item) => selectedRows.value[item.id])
})

const isSomeSelected = computed(() => {
  const items = expenseData.value?.items ?? []
  return items.some((item) => selectedRows.value[item.id]) && !isAllSelected.value
})

const toggleSelectAll = (val: boolean | 'indeterminate') => {
  const items = expenseData.value?.items ?? []
  const nextState = val === true
  const nextSelection = { ...selectedRows.value }
  items.forEach((item) => {
    nextSelection[item.id] = nextState
  })
  selectedRows.value = nextSelection
}

const toggleRowSelection = (id: string, val: boolean | 'indeterminate') => {
  selectedRows.value = {
    ...selectedRows.value,
    [id]: val === true,
  }
}

const resetSelection = () => {
  selectedRows.value = {}
}

// Fetch Finance Summary
const {
  data: summaryData,
  status: summaryStatus,
  refresh: refreshSummary,
} = useAsyncData<FinanceSummary>(
  'finance-summary',
  () =>
    $fetch('/api/admin/finance/summary', {
      query: {
        from: range.value.start.toISOString(),
        to: range.value.end.toISOString(),
      },
    }),
  {
    server: false,
    watch: [() => range.value],
    default: () => ({
      income: 0,
      expense: 0,
      net: 0,
      incomeBreakdown: {
        packageSale: 0,
        laundryOrder: 0,
        washFold: 0,
        other: 0,
      },
    }),
  }
)

// Fetch Expenses List
const {
  data: expenseData,
  status: expenseStatus,
  refresh: refreshExpenses,
} = useAsyncData<ExpenseListResponse>(
  'finance-expenses-list',
  () =>
    $fetch('/api/admin/expenses', {
      query: {
        page: page.value,
        pageSize: pageSize.value,
        search: search.value || undefined,
        categoryId: selectedCategoryId.value !== 'all' ? selectedCategoryId.value : undefined,
        from: range.value.start.toISOString(),
        to: range.value.end.toISOString(),
      },
    }),
  {
    server: false,
    watch: [() => range.value, () => page.value, () => pageSize.value, () => selectedCategoryId.value],
    default: () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      summary: { expenseTotal: 0 },
    }),
  }
)

watch([() => range.value, () => page.value, () => pageSize.value, () => selectedCategoryId.value], () => {
  resetSelection()
})

const isSummaryPending = computed(() => summaryStatus.value === 'pending')
const isExpensePending = computed(() => expenseStatus.value === 'pending')

const handleSearch = () => {
  page.value = 1
  resetSelection()
  refreshExpenses()
}

const handleRefreshAll = async () => {
  isRefreshing.value = true
  try {
    await Promise.all([refreshSummary(), refreshExpenses(), fetchCategories()])
  } finally {
    isRefreshing.value = false
  }
}

// Category filter options
const categoryFilterOptions = computed(() => [
  { label: 'ทุกหมวดหมู่รายจ่าย', value: 'all' },
  ...categories.value.map((c) => ({
    label: c.name + (!c.isActive ? ' (ปิดใช้งาน)' : ''),
    value: c.id,
  })),
])

// Category options for expense form (active categories only, or currently selected for editing)
const categoryFormOptions = computed(() =>
  categories.value
    .filter((c) => c.isActive || c.id === expenseForm.categoryId)
    .map((c) => ({
      label: c.name + (!c.isActive ? ' (ปิดใช้งาน)' : ''),
      value: c.id,
    }))
)

// Pagination Summary string
const paginationSummary = computed(() => {
  const total = expenseData.value?.total ?? 0
  if (total === 0) return 'ไม่มีรายการรายจ่าย'
  const from = (page.value - 1) * pageSize.value + 1
  const to = Math.min(page.value * pageSize.value, total)
  return `แสดง ${from}–${to} จากทั้งหมด ${total} รายการ (ยอดรวม ${formatCurrency(expenseData.value?.summary?.expenseTotal ?? 0)})`
})

// ---------------- Modal States ----------------
// Expense Modal
const isExpenseModalOpen = ref(false)
const isEditingExpense = ref(false)
const editingExpenseId = ref<string | null>(null)
const expenseSubmitting = ref(false)
const expenseForm = reactive({
  categoryId: '',
  amount: '',
  expenseAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  description: '',
})
const expenseErrors = reactive<{ categoryId?: string; amount?: string; expenseAt?: string }>({})

const openCreateExpenseModal = () => {
  isEditingExpense.value = false
  editingExpenseId.value = null
  expenseForm.categoryId = categories.value.find((c) => c.isActive)?.id || ''
  expenseForm.amount = ''
  expenseForm.expenseAt = format(new Date(), "yyyy-MM-dd'T'HH:mm")
  expenseForm.description = ''
  expenseErrors.categoryId = undefined
  expenseErrors.amount = undefined
  expenseErrors.expenseAt = undefined
  isExpenseModalOpen.value = true
}

const openEditExpenseModal = (item: ExpenseItem) => {
  isEditingExpense.value = true
  editingExpenseId.value = item.id
  expenseForm.categoryId = item.categoryId
  expenseForm.amount = String(item.amount)
  expenseForm.expenseAt = format(new Date(item.expenseAt), "yyyy-MM-dd'T'HH:mm")
  expenseForm.description = item.description || ''
  expenseErrors.categoryId = undefined
  expenseErrors.amount = undefined
  expenseErrors.expenseAt = undefined
  isExpenseModalOpen.value = true
}

const handleSubmitExpense = async () => {
  expenseErrors.categoryId = undefined
  expenseErrors.amount = undefined
  expenseErrors.expenseAt = undefined

  if (!expenseForm.categoryId) {
    expenseErrors.categoryId = 'กรุณาเลือกหมวดหมู่'
  }
  const amt = Number(expenseForm.amount)
  if (!expenseForm.amount || Number.isNaN(amt) || amt <= 0) {
    expenseErrors.amount = 'กรุณาระบุจำนวนเงินที่มากกว่า 0'
  }
  if (!expenseForm.expenseAt) {
    expenseErrors.expenseAt = 'กรุณาระบุวันที่และเวลา'
  }

  if (expenseErrors.categoryId || expenseErrors.amount || expenseErrors.expenseAt) {
    return
  }

  expenseSubmitting.value = true
  try {
    const payload = {
      categoryId: expenseForm.categoryId,
      amount: Number(expenseForm.amount),
      expenseAt: new Date(expenseForm.expenseAt).toISOString(),
      description: expenseForm.description?.trim() || null,
    }

    if (isEditingExpense.value && editingExpenseId.value) {
      await updateExpense(editingExpenseId.value, payload)
    } else {
      await createExpense(payload)
    }

    isExpenseModalOpen.value = false
    await Promise.all([refreshExpenses(), refreshSummary()])
  } catch {
    // Toast handled in composable
  } finally {
    expenseSubmitting.value = false
  }
}

// Single Delete Expense Modal
const isDeleteExpenseModalOpen = ref(false)
const deletingExpense = ref<ExpenseItem | null>(null)
const expenseDeleting = ref(false)

const openDeleteExpenseModal = (item: ExpenseItem) => {
  deletingExpense.value = item
  isDeleteExpenseModalOpen.value = true
}

const handleConfirmDeleteExpense = async () => {
  if (!deletingExpense.value) return
  expenseDeleting.value = true
  try {
    await deleteExpense(deletingExpense.value.id)
    isDeleteExpenseModalOpen.value = false
    deletingExpense.value = null
    resetSelection()
    await Promise.all([refreshExpenses(), refreshSummary()])
  } catch {
    // Toast handled in composable
  } finally {
    expenseDeleting.value = false
  }
}

// Bulk Delete Modal (Matching admin/users pattern)
const isBulkDeleteModalOpen = ref(false)
const bulkDeleting = ref(false)

const handleConfirmBulkDelete = async () => {
  const idsToDelete = Object.entries(selectedRows.value)
    .filter(([_, selected]) => selected)
    .map(([id]) => id)

  if (!idsToDelete.length) {
    isBulkDeleteModalOpen.value = false
    return
  }

  bulkDeleting.value = true
  try {
    await deleteExpensesBulk(idsToDelete)
    isBulkDeleteModalOpen.value = false
    resetSelection()
    await Promise.all([refreshExpenses(), refreshSummary()])
  } catch {
    // Toast handled in composable
  } finally {
    bulkDeleting.value = false
  }
}

// Category Management Modal
const isCategoryModalOpen = ref(false)
const newCategoryName = ref('')
const newCategorySubmitting = ref(false)
const editingCategoryId = ref<string | null>(null)
const editingCategoryName = ref('')

const handleCreateCategory = async () => {
  if (!newCategoryName.value.trim()) {
    toast.add({ title: 'กรุณาระบุชื่อหมวดหมู่', color: 'warning' })
    return
  }
  newCategorySubmitting.value = true
  try {
    await createCategory(newCategoryName.value.trim())
    newCategoryName.value = ''
  } catch {
    // Toast handled in composable
  } finally {
    newCategorySubmitting.value = false
  }
}

const startEditCategory = (cat: ExpenseCategory) => {
  editingCategoryId.value = cat.id
  editingCategoryName.value = cat.name
}

const cancelEditCategory = () => {
  editingCategoryId.value = null
  editingCategoryName.value = ''
}

const handleSaveCategoryName = async (id: string) => {
  if (!editingCategoryName.value.trim()) return
  try {
    await updateCategory(id, { name: editingCategoryName.value.trim() })
    cancelEditCategory()
  } catch {
    // Toast handled
  }
}

const handleToggleCategoryActive = async (cat: ExpenseCategory) => {
  try {
    await updateCategory(cat.id, { isActive: !cat.isActive })
  } catch {
    // Toast handled
  }
}

const handleDeleteCategory = async (cat: ExpenseCategory) => {
  try {
    await deleteCategory(cat.id)
  } catch {
    // Toast handled
  }
}

// Action items for expense rows
const getExpenseActionItems = (item: ExpenseItem) => [
  [
    {
      label: 'แก้ไขรายการ',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditExpenseModal(item),
    },
  ],
  [
    {
      label: 'ลบรายการ',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => openDeleteExpenseModal(item),
    },
  ],
]

// Initial fetch
onMounted(() => {
  fetchCategories()
  if (route.query.action === 'new-expense') {
    openCreateExpenseModal()
  }
})
</script>

<template>
  <UDashboardPanel id="finance">
    <template #header>
      <UDashboardNavbar title="รายรับ–รายจ่าย" :ui="{ right: 'gap-2 sm:gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            size="md"
            title="รีเฟรชข้อมูล"
            aria-label="รีเฟรชข้อมูล"
            :loading="isRefreshing"
            @click="handleRefreshAll"
          />
          <UButton
            icon="i-lucide-tags"
            color="neutral"
            variant="subtle"
            size="md"
            label="จัดการหมวดหมู่"
            @click="isCategoryModalOpen = true"
          />
          <UButton
            icon="i-lucide-plus"
            color="primary"
            size="md"
            label="บันทึกรายจ่าย"
            @click="openCreateExpenseModal"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <ClientOnly>
            <div class="flex flex-wrap items-center gap-2 -ms-1">
              <AdminDashboardDateRangePicker v-model="range" />
              <AdminDashboardPeriodSelect v-model="period" :range="range" />
            </div>
          </ClientOnly>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <!-- 3 Main Summary Cards -->
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <!-- Income Card -->
          <div class="min-h-28 rounded-lg border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55">
            <div class="flex items-center justify-between">
              <span class="text-xs font-normal text-muted">รายรับรวม</span>
              <div class="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring ring-inset ring-emerald-500/25 dark:text-emerald-400">
                <UIcon name="i-lucide-wallet" class="size-5" />
              </div>
            </div>
            <p class="mt-2 text-2xl font-bold text-highlighted sm:text-3xl">
              {{ isSummaryPending ? '...' : formatCurrency(summaryData?.income ?? 0) }}
            </p>
            <span class="mt-1 text-xs text-muted">จากรายการที่ชำระเงินแล้ว</span>
          </div>

          <!-- Expense Card -->
          <div class="min-h-28 rounded-lg border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55">
            <div class="flex items-center justify-between">
              <span class="text-xs font-normal text-muted">รายจ่ายรวม</span>
              <div class="flex size-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 ring ring-inset ring-amber-500/25 dark:text-amber-400">
                <UIcon name="i-lucide-receipt" class="size-5" />
              </div>
            </div>
            <p class="mt-2 text-2xl font-bold text-highlighted sm:text-3xl">
              {{ isSummaryPending ? '...' : formatCurrency(summaryData?.expense ?? 0) }}
            </p>
            <span class="mt-1 text-xs text-muted">รายจ่ายร้านค้าทั้งหมด</span>
          </div>

          <!-- Net Cashflow Card -->
          <div class="min-h-28 rounded-lg border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55">
            <div class="flex items-center justify-between">
              <span class="text-xs font-normal text-muted">ยอดสุทธิ (รายรับ - รายจ่าย)</span>
              <div
                :class="[
                  'flex size-9 items-center justify-center rounded-full ring ring-inset',
                  (summaryData?.net ?? 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-400',
                ]"
              >
                <UIcon name="i-lucide-coins" class="size-5" />
              </div>
            </div>
            <p
              class="mt-2 text-2xl font-bold sm:text-3xl"
              :class="(summaryData?.net ?? 0) >= 0 ? 'text-highlighted' : 'text-rose-600 dark:text-rose-400'"
            >
              {{ isSummaryPending ? '...' : formatCurrency(summaryData?.net ?? 0) }}
            </p>
            <span class="mt-1 text-xs text-muted">สรุปกระแสเงินสดสุทธิ</span>
          </div>
        </div>

        <!-- 4 Income Breakdown Cards -->
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">ที่มารายรับ (Income Breakdown)</h3>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div class="rounded-lg border border-default/20 bg-default/60 p-3 dark:bg-elevated/35">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-package" class="size-4 text-primary" />
                <span class="truncate text-xs text-muted">ยอดซื้อแพ็กเกจ</span>
              </div>
              <p class="mt-1.5 text-base font-semibold text-highlighted sm:text-lg">
                {{ isSummaryPending ? '...' : formatCurrency(summaryData?.incomeBreakdown.packageSale ?? 0) }}
              </p>
            </div>

            <div class="rounded-lg border border-default/20 bg-default/60 p-3 dark:bg-elevated/35">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-shirt" class="size-4 text-primary" />
                <span class="truncate text-xs text-muted">ยอดออเดอร์ผ้ารายชิ้น</span>
              </div>
              <p class="mt-1.5 text-base font-semibold text-highlighted sm:text-lg">
                {{ isSummaryPending ? '...' : formatCurrency(summaryData?.incomeBreakdown.laundryOrder ?? 0) }}
              </p>
            </div>

            <div class="rounded-lg border border-default/20 bg-default/60 p-3 dark:bg-elevated/35">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-scale" class="size-4 text-primary" />
                <span class="truncate text-xs text-muted">ยอดซัก–พับชั่งกิโล</span>
              </div>
              <p class="mt-1.5 text-base font-semibold text-highlighted sm:text-lg">
                {{ isSummaryPending ? '...' : formatCurrency(summaryData?.incomeBreakdown.washFold ?? 0) }}
              </p>
            </div>

            <div class="rounded-lg border border-default/20 bg-default/60 p-3 dark:bg-elevated/35">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-circle-dot" class="size-4 text-primary" />
                <span class="truncate text-xs text-muted">รายรับอื่น</span>
              </div>
              <p class="mt-1.5 text-base font-semibold text-highlighted sm:text-lg">
                {{ isSummaryPending ? '...' : formatCurrency(summaryData?.incomeBreakdown.other ?? 0) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Expense Table & Management Section (Styled like service-orders / users) -->
        <section class="flex flex-col gap-1 mt-1">
          <!-- Toolbar Filter Box -->
          <div class="-mx-2 rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 space-y-2 sm:mx-0 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0">
            <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-md">
              <UInput
                v-model="search"
                class="min-w-0 flex-1"
                icon="i-lucide-search"
                placeholder="ค้นหารายละเอียด หรือชื่อหมวดหมู่..."
                @keyup.enter="handleSearch"
              />
              <UButton
                color="neutral"
                variant="subtle"
                label="ค้นหา"
                @click="handleSearch"
              />

              <!-- Mobile Bulk Delete Button -->
              <UButton
                v-if="selectedRowsCount"
                label="ลบ"
                color="error"
                variant="subtle"
                icon="i-lucide-trash"
                class="shrink-0 md:hidden"
                @click="isBulkDeleteModalOpen = true"
              >
                <template #trailing>
                  <UKbd>{{ selectedRowsCount }}</UKbd>
                </template>
              </UButton>
            </div>

            <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
              <USelect
                v-model="selectedCategoryId"
                :items="categoryFilterOptions"
                value-key="value"
                class="min-w-0 sm:w-56"
              />

              <!-- Desktop Bulk Delete Button (Matching admin/users pattern) -->
              <UButton
                v-if="selectedRowsCount"
                label="ลบ"
                color="error"
                variant="subtle"
                icon="i-lucide-trash"
                class="hidden shrink-0 md:inline-flex"
                @click="isBulkDeleteModalOpen = true"
              >
                <template #trailing>
                  <UKbd>{{ selectedRowsCount }}</UKbd>
                </template>
              </UButton>

              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="subtle"
                title="รีเฟรชตาราง"
                :loading="isExpensePending"
                @click="() => refreshExpenses()"
              />
            </div>
          </div>

          <!-- Skeleton Loading -->
          <template v-if="isExpensePending">
            <!-- Mobile Skeleton -->
            <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
              <div
                v-for="i in 5"
                :key="`exp-mob-sk-${i}`"
                class="overflow-hidden border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55"
              >
                <div class="flex items-center gap-2">
                  <USkeleton class="size-4 rounded shrink-0" />
                  <div class="min-w-0 flex-1 space-y-2">
                    <div class="flex justify-between items-center">
                      <USkeleton class="h-4 w-24 rounded-full" />
                      <USkeleton class="h-4 w-20 rounded" />
                    </div>
                    <USkeleton class="h-3 w-48 rounded" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop Skeleton -->
            <div class="hidden rounded-lg border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 md:block">
              <div class="space-y-2">
                <USkeleton v-for="i in 6" :key="`exp-dt-sk-${i}`" class="h-11 w-full rounded-lg" />
              </div>
            </div>
          </template>

          <!-- Actual Content -->
          <template v-else>
            <!-- Mobile Card List -->
            <div class="md:hidden">
              <div
                v-if="!expenseData?.items?.length"
                class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30"
              >
                <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                <p class="text-sm font-medium">ไม่พบรายการรายจ่าย</p>
                <p class="mt-1 text-xs">ไม่มีรายการรายจ่ายในช่วงเวลาหรือเงื่อนไขที่เลือก</p>
                <UButton
                  icon="i-lucide-plus"
                  color="primary"
                  variant="subtle"
                  size="xs"
                  class="mt-3"
                  label="บันทึกรายจ่ายใหม่"
                  @click="openCreateExpenseModal"
                />
              </div>

              <div v-else class="-mx-2 space-y-1 sm:mx-0">
                <div
                  v-for="item in expenseData.items"
                  :key="item.id"
                  class="overflow-hidden border border-default/30 bg-default p-3 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
                >
                  <div class="flex items-center gap-2">
                    <UCheckbox
                      :model-value="!!selectedRows[item.id]"
                      aria-label="เลือกรายการ"
                      class="shrink-0"
                      @update:model-value="(val) => toggleRowSelection(item.id, val)"
                    />

                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <UBadge
                            :color="item.category.isActive ? 'primary' : 'neutral'"
                            variant="subtle"
                            size="xs"
                          >
                            {{ item.category.name }}
                          </UBadge>
                          <span class="ml-2 text-xs text-muted">{{ formatDateTime(item.expenseAt) }}</span>
                        </div>
                        <span class="text-base font-bold tabular-nums text-highlighted">{{ formatCurrency(item.amount) }}</span>
                      </div>

                      <p v-if="item.description" class="mt-2 text-sm text-highlighted">
                        {{ item.description }}
                      </p>

                      <div class="mt-3 flex items-center justify-between border-t border-default/20 pt-2 text-xs text-muted">
                        <span>ผู้บันทึก: {{ item.createdBy.name || item.createdBy.email }}</span>
                        <div class="flex items-center gap-1">
                          <UButton
                            icon="i-lucide-pencil"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            aria-label="แก้ไข"
                            @click="openEditExpenseModal(item)"
                          />
                          <UButton
                            icon="i-lucide-trash-2"
                            color="error"
                            variant="ghost"
                            size="xs"
                            aria-label="ลบ"
                            @click="openDeleteExpenseModal(item)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop Table (Matching service-orders and users style) -->
            <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
              <div v-if="!expenseData?.items?.length" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-10 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
                <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-60" />
                <p class="text-sm font-medium">ไม่พบรายการรายจ่าย</p>
                <p class="mt-1 text-xs">ไม่มีรายการรายจ่ายในช่วงเวลาหรือเงื่อนไขที่เลือก</p>
                <UButton
                  icon="i-lucide-plus"
                  color="primary"
                  variant="subtle"
                  size="sm"
                  class="mt-3"
                  label="บันทึกรายจ่ายแรก"
                  @click="openCreateExpenseModal"
                />
              </div>

              <div v-else class="relative overflow-x-auto">
                <table class="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                  <thead class="sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80">
                    <tr>
                      <!-- Select All Checkbox Column -->
                      <th class="w-12 border-b border-default bg-default py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        <UCheckbox
                          :model-value="isSomeSelected ? 'indeterminate' : isAllSelected"
                          aria-label="เลือกทั้งหมด"
                          @update:model-value="toggleSelectAll"
                        />
                      </th>
                      <th class="w-40 border-b border-default bg-default py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        วันที่
                      </th>
                      <th class="w-48 border-b border-default bg-default py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        หมวดหมู่
                      </th>
                      <th class="border-b border-default bg-default py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        รายละเอียด
                      </th>
                      <th class="w-36 border-b border-default bg-default py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        จำนวนเงิน
                      </th>
                      <th class="w-44 border-b border-default bg-default py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        ผู้บันทึก
                      </th>
                      <th class="w-24 border-b border-default bg-default py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default/20 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45">
                    <tr
                      v-for="item in expenseData.items"
                      :key="item.id"
                      class="transition-colors"
                      :class="selectedRows[item.id] ? 'bg-primary/5 dark:bg-elevated/60' : ''"
                    >
                      <!-- Row Checkbox Column -->
                      <td class="border-b border-default py-2.5 px-3 dark:border-default/25">
                        <UCheckbox
                          :model-value="!!selectedRows[item.id]"
                          aria-label="เลือกรายการ"
                          @update:model-value="(val) => toggleRowSelection(item.id, val)"
                        />
                      </td>
                      <td class="whitespace-nowrap border-b border-default py-2.5 px-3 text-xs text-muted dark:border-default/25">
                        {{ formatDateTime(item.expenseAt) }}
                      </td>
                      <td class="border-b border-default py-2.5 px-3 dark:border-default/25">
                        <UBadge
                          :color="item.category.isActive ? 'primary' : 'neutral'"
                          variant="subtle"
                          size="xs"
                        >
                          {{ item.category.name }}
                        </UBadge>
                      </td>
                      <td class="truncate border-b border-default py-2.5 px-3 text-highlighted dark:border-default/25">
                        {{ item.description || '-' }}
                      </td>
                      <td class="whitespace-nowrap border-b border-default py-2.5 px-3 text-right font-semibold tabular-nums text-highlighted dark:border-default/25">
                        {{ formatCurrency(item.amount) }}
                      </td>
                      <td class="truncate border-b border-default py-2.5 px-3 text-xs text-muted dark:border-default/25">
                        {{ item.createdBy.name || item.createdBy.email }}
                      </td>
                      <td class="whitespace-nowrap border-b border-default py-2.5 px-3 text-right dark:border-default/25">
                        <UDropdownMenu :items="getExpenseActionItems(item)" :content="{ align: 'end' }">
                          <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" aria-label="เมนูเพิ่มเติม" />
                        </UDropdownMenu>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <!-- Table Footer Pagination -->
          <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-3">
            <div class="text-sm text-muted">
              <template v-if="isExpensePending">
                <span class="inline-flex items-center gap-2">
                  <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
                  กำลังโหลด...
                </span>
              </template>
              <template v-else>{{ paginationSummary }}</template>
            </div>

            <UPagination
              v-if="!isExpensePending && (expenseData?.total ?? 0) > pageSize"
              v-model:page="page"
              :items-per-page="pageSize"
              :total="expenseData?.total ?? 0"
              size="sm"
            />
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create/Edit Expense Modal -->
  <UModal
    v-model:open="isExpenseModalOpen"
    :title="isEditingExpense ? 'แก้ไขรายการรายจ่าย' : 'บันทึกรายจ่ายใหม่'"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <form class="flex flex-col gap-4" @submit.prevent="handleSubmitExpense">
        <UFormField label="หมวดหมู่รายจ่าย" required :error="expenseErrors.categoryId">
          <USelect
            v-model="expenseForm.categoryId"
            :items="categoryFormOptions"
            value-key="value"
            placeholder="-- เลือกหมวดหมู่ --"
            class="w-full"
          />
        </UFormField>

        <UFormField label="จำนวนเงิน (บาท)" required :error="expenseErrors.amount">
          <UInput
            v-model="expenseForm.amount"
            type="number"
            step="any"
            min="0.01"
            placeholder="0.00"
            class="w-full"
          />
        </UFormField>

        <UFormField label="วันที่และเวลา" required :error="expenseErrors.expenseAt">
          <UInput
            v-model="expenseForm.expenseAt"
            type="datetime-local"
            class="w-full"
          />
        </UFormField>

        <UFormField label="รายละเอียดเพิ่มเติม">
          <UTextarea
            v-model="expenseForm.description"
            placeholder="ระบุรายละเอียด (ถ้ามี)..."
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="mt-2 flex justify-end gap-2">
          <UButton
            label="ยกเลิก"
            color="neutral"
            variant="ghost"
            @click="isExpenseModalOpen = false"
          />
          <UButton
            type="submit"
            label="บันทึก"
            color="primary"
            :loading="expenseSubmitting"
          />
        </div>
      </form>
    </template>
  </UModal>

  <!-- Single Delete Expense Confirmation Modal -->
  <UModal
    v-model:open="isDeleteExpenseModalOpen"
    title="ยืนยันการลบรายการรายจ่าย"
    :ui="{ content: 'max-w-sm' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          คุณต้องการลบรายการรายจ่ายจำนวน
          <strong class="text-highlighted">{{ formatCurrency(deletingExpense?.amount ?? 0) }}</strong>
          ({{ deletingExpense?.category.name }}) ใช่หรือไม่?
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="ยกเลิก"
            color="neutral"
            variant="ghost"
            @click="isDeleteExpenseModalOpen = false"
          />
          <UButton
            label="ยืนยันการลบ"
            color="error"
            :loading="expenseDeleting"
            @click="handleConfirmDeleteExpense"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Bulk Delete Confirmation Modal (Matching admin/users pattern) -->
  <UModal
    v-model:open="isBulkDeleteModalOpen"
    title="ยืนยันการลบรายการรายจ่ายที่เลือก"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          คุณต้องการลบรายการรายจ่ายที่เลือกทั้งหมด
          <strong class="text-highlighted">{{ selectedRowsCount }}</strong> รายการ
          (ยอดรวม <strong class="text-highlighted">{{ formatCurrency(selectedTotalAmount) }}</strong>)
          ใช่หรือไม่?
        </p>

        <div class="max-h-48 overflow-y-auto divide-y divide-default/20 rounded border border-default/20 p-2 text-xs">
          <div
            v-for="item in selectedExpenses"
            :key="item.id"
            class="flex items-center justify-between py-1.5 px-1"
          >
            <div class="min-w-0 flex-1 truncate pr-2">
              <span class="font-medium text-highlighted">[{{ item.category.name }}]</span>
              <span class="text-muted ml-1">{{ item.description || '-' }}</span>
            </div>
            <span class="font-bold tabular-nums text-highlighted shrink-0">{{ formatCurrency(item.amount) }}</span>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="ยกเลิก"
            color="neutral"
            variant="ghost"
            @click="isBulkDeleteModalOpen = false"
          />
          <UButton
            label="ยืนยันการลบทั้งหมด"
            color="error"
            :loading="bulkDeleting"
            @click="handleConfirmBulkDelete"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Manage Categories Modal -->
  <UModal
    v-model:open="isCategoryModalOpen"
    title="จัดการหมวดหมู่รายจ่าย"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Add Category Form -->
        <div class="flex items-center gap-2">
          <UInput
            v-model="newCategoryName"
            placeholder="เพิ่มหมวดหมู่ใหม่..."
            class="flex-1"
            @keyup.enter="handleCreateCategory"
          />
          <UButton
            label="เพิ่มหมวดหมู่"
            icon="i-lucide-plus"
            color="primary"
            :loading="newCategorySubmitting"
            @click="handleCreateCategory"
          />
        </div>

        <!-- Categories List -->
        <div class="max-h-80 overflow-y-auto divide-y divide-default/20 rounded-md border border-default/20 p-2">
          <div v-if="isLoadingCategories" class="space-y-2 py-2">
            <USkeleton v-for="i in 3" :key="i" class="h-10 w-full rounded" />
          </div>

          <div
            v-else-if="!categories.length"
            class="py-6 text-center text-xs text-muted"
          >
            ยังไม่มีหมวดหมู่รายจ่ายในระบบ
          </div>

          <div
            v-for="cat in categories"
            v-else
            :key="cat.id"
            class="flex items-center justify-between py-2.5 px-2"
          >
            <!-- Name Editing Mode -->
            <div v-if="editingCategoryId === cat.id" class="flex flex-1 items-center gap-2 mr-2">
              <UInput
                v-model="editingCategoryName"
                size="sm"
                class="flex-1"
                @keyup.enter="handleSaveCategoryName(cat.id)"
              />
              <UButton
                icon="i-lucide-check"
                color="primary"
                size="xs"
                @click="handleSaveCategoryName(cat.id)"
              />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="cancelEditCategory"
              />
            </div>

            <!-- Normal Display Mode -->
            <div v-else class="flex items-center gap-2">
              <span class="text-sm font-medium" :class="cat.isActive ? 'text-highlighted' : 'text-muted line-through'">
                {{ cat.name }}
              </span>
              <UBadge v-if="!cat.isActive" color="neutral" variant="subtle" size="xs">ปิดใช้งาน</UBadge>
              <span v-if="cat.expensesCount" class="text-xs text-muted">({{ cat.expensesCount }} รายการ)</span>
            </div>

            <!-- Actions -->
            <div v-if="editingCategoryId !== cat.id" class="flex items-center gap-1.5">
              <UButton
                :icon="cat.isActive ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :color="cat.isActive ? 'neutral' : 'success'"
                variant="ghost"
                size="xs"
                :title="cat.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'"
                @click="handleToggleCategoryActive(cat)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                title="เปลี่ยนชื่อ"
                @click="startEditCategory(cat)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                title="ลบหมวดหมู่"
                @click="handleDeleteCategory(cat)"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <UButton
            label="ปิด"
            color="neutral"
            variant="subtle"
            @click="isCategoryModalOpen = false"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
