<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { TableColumn } from '@nuxt/ui'
import type { AdminUser, CreateAdminUserBody, UpdateAdminUserBody } from '~~/app/composables/useAdminUsers'
import type { Role } from '~~/shared/types/enums'
import { cycleColumnSorting } from '~~/shared/utils/table'
import { randomPassword } from '~~/shared/utils/random'
import { formatDate } from '~~/shared/utils/format'

definePageMeta({
  layout: 'admin',
  middleware: ['role-admin']
})

const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIButtonChatLine = resolveComponent('UIButtonChatLine')
const UPopover = resolveComponent('UPopover')

const notify = useNotify()
const { users, isLoading, refresh, createUser, updateUser, deleteUser, toggleActive } = useAdminUsers()

const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const showSkeleton = computed(() => !hydrated.value || isLoading.value)

type RoleFilter = Role | 'all'
type VerificationFilter = 'all' | 'verified' | 'pending'
type PackageFilterValue = 'all' | 'none' | string
type TableRow<T> = { original: T; toggleSelected: (value: boolean) => void }

type ColumnApi = {
  id: string
  getCanHide: () => boolean
  getIsVisible: () => boolean
  toggleVisibility: (value: boolean) => void
}

type TableApi = {
  getFilteredSelectedRowModel: () => { rows: TableRow<AdminUser>[] }
  getFilteredRowModel: () => { rows: TableRow<AdminUser>[] }
  getRowModel: () => { rows: TableRow<AdminUser>[] }
  resetRowSelection: () => void
  getAllColumns: () => ColumnApi[]
  getState: () => { pagination: { pageIndex: number; pageSize: number } }
  setPageIndex: (pageIndex: number) => void
}

type TableInstance = { tableApi?: TableApi }

const table = useTemplateRef<TableInstance>('table')
const columnVisibility = ref<Record<string, boolean>>({})
const rowSelection = ref<Record<string, boolean>>({})
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const ROLE_BADGE_MAP: Record<Role, { color: 'neutral' | 'info' | 'warning'; label: string }> = {
  USER: { color: 'neutral', label: 'ผู้ใช้งาน' },
  EMPLOYEE: { color: 'info', label: 'พนักงาน' },
  ADMIN: { color: 'warning', label: 'แอดมิน' }
}

const EMAIL_STATUS_BADGE_MAP = {
  verified: { color: 'success' as const, label: 'ยืนยันแล้ว' },
  pending: { color: 'neutral' as const, label: 'รอยืนยัน' }
}

const roleFilter = ref<RoleFilter>('all')
const verificationFilter = ref<VerificationFilter>('all')
const packageFilter = ref<PackageFilterValue>('all')
const searchQuery = ref('')
const showDeleteModal = ref(false)

const ROLE_FILTER_OPTIONS = [
  { label: 'ทุกสิทธิ์', value: 'all' },
  { label: 'ผู้ใช้งาน', value: 'USER' },
  { label: 'พนักงาน', value: 'EMPLOYEE' },
  { label: 'แอดมิน', value: 'ADMIN' }
]

const EMAIL_VERIFICATION_OPTIONS = [
  { label: 'ทุกสถานะอีเมล', value: 'all' },
  { label: 'ยืนยันแล้ว', value: 'verified' },
  { label: 'รอยืนยัน', value: 'pending' }
]

const formatDateShort = (value: string | Date) => formatDate(value)

const getAvatarProps = (user: AdminUser) => ({
  as: { img: 'img' },
  src: user.image || '',
  alt: user.name || user.email || 'ผู้ใช้งาน',
  loading: 'lazy' as const
})

const getCurrentPackages = (user: AdminUser) => user.memberEntitlements ?? []

const packageFilterOptions = computed(() => {
  const source = users.value ?? []
  const seen = new Set<string>()
  const packageItems: Array<{ label: string; value: string }> = []

  for (const user of source) {
    for (const entitlement of getCurrentPackages(user)) {
      const pkg = entitlement.product
      if (!pkg || seen.has(pkg.id)) continue
      seen.add(pkg.id)
      packageItems.push({ label: pkg.name, value: pkg.id })
    }
  }

  return [
    { label: 'ทุกแพ็กเกจ', value: 'all' },
    { label: 'ไม่มีแพ็กเกจที่ใช้งาน', value: 'none' },
    ...packageItems
  ]
})

const filteredUsers = computed<AdminUser[]>(() => {
  const source = users.value ?? []
  const keyword = searchQuery.value.trim().toLowerCase()

  return source.filter((user) => {
    const currentPackages = getCurrentPackages(user)
    const matchKeyword = keyword
      ? [user.name ?? '', isInternalCustomerEmail(user.email) ? '' : user.email, user.phoneNumber ?? '', ...currentPackages.map((entitlement) => entitlement.product.name)]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      : true

    const matchRole = roleFilter.value === 'all' ? true : user.role === roleFilter.value
    const matchEmail = verificationFilter.value === 'all'
      ? true
      : verificationFilter.value === 'verified'
        ? user.emailVerified
        : !user.emailVerified
    const matchPackage = packageFilter.value === 'all'
      ? true
      : packageFilter.value === 'none'
        ? currentPackages.length === 0
        : currentPackages.some((entitlement) => entitlement.product.id === packageFilter.value)

    return matchKeyword && matchRole && matchEmail && matchPackage
  })
})

const selectedRows = computed<TableRow<AdminUser>[]>(() => table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [])
const selectedUsers = computed<AdminUser[]>(() => 
  selectedRows.value.map((row) => row.original)
)
const selectedRowsCount = computed(() => selectedUsers.value.length)
const filteredRowCount = computed(() => table.value?.tableApi?.getFilteredRowModel().rows.length ?? filteredUsers.value.length)
const paginatedUsers = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize
  return filteredUsers.value.slice(start, start + pagination.value.pageSize)
})

const getMobileRowId = (index: number) => String(pagination.value.pageIndex * pagination.value.pageSize + index)
const isMobileRowSelected = (index: number) => Boolean(rowSelection.value[getMobileRowId(index)])
const setMobileRowSelected = (index: number, value: boolean | 'indeterminate') => {
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

watch(selectedRowsCount, (count) => {
  if (!count) {
    showDeleteModal.value = false
  }
})

const resetFilters = () => {
  searchQuery.value = ''
  roleFilter.value = 'all'
  verificationFilter.value = 'all'
  packageFilter.value = 'all'
}

const handleRefresh = async () => {
  await refresh()
  resetFilters()
}

const handleUsersRemoved = async (removedUsers: AdminUser[]) => {
  const usersToDelete = removedUsers
  if (!usersToDelete.length) {
    showDeleteModal.value = false
    return
  }

  if (usersToDelete.length === 1) {
    await deleteUser(usersToDelete[0]!.id)
    table.value?.tableApi?.resetRowSelection()
    showDeleteModal.value = false
    return
  }

  try {
    await Promise.all(usersToDelete.map((u) =>
      $fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' }),
    ))
    await refresh()
    notify.deleted(`${usersToDelete.length} ผู้ใช้งาน`)
  } catch (error: unknown) {
    const message = error && typeof error === 'object' && 'data' in error
      ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || 'ไม่สามารถลบบางรายการได้')
      : 'ไม่สามารถลบบางรายการได้'
    notify.error(message)
    await refresh()
  }

  table.value?.tableApi?.resetRowSelection()
  showDeleteModal.value = false
}

const handleUserDeselected = (user: AdminUser) => {
  const rows = table.value?.tableApi?.getRowModel().rows ?? []
  const rowIndex = rows.findIndex((row) => row.original.id === user.id)
  if (rowIndex >= 0) {
    rows[rowIndex]?.toggleSelected(false)
  }
}

const isSingleDeleteOpen = ref(false)
const isSingleDeleting = ref(false)
const deletingUser = ref<AdminUser | null>(null)

const openSingleDeleteModal = (user: AdminUser) => {
  deletingUser.value = user
  isSingleDeleteOpen.value = true
}

const confirmSingleDelete = async () => {
  if (!deletingUser.value) return
  isSingleDeleting.value = true
  await handleUsersRemoved([deletingUser.value])
  isSingleDeleting.value = false
  isSingleDeleteOpen.value = false
  deletingUser.value = null
}

const showAddUserModal = ref(false)
const isCreatingUser = ref(false)
const newUserForm = reactive({
  name: '',
  email: '',
  password: '',
  role: 'USER' as Role
})

const resetNewUserForm = () => {
  newUserForm.name = ''
  newUserForm.email = ''
  newUserForm.password = ''
  newUserForm.role = 'USER'
}

watch(showAddUserModal, (open) => {
  if (!open) {
    resetNewUserForm()
  }
})

const showPassword = ref(false)

const openCreateModal = () => {
  showPassword.value = false
  showAddUserModal.value = true
}

const handleGeneratePassword = () => {
  newUserForm.password = randomPassword(12, { symbols: false })
}

const handleCopyPassword = async () => {
  if (!newUserForm.password) {
    notify.warning('กรุณาสร้างรหัสผ่านก่อน')
    return
  }

  await navigator.clipboard.writeText(newUserForm.password)
  notify.success('คัดลอกรหัสผ่านแล้ว')
}

const handleCreateUser = async () => {
  if (!newUserForm.name.trim() || !newUserForm.email.trim() || !newUserForm.password) {
    notify.validationError('กรุณากรอกข้อมูลให้ครบ')
    return
  }

  isCreatingUser.value = true
  const ok = await createUser({
    name: newUserForm.name.trim(),
    email: newUserForm.email.trim(),
    password: newUserForm.password,
    role: newUserForm.role
  })

  isCreatingUser.value = false
  if (ok) {
    showAddUserModal.value = false
    resetNewUserForm()
  }
}

const tableQuickRoleOpenMap = ref<Record<string, boolean>>({})
const mobileQuickRoleOpenMap = ref<Record<string, boolean>>({})
const roleItems = [
  { label: 'ผู้ใช้งาน', value: 'USER' as Role },
  { label: 'พนักงาน', value: 'EMPLOYEE' as Role },
  { label: 'แอดมิน', value: 'ADMIN' as Role }
]

const handleQuickRoleChange = async (user: AdminUser, role: Role) => {
  tableQuickRoleOpenMap.value[user.id] = false
  mobileQuickRoleOpenMap.value[user.id] = false
  await updateUser(user.id, { role } as CreateAdminUserBody)
}

const isFormOpen = ref(false)
const isSubmitting = ref(false)
const editingUser = ref<AdminUser | null>(null)
const form = reactive({
  name: '',
  email: '',
  phoneNumber: '',
  role: 'USER' as Role,
  emailVerified: false
})

const openEditModal = (user: AdminUser) => {
  editingUser.value = user
  form.name = user.name ?? ''
  form.email = isInternalCustomerEmail(user.email) ? '' : (user.email ?? '')
  form.phoneNumber = user.phoneNumber ?? ''
  form.role = user.role
  form.emailVerified = user.emailVerified
  isFormOpen.value = true
}

const saveUser = async () => {
  if (!editingUser.value) return
  const email = form.email?.trim().toLowerCase() || ''
  if (!email && editingUser.value?.customerAccountStatus !== 'OFFLINE') {
    notify.validationError('กรุณากรอกอีเมล')
    return
  }

  isSubmitting.value = true
  const payload: UpdateAdminUserBody = {
    name: form.name.trim() || null,
    phoneNumber: form.phoneNumber.trim() || null,
    role: form.role,
    emailVerified: form.emailVerified
  }
  if (email && email !== editingUser.value?.email?.toLowerCase()) payload.email = email

  const ok = await updateUser(editingUser.value.id, payload)

  isSubmitting.value = false
  if (ok) {
    isFormOpen.value = false
  }
}

const getUserActionItems = (user: AdminUser): Array<Array<Record<string, unknown>>> => {
  const items: Array<Array<Record<string, unknown>>> = [
    [
      { label: 'แก้ไขผู้ใช้งาน', icon: 'i-lucide-pencil', onSelect: () => openEditModal(user) }
    ],
  ]

  if (user.role === 'EMPLOYEE' || user.role === 'ADMIN') {
    items.push([
      {
        label: user.isActive ? 'พักงาน' : 'เปิดใช้งาน',
        icon: user.isActive ? 'i-lucide-user-x' : 'i-lucide-user-check',
        onSelect: () => toggleActive(user)
      }
    ])
  }

  items.push([
    {
      label: 'ลบผู้ใช้งาน',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openSingleDeleteModal(user)
    }
  ])

  return items
}

const columns: TableColumn<AdminUser>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h('div', h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'เลือกทั้งหมด'
      })),
    cell: ({ row }) => {
      return h('div', h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => {
          row.toggleSelected(!!value)
        },
        ariaLabel: 'เลือกแถว'
      }))
    }
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down' : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'

      return h(UButton, {
        label: 'ลูกค้า',
        color: 'neutral',
        variant: 'ghost',
        class: '-mx-2.5',
        icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }) => {
      const user = row.original
      return h(
        'a',
        { href: `/admin/users/${user.id}`, class: 'flex items-center gap-3 hover:opacity-75 transition-opacity' },
        [
          h(UAvatar, getAvatarProps(user)),
          h('div', { class: 'w-44 space-y-1 sm:w-60' }, [
            h('p', { class: 'truncate font-medium text-highlighted' }, user.name || '-'),
            h('div', { class: 'flex flex-wrap items-center gap-1.5' }, [
              h('p', { class: 'truncate text-sm text-muted' }, customerEmailLabel(user.email)),
              user.customerAccountStatus === 'OFFLINE'
                ? h(UBadge, { color: 'warning', variant: 'subtle', size: 'xs' }, () => 'ยังไม่เปิดใช้งาน')
                : null,
            ])
          ])
        ]
      )
    }
  },
  {
    accessorKey: 'role',
    header: 'สิทธิ์',
    cell: ({ row }) => {
      const user = row.original
      const badge = ROLE_BADGE_MAP[user.role]

      return h(
        UPopover,
        {
          open: tableQuickRoleOpenMap.value[user.id] ?? false,
          'onUpdate:open': (v: boolean) => { tableQuickRoleOpenMap.value[user.id] = v },
          content: { align: 'start' }
        },
        {
          default: () => h(UBadge, { color: badge.color, variant: 'subtle', icon: 'i-lucide-pencil', class: 'cursor-pointer' }, () => badge.label),
          content: () => h('div', { class: 'p-1 space-y-0.5' },
            roleItems.map((item) =>
              h(UButton, {
                label: item.label,
                color: item.value === user.role ? 'primary' : 'neutral',
                variant: item.value === user.role ? 'subtle' : 'ghost',
                size: 'xs',
                class: 'w-full justify-start',
                onClick: () => handleQuickRoleChange(user, item.value)
              })
            )
          )
        }
      )
    }
  },
  {
    accessorKey: 'isActive',
    header: 'สถานะ',
    cell: ({ row }) => {
      const user = row.original
      if (user.role === 'USER') return null

      return h('div', { class: 'flex items-center gap-1.5' }, [
        h(UBadge, {
          color: user.isActive ? 'success' : 'warning',
          variant: 'subtle',
          size: 'xs',
        }, () => user.isActive ? 'ใช้งาน' : 'พักงาน'),
      ])
    }
  },
  {
    accessorKey: 'phoneNumber',
    header: 'เบอร์โทร',
    cell: ({ row }) => {
      const user = row.original
      if (!user.phoneNumber) return h('span', { class: 'text-muted' }, '-')
      return h('a', { href: `/admin/users/${user.id}`, class: 'hover:underline' }, user.phoneNumber)
    }
  },
  {
    accessorKey: 'memberEntitlements',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const icon = !isSorted ? 'i-lucide-arrow-up-down' : isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'

      return h(UButton, {
        label: 'แพ็กเกจปัจจุบัน',
        color: 'neutral',
        variant: 'ghost',
        class: '-mx-2.5',
        icon,
        onClick: () => cycleColumnSorting(column)
      })
    },
    cell: ({ row }) => {
      const user = row.original
      const currentPackages = getCurrentPackages(user)

      if (!currentPackages.length) {
        return h('span', { class: 'text-sm text-muted' }, 'ไม่มีแพ็กเกจที่ใช้งาน')
      }

      const visiblePackages = currentPackages.slice(0, 2)
      const remainingCount = currentPackages.length - visiblePackages.length

      return h('div', { class: 'max-w-72 space-x-2 flex' }, [
        ...visiblePackages.map((entitlement) => h('p', { class: 'truncate font-medium text-highlighted' }, entitlement.product.name),
        ),
        ...(remainingCount > 0 ? [h('p', { class: 'text-xs text-muted' }, `+ อีก ${remainingCount} แพ็กเกจ`)] : [])
      ])
    }
  },
  {
    accessorKey: 'emailVerified',
    header: 'อีเมล',
    cell: ({ row }) => {
      const user = row.original
      if (user.customerAccountStatus === 'OFFLINE') {
        return h('a', { href: `/admin/users/${user.id}`, class: 'hover:opacity-75 transition-opacity' },
          h(UBadge, { variant: 'subtle', color: 'warning' }, () => 'ยังไม่เปิดใช้งาน')
        )
      }
      const status = user.emailVerified ? 'verified' : 'pending'
      const badge = EMAIL_STATUS_BADGE_MAP[status]
      return h('a', { href: `/admin/users/${user.id}`, class: 'hover:opacity-75 transition-opacity' },
        h(UBadge, { variant: 'subtle', color: badge.color }, () => badge.label)
      )
    }
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const user = row.original

      const detailButton = h(UButton, {
        icon: 'i-lucide-eye',
        size: 'xs',
        color: 'neutral',
        variant: 'ghost',
        title: 'ดูรายละเอียดลูกค้า',
        to: `/admin/users/${user.id}`
      })

      const menuButton = h(UButton, {
        icon: 'i-lucide-ellipsis',
        size: 'xs',
        color: 'neutral',
        variant: 'ghost',
        title: 'เมนูเพิ่มเติม'
      })

      const chatLineButton = user.lineUserId
        ? h(UIButtonChatLine, {
            lineUserId: user.lineUserId,
            size: 'xs',
            iconOnly: true
          })
        : null

      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        detailButton,
        chatLineButton,
        h(
          UDropdownMenu,
          { items: getUserActionItems(user), content: { align: 'end' } },
          { default: () => menuButton }
        )
      ])
    }
  }
]
</script>

<template>
  <div class="contents">
  <UDashboardPanel id="users">
    <template #header>
      <UDashboardNavbar title="จัดการลูกค้าและผู้ใช้งาน" icon="i-lucide-users">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <UButton
            label="เพิ่มผู้ใช้งาน"
            icon="i-lucide-user-plus"
            color="primary"
            class="shrink-0"
            aria-label="เพิ่มผู้ใช้งาน"
            :ui="{ label: 'hidden sm:inline' }"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <section class="flex flex-col gap-1">
        <div class="-mx-2 rounded-lg border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 space-y-2 sm:mx-0 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0">
          <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
            <UInput
              v-model="searchQuery"
              class="min-w-0 flex-1"
              icon="i-lucide-search"
              placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือแพ็กเกจ"
            />
            <UButton
              v-if="selectedRowsCount"
              label="ลบ"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              class="shrink-0 md:hidden"
              @click="showDeleteModal = true"
            >
              <template #trailing>
                <UKbd>{{ selectedRowsCount }}</UKbd>
              </template>
            </UButton>
            <UIButtonRefresh class="shrink-0 md:hidden" :loading="isLoading" @refresh="handleRefresh" />
          </div>

          <div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
            <USelect
              v-model="roleFilter"
              :items="ROLE_FILTER_OPTIONS"
              value-key="value"
              class="min-w-0 sm:w-36"
            />
            <USelect
              v-model="packageFilter"
              :items="packageFilterOptions"
              value-key="value"
              class="min-w-0 sm:w-44"
            />
            <USelect
              v-model="verificationFilter"
              :items="EMAIL_VERIFICATION_OPTIONS"
              value-key="value"
              class="min-w-0 sm:w-40"
            />
            <UButton
              v-if="selectedRowsCount"
              label="ลบ"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              class="hidden shrink-0 md:inline-flex"
              @click="showDeleteModal = true"
            >
              <template #trailing>
                <UKbd>{{ selectedRowsCount }}</UKbd>
              </template>
            </UButton>
            <UIButtonRefresh class="hidden shrink-0 md:inline-flex" :loading="isLoading" @refresh="handleRefresh" />
          </div>
        </div>

        <UModal
          v-model:open="showDeleteModal"
          title="ลบผู้ใช้งานที่เลือก"
          :description="`ยืนยันการลบผู้ใช้งาน ${selectedRowsCount} รายการ`"
        >
          <template #body>
            <div v-if="selectedUsers.length" class="max-h-72 space-y-3 overflow-auto pr-1">
              <div
                v-for="user in selectedUsers"
                :key="user.id"
                class="flex items-center gap-3"
              >
                <UAvatar v-bind="getAvatarProps(user)" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-highlighted">
                    {{ user.name || '-' }}
                  </p>
                  <p class="truncate text-sm text-muted">
                    {{ customerEmailLabel(user.email) }}
                  </p>
                </div>
                <UButton
                  icon="i-lucide-x"
                  variant="ghost"
                  size="xs"
                  color="neutral"
                  @click="handleUserDeselected(user)"
                />
              </div>
            </div>
            <p v-else class="py-6 text-center text-sm text-muted">
              ยังไม่มีผู้ใช้งานที่เลือก
            </p>
          </template>

          <template #footer>
            <div class="flex w-full justify-end gap-3">
              <UButton
                label="ยกเลิก"
                color="neutral"
                variant="outline"
                @click="showDeleteModal = false"
              />
              <UButton
                label="ลบ"
                color="error"
                :disabled="!selectedRowsCount"
                @click="handleUsersRemoved([...selectedUsers])"
              />
            </div>
          </template>
        </UModal>

        <template v-if="showSkeleton">
          <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
            <div
              v-for="i in 5"
              :key="`u-mob-sk-${i}`"
              class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
            >
              <div class="flex items-center gap-2 p-2">
                <USkeleton class="size-4 rounded-lg shrink-0" />
                <USkeleton class="size-8 rounded-full shrink-0" />
                <div class="min-w-0 flex-1 space-y-1.5">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1 space-y-1">
                      <USkeleton class="h-3.5 w-32 rounded-lg" />
                      <USkeleton class="h-2.5 w-40 rounded-lg" />
                    </div>
                    <div class="flex shrink-0 flex-col items-end gap-1">
                      <USkeleton class="h-4 w-14 rounded-full" />
                      <USkeleton class="h-4 w-16 rounded-full" />
                    </div>
                  </div>
                  <USkeleton class="h-2.5 w-3/4 rounded-lg" />
                  <div class="flex items-center justify-end gap-1">
                    <USkeleton class="size-5 rounded-lg" />
                    <USkeleton class="size-5 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="hidden rounded-lg border border-default/30 bg-default p-4 p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
            <div class="space-y-2 p-3">
              <USkeleton v-for="i in 8" :key="`u-dt-sk-${i}`" class="h-12 w-full rounded-lg" />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="md:hidden">
            <div v-if="isLoading" class="-mx-2 space-y-1 sm:mx-0">
              <USkeleton v-for="i in 5" :key="i" class="h-24 w-full rounded-lg" />
            </div>

            <div v-else-if="!paginatedUsers.length" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
              <UIcon name="i-lucide-users" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบผู้ใช้งาน</p>
            </div>

            <div v-else class="-mx-2 space-y-1 sm:mx-0">
              <div
                v-for="(user, index) in paginatedUsers"
                :key="user.id"
                class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
              >
                <div class="flex items-center gap-2 p-2">
                  <UCheckbox
                    :model-value="isMobileRowSelected(index)"
                    aria-label="เลือกผู้ใช้งาน"
                    class="shrink-0"
                    @update:model-value="setMobileRowSelected(index, $event)"
                  />
                  <NuxtLink :to="`/admin/users/${user.id}`" class="shrink-0">
                    <UAvatar v-bind="getAvatarProps(user)" size="sm" />
                  </NuxtLink>

                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <NuxtLink :to="`/admin/users/${user.id}`" class="block max-w-full truncate text-sm font-medium text-highlighted hover:underline">
                          {{ user.name || '-' }}
                          <span class="text-[11px] font-normal text-muted">· {{ user.phoneNumber || ROLE_BADGE_MAP[user.role].label }}</span>
                        </NuxtLink>
                        <NuxtLink :to="`/admin/users/${user.id}`" class="block max-w-full truncate text-[11px] text-muted hover:underline">
                          {{ customerEmailLabel(user.email) }}
                        </NuxtLink>
                      </div>

                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <UPopover
                          v-model:open="mobileQuickRoleOpenMap[user.id]"
                          :content="{ align: 'end' }"
                        >
                          <UBadge
                            :color="ROLE_BADGE_MAP[user.role].color"
                            variant="subtle"
                            size="xs"
                            icon="i-lucide-pencil"
                            class="cursor-pointer"
                          >
                            {{ ROLE_BADGE_MAP[user.role].label }}
                          </UBadge>

                          <template #content>
                            <div class="space-y-0.5 p-1">
                              <UButton
                                v-for="item in roleItems"
                                :key="item.value"
                                :label="item.label"
                                :color="item.value === user.role ? 'primary' : 'neutral'"
                                :variant="item.value === user.role ? 'subtle' : 'ghost'"
                                size="xs"
                                class="w-full justify-start"
                                @click="handleQuickRoleChange(user, item.value)"
                              />
                            </div>
                          </template>
                        </UPopover>
                        <UBadge
                          variant="subtle"
                          size="xs"
                          :color="user.customerAccountStatus === 'OFFLINE' ? 'warning' : EMAIL_STATUS_BADGE_MAP[user.emailVerified ? 'verified' : 'pending'].color"
                        >
                          {{ user.customerAccountStatus === 'OFFLINE' ? 'ยังไม่เปิดใช้งาน' : EMAIL_STATUS_BADGE_MAP[user.emailVerified ? 'verified' : 'pending'].label }}
                        </UBadge>
                        <UBadge
                          v-if="user.role === 'EMPLOYEE' || user.role === 'ADMIN'"
                          variant="subtle"
                          size="xs"
                          :color="user.isActive ? 'success' : 'warning'"
                        >
                          {{ user.isActive ? 'ใช้งาน' : 'พักงาน' }}
                        </UBadge>
                      </div>
                    </div>

                    <div class="mt-1 min-w-0">
                      <p v-if="getCurrentPackages(user).length" class="truncate text-xs text-highlighted">
                        {{ getCurrentPackages(user)[0]?.product.name }}<span v-if="getCurrentPackages(user).length > 1"> + อีก {{ getCurrentPackages(user).length - 1 }} แพ็กเกจ</span>
                      </p>
                      <p v-else class="truncate text-xs text-muted">ไม่มีแพ็กเกจที่ใช้งาน</p>
                    </div>

                    <div class="mt-1 flex items-center justify-between gap-2">
                      <div class="min-w-0 truncate text-[11px] text-muted">
                        สมัคร {{ formatDateShort(user.createdAt) }}
                      </div>
                      <div class="flex shrink-0 items-center justify-end gap-1">
                        <UIButtonChatLine
                          v-if="user.lineUserId"
                          :line-user-id="user.lineUserId"
                          size="xs"
                          icon-only
                        />
                        <UDropdownMenu :items="getUserActionItems(user)" :content="{ align: 'end' }">
                          <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" aria-label="เมนูเพิ่มเติม" />
                        </UDropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default p-4 p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
            <UTable
              ref="table"
              v-model:column-visibility="columnVisibility"
              v-model:row-selection="rowSelection"
              v-model:pagination="pagination"
              :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
              :data="filteredUsers"
              :columns="columns"
              :loading="isLoading"
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
                <div v-if="isLoading" class="space-y-2 p-3">
                  <USkeleton v-for="i in 6" :key="`u-tbl-${i}`" class="h-12 w-full rounded-lg" />
                </div>
                <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
                  <UIcon name="i-lucide-users" class="mb-3 size-10 opacity-60" />
                  <p>ไม่พบผู้ใช้งาน</p>
                </div>
              </template>
            </UTable>
          </div>
        </template>
        </section>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            <template v-if="showSkeleton">
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
                กำลังโหลด...
              </span>
            </template>
            <template v-else>เลือก {{ selectedRowsCount }} จาก {{ filteredRowCount }} แถวทั้งหมด</template>
          </div>

          <div class="flex items-center gap-1.5">
            <UPagination
              v-if="!showSkeleton"
              :page="pagination.pageIndex + 1"
              :items-per-page="pagination.pageSize"
              :total="filteredRowCount"
              @update:page="(page: number) => { pagination = { ...pagination, pageIndex: page - 1 } }"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="showAddUserModal"
    title="เพิ่มผู้ใช้งานใหม่"
    description="สร้างบัญชีสำหรับลูกค้าหรือพนักงานในระบบ"
  >
    <template #body>
      <UForm :state="newUserForm" class="space-y-4">
        <UFormField name="name" label="ชื่อผู้ใช้งาน" required>
          <UInput
            v-model="newUserForm.name"
            placeholder="เช่น สมชาย ใจดี"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField name="email" label="อีเมล" required>
          <UInput
            v-model="newUserForm.email"
            type="email"
            placeholder="someone@example.com"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField name="password" label="รหัสผ่าน" :ui="{ label: 'w-full' }">
          <template #label>
            <div class="flex w-full items-center justify-between gap-2">
              <span class="text-sm font-medium text-highlighted">
                รหัสผ่าน <span class="text-error">*</span>
              </span>
              <div class="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-primary">
                <UButton
                  label="สุ่มรหัสผ่าน"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-wand-2"
                  @click="handleGeneratePassword"
                />
                <UButton
                  label="คัดลอก"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-copy"
                  @click="handleCopyPassword"
                />
              </div>
            </div>
          </template>
          <UInput
            id="password"
            v-model="newUserForm.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="สร้างหรือสุ่มรหัสผ่าน"
            class="w-full"
            required
          >
            <template #trailing>
              <UButton
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="link"
                size="sm"
                :aria-label="showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField name="role" label="สิทธิ์">
          <USelect
            v-model="newUserForm.role"
            :items="ROLE_FILTER_OPTIONS.filter((item) => item.value !== 'all')"
            value-key="value"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="ยกเลิก"
          color="neutral"
          variant="outline"
          @click="showAddUserModal = false"
        />
        <UButton
          label="สร้างผู้ใช้งาน"
          icon="i-lucide-check"
          color="primary"
          :loading="isCreatingUser"
          @click="handleCreateUser"
        />
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="isFormOpen"
    title="แก้ไขผู้ใช้งาน"
    description="อัปเดตข้อมูลและสิทธิ์ของผู้ใช้งาน"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="ชื่อ">
          <UInput v-model="form.name" class="w-full" />
        </UFormField>

        <UFormField label="อีเมล" :required="editingUser?.customerAccountStatus !== 'OFFLINE'">
          <UInput v-model="form.email" type="email" class="w-full" placeholder="customer@example.com" />
          <template v-if="editingUser?.customerAccountStatus === 'OFFLINE'" #help>
            เว้นว่างเพื่อเก็บบัญชีแบบยังไม่เปิดใช้งาน หรือกรอกอีเมลจริงของลูกค้า
          </template>
        </UFormField>

        <UFormField label="เบอร์โทร">
          <UInput v-model="form.phoneNumber" class="w-full" />
        </UFormField>

        <UFormField label="สิทธิ์">
          <USelect
            v-model="form.role"
            :items="ROLE_FILTER_OPTIONS.filter((item) => item.value !== 'all')"
            value-key="value"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="ยกเลิก"
          color="neutral"
          variant="outline"
          @click="isFormOpen = false"
        />
        <UButton
          label="บันทึกการแก้ไข"
          icon="i-lucide-check"
          color="primary"
          :loading="isSubmitting"
          @click="saveUser"
        />
      </div>
    </template>
  </UModal>

  <UIConfirmModal
    v-model:open="isSingleDeleteOpen"
    title="ลบผู้ใช้งาน"
    description="ยืนยันการลบผู้ใช้งานออกจากระบบ"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบผู้ใช้งาน"
    confirm-color="error"
    :loading="isSingleDeleting"
    @confirm="confirmSingleDelete"
  >
    <template #message>
      คุณต้องการลบผู้ใช้งาน
      <strong class="text-highlighted">{{ deletingUser?.name || customerEmailLabel(deletingUser?.email) }}</strong>
      ใช่หรือไม่?
    </template>
  </UIConfirmModal>
  </div>
</template>
