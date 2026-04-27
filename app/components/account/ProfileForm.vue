<script setup lang="ts">
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

type ProfileResponse = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  phoneNumber: string | null;
  role: "ADMIN" | "EMPLOYEE" | "USER";
  emailVerified: boolean;
  createdAt: string;
  hasLineLinked: boolean;
  hasPasswordCredential: boolean;
};

const notify = useNotify();
const { refreshSession } = useUser();

const { data, status, refresh } = await useFetch<ProfileResponse>("/api/me/profile", {
  key: "me-profile",
});

const isLoading = computed(() => status.value === "pending");

const form = reactive({
  name: "",
  phoneNumber: "",
  image: undefined as string | undefined,
});

watch(
  data,
  (val) => {
    if (!val) return;
    form.name = val.name ?? "";
    form.phoneNumber = val.phoneNumber ?? "";
    form.image = val.image ?? undefined;
  },
  { immediate: true },
);

const avatarFile = ref<File | null>(null);
const avatarPhotos = computed<Photo[]>(() => {
  if (avatarFile.value) return [{ key: "avatar", file: avatarFile.value, url: null }];
  return form.image ? [{ key: "avatar", file: null, url: form.image }] : [];
});

const onAvatarChange = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  avatarFile.value = photo?.file ?? null;
  if (!photo) form.image = undefined;
};

const isSaving = ref(false);

const onSubmit = async () => {
  isSaving.value = true;
  try {
    if (avatarFile.value) {
      const fd = new FormData();
      fd.append("file", avatarFile.value);
      const res = await $fetch<{ secureUrl: string }>("/api/me/avatar", { method: "POST", body: fd });
      form.image = res.secureUrl;
      avatarFile.value = null;
    }

    await $fetch("/api/me/profile", {
      method: "PUT",
      body: {
        name: form.name.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        image: form.image ?? null,
      },
    });

    notify.updated();
    await Promise.all([refresh(), refreshSession()]);
  } catch {
    notify.serverError();
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <USkeleton v-if="isLoading" class="h-64 w-full rounded-lg" />

  <UCard v-else>
    <template #header>
      <div>
        <p class="font-semibold">ข้อมูลส่วนตัว</p>
        <p class="text-xs text-muted mt-1">ชื่อ เบอร์ และรูปโปรไฟล์ของคุณ</p>
      </div>
    </template>

    <UForm :state="form" class="space-y-4" @submit="onSubmit">
      <UFormField label="รูปโปรไฟล์" name="image">
        <UIPhotoUpload
          label="รูปโปรไฟล์"
          description="แสดงในเมนูและรายการต่างๆ"
          :photos="avatarPhotos"
          :max="1"
          @update:photos="onAvatarChange"
        />
      </UFormField>

      <UFormField label="ชื่อ" name="name" required>
        <UInput v-model="form.name" placeholder="ชื่อ-นามสกุล" class="w-full" />
      </UFormField>

      <UFormField label="เบอร์โทรศัพท์" name="phoneNumber">
        <UInput v-model="form.phoneNumber" placeholder="เช่น 081-234-5678" class="w-full" />
      </UFormField>

      <UFormField label="อีเมล" name="email">
        <UInput :model-value="data?.email" disabled class="w-full" />
        <template #help>
          <span class="text-xs text-muted">อีเมลใช้สำหรับเข้าสู่ระบบ ไม่สามารถเปลี่ยนได้</span>
        </template>
      </UFormField>
    </UForm>

    <template #footer>
      <div class="flex justify-end">
        <UButton :loading="isSaving" icon="i-lucide-save" @click="onSubmit">บันทึก</UButton>
      </div>
    </template>
  </UCard>
</template>
