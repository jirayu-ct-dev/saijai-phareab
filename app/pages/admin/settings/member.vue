<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  phoneNumber: string | null;
  createdAt: string;
  activeCount: number;
  totalEntitlements: number;
  mainCreditRemaining: number;
  mainCreditInitial: number;
  addonCreditRemaining: number;
  addonCreditInitial: number;
  earliestEndAt: string | null;
  totalSpent: number;
  mainPackageName: string | null;
  addonPackageNames: string[];
};

const notify = useNotify();

const search = ref("");
const filter = ref<"all" | "active" | "none" | "expiring">("all");

const { data: members, status, refresh } = await useFetch<MemberRow[]>("/api/admin/members", {
  query: { search, filter },
  default: () => [],
  watch: [search, filter],
});

const isLoading = computed(() => status.value === "pending");

const isEditOpen = ref(false);
const editingMember = ref<MemberRow | null>(null);
const editForm = reactive({ name: "", phoneNumber: "" });
const isSaving = ref(false);

const openEdit = (m: MemberRow) => {
  editingMember.value = m;
  editForm.name = m.name ?? "";
  editForm.phoneNumber = m.phoneNumber ?? "";
  isEditOpen.value = true;
};

const onSaveEdit = async () => {
  if (!editingMember.value) return;
  if (!editForm.name.trim()) return notify.validationError("กรุณากรอกชื่อ");
  isSaving.value = true;
  try {
    await $fetch(`/api/admin/members/${editingMember.value.id}`, {
      method: "PUT",
      body: { name: editForm.name.trim(), phoneNumber: editForm.phoneNumber.trim() || null },
    });
    notify.updated();
    isEditOpen.value = false;
    await refresh();
  } catch (e: any) {
    notify.error(e?.statusMessage || "ไม่สามารถแก้ไขข้อมูลได้");
  } finally {
    isSaving.value = false;
  }
};

const isDeleteOpen = ref(false);
const deletingMember = ref<MemberRow | null>(null);
const isDeleting = ref(false);

const openDelete = (m: MemberRow) => {
  deletingMember.value = m;
  isDeleteOpen.value = true;
};

const onConfirmDelete = async () => {
  if (!deletingMember.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/admin/members/${deletingMember.value.id}`, { method: "DELETE" });
    notify.deleted();
    isDeleteOpen.value = false;
    await refresh();
  } catch (e: any) {
    notify.error(e?.statusMessage || "ไม่สามารถลบลูกค้าได้");
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
const formatCurrency = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

const formatDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("th-TH", { dateStyle: "medium" }) : "-";

const isExpiringSoon = (s: string | null) => {
  if (!s) return false;
  const days = (new Date(s).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 7;
};
</script>

<template>
  <div class="w-full p-6 max-w-6xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">จัดการสมาชิก</h1>
      <p class="text-sm text-muted mt-1">ลูกค้าที่มีบัญชีและแพ็กเกจรายเดือน</p>
    </div>

    <UCard>
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <UInput v-model="search" icon="i-lucide-search" placeholder="ค้นหาชื่อ/อีเมล/เบอร์" class="w-full md:w-72" />
        <div class="flex gap-1">
          <UButton
            v-for="f in [
              { label: 'ทั้งหมด', value: 'all' },
              { label: 'มีแพ็กเกจ', value: 'active' },
              { label: 'ไม่มีแพ็กเกจ', value: 'none' },
              { label: 'ใกล้หมดอายุ', value: 'expiring' },
            ]"
            :key="f.value"
            :label="f.label"
            color="neutral"
            :variant="filter === f.value ? 'solid' : 'outline'"
            size="sm"
            @click="filter = f.value as typeof filter"
          />
        </div>
      </div>

      <USkeleton v-if="isLoading" class="h-64 w-full rounded-lg" />

      <div v-else-if="!members?.length" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        ไม่พบสมาชิกตามเงื่อนไข
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="m in members"
          :key="m.id"
          class="rounded-lg border border-default p-3 space-y-2"
        >
          <!-- Row 1: Avatar + ชื่อ + actions -->
          <div class="flex items-center gap-3">
            <NuxtLink :to="`/admin/users/${m.id}`" class="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition">
              <UAvatar v-bind="getAvatarProps(m.image, m.name, m.email)" size="sm" class="shrink-0" />
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">{{ m.name || m.email }}</p>
                <p class="text-xs text-muted truncate">
                  {{ m.email }}<span v-if="m.phoneNumber"> · {{ m.phoneNumber }}</span>
                </p>
              </div>
            </NuxtLink>
            <div class="flex items-center gap-0.5 shrink-0">
              <UButton icon="i-lucide-package" color="primary" variant="ghost" size="xs" :to="`/admin/users/${m.id}#packages`" />
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(m)" />
              <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="openDelete(m)" />
            </div>
          </div>

          <!-- Row 2: Badges + stats -->
          <div class="flex items-center justify-between gap-2 flex-wrap pl-1">
            <div class="flex items-center gap-1 flex-wrap">
              <UBadge v-if="m.mainPackageName" color="primary" variant="subtle" size="xs">{{ m.mainPackageName }}</UBadge>
              <UBadge v-for="name in m.addonPackageNames" :key="name" color="info" variant="subtle" size="xs">{{ name }}</UBadge>
              <UBadge v-if="isExpiringSoon(m.earliestEndAt)" color="warning" variant="subtle" size="xs">ใกล้หมดอายุ</UBadge>
            </div>
            <div class="flex items-center gap-3 text-xs shrink-0">
              <div v-if="m.mainCreditInitial > 0" class="text-right">
                <p class="text-muted">หลัก</p>
                <p class="font-semibold">{{ m.mainCreditRemaining }}/{{ m.mainCreditInitial }}</p>
              </div>
              <div v-if="m.addonCreditInitial > 0" class="text-right">
                <p class="text-muted">เสริม</p>
                <p class="font-semibold text-info">{{ m.addonCreditRemaining }}/{{ m.addonCreditInitial }}</p>
              </div>
              <div class="text-right">
                <p class="text-muted">หมดอายุ</p>
                <p class="font-medium">{{ formatDate(m.earliestEndAt) }}</p>
              </div>
              <div class="text-right">
                <p class="text-muted">ยอดรวม</p>
                <p class="font-medium">฿{{ formatCurrency(m.totalSpent) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <UModal v-model:open="isEditOpen" title="แก้ไขข้อมูลลูกค้า">
      <template #body>
        <div class="space-y-3">
          <UFormField label="ชื่อ" required>
            <UInput v-model="editForm.name" placeholder="ชื่อ-นามสกุล" class="w-full" />
          </UFormField>
          <UFormField label="เบอร์โทรศัพท์">
            <UInput v-model="editForm.phoneNumber" placeholder="081-234-5678" class="w-full" />
          </UFormField>
          <UFormField label="อีเมล">
            <UInput :model-value="editingMember?.email" disabled class="w-full" />
            <template #help>
              <span class="text-xs text-muted">อีเมลใช้สำหรับ login ไม่สามารถเปลี่ยนได้</span>
            </template>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isEditOpen = false">ยกเลิก</UButton>
          <UButton :loading="isSaving" icon="i-lucide-save" @click="onSaveEdit">บันทึก</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isDeleteOpen" title="ยืนยันการลบ">
      <template #body>
        <div class="space-y-3 text-sm">
          <p>คุณต้องการลบลูกค้า <span class="font-semibold">{{ deletingMember?.name || deletingMember?.email }}</span> ใช่หรือไม่?</p>
          <div class="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            ⚠ ลูกค้าที่มีการใช้สิทธิ์แพ็กเกจไปแล้วจะลบไม่ได้ — แพ็กเกจที่ยังไม่ถูกใช้จะถูกยกเลิกอัตโนมัติ
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isDeleteOpen = false">ยกเลิก</UButton>
          <UButton color="error" :loading="isDeleting" icon="i-lucide-trash-2" @click="onConfirmDelete">ยืนยันลบ</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
