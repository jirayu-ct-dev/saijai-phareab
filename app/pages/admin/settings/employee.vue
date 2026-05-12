<script setup lang="ts">
import { adminMobileListCardClass } from "~~/shared/config/adminUi";

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
  } catch (e: any) {
    notify.error(e?.statusMessage || "ไม่สามารถเพิ่มพนักงานได้");
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
  if (!selectedUserId.value) return notify.validationError("กรุณาเลือกผู้ใช้") as unknown as void;
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
  } catch (e: any) {
    notify.error(e?.statusMessage || "ไม่สามารถเปลี่ยนสิทธิ์ได้");
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

const onDelete = async (emp: Employee) => {
  if (emp.id === actor.value?.id) return notify.error("ห้ามลบบัญชีตัวเอง");
  try {
    await $fetch(`/api/admin/employees/${emp.id}`, { method: "DELETE" });
    notify.deleted();
    await refresh();
  } catch {
    notify.serverError();
  }
};

const getAvatarProps = (image: string | null, name: string | null, email: string) => ({
  as: { img: "img" as const },
  src: image || "",
  alt: name || email,
  loading: "lazy" as const,
});
const roleLabel = (r: string) => (r === "ADMIN" ? "ผู้ดูแล" : "พนักงาน");
const roleColor = (r: string) => (r === "ADMIN" ? "primary" : "neutral");

const formatDate = (s: string) => new Date(s).toLocaleDateString("th-TH", { dateStyle: "medium" });
</script>

<template>
  <div class="w-full p-6 max-w-5xl mx-auto space-y-6">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold">จัดการพนักงาน</h1>
        <p class="text-sm text-muted mt-1">เพิ่ม/ลบ และเปลี่ยน role ของพนักงานในร้าน</p>
      </div>
      <div class="flex gap-2">
        <UButton icon="i-lucide-user-search" color="neutral" variant="outline" @click="isPromoteOpen = true">เลือกผู้ใช้ในระบบ</UButton>
        <UButton icon="i-lucide-plus" @click="isCreateOpen = true">สร้างพนักงานใหม่</UButton>
      </div>
    </div>

    <USkeleton v-if="isLoading" class="h-64 w-full rounded-lg" />

    <UCard v-else>
      <div v-if="!employees?.length" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        ยังไม่มีพนักงานในระบบ
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="emp in employees"
          :key="emp.id"
          :class="[adminMobileListCardClass, 'flex flex-wrap items-center justify-between gap-3 p-3']"
        >
          <div class="flex items-center gap-3 min-w-0">
            <UAvatar v-bind="getAvatarProps(emp.image, emp.name, emp.email)" size="md" />

            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-medium truncate">{{ emp.name || emp.email }}</p>
                <UBadge :color="roleColor(emp.role)" variant="subtle" size="xs">{{ roleLabel(emp.role) }}</UBadge>
                <UBadge v-if="emp.hasLineLinked" color="success" variant="subtle" size="xs" icon="i-simple-icons-line">LINE</UBadge>
              </div>
              <p class="text-xs text-muted">{{ emp.email }} · เริ่ม {{ formatDate(emp.createdAt) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
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
              @update:model-value="(v: any) => onChangeRole(emp, v)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :disabled="emp.id === actor?.id"
              @click="onDelete(emp)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Create new employee modal -->
    <UModal v-model:open="isCreateOpen" title="สร้างพนักงานใหม่">
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
    <UModal v-model:open="isPromoteOpen" title="เลือกผู้ใช้จากระบบ" :ui="{ content: 'max-w-md' }">
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
                    <p class="text-sm font-medium truncate">{{ item.label }}</p>
                    <p class="text-xs text-muted truncate">{{ item.email }}</p>
                  </div>
                </div>
              </template>
              <template #empty>
                <p class="text-sm text-muted text-center py-2">ไม่พบผู้ใช้</p>
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
  </div>
</template>
