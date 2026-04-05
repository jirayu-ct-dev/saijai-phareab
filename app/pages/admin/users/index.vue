<script setup lang="ts">
definePageMeta({
  middleware: ['role-admin']
})

import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { AdminUser, AdminUserMemberEntitlement, CreateAdminUserBody } from '~~/app/composables/useAdminUsers'
import type { Role } from '~~/shared/types/enums'
import { cycleColumnSorting } from '~~/shared/utils/table'
import { randomPassword } from '~~/shared/utils/random'

const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIButtonChatLine = resolveComponent('UIButtonChatLine')

const notify = useNotify()
const { users, isLoading, refresh, createUser, updateUser, deleteUser } = useAdminUsers()

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

const shortDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok'
})

const formatDateShort = (value: string | Date) => shortDateFormatter.format(new Date(value))

const getAvatarProps = (user: AdminUser) => ({
  as: { img: 'img' },
  src: user.image || '',
  alt: user.name || user.email || 'ผู้ใช้งาน',
  loading: 'lazy' as const
})

const getCurrentPackages = (user: AdminUser) => user.memberEntitlements ?? []

const getPackageSummary = (entitlement: AdminUserMemberEntitlement) => {
  const credits = entitlement.creditRemaining ?? 0
  const expiry = entitlement.endAt ? formatDateShort(entitlement.endAt) : '-'
  return `เครดิตคงเหลือ ${credits} | หมดอายุ ${expiry}`
}

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
      ? [user.name ?? '', user.email, user.phoneNumber ?? '', ...currentPackages.map((entitlement) => entitlement.product.name)]
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
  selectedRows.value.map((row) => row.original).filter(u => u.email !== 'walkin@saijai.local')
)
const selectedRowsCount = computed(() => selectedUsers.value.length)
const filteredRowCount = computed(() => table.value?.tableApi?.getFilteredRowModel().rows.length ?? filteredUsers.value.length)

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
  const usersToDelete = removedUsers.filter(u => u.email !== 'walkin@saijai.local')
  if (!usersToDelete.length) {
    showDeleteModal.value = false
    return
  }

  for (const user of usersToDelete) {
    await deleteUser(user.id)
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
  form.email = user.email
  form.phoneNumber = user.phoneNumber ?? ''
  form.role = user.role
  form.emailVerified = user.emailVerified
  isFormOpen.value = true
}

const saveUser = async () => {
  if (!form.email.trim()) {
    notify.validationError('กรุณากรอกอีเมล')
    return
  }

  isSubmitting.value = true
  const payload: CreateAdminUserBody = {
    name: form.name.trim() || null,
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim() || null,
    role: form.role,
    emailVerified: form.emailVerified
  }

  const ok = editingUser.value
    ? await updateUser(editingUser.value.id, payload)
    : await createUser(payload)

  isSubmitting.value = false
  if (ok) {
    isFormOpen.value = false
  }
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
      const isSystemUser = row.original.email === 'walkin@saijai.local'
      return h('div', h(UCheckbox, {
        modelValue: row.getIsSelected(),
        disabled: isSystemUser,
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => {
          if (!isSystemUser) row.toggleSelected(!!value)
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
      return h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, getAvatarProps(user)),
        h('div', { class: 'w-44 space-y-1 sm:w-60' }, [
          h('p', { class: 'truncate font-medium text-highlighted' }, user.name || '-'),
          h('p', { class: 'truncate text-sm text-muted' }, user.email)
        ])
      ])
    }
  },
  {
    accessorKey: 'role',
    header: 'สิทธิ์',
    cell: ({ row }) => {
      const badge = ROLE_BADGE_MAP[row.original.role]
      return h(UBadge, { color: badge.color, variant: 'subtle' }, () => badge.label)
    }
  },
  {
    accessorKey: 'phoneNumber',
    header: 'เบอร์โทร',
    cell: ({ row }) => row.original.phoneNumber || '-'
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

      return h('div', { class: 'max-w-72 space-y-2' }, [
        ...visiblePackages.map((entitlement) =>
          h('div', { key: entitlement.id, class: 'space-y-0.5' }, [
            h('p', { class: 'truncate font-medium text-highlighted' }, entitlement.product.name),
            h('p', { class: 'truncate text-xs text-muted' }, getPackageSummary(entitlement))
          ])
        ),
        ...(remainingCount > 0 ? [h('p', { class: 'text-xs text-muted' }, `+ อีก ${remainingCount} แพ็กเกจ`)] : [])
      ])
    }
  },
  {
    accessorKey: 'emailVerified',
    header: 'อีเมล',
    cell: ({ row }) => {
      const status = row.original.emailVerified ? 'verified' : 'pending'
      const badge = EMAIL_STATUS_BADGE_MAP[status]
      return h(UBadge, { variant: 'subtle', color: badge.color }, () => badge.label)
    }
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const user = row.original

      const items: Array<Array<Record<string, unknown>>> = [
        [
          { label: 'แก้ไขผู้ใช้งาน', icon: 'i-lucide-pencil', onSelect: () => openEditModal(user) }
        ],
        [
          { 
            label: 'ลบผู้ใช้งาน', 
            icon: 'i-lucide-trash-2', 
            color: 'error', 
            onSelect: () => {
              if (user.email === 'walkin@saijai.local') {
                notify.error('ไม่สามารถลบได้เนื่องจากเป็นบัญชีของระบบ')
                return
              }
              openSingleDeleteModal(user)
            } 
          }
        ]
      ]

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
          { items, content: { align: 'end' } },
          { default: () => menuButton }
        )
      ])
    }
  }
]
</script>

<template>
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
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <div class="w-full md:w-auto">
            <UInput
              v-model="searchQuery"
              class="w-full md:max-w-sm"
              icon="i-lucide-search"
              placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือแพ็กเกจ"
            />
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <UButton
              v-if="selectedRowsCount"
              label="ลบ"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              @click="showDeleteModal = true"
            >
              <template #trailing>
                <UKbd>{{ selectedRowsCount }}</UKbd>
              </template>
            </UButton>

            <USelect
              v-model="roleFilter"
              :items="ROLE_FILTER_OPTIONS"
              value-key="value"
              class="min-w-32"
            />

            <USelect
              v-model="packageFilter"
              :items="packageFilterOptions"
              value-key="value"
              class="min-w-44"
            />

            <USelect
              v-model="verificationFilter"
              :items="EMAIL_VERIFICATION_OPTIONS"
              value-key="value"
              class="min-w-32"
            />

            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              :loading="isLoading"
              @click="handleRefresh"
            />
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
                    {{ user.email }}
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

        <UTable
          ref="table"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          class="shrink-0"
          :data="filteredUsers"
          :columns="columns"
          :loading="isLoading"
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
              <UIcon name="i-lucide-users" class="mb-3 size-10 opacity-60" />
              <p>ไม่พบผู้ใช้งาน</p>
            </div>
          </template>
        </UTable>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            เลือก {{ selectedRowsCount }} จาก {{ filteredRowCount }} แถวทั้งหมด
          </div>

          <div class="flex items-center gap-1.5">
            <UPagination
              :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
              :items-per-page="table?.tableApi?.getState().pagination.pageSize"
              :total="filteredRowCount"
              @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)"
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

        <UFormField label="อีเมล" required>
          <UInput v-model="form.email" class="w-full" />
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
      <strong class="text-highlighted">{{ deletingUser?.email }}</strong>
      ใช่หรือไม่?
    </template>
  </UIConfirmModal>
</template>
