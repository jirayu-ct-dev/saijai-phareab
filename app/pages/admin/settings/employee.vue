<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

type Employee = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "ADMIN" | "EMPLOYEE";
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  hasLineLinked: boolean;
};

type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

const notify = useNotify();
const { user: actor } = useUser();

const { data: employees, refresh, status } = await useFetch<Employee[]>("/api/admin/employees", {
  key: "admin-employees",
  default: () => [],
});
const isLoading = computed(() => status.value === "pending");

// --- Create new employee ---
const isCreateOpen = ref(false);
const createForm = reactive({ email: "", name: "", phoneNumber: "", password: "", role: "EMPLOYEE" as "ADMIN" | "EMPLOYEE" });
const isCreating = ref(false);

const resetCreate = () => {
  createForm.email = "";
  createForm.name = "";
  createForm.phoneNumber = "";
  createForm.password = "";
  createForm.role = "EMPLOYEE";
};

const onCreate = async () => {
  if (!createForm.email || !createForm.name || !createForm.password) {
    return notify.validationError("กรอกข้อมูลให้ครบถ้วน");
  }
  if (createForm.password.length < 8) {
    return notify.validationError("รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร");
  }

  isCreating.value = true;
  try {
    await $fetch("/api/admin/employees", {
      method: "POST",
      body: {
        email: createForm.email,
        name: createForm.name,
        phoneNumber: createForm.phoneNumber || null,
        password: createForm.password,
        role: createForm.role,
      },
    });
    notify.created();
    isCreateOpen.value = false;
    resetCreate();
    await refresh();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถเพิ่มพนักงานได้";
    notify.error(message);
  } finally {
    isCreating.value = false;
  }
};

// --- Promote existing user ---
const isPromoteOpen = ref(false);
const promoteSearch = ref("");
const promoteRole = ref<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
const selectedUserId = ref<string | undefined>(undefined);
const isPromoting = ref(false);

const { data: memberResults, status: memberStatus } = useFetch<MemberRow[]>("/api/admin/members", {
  query: computed(() => ({ search: promoteSearch.value, filter: "all" })),
  watch: [promoteSearch],
  default: () => [],
});
const isSearching = computed(() => memberStatus.value === "pending");

const memberSelectOptions = computed(() =>
  (memberResults.value ?? []).map((m) => ({
    label: m.name || m.email,
    value: m.id,
    email: m.email,
    image: m.image,
    name: m.name,
  }))
);

const selectedUserObj = computed(() =>
  memberSelectOptions.value.find((m) => m.value === selectedUserId.value) ?? null
);

const resetPromote = () => {
  promoteSearch.value = "";
  promoteRole.value = "EMPLOYEE";
  selectedUserId.value = undefined;
};

const onPromote = async () => {
  if (!selectedUserId.value) {
    notify.validationError("กรุณาเลือกผู้ใช้");
    return;
  }
  isPromoting.value = true;
  try {
    await $fetch("/api/admin/employees/promote", {
      method: "POST",
      body: { userId: selectedUserId.value, role: promoteRole.value },
    });
    notify.success(`เปลี่ยน "${selectedUserObj.value?.label}" เป็นพนักงานแล้ว`);
    isPromoteOpen.value = false;
    resetPromote();
    await refresh();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถเปลี่ยนสิทธิ์ได้";
    notify.error(message);
  } finally {
    isPromoting.value = false;
  }
};

// --- Role / Delete ---
const onChangeRole = async (emp: Employee, role: "ADMIN" | "EMPLOYEE") => {
  if (emp.id === actor.value?.id && role !== "ADMIN") {
    return notify.error("ห้ามลด role ของตัวเอง");
  }
  try {
    await $fetch(`/api/admin/employees/${emp.id}`, { method: "PUT", body: { role } });
    notify.updated();
    await refresh();
  } catch {
    notify.serverError();
  }
};

const isDeleteOpen = ref(false);
const deletingEmployee = ref<Employee | null>(null);
const isDeleting = ref(false);

const closeDelete = () => {
  if (isDeleting.value) return;
  isDeleteOpen.value = false;
  deletingEmployee.value = null;
};

const openDelete = (emp: Employee) => {
  if (emp.id === actor.value?.id) return notify.error("ห้ามลบบัญชีตัวเอง");
  deletingEmployee.value = emp;
  isDeleteOpen.value = true;
};

const onConfirmDelete = async () => {
  if (!deletingEmployee.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/admin/employees/${deletingEmployee.value.id}`, { method: "DELETE" });
    notify.deleted();
    isDeleteOpen.value = false;
    deletingEmployee.value = null;
    await refresh();
  } catch {
    notify.serverError();
  } finally {
    isDeleting.value = false;
  }
};

const getAvatarProps = (image: string | null, name: string | null, email: string) => ({
  as: { img: "img" as const },
  src: image || "",
  alt: name || email,
  loading: "lazy" as const,
});
const roleLabel = (r: string) => (r === "ADMIN" ? "ผู้ดูแล" : "พนักงาน");
const roleColor = (r: string): "primary" | "neutral" => (r === "ADMIN" ? "primary" : "neutral");

const formatDate = (s: string) => new Date(s).toLocaleDateString("th-TH", { dateStyle: "medium" });

// --- Toggle active status ---
const onToggleActive = async (emp: Employee) => {
  if (emp.id === actor.value?.id) return notify.error("ห้ามปิดการใช้งานบัญชีตัวเอง");
  try {
    await $fetch(`/api/admin/users/${emp.id}`, { method: "PUT", body: { isActive: !emp.isActive } });
    notify.success(`${emp.name || emp.email} ${!emp.isActive ? "กลับมาใช้งานแล้ว" : "ถูกพักการใช้งานแล้ว"}`);
    await refresh();
  } catch {
    notify.serverError();
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 flex flex-col gap-3 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-highlighted">จัดการพนักงาน</h1>
        <p class="mt-1 text-sm text-muted">เพิ่ม/ลบ และเปลี่ยน role ของพนักงานในร้าน</p>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:flex-row sm:items-center">
        <UButton
          icon="i-lucide-user-search"
          color="neutral"
          variant="outline"
          class="justify-center"
          @click="isPromoteOpen = true"
        >
          เลือกผู้ใช้ในระบบ
        </UButton>
        <UButton icon="i-lucide-plus" class="justify-center" @click="isCreateOpen = true">
          สร้างพนักงานใหม่
        </UButton>
      </div>
    </section>

    <div v-if="isLoading" class="-mx-2 space-y-1 sm:mx-0">
      <div
        v-for="i in 5"
        :key="`emp-sk-${i}`"
        class="flex items-center gap-3 border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
      >
        <USkeleton class="size-10 rounded-full shrink-0" />
        <div class="min-w-0 flex-1 space-y-1.5">
          <USkeleton class="h-3.5 w-40 rounded" />
          <USkeleton class="h-2.5 w-56 rounded" />
        </div>
        <USkeleton class="h-6 w-20 rounded-full shrink-0" />
        <USkeleton class="size-7 rounded-lg shrink-0" />
      </div>
    </div>

    <template v-else>
      <div
        v-if="!employees?.length"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30"
      >
        ยังไม่มีพนักงานในระบบ
      </div>

      <div v-else class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="emp in employees"
          :key="emp.id"
          class="flex flex-col gap-2 border border-default/30 bg-default p-2 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex min-w-0 items-center gap-3">
            <UAvatar v-bind="getAvatarProps(emp.image, emp.name, emp.email)" size="md" class="shrink-0" />

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate font-medium">{{ emp.name || emp.email }}</p>
                <UBadge :color="roleColor(emp.role)" variant="subtle" size="xs">{{ roleLabel(emp.role) }}</UBadge>
                <UBadge v-if="!emp.isActive" color="warning" variant="subtle" size="xs">พักการใช้งาน</UBadge>
                <UBadge v-if="emp.hasLineLinked" color="success" variant="subtle" size="xs" icon="i-simple-icons-line">LINE</UBadge>
              </div>
              <p class="text-xs text-muted">{{ emp.email }} · เริ่ม {{ formatDate(emp.createdAt) }}</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 sm:shrink-0">
            <div class="flex flex-col items-center gap-0.5">
              <USwitch
                :model-value="emp.isActive"
                :disabled="emp.id === actor?.id"
                @update:model-value="onToggleActive(emp)"
              />
              <span class="text-[10px] leading-none text-muted">{{ emp.isActive ? 'ใช้งาน' : 'พัก' }}</span>
            </div>
            <USelect
              :model-value="emp.role"
              :items="[
                { label: 'ผู้ดูแล', value: 'ADMIN' },
                { label: 'พนักงาน', value: 'EMPLOYEE' },
              ]"
              size="sm"
              class="w-32"
              value-key="value"
              :disabled="emp.id === actor?.id"
              @update:model-value="(v) => onChangeRole(emp, v as 'ADMIN' | 'EMPLOYEE')"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :disabled="emp.id === actor?.id"
              @click="openDelete(emp)"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Create new employee modal -->
    <UModal
      v-model:open="isCreateOpen"
      title="สร้างพนักงานใหม่"
      :ui="{ body: '!bg-default p-4! dark:!bg-elevated/55' }"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField label="ชื่อ" required>
            <UInput v-model="createForm.name" placeholder="ชื่อ-นามสกุล" class="w-full" />
          </UFormField>
          <UFormField label="อีเมล" required>
            <UInput v-model="createForm.email" type="email" placeholder="email@example.com" class="w-full" />
          </UFormField>
          <UFormField label="เบอร์โทรศัพท์">
            <UInput v-model="createForm.phoneNumber" placeholder="081-234-5678" class="w-full" />
          </UFormField>
          <UFormField label="รหัสผ่าน" required help="อย่างน้อย 8 ตัวอักษร">
            <UInput v-model="createForm.password" type="password" class="w-full" />
          </UFormField>
          <UFormField label="Role" required>
            <USelect
              v-model="createForm.role"
              :items="[
                { label: 'พนักงาน', value: 'EMPLOYEE' },
                { label: 'ผู้ดูแล', value: 'ADMIN' },
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isCreateOpen = false">ยกเลิก</UButton>
          <UButton :loading="isCreating" icon="i-lucide-user-plus" @click="onCreate">เพิ่มพนักงาน</UButton>
        </div>
      </template>
    </UModal>

    <!-- Promote existing user modal -->
    <UModal
      v-model:open="isPromoteOpen"
      title="เลือกผู้ใช้จากระบบ"
      :ui="{ content: 'max-w-md', body: '!bg-default p-4! dark:!bg-elevated/55' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="ค้นหาผู้ใช้" required>
            <USelectMenu
              v-model="selectedUserId"
              :items="memberSelectOptions"
              value-key="value"
              label-key="label"
              searchable
              :search-input="{ placeholder: 'พิมพ์ชื่อหรืออีเมล...' }"
              :loading="isSearching"
              placeholder="เลือกผู้ใช้"
              class="w-full"
              @update:search-term="promoteSearch = $event"
            >
              <template #item="{ item }">
                <div class="flex items-center gap-2">
                  <UAvatar v-bind="getAvatarProps(item.image, item.name, item.email)" size="xs" />
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ item.label }}</p>
                    <p class="truncate text-xs text-muted">{{ item.email }}</p>
                  </div>
                </div>
              </template>
              <template #empty>
                <p class="py-2 text-center text-sm text-muted">ไม่พบผู้ใช้</p>
              </template>
            </USelectMenu>
          </UFormField>

          <UFormField label="Role ที่จะมอบให้">
            <USelect
              v-model="promoteRole"
              :items="[
                { label: 'พนักงาน', value: 'EMPLOYEE' },
                { label: 'ผู้ดูแล', value: 'ADMIN' },
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isPromoteOpen = false; resetPromote()">ยกเลิก</UButton>
          <UButton :loading="isPromoting" :disabled="!selectedUserId" icon="i-lucide-shield-check" @click="onPromote">มอบสิทธิ์พนักงาน</UButton>
        </div>
      </template>
    </UModal>

    <UIConfirmModal
      v-model:open="isDeleteOpen"
      title="ยืนยันการลบพนักงาน"
      icon="i-lucide-triangle-alert"
      icon-color="error"
      confirm-color="error"
      confirm-label="ยืนยันลบ"
      :loading="isDeleting"
      @confirm="onConfirmDelete"
      @cancel="closeDelete"
    >
      <template #message>
        คุณต้องการลบพนักงาน
        <span class="font-semibold text-highlighted">{{ deletingEmployee?.name || deletingEmployee?.email }}</span>
        ใช่หรือไม่?
      </template>
      <template #subMessage>
        ระบบจะลบบัญชีพนักงานนี้ออกจากรายการผู้ใช้งานแบบ soft delete และบัญชีนี้จะเข้าใช้งานระบบไม่ได้
      </template>
    </UIConfirmModal>
  </div>
</template>
