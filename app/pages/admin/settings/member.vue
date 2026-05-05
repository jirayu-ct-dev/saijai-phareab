<script setup lang="ts">
import { parseDate, type CalendarDate } from "@internationalized/date";

definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

type EntitlementStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "CANCELLED";

type MemberEntitlement = {
  id: string;
  status: EntitlementStatus;
  creditInitial: number | null;
  creditRemaining: number | null;
  startAt: string | null;
  endAt: string | null;
  product: { id: string; name: string; packageType: "MAIN" | "ADDON" };
};

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
  entitlements: MemberEntitlement[];
};

type PackageProduct = {
  id: string;
  name: string;
  packageType: "MAIN" | "ADDON";
  credits: number | null;
  validityDays: number | null;
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

const { data: allPackages } = await useFetch<PackageProduct[]>("/api/admin/packages", {
  default: () => [],
});
const packageOptions = computed(() =>
  (allPackages.value ?? []).map((p) => ({
    label: `${p.packageType === "MAIN" ? "หลัก" : "เสริม"} · ${p.name}`,
    value: p.id,
  })),
);

const expandedId = ref<string | null>(null);
const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id;
};

const STATUS_LABELS: Record<EntitlementStatus, string> = {
  PENDING: "รอเริ่มใช้งาน",
  ACTIVE: "กำลังใช้งาน",
  SUSPENDED: "ระงับ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};
const STATUS_COLORS: Record<EntitlementStatus, "neutral" | "success" | "warning" | "error" | "info"> = {
  PENDING: "neutral",
  ACTIVE: "success",
  SUSPENDED: "warning",
  EXPIRED: "neutral",
  CANCELLED: "error",
};
const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as EntitlementStatus[]).map((v) => ({
  label: STATUS_LABELS[v],
  value: v,
}));

const isEntOpen = ref(false);
const isEntSaving = ref(false);
const editingEnt = ref<{ memberId: string; entitlement: MemberEntitlement } | null>(null);
const entForm = reactive({
  productId: "",
  status: "ACTIVE" as EntitlementStatus,
  creditInitial: 0,
  creditRemaining: 0,
});
const startDate = shallowRef<CalendarDate | null>(null);
const endDate = shallowRef<CalendarDate | null>(null);

const toCalendarDate = (s: string | null): CalendarDate | null => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return parseDate(`${y}-${m}-${day}`);
};

const calendarDateToISO = (v: CalendarDate | null) => {
  if (!v) return null;
  const dd = String(v.day).padStart(2, "0");
  const mm = String(v.month).padStart(2, "0");
  return new Date(`${v.year}-${mm}-${dd}T00:00:00`).toISOString();
};

const formatCalendarLabel = (v: CalendarDate | null) => {
  if (!v) return "เลือกวันที่";
  const dd = String(v.day).padStart(2, "0");
  const mm = String(v.month).padStart(2, "0");
  return `${dd}/${mm}/${v.year}`;
};

const openEntEdit = (memberId: string, ent: MemberEntitlement) => {
  editingEnt.value = { memberId, entitlement: ent };
  entForm.productId = ent.product.id;
  entForm.status = ent.status;
  entForm.creditInitial = ent.creditInitial ?? 0;
  entForm.creditRemaining = ent.creditRemaining ?? 0;
  startDate.value = toCalendarDate(ent.startAt);
  endDate.value = toCalendarDate(ent.endAt);
  isEntOpen.value = true;
};

const onSaveEnt = async () => {
  if (!editingEnt.value) return;
  if (entForm.creditRemaining > entForm.creditInitial) {
    return notify.validationError("เครดิตคงเหลือต้องไม่เกินเครดิตเริ่มต้น");
  }
  isEntSaving.value = true;
  try {
    const { memberId, entitlement } = editingEnt.value;
    await $fetch(`/api/admin/members/${memberId}/entitlements/${entitlement.id}`, {
      method: "PUT",
      body: {
        productId: entForm.productId,
        status: entForm.status,
        creditInitial: entForm.creditInitial,
        creditRemaining: entForm.creditRemaining,
        startAt: calendarDateToISO(startDate.value),
        endAt: calendarDateToISO(endDate.value),
      },
    });
    notify.updated();
    isEntOpen.value = false;
    await refresh();
  } catch (e: any) {
    notify.error(e?.statusMessage || "ไม่สามารถแก้ไขแพ็กเกจได้");
  } finally {
    isEntSaving.value = false;
  }
};

const setStartToday = () => {
  const d = new Date();
  startDate.value = parseDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
};
const extendEndDays = (days: number) => {
  const base = startDate.value ? new Date(`${startDate.value.year}-${String(startDate.value.month).padStart(2, "0")}-${String(startDate.value.day).padStart(2, "0")}T00:00:00`) : new Date();
  const t = new Date(base.getTime() + days * 86400000);
  endDate.value = parseDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
};
const clearStartDate = () => { startDate.value = null; };
const clearEndDate = () => { endDate.value = null; };

const isEntDeleteOpen = ref(false);
const isEntDeleting = ref(false);
const deletingEnt = ref<{ memberId: string; entitlement: MemberEntitlement } | null>(null);
const openEntDelete = (memberId: string, ent: MemberEntitlement) => {
  deletingEnt.value = { memberId, entitlement: ent };
  isEntDeleteOpen.value = true;
};
const onConfirmEntDelete = async () => {
  if (!deletingEnt.value) return;
  isEntDeleting.value = true;
  try {
    const { memberId, entitlement } = deletingEnt.value;
    await $fetch(`/api/admin/members/${memberId}/entitlements/${entitlement.id}`, { method: "DELETE" });
    notify.deleted();
    isEntDeleteOpen.value = false;
    await refresh();
  } catch (e: any) {
    notify.error(e?.statusMessage || "ไม่สามารถลบแพ็กเกจได้");
  } finally {
    isEntDeleting.value = false;
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
  <div class="mx-auto w-full max-w-6xl space-y-4 p-4 sm:space-y-6 sm:p-6">
    <div>
      <h1 class="text-xl font-semibold">จัดการสมาชิก</h1>
      <p class="text-sm text-muted mt-1">ลูกค้าที่มีบัญชีและแพ็กเกจรายเดือน</p>
    </div>

    <UCard>
      <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <UInput v-model="search" icon="i-lucide-search" placeholder="ค้นหาชื่อ/อีเมล/เบอร์" class="w-full lg:w-80" />
        <div class="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
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
            class="justify-center"
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
          class="space-y-3 rounded-lg border border-default p-3"
        >
          <!-- Row 1: Avatar + ชื่อ + actions -->
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <NuxtLink :to="`/admin/users/${m.id}`" class="flex min-w-0 items-center gap-3 transition hover:opacity-80">
              <UAvatar v-bind="getAvatarProps(m.image, m.name, m.email)" size="sm" class="shrink-0" />
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">{{ m.name || m.email }}</p>
                <p class="text-xs text-muted truncate">
                  {{ m.email }}<span v-if="m.phoneNumber"> · {{ m.phoneNumber }}</span>
                </p>
              </div>
            </NuxtLink>
            <div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 sm:w-auto sm:flex sm:shrink-0">
              <UButton
                :label="expandedId === m.id ? 'ซ่อนแพ็กเกจ' : 'จัดการแพ็กเกจ'"
                :icon="expandedId === m.id ? 'i-lucide-chevron-up' : 'i-lucide-package'"
                color="primary"
                :variant="expandedId === m.id ? 'solid' : 'subtle'"
                size="xs"
                aria-label="จัดการแพ็กเกจ"
                class="min-w-0 justify-center"
                :ui="{ label: 'truncate' }"
                @click="toggleExpand(m.id)"
              />
              <UButton
                label="ดูรายละเอียด"
                icon="i-lucide-eye"
                color="neutral"
                variant="ghost"
                size="xs"
                title="ดูข้อมูลลูกค้า"
                aria-label="ดูรายละเอียด"
                :ui="{ label: 'hidden md:inline' }"
                :to="`/admin/users/${m.id}`"
              />
              <UButton
                label="ลบ"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                title="ลบสมาชิก"
                aria-label="ลบสมาชิก"
                :ui="{ label: 'hidden md:inline' }"
                @click="openDelete(m)"
              />
            </div>
          </div>

          <!-- Row 2: Badges + stats -->
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-1">
              <UBadge v-if="m.mainPackageName" color="primary" variant="subtle" size="xs">{{ m.mainPackageName }}</UBadge>
              <UBadge v-for="name in m.addonPackageNames" :key="name" color="info" variant="subtle" size="xs">{{ name }}</UBadge>
              <UBadge v-if="isExpiringSoon(m.earliestEndAt)" color="warning" variant="subtle" size="xs">ใกล้หมดอายุ</UBadge>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:gap-3">
              <div v-if="m.mainCreditInitial > 0" class="rounded-md bg-elevated/40 px-3 py-2 sm:bg-transparent sm:p-0 sm:text-right">
                <p class="text-muted">หลัก</p>
                <p class="font-semibold">{{ m.mainCreditRemaining }}/{{ m.mainCreditInitial }}</p>
              </div>
              <div v-if="m.addonCreditInitial > 0" class="rounded-md bg-elevated/40 px-3 py-2 sm:bg-transparent sm:p-0 sm:text-right">
                <p class="text-muted">เสริม</p>
                <p class="font-semibold text-info">{{ m.addonCreditRemaining }}/{{ m.addonCreditInitial }}</p>
              </div>
              <div class="rounded-md bg-elevated/40 px-3 py-2 sm:bg-transparent sm:p-0 sm:text-right">
                <p class="text-muted">หมดอายุ</p>
                <p class="font-medium">{{ formatDate(m.earliestEndAt) }}</p>
              </div>
              <div class="rounded-md bg-elevated/40 px-3 py-2 sm:bg-transparent sm:p-0 sm:text-right">
                <p class="text-muted">ยอดรวม</p>
                <p class="font-medium">฿{{ formatCurrency(m.totalSpent) }}</p>
              </div>
            </div>
          </div>

          <!-- Expanded: edit entitlements -->
          <div v-if="expandedId === m.id" class="border-t border-default pt-3 space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide">แพ็กเกจของสมาชิก</p>
              <span class="text-xs text-muted">{{ m.entitlements.length }} รายการ</span>
            </div>
            <p v-if="!m.entitlements.length" class="text-xs text-muted text-center py-3 rounded-md border border-dashed border-default">
              ลูกค้าคนนี้ยังไม่มีแพ็กเกจ
            </p>
            <div
              v-for="ent in m.entitlements"
              :key="ent.id"
              class="space-y-2 rounded-md bg-elevated/40 px-3 py-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0"
            >
              <div class="flex min-w-0 flex-wrap items-center gap-2 sm:flex-1">
                <UBadge :color="ent.product.packageType === 'MAIN' ? 'primary' : 'info'" variant="subtle" size="xs">
                  {{ ent.product.packageType === 'MAIN' ? 'หลัก' : 'เสริม' }}
                </UBadge>
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ ent.product.name }}</span>
                <UBadge :color="STATUS_COLORS[ent.status]" variant="subtle" size="xs">{{ STATUS_LABELS[ent.status] }}</UBadge>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs text-muted sm:flex sm:items-center sm:gap-2">
                <span class="inline-flex items-center gap-1">
                  <UIcon name="i-lucide-coins" class="size-3" />
                  {{ ent.creditRemaining ?? 0 }}/{{ ent.creditInitial ?? 0 }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="size-3" />
                  {{ formatDate(ent.endAt) }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <UButton
                  label="แก้ไข"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="justify-center"
                  @click="openEntEdit(m.id, ent)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  title="ลบแพ็กเกจ"
                  @click="openEntDelete(m.id, ent)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <UModal v-model:open="isEntOpen" title="แก้ไขแพ็กเกจสมาชิก">
      <template #body>
        <div class="space-y-3">
          <UFormField label="แพ็กเกจ" required>
            <USelect v-model="entForm.productId" :items="packageOptions" value-key="value" class="w-full" />
          </UFormField>
          <UFormField label="สถานะ">
            <USelect v-model="entForm.status" :items="STATUS_OPTIONS" value-key="value" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="เครดิตเริ่มต้น">
              <UInput v-model.number="entForm.creditInitial" type="number" min="0" class="w-full" />
            </UFormField>
            <UFormField label="เครดิตคงเหลือ">
              <UInput v-model.number="entForm.creditRemaining" type="number" min="0" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="วันที่เริ่ม">
              <UPopover>
                <UButton
                  :label="formatCalendarLabel(startDate)"
                  icon="i-lucide-calendar"
                  color="neutral"
                  variant="outline"
                  block
                  class="justify-start font-normal"
                />
                <template #content>
                  <UCalendar v-model="startDate" locale="th-TH" class="p-2" />
                </template>
              </UPopover>
            </UFormField>
            <UFormField label="วันหมดอายุ">
              <UPopover>
                <UButton
                  :label="formatCalendarLabel(endDate)"
                  icon="i-lucide-calendar"
                  color="neutral"
                  variant="outline"
                  block
                  class="justify-start font-normal"
                />
                <template #content>
                  <UCalendar v-model="endDate" locale="th-TH" class="p-2" />
                </template>
              </UPopover>
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isEntOpen = false">ยกเลิก</UButton>
          <UButton :loading="isEntSaving" icon="i-lucide-save" @click="onSaveEnt">บันทึก</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isEntDeleteOpen" title="ลบแพ็กเกจสมาชิก">
      <template #body>
        <div class="space-y-3 text-sm">
          <p>
            ลบแพ็กเกจ
            <span class="font-semibold">{{ deletingEnt?.entitlement.product.name }}</span>
            ของลูกค้านี้ใช่หรือไม่?
          </p>
          <div class="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            ⚠ การลบจะตั้งสถานะเป็น CANCELLED และไม่ส่งผลต่อประวัติการใช้งานเดิม
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isEntDeleteOpen = false">ยกเลิก</UButton>
          <UButton color="error" :loading="isEntDeleting" icon="i-lucide-trash-2" @click="onConfirmEntDelete">ยืนยันลบ</UButton>
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
