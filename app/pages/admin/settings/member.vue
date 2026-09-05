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

/* ------------------------------------------------------------------ */
/* Member drawer — single place to manage one member's packages.      */
/* ------------------------------------------------------------------ */
const selectedMember = ref<MemberRow | null>(null);
const isDrawerOpen = ref(false);

const openMember = (m: MemberRow) => {
  selectedMember.value = m;
  isDrawerOpen.value = true;
};

const syncSelectedAfterRefresh = async () => {
  await refresh();
  if (!selectedMember.value) return;
  selectedMember.value = members.value.find((m) => m.id === selectedMember.value!.id) ?? null;
  if (!selectedMember.value) isDrawerOpen.value = false;
};

/* ------------------------------------------------------------------ */
/* Presentation helpers                                               */
/* ------------------------------------------------------------------ */
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

const daysLeft = (s: string | null) => {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
};

const expiryHint = (s: string | null) => {
  const d = daysLeft(s);
  if (d === null) return "ไม่ระบุวันหมดอายุ";
  if (d < 0) return `หมดอายุมาแล้ว ${Math.abs(d)} วัน`;
  if (d === 0) return "หมดอายุวันนี้";
  return `อีก ${d} วัน`;
};

const isExpiringSoon = (s: string | null) => {
  const d = daysLeft(s);
  return d !== null && d >= 0 && d <= 7;
};

const creditPercent = (remaining: number | null, initial: number | null) => {
  if (!initial || initial <= 0) return 0;
  return Math.min(100, Math.max(0, ((remaining ?? 0) / initial) * 100));
};

const creditBarColor = (remaining: number | null, initial: number | null) => {
  if (!initial || initial <= 0) return "bg-neutral-300 dark:bg-neutral-700";
  if ((remaining ?? 0) <= 0) return "bg-error";
  if (creditPercent(remaining, initial) <= 20) return "bg-warning";
  return "bg-primary";
};

const visibleAddonPackageNames = (names: string[]) => names.slice(0, 2);
const hiddenAddonPackageCount = (names: string[]) => Math.max(0, names.length - 2);

/* ------------------------------------------------------------------ */
/* Entitlement edit / expire / delete (drawer context)                */
/* ------------------------------------------------------------------ */
const editingEnt = ref<MemberEntitlement | null>(null);
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

const openEntEdit = (ent: MemberEntitlement) => {
  editingEnt.value = ent;
  entForm.productId = ent.product.id;
  entForm.status = ent.status;
  entForm.creditInitial = ent.creditInitial ?? 0;
  entForm.creditRemaining = ent.creditRemaining ?? 0;
  startDate.value = toCalendarDate(ent.startAt);
  endDate.value = toCalendarDate(ent.endAt);
  isEntOpen.value = true;
};

const isEntOpen = ref(false);
const isEntSaving = ref(false);

const onSaveEnt = async () => {
  if (!editingEnt.value || !selectedMember.value) return;
  if (entForm.creditRemaining > entForm.creditInitial) {
    return notify.validationError("เครดิตคงเหลือต้องไม่เกินเครดิตเริ่มต้น");
  }
  isEntSaving.value = true;
  try {
    await $fetch(`/api/admin/members/${selectedMember.value.id}/entitlements/${editingEnt.value.id}`, {
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
    await syncSelectedAfterRefresh();
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
const deletingEnt = ref<MemberEntitlement | null>(null);

const openEntDelete = (ent: MemberEntitlement) => {
  deletingEnt.value = ent;
  isEntDeleteOpen.value = true;
};

const onConfirmEntDelete = async () => {
  if (!deletingEnt.value || !selectedMember.value) return;
  isEntDeleting.value = true;
  try {
    await $fetch(`/api/admin/members/${selectedMember.value.id}/entitlements/${deletingEnt.value.id}`, {
      method: "DELETE",
    });
    notify.deleted();
    isEntDeleteOpen.value = false;
    await syncSelectedAfterRefresh();
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
const expiringEnt = ref<MemberEntitlement | null>(null);
const isEntExpireOpen = ref(false);

const openEntExpire = (ent: MemberEntitlement) => {
  expiringEnt.value = ent;
  isEntExpireOpen.value = true;
};

const onConfirmEntExpire = async () => {
  if (!expiringEnt.value || !selectedMember.value || isEntExpiring.value) return;
  isEntExpiring.value = true;
  try {
    await $fetch(`/api/admin/members/${selectedMember.value.id}/entitlements/${expiringEnt.value.id}`, {
      method: "PUT",
      body: {
        productId: expiringEnt.value.product.id,
        status: "EXPIRED",
        creditInitial: expiringEnt.value.creditInitial ?? 0,
        creditRemaining: expiringEnt.value.creditRemaining ?? 0,
        startAt: expiringEnt.value.startAt,
        endAt: expiringEnt.value.endAt,
      },
    });
    notify.updated();
    isEntExpireOpen.value = false;
    await syncSelectedAfterRefresh();
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "statusMessage" in error
      ? String((error as { statusMessage?: string }).statusMessage)
      : "ไม่สามารถปิดใช้งานแพ็กเกจได้";
    notify.error(message);
  } finally {
    isEntExpiring.value = false;
  }
};

/* ------------------------------------------------------------------ */
/* Member delete (drawer context)                                     */
/* ------------------------------------------------------------------ */
const isDeleteOpen = ref(false);
const isDeleting = ref(false);

const onConfirmDelete = async () => {
  if (!selectedMember.value) return;
  isDeleting.value = true;
  try {
    await $fetch(`/api/admin/members/${selectedMember.value.id}`, { method: "DELETE" });
    notify.deleted();
    isDeleteOpen.value = false;
    selectedMember.value = null;
    isDrawerOpen.value = false;
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
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h1 class="text-xl font-semibold text-highlighted">จัดการสมาชิก</h1>
          <p class="mt-1 text-sm text-muted">ลูกค้าที่มีบัญชีและแพ็กเกจรายเดือน</p>
        </div>
        <UBadge color="neutral" variant="subtle" size="lg">{{ members?.length ?? 0 }} คน</UBadge>
      </div>
    </section>

    <section class="flex flex-col gap-1">
      <div class="-mx-2 flex flex-col gap-1.5 border border-default/30 bg-default px-3! py-3! dark:border-default/40 dark:bg-default/80 sm:mx-0 sm:rounded-lg">
        <div class="flex items-center gap-1.5">
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
              { label: 'ใช้งานอยู่', value: 'active' },
              { label: 'ไม่มีสิทธิ์', value: 'none' },
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
          class="border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
        >
          <div class="flex items-center gap-3">
            <USkeleton class="size-9 rounded-full shrink-0" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <USkeleton class="h-3.5 w-40 rounded" />
              <USkeleton class="h-2.5 w-56 rounded" />
            </div>
            <USkeleton class="size-5 rounded-full shrink-0" />
          </div>
          <div class="mt-2 grid grid-cols-3 gap-1.5">
            <USkeleton class="h-9 rounded-lg" />
            <USkeleton class="h-9 rounded-lg" />
            <USkeleton class="h-9 rounded-lg" />
          </div>
        </div>
      </div>

      <div
        v-else-if="!members?.length"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30"
      >
        ไม่พบสมาชิกตามเงื่อนไข
      </div>

      <!-- รายชื่อ: แตะการ์ดใดก็ได้เพื่อเปิดศูนย์จัดการของลูกค้าคนนั้น -->
      <div v-else class="-mx-2 space-y-1 sm:mx-0">
        <button
          v-for="m in members"
          :key="m.id"
          type="button"
          class="w-full rounded-lg border border-default/30 bg-default p-3 text-left transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-md"
          :aria-label="`จัดการแพ็กเกจของ ${m.name || m.email}`"
          @click="openMember(m)"
        >
          <div class="flex items-center gap-2.5">
            <UAvatar v-bind="getAvatarProps(m.image, m.name, m.email)" size="md" class="shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-1.5">
                <p class="truncate text-sm font-semibold text-highlighted">{{ m.name || m.email }}</p>
                <UBadge v-if="isExpiringSoon(m.earliestEndAt)" color="warning" variant="subtle" size="xs" class="shrink-0">
                  ใกล้หมดอายุ
                </UBadge>
              </div>
              <p class="truncate text-xs text-muted">
                {{ m.email || "ไม่มีอีเมล" }}<span v-if="m.phoneNumber"> · {{ m.phoneNumber }}</span>
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" />
          </div>

          <div class="mt-2 flex min-w-0 items-center gap-1 overflow-hidden">
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
              class="max-w-[35%] shrink-0"
              :ui="{ label: 'truncate' }"
            >
              {{ name }}
            </UBadge>
            <UBadge v-if="hiddenAddonPackageCount(m.addonPackageNames)" color="neutral" variant="subtle" size="xs" class="shrink-0">
              +{{ hiddenAddonPackageCount(m.addonPackageNames) }}
            </UBadge>
            <span v-if="!m.mainPackageName && !m.addonPackageNames.length" class="truncate text-xs text-muted">
              ยังไม่มีแพ็กเกจที่ใช้งานอยู่
            </span>
          </div>

          <div class="mt-2 grid grid-cols-3 gap-1.5 text-xs">
            <div class="rounded-lg bg-elevated/40 px-2 py-1.5">
              <p class="text-muted">เครดิตหลัก</p>
              <p class="truncate font-semibold">
                {{ m.mainCreditInitial > 0 ? `${m.mainCreditRemaining}/${m.mainCreditInitial}` : "-" }}
              </p>
            </div>
            <div class="rounded-lg bg-elevated/40 px-2 py-1.5">
              <p class="text-muted">เครดิตเสริม</p>
              <p class="truncate font-semibold text-info">
                {{ m.addonCreditInitial > 0 ? `${m.addonCreditRemaining}/${m.addonCreditInitial}` : "-" }}
              </p>
            </div>
            <div class="rounded-lg px-2 py-1.5" :class="isExpiringSoon(m.earliestEndAt) ? 'bg-warning/10' : 'bg-elevated/40'">
              <p class="text-muted">หมดอายุ</p>
              <p class="truncate font-semibold" :class="isExpiringSoon(m.earliestEndAt) ? 'text-warning' : ''">
                {{ m.earliestEndAt ? formatDate(m.earliestEndAt) : "-" }}
              </p>
              <p v-if="m.earliestEndAt" class="truncate text-[11px]" :class="isExpiringSoon(m.earliestEndAt) ? 'text-warning' : 'text-muted'">
                {{ expiryHint(m.earliestEndAt) }}
              </p>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- ศูนย์จัดการรายลูกค้า: โปรไฟล์ + สถิติ + แพ็กเกจทุกใบ พร้อมปุ่มจัดการชัดเจน -->
    <UDrawer
      v-model:open="isDrawerOpen"
      direction="bottom"
      :ui="{ content: 'max-h-[88vh] mx-auto w-full max-w-2xl rounded-t-lg' }"
    >
      <template #body>
        <div v-if="selectedMember" class="space-y-4">
          <!-- โปรไฟล์ -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <UAvatar v-bind="getAvatarProps(selectedMember.image, selectedMember.name, selectedMember.email)" size="lg" class="shrink-0" />
              <div class="min-w-0">
                <p class="truncate text-base font-semibold text-highlighted">{{ selectedMember.name || selectedMember.email }}</p>
                <p class="truncate text-xs text-muted">
                  {{ selectedMember.email || "ไม่มีอีเมล" }}<span v-if="selectedMember.phoneNumber"> · {{ selectedMember.phoneNumber }}</span>
                </p>
                <p class="mt-0.5 text-xs text-muted">สมัครเมื่อ {{ formatDate(selectedMember.createdAt) }}</p>
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <UButton
                label="หน้ารายละเอียด"
                icon="i-lucide-external-link"
                color="neutral"
                variant="outline"
                size="xs"
                :to="`/admin/users/${selectedMember.id}`"
              />
              <UButton
                label="ลบลูกค้า"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click="isDeleteOpen = true"
              />
            </div>
          </div>

          <!-- สถิติ -->
          <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <div class="rounded-lg border border-default/30 px-3 py-2">
              <p class="text-xs text-muted">เครดิตหลัก</p>
              <p class="text-sm font-semibold">
                {{ selectedMember.mainCreditInitial > 0 ? `${selectedMember.mainCreditRemaining}/${selectedMember.mainCreditInitial}` : "-" }}
              </p>
            </div>
            <div class="rounded-lg border border-default/30 px-3 py-2">
              <p class="text-xs text-muted">เครดิตเสริม</p>
              <p class="text-sm font-semibold text-info">
                {{ selectedMember.addonCreditInitial > 0 ? `${selectedMember.addonCreditRemaining}/${selectedMember.addonCreditInitial}` : "-" }}
              </p>
            </div>
            <div class="rounded-lg border border-default/30 px-3 py-2">
              <p class="text-xs text-muted">ยอดใช้จ่ายรวม</p>
              <p class="text-sm font-semibold">฿{{ formatCurrency(selectedMember.totalSpent) }}</p>
            </div>
            <div class="rounded-lg border border-default/30 px-3 py-2">
              <p class="text-xs text-muted">สิทธิ์ใช้งานอยู่</p>
              <p class="text-sm font-semibold">{{ selectedMember.activeCount }}/{{ selectedMember.totalEntitlements }}</p>
            </div>
          </div>

          <!-- แพ็กเกจทั้งหมด -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-highlighted">แพ็กเกจและสิทธิ์</p>
              <UBadge color="neutral" variant="subtle" size="sm">{{ selectedMember.entitlements.length }} รายการ</UBadge>
            </div>

            <p
              v-if="!selectedMember.entitlements.length"
              class="rounded-lg border border-dashed border-default py-4 text-center text-sm text-muted"
            >
              ลูกค้าคนนี้ยังไม่มีแพ็กเกจ
            </p>

            <div
              v-for="ent in selectedMember.entitlements"
              :key="ent.id"
              class="space-y-2 rounded-lg border border-default/30 bg-elevated/30 p-3"
            >
              <div class="flex min-w-0 items-center gap-1.5">
                <UBadge :color="ent.product.packageType === 'MAIN' ? 'primary' : 'info'" variant="subtle" size="xs" class="shrink-0">
                  {{ ent.product.packageType === 'MAIN' ? 'หลัก' : 'เสริม' }}
                </UBadge>
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ ent.product.name }}</span>
                <UBadge :color="STATUS_COLORS[ent.status]" variant="subtle" size="xs" class="shrink-0">
                  {{ STATUS_LABELS[ent.status] }}
                </UBadge>
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-muted">
                    เหลือ {{ ent.creditRemaining ?? 0 }} / {{ ent.creditInitial ?? 0 }} เครดิต
                  </span>
                  <span class="text-muted">{{ formatDate(ent.startAt) }} - {{ formatDate(ent.endAt) }}</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated/70">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="creditBarColor(ent.creditRemaining, ent.creditInitial)"
                    :style="{ width: `${creditPercent(ent.creditRemaining, ent.creditInitial)}%` }"
                  />
                </div>
                <p
                  v-if="ent.status === 'ACTIVE' && ent.endAt"
                  class="text-xs"
                  :class="isExpiringSoon(ent.endAt) ? 'font-medium text-warning' : 'text-muted'"
                >
                  {{ expiryHint(ent.endAt) }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <UButton
                  label="แก้ไข"
                  icon="i-lucide-pencil"
                  color="primary"
                  variant="subtle"
                  size="xs"
                  @click="openEntEdit(ent)"
                />
                <UButton
                  v-if="ent.status === 'ACTIVE'"
                  label="ปิดใช้งาน"
                  icon="i-lucide-calendar-x"
                  color="warning"
                  variant="subtle"
                  size="xs"
                  :loading="expiringEnt?.id === ent.id && isEntExpiring"
                  @click="openEntExpire(ent)"
                />
                <UButton
                  label="ลบ"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  class="ml-auto"
                  @click="openEntDelete(ent)"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="space-y-3 py-2">
          <USkeleton class="h-12 w-full rounded-lg" />
          <USkeleton class="h-24 w-full rounded-lg" />
          <USkeleton class="h-40 w-full rounded-lg" />
        </div>
      </template>
    </UDrawer>

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
            <span class="font-semibold">{{ deletingEnt?.product.name }}</span>
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
            <span class="font-semibold">{{ expiringEnt?.product.name }}</span>
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
          <p>คุณต้องการลบลูกค้า <span class="font-semibold">{{ selectedMember?.name || selectedMember?.email }}</span> ใช่หรือไม่?</p>
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
