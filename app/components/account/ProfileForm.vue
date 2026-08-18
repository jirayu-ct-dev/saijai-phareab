<script setup lang="ts">
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";
import { authClient } from "~~/app/utils/auth-client";

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
  customerAccountStatus?: "OFFLINE" | "ACTIVE";
};

const notify = useNotify();
const route = useRoute();
const router = useRouter();
const { refreshSession } = useUser();

const { data, status, refresh } = useFetch<ProfileResponse>("/api/me/profile", {
  key: "me-profile",
  lazy: true,
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
const emailChangeOpen = ref(false);
const newEmail = ref("");
const pendingEmail = ref<string | null>(null);
const isChangingEmail = ref(false);

const changeEmail = async () => {
  const email = newEmail.value.trim().toLowerCase();
  if (!email) return notify.validationError("กรุณากรอกอีเมลใหม่");
  if (email.endsWith("@saijai.local")) return notify.validationError("ไม่สามารถใช้อีเมลภายในของระบบได้");
  if (email === data.value?.email.toLowerCase()) return notify.validationError("อีเมลใหม่ต้องต่างจากอีเมลปัจจุบัน");
  isChangingEmail.value = true;
  try {
    const { error } = await authClient.changeEmail({
      newEmail: email,
      callbackURL: "/me/settings/profile?emailChanged=1",
    });
    if (error) throw new Error(error.message || "ไม่สามารถเปลี่ยนอีเมลได้");
    pendingEmail.value = email;
    notify.success("ส่งลิงก์ยืนยันไปยังอีเมลใหม่แล้ว");
    emailChangeOpen.value = false;
    newEmail.value = "";
  } catch (error: unknown) {
    notify.error(error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนอีเมลได้");
  } finally {
    isChangingEmail.value = false;
  }
};

onMounted(async () => {
  if (route.query.emailChanged !== "1") return;
  try {
    const { error } = await authClient.revokeOtherSessions();
    if (error) throw new Error(error.message || "ไม่สามารถยกเลิกเซสชันอื่นได้");
    pendingEmail.value = null;
    await Promise.all([refresh(), refreshSession()]);
    notify.success("ยืนยันอีเมลใหม่แล้ว และออกจากระบบบนอุปกรณ์อื่นเรียบร้อยแล้ว");
  } catch (error: unknown) {
    notify.error(error instanceof Error ? error.message : "เปลี่ยนอีเมลแล้ว แต่ไม่สามารถยกเลิกเซสชันอื่นได้");
  } finally {
    const nextQuery = { ...route.query };
    delete nextQuery.emailChanged;
    await router.replace({ query: nextQuery });
  }
});

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
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "data" in error
      ? (error as { data?: { statusMessage?: string; message?: string } }).data?.statusMessage
        || (error as { data?: { message?: string } }).data?.message
      : null;
    notify.error(message || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <USkeleton v-if="isLoading" class="h-64 w-full rounded-lg" />

  <section
    v-else
    class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
  >
    <div class="mb-4">
      <p class="font-semibold text-highlighted">ข้อมูลส่วนตัว</p>
      <p class="mt-1 text-xs text-muted">ชื่อ เบอร์ และรูปโปรไฟล์ของคุณ</p>
    </div>

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

      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="ชื่อ" name="name" required>
          <UInput v-model="form.name" placeholder="ชื่อ-นามสกุล" class="w-full" />
        </UFormField>

        <UFormField label="เบอร์โทรศัพท์" name="phoneNumber">
          <UInput v-model="form.phoneNumber" placeholder="เช่น 081-234-5678" class="w-full" />
        </UFormField>

        <UFormField label="อีเมล" name="email" class="sm:col-span-2">
          <div class="flex gap-2">
            <UInput :model-value="data?.email" disabled class="min-w-0 flex-1" />
            <UButton color="neutral" variant="outline" icon="i-lucide-mail" @click="emailChangeOpen = true">เปลี่ยนอีเมล</UButton>
          </div>
          <template #help>
            <span class="text-xs text-muted">ระบบจะเปลี่ยนอีเมลหลังจากคุณยืนยันอีเมลใหม่แล้ว</span>
          </template>
        </UFormField>

        <div v-if="pendingEmail" class="sm:col-span-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-toned">
          รอยืนยันอีเมลใหม่ <span class="font-medium text-highlighted">{{ pendingEmail }}</span>
          กรุณาเปิดลิงก์ที่ส่งไปยังอีเมลนี้ อีเมลปัจจุบันยังใช้เข้าสู่ระบบได้จนกว่าจะยืนยันสำเร็จ
        </div>
      </div>
    </UForm>

    <div class="mt-4 flex justify-end border-t border-default pt-3">
      <UButton :loading="isSaving" icon="i-lucide-save" @click="onSubmit">บันทึก</UButton>
    </div>
  </section>

  <UModal v-model:open="emailChangeOpen" title="เปลี่ยนอีเมล" description="เราจะส่งลิงก์ยืนยันไปยังอีเมลใหม่">
    <template #body>
      <UForm :state="{ newEmail }" class="space-y-4" @submit="changeEmail">
        <UFormField label="อีเมลปัจจุบัน">
          <UInput :model-value="data?.email" disabled class="w-full" />
        </UFormField>
        <UFormField label="อีเมลใหม่" required>
          <UInput v-model="newEmail" type="email" autocomplete="email" class="w-full" placeholder="new-email@example.com" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emailChangeOpen = false">ยกเลิก</UButton>
        <UButton icon="i-lucide-send" :loading="isChangingEmail" @click="changeEmail">ส่งลิงก์ยืนยัน</UButton>
      </div>
    </template>
  </UModal>
</template>
