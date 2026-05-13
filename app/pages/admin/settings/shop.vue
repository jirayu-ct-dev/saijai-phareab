<script setup lang="ts">
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const { settings, isLoading, updateSettings } = useAdminShopSettings();

const form = reactive({
  name: "",
  phone: "",
  address: "",
  logoUrl: undefined as string | undefined,
  lineQrImageUrl: undefined as string | undefined,
});

watch(
  settings,
  (val) => {
    if (!val) return;
    form.name = val.name;
    form.phone = val.phone;
    form.address = val.address;
    form.logoUrl = val.logoUrl ?? undefined;
    form.lineQrImageUrl = val.lineQrImageUrl ?? undefined;
  },
  { immediate: true },
);

const logoFile = ref<File | null>(null);
const lineQrFile = ref<File | null>(null);
const isSaving = ref(false);

const logoPhotos = computed<Photo[]>(() => {
  if (logoFile.value) return [{ key: "logo", file: logoFile.value, url: null }];
  return form.logoUrl ? [{ key: "logo", file: null, url: form.logoUrl }] : [];
});

const onLogoPhotosUpdate = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  logoFile.value = photo?.file ?? null;
  if (!photo) form.logoUrl = undefined;
};

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

  const logoOk = await uploadIfNeeded(logoFile, "/api/admin/settings/shop-logo", (url) => (form.logoUrl = url));
  if (!logoOk) { isSaving.value = false; return; }

  const qrOk = await uploadIfNeeded(lineQrFile, "/api/admin/settings/line-qr", (url) => (form.lineQrImageUrl = url));
  if (!qrOk) { isSaving.value = false; return; }

  await updateSettings({
    name: form.name,
    phone: form.phone,
    address: form.address,
    logoUrl: form.logoUrl ?? null,
    lineQrImageUrl: form.lineQrImageUrl ?? null,
  });
  isSaving.value = false;
};
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-3 p-2 sm:space-y-4 sm:p-6">
    <div class="rounded-md border border-default/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <h1 class="text-xl font-semibold">ข้อมูลร้าน</h1>
      <p class="mt-1 text-sm text-muted">ข้อมูลพื้นฐานของร้านที่แสดงบนใบเสร็จและสลิป</p>
    </div>

    <ClientOnly>
      <USkeleton v-if="isLoading" class="h-64 w-full rounded-md" />

      <UCard v-else class="p-2">
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

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="โลโก้ร้าน" name="logoUrl">
              <UIPhotoUpload
                label="รูปโลโก้ร้าน"
                description="รูปที่แสดงบนใบเสร็จและสลิป"
                :photos="logoPhotos"
                :max="1"
                @update:photos="onLogoPhotosUpdate"
              />
            </UFormField>

            <UFormField label="QR Code LINE" name="lineQrImageUrl">
              <UIPhotoUpload
                label="รูป QR Code LINE"
                description="รูป QR Code สำหรับแสดงท้ายใบเสร็จ"
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
      </UCard>

      <template #fallback>
        <USkeleton class="h-64 w-full rounded-md" />
      </template>
    </ClientOnly>
  </div>
</template>
