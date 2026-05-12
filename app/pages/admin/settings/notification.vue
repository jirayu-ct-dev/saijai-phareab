<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

type NotificationSetting = {
  id: string;
  notifyCustomerOnReceived: boolean;
  notifyCustomerOnProcessing: boolean;
  notifyCustomerOnDelivering: boolean;
  notifyCustomerOnCompleted: boolean;
  notifyCustomerOnCancelled: boolean;
  notifyCustomerReceipt: boolean;
  notifyStaffOnNewOrder: boolean;
  updatedAt: string;
};

type Subscriber = {
  id: string;
  userId: string;
  isActive: boolean;
  receiveNewOrder: boolean;
  receiveStatusChange: boolean;
  receiveReceipt: boolean;
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

const { data, status, refresh } = await useFetch<{ setting: NotificationSetting; subscribers: Subscriber[] }>(
  "/api/admin/settings/notification",
  { key: "admin-notification-setting" },
);

const { data: staffOptions } = await useFetch<StaffOption[]>("/api/admin/staff-options", {
  key: "admin-staff-options",
});

const isLoading = computed(() => status.value === "pending");

const form = reactive({
  notifyCustomerOnReceived: true,
  notifyCustomerOnProcessing: true,
  notifyCustomerOnDelivering: true,
  notifyCustomerOnCompleted: true,
  notifyCustomerOnCancelled: true,
  notifyCustomerReceipt: true,
  notifyStaffOnNewOrder: true,
});

watch(
  () => data.value?.setting,
  (val) => {
    if (!val) return;
    form.notifyCustomerOnReceived = val.notifyCustomerOnReceived;
    form.notifyCustomerOnProcessing = val.notifyCustomerOnProcessing;
    form.notifyCustomerOnDelivering = val.notifyCustomerOnDelivering;
    form.notifyCustomerOnCompleted = val.notifyCustomerOnCompleted;
    form.notifyCustomerOnCancelled = val.notifyCustomerOnCancelled;
    form.notifyCustomerReceipt = val.notifyCustomerReceipt;
    form.notifyStaffOnNewOrder = val.notifyStaffOnNewOrder;
  },
  { immediate: true },
);

const isSaving = ref(false);
const onSaveSetting = async () => {
  isSaving.value = true;
  try {
    await $fetch("/api/admin/settings/notification", { method: "PUT", body: form });
    notify.updated();
    await refresh();
  } catch {
    notify.serverError();
  } finally {
    isSaving.value = false;
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

const onUpdateSubscriber = async (sub: Subscriber, patch: Partial<Pick<Subscriber, "isActive" | "receiveNewOrder" | "receiveStatusChange" | "receiveReceipt">>) => {
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
  <div class="w-full p-6 max-w-4xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">การแจ้งเตือน</h1>
      <p class="text-sm text-muted mt-1">ตั้งค่าการแจ้งเตือนผ่าน LINE สำหรับลูกค้าและทีมงาน</p>
    </div>

    <USkeleton v-if="isLoading" class="h-64 w-full rounded-md" />

    <template v-else>
      <UCard>
        <template #header>
          <div>
            <p class="font-semibold">แจ้งเตือนลูกค้าตามสถานะผ้า</p>
            <p class="text-xs text-muted mt-1">เมื่อสถานะผ้าเปลี่ยน ระบบจะส่ง LINE ให้ลูกค้าที่ผูกบัญชี LINE</p>
          </div>
        </template>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">รับผ้าแล้ว (RECEIVED)</p>
              <p class="text-xs text-muted">แจ้งเมื่อสร้างออเดอร์รับผ้าใหม่</p>
            </div>
            <USwitch v-model="form.notifyCustomerOnReceived" />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">กำลังดำเนินการ (PROCESSING)</p>
            </div>
            <USwitch v-model="form.notifyCustomerOnProcessing" />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">พร้อมส่ง / กำลังจัดส่ง (DELIVERING)</p>
            </div>
            <USwitch v-model="form.notifyCustomerOnDelivering" />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">เสร็จสิ้น (COMPLETED)</p>
            </div>
            <USwitch v-model="form.notifyCustomerOnCompleted" />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">ยกเลิก (CANCELLED)</p>
            </div>
            <USwitch v-model="form.notifyCustomerOnCancelled" />
          </div>

          <div class="border-t border-default pt-3" />

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">ส่งใบเสร็จขายแพ็กเกจให้ลูกค้า</p>
              <p class="text-xs text-muted">เมื่อสร้างรายการขายแพ็กเกจ ระบบจะส่งใบเสร็จทาง LINE</p>
            </div>
            <USwitch v-model="form.notifyCustomerReceipt" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">แจ้งพนักงานเมื่อมีออเดอร์ใหม่</p>
              <p class="text-xs text-muted">ส่ง LINE ให้พนักงานทันทีที่บันทึกรายการผ้าจากหน้า POS</p>
            </div>
            <USwitch v-model="form.notifyStaffOnNewOrder" />
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton :loading="isSaving" icon="i-lucide-save" @click="onSaveSetting">บันทึกการตั้งค่า</UButton>
          </div>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="font-semibold">ผู้รับการแจ้งเตือนของร้าน</p>
              <p class="text-xs text-muted mt-1">ผู้ที่จะได้รับ LINE สำหรับการแจ้งเตือนของร้าน (เฉพาะ ADMIN/EMPLOYEE)</p>
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
        </template>

        <div v-if="!data?.subscribers?.length" class="rounded-md border border-dashed border-default p-8 text-center text-sm text-muted">
          ยังไม่มีผู้รับการแจ้งเตือน
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="sub in data.subscribers"
            :key="sub.id"
            class="rounded-md border border-default p-4 space-y-3"
          >
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-3">
                <UAvatar v-bind="getAvatarProps(sub.user.image, sub.user.name, sub.user.email)" size="md" />
                <div>
                  <p class="font-medium">{{ sub.user.name || sub.user.email }}</p>
                  <p class="text-xs text-muted">{{ sub.user.email }} · {{ roleLabel(sub.user.role) }}</p>
                  <p v-if="!sub.user.hasLineLinked" class="text-xs text-warning mt-1">
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

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-default">
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
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
