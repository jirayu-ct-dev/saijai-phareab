<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

type NotificationSetting = {
  id: string;
  notifyCustomerOnQuotation: boolean;
  notifyCustomerOnReceived: boolean;
  notifyCustomerOnProcessing: boolean;
  notifyCustomerOnDelivering: boolean;
  notifyCustomerOnCompleted: boolean;
  notifyCustomerOnCancelled: boolean;
  notifyCustomerReceipt: boolean;
  notifyStaffOnNewOrder: boolean;
  notifyCustomerOnPackageExpiring: boolean;
  pickupConfirmationEnabled: boolean;
  pickupInitialDaysBefore: number;
  pickupInitialTime: string;
  pickupReminderEnabled: boolean;
  pickupReminderDaysBefore: number;
  pickupReminderTime: string;
  pickupMinimumLeadMinutes: number;
  updatedAt: string;
};

type Subscriber = {
  id: string;
  userId: string;
  isActive: boolean;
  receiveNewOrder: boolean;
  receiveStatusChange: boolean;
  receiveReceipt: boolean;
  receivePickupResponse: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: "ADMIN" | "EMPLOYEE" | "USER";
    hasLineLinked: boolean;
  };
};

type StaffOption = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "EMPLOYEE";
  hasLineLinked: boolean;
};

const notify = useNotify();

const { data, status, refresh } = useFetch<{ setting: NotificationSetting; subscribers: Subscriber[] }>(
  "/api/admin/settings/notification",
  { key: "admin-notification-setting", lazy: true },
);

const { data: staffOptions } = useFetch<StaffOption[]>("/api/admin/staff-options", {
  key: "admin-staff-options",
  lazy: true,
  default: () => [],
});

const isLoading = computed(() => status.value === "pending");

const form = reactive({
  notifyCustomerOnQuotation: true,
  notifyCustomerOnReceived: true,
  notifyCustomerOnProcessing: true,
  notifyCustomerOnDelivering: true,
  notifyCustomerOnCompleted: true,
  notifyCustomerOnCancelled: true,
  notifyCustomerReceipt: true,
  notifyStaffOnNewOrder: true,
  notifyCustomerOnPackageExpiring: true,
});

const pickupForm = reactive({
  pickupConfirmationEnabled: true,
  pickupInitialDaysBefore: 1,
  pickupInitialTime: "12:15",
  pickupReminderEnabled: true,
  pickupReminderDaysBefore: 0,
  pickupReminderTime: "12:15",
  pickupMinimumLeadMinutes: 120,
});

const minimumLeadItems = [
  { label: "30 นาที", value: 30 },
  { label: "1 ชั่วโมง", value: 60 },
  { label: "2 ชั่วโมง", value: 120 },
  { label: "3 ชั่วโมง", value: 180 },
  { label: "6 ชั่วโมง", value: 360 },
];
const isSavingPickup = ref(false);
const pickupPreview = computed(() => {
  const initialDay = pickupForm.pickupInitialDaysBefore === 0
    ? "วันนัด"
    : `ก่อนวันนัด ${pickupForm.pickupInitialDaysBefore} วัน`;
  const reminder = pickupForm.pickupReminderEnabled
    ? ` และเตือนซ้ำ${pickupForm.pickupReminderDaysBefore === 0 ? "วันนัด" : `ก่อนวันนัด ${pickupForm.pickupReminderDaysBefore} วัน`} เวลา ${pickupForm.pickupReminderTime} น.`
    : "";
  return `ระบบจะถาม${initialDay} เวลา ${pickupForm.pickupInitialTime} น.${reminder}`;
});

watch(
  () => data.value?.setting,
  (val) => {
    if (!val) return;
    form.notifyCustomerOnQuotation = val.notifyCustomerOnQuotation;
    form.notifyCustomerOnReceived = val.notifyCustomerOnReceived;
    form.notifyCustomerOnProcessing = val.notifyCustomerOnProcessing;
    form.notifyCustomerOnDelivering = val.notifyCustomerOnDelivering;
    form.notifyCustomerOnCompleted = val.notifyCustomerOnCompleted;
    form.notifyCustomerOnCancelled = val.notifyCustomerOnCancelled;
    form.notifyCustomerReceipt = val.notifyCustomerReceipt;
    form.notifyStaffOnNewOrder = val.notifyStaffOnNewOrder;
    form.notifyCustomerOnPackageExpiring = val.notifyCustomerOnPackageExpiring;
    pickupForm.pickupConfirmationEnabled = val.pickupConfirmationEnabled;
    pickupForm.pickupInitialDaysBefore = val.pickupInitialDaysBefore;
    pickupForm.pickupInitialTime = val.pickupInitialTime;
    pickupForm.pickupReminderEnabled = val.pickupReminderEnabled;
    pickupForm.pickupReminderDaysBefore = val.pickupReminderDaysBefore;
    pickupForm.pickupReminderTime = val.pickupReminderTime;
    pickupForm.pickupMinimumLeadMinutes = val.pickupMinimumLeadMinutes;
  },
  { immediate: true },
);

type SettingKey =
  | "notifyCustomerOnQuotation"
  | "notifyCustomerOnReceived"
  | "notifyCustomerOnProcessing"
  | "notifyCustomerOnDelivering"
  | "notifyCustomerOnCompleted"
  | "notifyCustomerOnCancelled"
  | "notifyCustomerReceipt"
  | "notifyStaffOnNewOrder"
  | "notifyCustomerOnPackageExpiring";

const pendingKeys = reactive(new Set<SettingKey>());
const isPending = (key: SettingKey) => pendingKeys.has(key);

const onToggleSetting = async (key: SettingKey, value: boolean) => {
  const prev = form[key];
  form[key] = value;
  pendingKeys.add(key);
  try {
    await $fetch("/api/admin/settings/notification", {
      method: "PUT",
      body: { ...form, ...pickupForm, [key]: value },
    });
  } catch {
    form[key] = prev;
    notify.serverError();
  } finally {
    pendingKeys.delete(key);
  }
};

const onSavePickupSetting = async () => {
  isSavingPickup.value = true;
  try {
    await $fetch("/api/admin/settings/notification", {
      method: "PUT",
      body: { ...form, ...pickupForm },
    });
    notify.saved("การตั้งค่ายืนยันการรับผ้า");
    await refresh();
  } catch {
    notify.validationError("กรุณาตรวจสอบวันและเวลาของการถามครั้งแรกกับการเตือนซ้ำ");
  } finally {
    isSavingPickup.value = false;
  }
};

const subscriberUserIds = computed(() => new Set((data.value?.subscribers ?? []).map((s) => s.userId)));
const availableStaff = computed(() => (staffOptions.value ?? []).filter((s) => !subscriberUserIds.value.has(s.id)));

const selectedStaffId = ref<string | undefined>(undefined);
const isAdding = ref(false);

const onAddSubscriber = async () => {
  if (!selectedStaffId.value) return;
  isAdding.value = true;
  try {
    await $fetch("/api/admin/settings/notification-subscribers", {
      method: "POST",
      body: { userId: selectedStaffId.value },
    });
    selectedStaffId.value = undefined;
    notify.created();
    await refresh();
  } catch {
    notify.serverError();
  } finally {
    isAdding.value = false;
  }
};

const onUpdateSubscriber = async (sub: Subscriber, patch: Partial<Pick<Subscriber, "isActive" | "receiveNewOrder" | "receiveStatusChange" | "receiveReceipt" | "receivePickupResponse">>) => {
  try {
    await $fetch(`/api/admin/settings/notification-subscribers/${sub.id}`, { method: "PUT", body: patch });
    await refresh();
  } catch {
    notify.serverError();
  }
};

const onRemoveSubscriber = async (sub: Subscriber) => {
  try {
    await $fetch(`/api/admin/settings/notification-subscribers/${sub.id}`, { method: "DELETE" });
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
const roleLabel = (role: "ADMIN" | "EMPLOYEE" | "USER") =>
  role === "ADMIN" ? "ผู้ดูแล" : role === "EMPLOYEE" ? "พนักงาน" : "ลูกค้า";
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <h1 class="text-xl font-semibold text-highlighted">การแจ้งเตือน</h1>
      <p class="mt-1 text-sm text-muted">ตั้งค่าการแจ้งเตือนผ่าน LINE สำหรับลูกค้าและทีมงาน</p>
    </section>

    <template v-if="isLoading">
      <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="space-y-1.5 border-b border-default/40 pb-3">
          <USkeleton class="h-4 w-48 rounded" />
          <USkeleton class="h-3 w-64 rounded" />
        </div>
        <div v-for="i in 9" :key="`nt-row-${i}`" class="flex items-center justify-between gap-3">
          <div class="space-y-1">
            <USkeleton class="h-3.5 w-40 rounded" />
            <USkeleton class="h-2.5 w-56 rounded" />
          </div>
          <USkeleton class="h-5 w-9 rounded-full shrink-0" />
        </div>
      </div>
      <div class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="flex items-center justify-between gap-3 border-b border-default/40 pb-3">
          <div class="space-y-1">
            <USkeleton class="h-4 w-44 rounded" />
            <USkeleton class="h-3 w-60 rounded" />
          </div>
          <USkeleton class="h-9 w-28 rounded-lg" />
        </div>
        <div v-for="i in 3" :key="`nt-sub-${i}`" class="space-y-2 rounded-lg border border-default p-3">
          <div class="flex items-center gap-3">
            <USkeleton class="size-10 rounded-full" />
            <div class="flex-1 space-y-1">
              <USkeleton class="h-3.5 w-32 rounded" />
              <USkeleton class="h-2.5 w-48 rounded" />
            </div>
            <USkeleton class="h-5 w-9 rounded-full" />
          </div>
          <div class="grid grid-cols-3 gap-3 border-t border-default pt-2">
            <USkeleton v-for="j in 3" :key="`nt-sub-${i}-${j}`" class="h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <p class="font-semibold text-highlighted">แจ้งเตือนลูกค้าตามสถานะผ้า</p>
          <p class="mt-1 text-xs text-muted">เมื่อสถานะผ้าเปลี่ยน ระบบจะส่ง LINE ให้ลูกค้าที่ผูกบัญชี LINE</p>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">ใบแจ้งราคา</p>
              <p class="text-xs text-muted">แจ้งลูกค้าเมื่อออกใบแจ้งราคาที่รอชำระ</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnQuotation"
              :loading="isPending('notifyCustomerOnQuotation')"
              :disabled="isPending('notifyCustomerOnQuotation')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnQuotation', v)"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">รับผ้าแล้ว (RECEIVED)</p>
              <p class="text-xs text-muted">แจ้งเมื่อสร้างออเดอร์รับผ้าใหม่</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnReceived"
              :loading="isPending('notifyCustomerOnReceived')"
              :disabled="isPending('notifyCustomerOnReceived')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnReceived', v)"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">กำลังดำเนินการ (PROCESSING)</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnProcessing"
              :loading="isPending('notifyCustomerOnProcessing')"
              :disabled="isPending('notifyCustomerOnProcessing')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnProcessing', v)"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">พร้อมส่ง / กำลังจัดส่ง (DELIVERING)</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnDelivering"
              :loading="isPending('notifyCustomerOnDelivering')"
              :disabled="isPending('notifyCustomerOnDelivering')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnDelivering', v)"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">เสร็จสิ้น (COMPLETED)</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnCompleted"
              :loading="isPending('notifyCustomerOnCompleted')"
              :disabled="isPending('notifyCustomerOnCompleted')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnCompleted', v)"
            />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">ยกเลิก (CANCELLED)</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnCancelled"
              :loading="isPending('notifyCustomerOnCancelled')"
              :disabled="isPending('notifyCustomerOnCancelled')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnCancelled', v)"
            />
          </div>

          <div class="border-t border-default pt-3" />

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">ส่งใบเสร็จให้ลูกค้า</p>
              <p class="text-xs text-muted">เมื่อชำระเงิน ระบบจะส่งใบเสร็จทาง LINE</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerReceipt"
              :loading="isPending('notifyCustomerReceipt')"
              :disabled="isPending('notifyCustomerReceipt')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerReceipt', v)"
            />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">แจ้งเตือนแพ็กเกจใกล้หมดอายุ</p>
              <p class="text-xs text-muted">ส่งตามรอบ cron ก่อนแพ็กเกจหมดอายุ</p>
            </div>
            <USwitch
              :model-value="form.notifyCustomerOnPackageExpiring"
              :loading="isPending('notifyCustomerOnPackageExpiring')"
              :disabled="isPending('notifyCustomerOnPackageExpiring')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyCustomerOnPackageExpiring', v)"
            />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">แจ้งพนักงานเมื่อมีออเดอร์ใหม่</p>
              <p class="text-xs text-muted">ส่ง LINE ให้พนักงานทันทีที่บันทึกรายการผ้าจากหน้า POS</p>
            </div>
            <USwitch
              :model-value="form.notifyStaffOnNewOrder"
              :loading="isPending('notifyStaffOnNewOrder')"
              :disabled="isPending('notifyStaffOnNewOrder')"
              @update:model-value="(v: boolean) => onToggleSetting('notifyStaffOnNewOrder', v)"
            />
          </div>
        </div>
      </section>

      <section class="-mx-2 overflow-hidden border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="flex items-start justify-between gap-4 border-b border-default/40 p-4 sm:p-5">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UIcon name="i-lucide-message-circle-question" class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">ยืนยันการรับผ้ารอบถัดไป</p>
              <p class="mt-1 text-xs leading-5 text-muted">ถามลูกค้าก่อนนำผ้าสะอาดไปส่ง เฉพาะออเดอร์ที่เลือกใช้บริการรับ–ส่ง</p>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <USwitch v-model="pickupForm.pickupConfirmationEnabled" />
            <span class="text-[11px] text-muted">{{ pickupForm.pickupConfirmationEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน" }}</span>
          </div>
        </div>

        <div class="space-y-4 p-4 sm:p-5">
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-lg border border-default/50 bg-elevated/45 p-4">
              <div class="mb-4 flex items-center gap-2">
                <UBadge label="1" color="primary" variant="solid" size="xs" />
                <div>
                  <p class="text-sm font-semibold text-highlighted">ข้อความถามครั้งแรก</p>
                  <p class="text-xs text-muted">กำหนดวันและเวลาที่เริ่มถามลูกค้า</p>
                </div>
              </div>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <UFormField label="ล่วงหน้าก่อนวันนัด">
                  <UInput
                    v-model.number="pickupForm.pickupInitialDaysBefore"
                    type="number"
                    :min="0"
                    :max="30"
                    :disabled="!pickupForm.pickupConfirmationEnabled"
                    class="w-full"
                  >
                    <template #trailing><span class="text-xs text-muted">วัน</span></template>
                  </UInput>
                </UFormField>
                <UFormField label="เวลาส่งข้อความ">
                  <UInput
                    v-model="pickupForm.pickupInitialTime"
                    type="time"
                    :disabled="!pickupForm.pickupConfirmationEnabled"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <div class="rounded-lg border border-default/50 bg-elevated/45 p-4">
              <div class="mb-4 flex items-start justify-between gap-3">
                <div class="flex items-center gap-2">
                  <UBadge label="2" color="neutral" variant="solid" size="xs" />
                  <div>
                    <p class="text-sm font-semibold text-highlighted">ข้อความเตือนซ้ำ</p>
                    <p class="text-xs text-muted">ส่งเมื่อข้อความแรกสำเร็จและลูกค้ายังไม่ตอบ</p>
                  </div>
                </div>
                <USwitch
                  v-model="pickupForm.pickupReminderEnabled"
                  :disabled="!pickupForm.pickupConfirmationEnabled"
                  size="sm"
                />
              </div>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <UFormField label="ล่วงหน้าก่อนวันนัด">
                  <UInput
                    v-model.number="pickupForm.pickupReminderDaysBefore"
                    type="number"
                    :min="0"
                    :max="30"
                    :disabled="!pickupForm.pickupConfirmationEnabled || !pickupForm.pickupReminderEnabled"
                    class="w-full"
                  >
                    <template #trailing><span class="text-xs text-muted">วัน</span></template>
                  </UInput>
                </UFormField>
                <UFormField label="เวลาเตือนซ้ำ">
                  <UInput
                    v-model="pickupForm.pickupReminderTime"
                    type="time"
                    :disabled="!pickupForm.pickupConfirmationEnabled || !pickupForm.pickupReminderEnabled"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div class="rounded-lg border border-default/50 p-4">
              <UFormField label="เวลาเตรียมงานขั้นต่ำก่อนส่ง">
                <USelect
                  v-model="pickupForm.pickupMinimumLeadMinutes"
                  :items="minimumLeadItems"
                  value-key="value"
                  :disabled="!pickupForm.pickupConfirmationEnabled"
                  class="w-full"
                />
              </UFormField>
              <p class="mt-2 text-xs leading-5 text-muted">ระบบจะไม่ส่งคำถามช้าจนร้านเหลือเวลาเตรียมงานน้อยกว่าค่านี้</p>
            </div>

            <div class="rounded-lg border border-primary/25 bg-primary/5 p-4">
              <div class="flex items-start gap-3">
                <UIcon name="i-lucide-calendar-clock" class="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-primary">ตัวอย่างตารางส่ง</p>
                  <p class="mt-1 text-sm font-medium leading-6 text-highlighted">{{ pickupPreview }}</p>
                  <p class="mt-1 text-xs leading-5 text-muted">ออเดอร์รอบเช้าอาจถูกเลื่อนเวลาเตือนให้เร็วขึ้น เพื่อให้ร้านมีเวลาเตรียมงานเพียงพอ</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-default/40 bg-elevated/30 px-4 py-3 sm:px-5">
          <p class="hidden text-xs text-muted sm:block">การเปลี่ยนค่านี้จะปรับเฉพาะข้อความที่ยังไม่ถูกส่ง</p>
          <UButton icon="i-lucide-save" :loading="isSavingPickup" class="w-full justify-center sm:ml-auto sm:w-auto" @click="onSavePickupSetting">
            บันทึกการตั้งค่า
          </UButton>
        </div>
      </section>

      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">ผู้รับการแจ้งเตือนของร้าน</p>
              <p class="mt-1 text-xs text-muted">ผู้ที่จะได้รับ LINE สำหรับการแจ้งเตือนของร้าน (เฉพาะ ADMIN/EMPLOYEE)</p>
            </div>
            <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <USelect
                v-model="selectedStaffId"
                :items="availableStaff.map((s) => ({ label: s.name || s.email, value: s.id }))"
                placeholder="เลือกผู้ใช้"
                class="w-full sm:w-60"
                value-key="value"
              />
              <UButton
                icon="i-lucide-plus"
                :disabled="!selectedStaffId"
                :loading="isAdding"
                class="justify-center sm:shrink-0"
                @click="onAddSubscriber"
              >
                เพิ่ม
              </UButton>
            </div>
        </div>

        <div v-if="!data?.subscribers?.length" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
          ยังไม่มีผู้รับการแจ้งเตือน
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="sub in data.subscribers"
            :key="sub.id"
            class="space-y-3 rounded-lg border border-default p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <UAvatar v-bind="getAvatarProps(sub.user.image, sub.user.name, sub.user.email)" size="md" />
                <div>
                  <p class="font-medium">{{ sub.user.name || sub.user.email }}</p>
                  <p class="text-xs text-muted">{{ sub.user.email }} · {{ roleLabel(sub.user.role) }}</p>
                  <p v-if="!sub.user.hasLineLinked" class="mt-1 text-xs text-warning">
                    ⚠ ผู้ใช้ยังไม่ผูกบัญชี LINE จะไม่ได้รับการแจ้งเตือน
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted">เปิดใช้</span>
                  <USwitch
                    :model-value="sub.isActive"
                    @update:model-value="(v: boolean) => onUpdateSubscriber(sub, { isActive: v })"
                  />
                </div>
                <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="onRemoveSubscriber(sub)" />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 border-t border-default pt-2 md:grid-cols-2">
              <div class="flex items-center justify-between">
                <span class="text-sm">ออเดอร์ใหม่</span>
                <USwitch
                  :model-value="sub.receiveNewOrder"
                  :disabled="!sub.isActive"
                  @update:model-value="(v: boolean) => onUpdateSubscriber(sub, { receiveNewOrder: v })"
                />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">เปลี่ยนสถานะผ้า</span>
                <USwitch
                  :model-value="sub.receiveStatusChange"
                  :disabled="!sub.isActive"
                  @update:model-value="(v: boolean) => onUpdateSubscriber(sub, { receiveStatusChange: v })"
                />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">ใบเสร็จ</span>
                <USwitch
                  :model-value="sub.receiveReceipt"
                  :disabled="!sub.isActive"
                  @update:model-value="(v: boolean) => onUpdateSubscriber(sub, { receiveReceipt: v })"
                />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">คำตอบรับผ้ารอบถัดไป</span>
                <USwitch
                  :model-value="sub.receivePickupResponse"
                  :disabled="!sub.isActive"
                  @update:model-value="(v: boolean) => onUpdateSubscriber(sub, { receivePickupResponse: v })"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
