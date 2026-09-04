<script setup lang="ts">
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const {
  settings,
  isLoading,
  updateSettings,
  paymentQrSettings,
  isPaymentQrLoading,
  updatePaymentQr,
} = useAdminShopSettings();

const form = reactive({
  name: "",
  phone: "",
  address: "",
  lineQrImageUrl: undefined as string | undefined,
});

watch(
  settings,
  (val) => {
    if (!val) return;
    form.name = val.name;
    form.phone = val.phone;
    form.address = val.address;
    form.lineQrImageUrl = val.lineQrImageUrl ?? undefined;
  },
  { immediate: true },
);

const lineQrFile = ref<File | null>(null);
const isSaving = ref(false);
const isSavingPaymentQr = ref(false);
const paymentQrError = ref("");
const paymentQrForm = reactive({
  enabled: false,
  receiverValue: "",
  receiverLabel: "",
});

watch(paymentQrSettings, (value) => {
  if (!value) return;
  paymentQrForm.enabled = value.enabled;
  paymentQrForm.receiverValue = "";
  paymentQrForm.receiverLabel = value.receiverLabel || settings.value?.name || "ร้านใส่ใจ ผ้าเรียบ";
}, { immediate: true });

const lineQrPhotos = computed<Photo[]>(() => {
  if (lineQrFile.value) return [{ key: "line-qr", file: lineQrFile.value, url: null }];
  return form.lineQrImageUrl ? [{ key: "line-qr", file: null, url: form.lineQrImageUrl }] : [];
});

const onLineQrPhotosUpdate = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  lineQrFile.value = photo?.file ?? null;
  if (!photo) form.lineQrImageUrl = undefined;
};

const uploadIfNeeded = async (file: Ref<File | null>, endpoint: string, onSuccess: (url: string) => void) => {
  if (!file.value) return true;
  const fd = new FormData();
  fd.append("file", file.value);
  try {
    const res = await $fetch<{ secureUrl: string }>(endpoint, { method: "POST", body: fd });
    onSuccess(res.secureUrl);
    file.value = null;
    return true;
  } catch {
    useNotify().serverError();
    return false;
  }
};

const onSubmit = async () => {
  isSaving.value = true;

  const qrOk = await uploadIfNeeded(lineQrFile, "/api/admin/settings/line-qr", (url) => (form.lineQrImageUrl = url));
  if (!qrOk) { isSaving.value = false; return; }

  await updateSettings({
    name: form.name,
    phone: form.phone,
    address: form.address,
    lineQrImageUrl: form.lineQrImageUrl ?? null,
  });
  isSaving.value = false;
};

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "ไม่สามารถบันทึกการตั้งค่า PromptPay ได้";
  const candidate = error as { statusMessage?: unknown; data?: { statusMessage?: unknown } };
  const message = candidate.data?.statusMessage ?? candidate.statusMessage;
  return typeof message === "string" ? message : "ไม่สามารถบันทึกการตั้งค่า PromptPay ได้";
};

const onPaymentQrSubmit = async () => {
  if (isSavingPaymentQr.value) return;
  isSavingPaymentQr.value = true;
  paymentQrError.value = "";
  try {
    await updatePaymentQr({
      enabled: paymentQrForm.enabled,
      receiverValue: paymentQrForm.receiverValue.trim() || null,
      receiverLabel: paymentQrForm.receiverLabel,
    });
    paymentQrForm.receiverValue = "";
  } catch (error) {
    paymentQrError.value = errorMessage(error);
  } finally {
    isSavingPaymentQr.value = false;
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <h1 class="text-xl font-semibold text-highlighted">ข้อมูลร้าน</h1>
      <p class="mt-1 text-sm text-muted">ข้อมูลพื้นฐานของร้านที่แสดงบนใบเสร็จและสลิป</p>
    </section>

    <section v-if="isLoading" class="-mx-2 space-y-4 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <div class="grid gap-4 sm:grid-cols-2">
        <div v-for="i in 2" :key="`shop-f1-${i}`" class="space-y-1.5">
          <USkeleton class="h-3 w-24 rounded-lg" />
          <USkeleton class="h-9 w-full rounded-lg" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <USkeleton class="h-3 w-24 rounded-lg" />
          <USkeleton class="h-20 w-full rounded-lg" />
        </div>
      </div>
      <div class="space-y-4">
        <div v-for="i in 2" :key="`shop-i-${i}`" class="space-y-1.5">
          <USkeleton class="h-3 w-24 rounded-lg" />
          <USkeleton class="h-28 w-full rounded-lg" />
        </div>
      </div>
      <div class="flex justify-end border-t border-default pt-3">
        <USkeleton class="h-9 w-24 rounded-lg" />
      </div>
    </section>

    <ClientOnly v-else>
      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <UForm :state="form" class="space-y-4" @submit="onSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="ชื่อร้าน" name="name" required>
              <UInput v-model="form.name" placeholder="เช่น ร้านไสใจ ซักอบรีด" class="w-full" />
            </UFormField>

            <UFormField label="เบอร์โทรศัพท์" name="phone">
              <UInput v-model="form.phone" placeholder="เช่น 081-234-5678" class="w-full" />
            </UFormField>

            <UFormField label="ที่อยู่ร้าน" name="address" class="sm:col-span-2">
              <UTextarea v-model="form.address" placeholder="ที่อยู่ร้านสำหรับแสดงบนใบเสร็จ" :rows="3" class="w-full" />
            </UFormField>
          </div>

          <div class="space-y-4">
            <UFormField label="โลโก้ร้าน" name="logoUrl">
              <div class="flex items-center gap-4 rounded-md border border-default p-3">
                <img
                  src="/logo-saijai-phareab.png"
                  alt="โลโก้ร้านใส่ใจ ผ้าเรียบ"
                  class="size-24 shrink-0 rounded-md bg-white object-contain p-1"
                >
                <div>
                  <p class="text-sm font-medium text-highlighted">ใช้โลโก้หลักของระบบ</p>
                  <p class="mt-1 text-xs text-muted">แสดงจากไฟล์ logo-saijai-phareab.png บนหัวเอกสารและใบพิมพ์</p>
                </div>
              </div>
            </UFormField>

            <UFormField label="QR Code LINE" name="lineQrImageUrl">
              <UIPhotoUpload
                label="รูป QR Code LINE"
                description="เมื่อมีรูป ระบบจะแสดง QR Code ตรงกลางท้ายใบเสร็จอัตโนมัติ"
                :photos="lineQrPhotos"
                :max="1"
                @update:photos="onLineQrPhotosUpdate"
              />
            </UFormField>
          </div>

          <div class="flex justify-end border-t border-default pt-3">
            <UButton type="submit" :loading="isSaving" icon="i-lucide-save">
              บันทึก
            </UButton>
          </div>
        </UForm>
      </section>

      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-highlighted">QR ชำระเงิน PromptPay</h2>
          <p class="mt-1 text-sm text-muted">สร้าง QR พร้อมยอดจริงท้ายใบแจ้งราคาที่ยังไม่ชำระ หมายเลขเต็มถูกเข้ารหัสและไม่แสดงกลับหน้าเว็บ</p>
        </div>

        <div v-if="isPaymentQrLoading" class="space-y-3">
          <USkeleton class="h-9 w-full rounded-lg" />
          <USkeleton class="h-9 w-full rounded-lg" />
        </div>

        <UForm v-else :state="paymentQrForm" class="space-y-4" @submit="onPaymentQrSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="หมายเลขโทรศัพท์ PromptPay" name="receiverValue">
              <UInput
                v-model="paymentQrForm.receiverValue"
                type="tel"
                inputmode="tel"
                autocomplete="off"
                :placeholder="paymentQrSettings?.configured ? `ตั้งค่าแล้ว ลงท้าย ${paymentQrSettings.receiverLast4}` : 'เช่น 081-234-5678'"
                class="w-full"
              />
              <p v-if="paymentQrSettings?.configured" class="mt-1 text-xs text-muted">เว้นว่างไว้เพื่อใช้หมายเลขเดิม</p>
            </UFormField>

            <UFormField label="ชื่อผู้รับเงิน" name="receiverLabel" required>
              <UInput v-model="paymentQrForm.receiverLabel" maxlength="100" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-between gap-3 rounded-md border border-default p-3">
            <div>
              <p class="text-sm font-medium text-highlighted">แสดง QR ท้ายใบแจ้งราคา</p>
              <p class="mt-0.5 text-xs text-muted">แสดงเฉพาะรายการ UNPAID ที่มียอดมากกว่า 0 บาท</p>
            </div>
            <USwitch v-model="paymentQrForm.enabled" aria-label="แสดง QR PromptPay ท้ายใบแจ้งราคา" />
          </div>

          <p v-if="paymentQrError" role="alert" class="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {{ paymentQrError }}
          </p>

          <div class="flex justify-end border-t border-default pt-3">
            <UButton type="submit" :loading="isSavingPaymentQr" icon="i-lucide-save">
              บันทึก PromptPay
            </UButton>
          </div>
        </UForm>
      </section>

    </ClientOnly>
  </div>
</template>
