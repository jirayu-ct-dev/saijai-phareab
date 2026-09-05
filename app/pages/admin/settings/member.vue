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

const { data: members, status, refresh } = useFetch<MemberRow[]>("/api/admin/members", {
  query: { search, filter },
  lazy: true,
  default: () => [],
  watch: [search, filter],
});

const isLoading = computed(() => status.value === "pending");

const { data: allPackages } = useFetch<PackageProduct[]>("/api/admin/packages", {
  lazy: true,
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
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const toCalendarDate = (s: string | null): CalendarDate | null => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const bkk = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bkk.getUTCDate()).padStart(2, "0");
  return parseDate(`${y}-${m}-${day}`);
};

const calendarDateToBangkokDateTime = (v: CalendarDate | null) => {
  if (!v) return null;
  const dd = String(v.day).padStart(2, "0");
  const mm = String(v.month).padStart(2, "0");
  return `${v.year}-${mm}-${dd}T00:00:00`;
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
        startAt: calendarDateToBangkokDateTime(startDate.value),
        endAt: calendarDateToBangkokDateTime(endDate.value),
      },
    });
    notify.updated();
    isEntOpen.value = false;
    await refresh();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถแก้ไขแพ็กเกจได้";
    notify.error(message);
  } finally {
    isEntSaving.value = false;
  }
};

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
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถลบแพ็กเกจได้";
    notify.error(message);
  } finally {
    isEntDeleting.value = false;
  }
};

const isEntExpiring = ref(false);
const expiringEnt = ref<{ memberId: string; entitlement: MemberEntitlement } | null>(null);
const isEntExpireOpen = ref(false);

const openEntExpire = (memberId: string, ent: MemberEntitlement) => {
  expiringEnt.value = { memberId, entitlement: ent };
  isEntExpireOpen.value = true;
};

const onConfirmEntExpire = async () => {
  if (!expiringEnt.value || isEntExpiring.value) return;
  isEntExpiring.value = true;
  try {
    const { memberId, entitlement } = expiringEnt.value;
    await $fetch(`/api/admin/members/${memberId}/entitlements/${entitlement.id}`, {
      method: "PUT",
      body: {
        productId: entitlement.product.id,
        status: "EXPIRED",
        creditInitial: entitlement.creditInitial ?? 0,
        creditRemaining: entitlement.creditRemaining ?? 0,
        startAt: entitlement.startAt,
        endAt: entitlement.endAt,
      },
    });
    notify.updated();
    expiringEnt.value = null;
    isEntExpireOpen.value = false;
    await refresh();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถปิดใช้งานแพ็กเกจได้";
    notify.error(message);
  } finally {
    isEntExpiring.value = false;
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
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถลบลูกค้าได้";
    notify.error(message);
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

const visibleAddonPackageNames = (names: string[]) => names.slice(0, 1);
const hiddenAddonPackageCount = (names: string[]) => Math.max(0, names.length - 1);

const isExpiringSoon = (s: string | null) => {
  if (!s) return false;
  const days = (new Date(s).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 7;
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <h1 class="text-xl font-semibold text-highlighted">จัดการสมาชิก</h1>
      <p class="mt-1 text-sm text-muted">ลูกค้าที่มีบัญชีและแพ็กเกจรายเดือน</p>
    </section>

    <section class="flex flex-col gap-1">
      <div class="-mx-2 flex flex-col gap-1.5 border border-default/30 bg-default px-3! py-3! dark:border-default/40 dark:bg-default/80 sm:mx-0 sm:rounded-lg">
        <div class="flex items-center justify-between gap-1.5">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="ค้นหาชื่อ/อีเมล/เบอร์"
            class="min-w-0 flex-1 w-full"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="isLoading"
            aria-label="รีเฟรชข้อมูล"
            @click="refresh()"
          />
        </div>
        <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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

      <div v-if="isLoading" class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="i in 5"
          :key="`mem-sk-${i}`"
          class="border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
        >
          <div class="flex items-center gap-3">
            <USkeleton class="size-8 rounded-full shrink-0" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <USkeleton class="h-3.5 w-40 rounded" />
              <USkeleton class="h-2.5 w-56 rounded" />
            </div>
            <USkeleton class="h-5 w-16 rounded-full shrink-0" />
            <USkeleton class="size-7 rounded-lg shrink-0" />
          </div>
        </div>
      </div>

      <div
        v-else-if="!members?.length"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30"
      >
        ไม่พบสมาชิกตามเงื่อนไข
      </div>

      <div v-else class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="m in members"
          :key="m.id"
          class="space-y-1.5 border border-default/30 bg-default p-2 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
        >
          <div class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <NuxtLink :to="`/admin/users/${m.id}`" class="flex min-w-0 items-center gap-2 transition hover:opacity-80">
              <UAvatar v-bind="getAvatarProps(m.image, m.name, m.email)" size="sm" class="shrink-0" />
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-1.5">
                  <p class="truncate text-sm font-medium">{{ m.name || m.email }}</p>
                  <UBadge v-if="m.mainPackageName" color="primary" variant="subtle" size="xs" class="shrink-0">
                    หลัก
                  </UBadge>
                  <UBadge v-if="m.addonPackageNames.length" color="info" variant="subtle" size="xs" class="shrink-0">
                    เสริม
                  </UBadge>
                  <UBadge v-if="isExpiringSoon(m.earliestEndAt)" color="warning" variant="subtle" size="xs" class="shrink-0">
                    ใกล้หมดอายุ
                  </UBadge>
                </div>
                <p class="truncate text-xs text-muted">
                  {{ m.email }}<span v-if="m.phoneNumber"> · {{ m.phoneNumber }}</span>
                </p>
              </div>
            </NuxtLink>
            <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 lg:w-auto lg:flex lg:shrink-0">
              <UButton
                label="จัดการแพ็กเกจ"
                trailing-icon="i-lucide-chevron-right"
                color="primary"
                :variant="expandedId === m.id ? 'solid' : 'subtle'"
                size="xs"
                aria-label="จัดการแพ็กเกจ"
                class="min-w-0 justify-center"
                :ui="{
                  label: 'truncate',
                  trailingIcon: [
                    'shrink-0 transition-transform duration-200 ease-out',
                    expandedId === m.id ? 'rotate-90' : 'rotate-0'
                  ]
                }"
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

          <div class="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)] lg:items-center">
            <div class="flex min-h-5 min-w-0 items-center gap-1 overflow-hidden">
              <UBadge
                v-if="m.mainPackageName"
                color="primary"
                variant="subtle"
                size="xs"
                class="max-w-[45%] shrink-0"
                :ui="{ label: 'truncate' }"
              >
                {{ m.mainPackageName }}
              </UBadge>
              <UBadge
                v-for="name in visibleAddonPackageNames(m.addonPackageNames)"
                :key="name"
                color="info"
                variant="subtle"
                size="xs"
                class="max-w-[45%] shrink-0"
                :ui="{ label: 'truncate' }"
              >
                {{ name }}
              </UBadge>
              <UBadge v-if="hiddenAddonPackageCount(m.addonPackageNames)" color="neutral" variant="subtle" size="xs" class="shrink-0">
                +{{ hiddenAddonPackageCount(m.addonPackageNames) }}
              </UBadge>
              <span v-if="!m.mainPackageName && !m.addonPackageNames.length" class="truncate text-xs text-muted">
                ยังไม่มีแพ็กเกจ
              </span>
            </div>

            <div class="grid grid-cols-4 gap-1 text-xs">
              <div class="rounded-lg bg-elevated/40 px-2 py-1.5 text-right">
                <p class="text-muted">หลัก</p>
                <p class="truncate font-semibold">
                  {{ m.mainCreditInitial > 0 ? `${m.mainCreditRemaining}/${m.mainCreditInitial}` : "-" }}
                </p>
              </div>
              <div class="rounded-lg bg-elevated/40 px-2 py-1.5 text-right">
                <p class="text-muted">เสริม</p>
                <p class="truncate font-semibold text-info">
                  {{ m.addonCreditInitial > 0 ? `${m.addonCreditRemaining}/${m.addonCreditInitial}` : "-" }}
                </p>
              </div>
              <div class="rounded-lg bg-elevated/40 px-2 py-1.5 text-right">
                <p class="text-muted">หมดอายุ</p>
                <p class="truncate font-medium">{{ formatDate(m.earliestEndAt) }}</p>
              </div>
              <div class="rounded-lg bg-elevated/40 px-2 py-1.5 text-right">
                <p class="text-muted">ยอดรวม</p>
                <p class="truncate font-medium">฿{{ formatCurrency(m.totalSpent) }}</p>
              </div>
            </div>
          </div>

          <div v-if="expandedId === m.id" class="space-y-1.5 border-t border-default pt-1.5">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold text-muted">แพ็กเกจของสมาชิก</p>
              <span class="text-xs text-muted">{{ m.entitlements.length }} รายการ</span>
            </div>
            <p v-if="!m.entitlements.length" class="rounded-lg border border-dashed border-default py-2 text-center text-xs text-muted">
              ลูกค้าคนนี้ยังไม่มีแพ็กเกจ
            </p>
            <div
              v-for="ent in m.entitlements"
              :key="ent.id"
              class="grid gap-1.5 rounded-lg bg-elevated/40 px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
            >
              <div class="flex min-w-0 items-center gap-1.5">
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
              <div class="flex items-center justify-end gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  title="แก้ไขแพ็กเกจ"
                  aria-label="แก้ไขแพ็กเกจ"
                  class="justify-center"
                  @click="openEntEdit(m.id, ent)"
                />
                <UButton
                  v-if="ent.status === 'ACTIVE'"
                  icon="i-lucide-calendar-x"
                  color="warning"
                  variant="ghost"
                  size="xs"
                  title="ปิดใช้งาน (ตั้งเป็นหมดอายุ)"
                  aria-label="ปิดใช้งานแพ็กเกจนี้"
                  :loading="expiringEnt?.entitlement.id === ent.id && isEntExpiring"
                  @click="openEntExpire(m.id, ent)"
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
    </section>

    <UModal
      v-model:open="isEntOpen"
      title="แก้ไขแพ็กเกจสมาชิก"
      :ui="{ body: '!bg-default p-4! dark:!bg-elevated/55' }"
    >
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

    <UModal
      v-model:open="isEntDeleteOpen"
      title="ลบแพ็กเกจสมาชิก"
      :ui="{ body: '!bg-default p-4! dark:!bg-elevated/55' }"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p>
            ลบแพ็กเกจ
            <span class="font-semibold">{{ deletingEnt?.entitlement.product.name }}</span>
            ของลูกค้านี้ใช่หรือไม่?
          </p>
          <div class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
            <span>การลบจะตั้งสถานะเป็น CANCELLED และไม่ส่งผลต่อประวัติการใช้งานเดิม</span>
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

    <UModal
      v-model:open="isEntExpireOpen"
      title="ปิดใช้งานแพ็กเกจสมาชิก"
      :ui="{ body: '!bg-default p-4! dark:!bg-elevated/55' }"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p>
            ปิดใช้งานแพ็กเกจ
            <span class="font-semibold">{{ expiringEnt?.entitlement.product.name }}</span>
            ของลูกค้านี้ใช่หรือไม่?
          </p>
          <div class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
            <span>แพ็กเกจจะถูกตั้งเป็นหมดอายุ (EXPIRED) และไม่สามารถใช้เครดิตคงเหลือได้ทันที</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="neutral" variant="ghost" @click="isEntExpireOpen = false">ยกเลิก</UButton>
          <UButton color="warning" :loading="isEntExpiring" icon="i-lucide-calendar-x" @click="onConfirmEntExpire">ยืนยันปิดใช้งาน</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="ยืนยันการลบ"
      :ui="{ body: '!bg-default p-4! dark:!bg-elevated/55' }"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p>คุณต้องการลบลูกค้า <span class="font-semibold">{{ deletingMember?.name || deletingMember?.email }}</span> ใช่หรือไม่?</p>
          <div class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
            <span>ลูกค้าที่มีการใช้สิทธิ์แพ็กเกจไปแล้วจะลบไม่ได้ แพ็กเกจที่ยังไม่ถูกใช้จะถูกยกเลิกอัตโนมัติ</span>
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
