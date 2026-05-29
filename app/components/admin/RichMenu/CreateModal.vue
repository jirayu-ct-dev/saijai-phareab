<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'refresh'): void;
}>();

const notify = useNotify();
const isSaving = ref(false);

const form = reactive({
  name: "",
  jsonContent: JSON.stringify({
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "richmenu-template",
    chatBarText: "เมนูหลัก",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 1686 },
        action: { type: "uri", uri: "https://liff.line.me/your-liff-id/packages" }
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
        action: { type: "message", text: "ติดต่อสอบถาม" }
      }
    ]
  }, null, 2),
  targetRole: "ALL" as string | null,
  isDefault: false,
  logoUrl: undefined as string | undefined,
});

const resetForm = () => {
  form.name = "";
  form.targetRole = "ALL";
  form.isDefault = false;
  form.logoUrl = undefined;
  photoFile.value = null;
  imagePreviewUrl.value = "";
  uploadedImageWidth.value = null;
  uploadedImageHeight.value = null;
};

const duplicate = async (menu: any) => {
  resetForm();
  form.name = `${menu.name} (คัดลอก)`;
  form.jsonContent = menu.jsonContent;
  form.targetRole = menu.targetRole || "ALL";
  form.isDefault = false;
  
  try {
    const res = await fetch(menu.imageUrl);
    const blob = await res.blob();
    const file = new File([blob], "richmenu-duplicate.png", { type: "image/png" });
    photoFile.value = file;
    form.logoUrl = menu.imageUrl;
    imagePreviewUrl.value = menu.imageUrl;

    const img = new Image();
    img.onload = () => {
      uploadedImageWidth.value = img.naturalWidth;
      uploadedImageHeight.value = img.naturalHeight;
    };
    img.onerror = () => {
      uploadedImageWidth.value = null;
      uploadedImageHeight.value = null;
    };
    img.src = menu.imageUrl;

    emit('update:modelValue', true);
    notify.success("คัดลอกโครงสร้าง Rich Menu สำเร็จ!");
  } catch (err) {
    console.error("Failed to copy image blob", err);
    photoFile.value = null;
    form.logoUrl = undefined;
    imagePreviewUrl.value = "";
    uploadedImageWidth.value = null;
    uploadedImageHeight.value = null;
    emit('update:modelValue', true);
    notify.warning("คัดลอกโครงสร้างสำเร็จ! กรุณาอัปโหลดไฟล์ภาพ Rich Menu ใหม่อีกครั้ง");
  }
};

defineExpose({ duplicate, resetForm });

const uploadedImageWidth = ref<number | null>(null);
const uploadedImageHeight = ref<number | null>(null);
const jsonFileInput = ref<HTMLInputElement | null>(null);
const photoFile = ref<File | null>(null);
const imagePreviewUrl = ref("");

const imagePhotos = computed<Photo[]>(() => {
  if (photoFile.value) return [{ key: "photo", file: photoFile.value, url: null }];
  return form.logoUrl ? [{ key: "photo", file: null, url: form.logoUrl }] : [];
});

const onPhotosUpdate = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  photoFile.value = photo?.file ?? null;
  if (!photo) {
    form.logoUrl = undefined;
    imagePreviewUrl.value = "";
    uploadedImageWidth.value = null;
    uploadedImageHeight.value = null;
  } else if (photo.file) {
    imagePreviewUrl.value = URL.createObjectURL(photo.file);
    const img = new Image();
    img.onload = () => {
      uploadedImageWidth.value = img.naturalWidth;
      uploadedImageHeight.value = img.naturalHeight;
    };
    img.onerror = () => {
      uploadedImageWidth.value = null;
      uploadedImageHeight.value = null;
    };
    img.src = imagePreviewUrl.value;
  }
};

const onJsonFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target?.result as string;
      const parsed = JSON.parse(text);
      form.jsonContent = JSON.stringify(parsed, null, 2);
      notify.success("นำเข้าไฟล์ JSON สำเร็จ!");
    } catch (err: any) {
      notify.error(`ไฟล์ JSON ไม่ถูกต้อง: ${err.message}`);
    }
  };
  reader.readAsText(file);
  target.value = "";
};

const parsedConfig = computed(() => {
  try { return JSON.parse(form.jsonContent); } catch { return null; }
});

const jsonValidationError = computed(() => {
  if (!form.jsonContent.trim()) return "กรุณากรอก JSON Configuration";
  try {
    const config = JSON.parse(form.jsonContent);
    if (!config.size || typeof config.size.width !== "number" || typeof config.size.height !== "number") {
      return "ข้อมูลขนาด (size) ต้องระบุ width และ height เป็นตัวเลข";
    }
    if (config.size.width < 800 || config.size.width > 2500 || config.size.height < 250 || config.size.height > 1686) {
      return "ขนาด Rich Menu ต้องอยู่ระหว่าง กว้าง 800-2500px, สูง 250-1686px";
    }
    if (!config.chatBarText) {
      return "กรุณาระบุข้อความสำหรับ chatBarText";
    }
    if (!Array.isArray(config.areas) || config.areas.length === 0) {
      return "ต้องกำหนดพื้นที่ปุ่ม (areas) อย่างน้อย 1 ปุ่ม";
    }
    for (let i = 0; i < config.areas.length; i++) {
      const area = config.areas[i];
      if (!area.bounds || typeof area.bounds.x !== "number" || typeof area.bounds.y !== "number" || typeof area.bounds.width !== "number" || typeof area.bounds.height !== "number") {
        return `ปุ่มที่ ${i + 1}: พิกัด bounds ไม่ถูกต้อง`;
      }
      if (!area.action || !area.action.type) {
        return `ปุ่มที่ ${i + 1}: ประเภทของแอ็กชันไม่ถูกต้อง`;
      }
    }
    return null;
  } catch (e: any) {
    return `รูปแบบ JSON ไม่ถูกต้อง: ${e.message}`;
  }
});

const imageDimensionValidationError = computed(() => {
  if (!photoFile.value) return null;
  if (uploadedImageWidth.value === null || uploadedImageHeight.value === null) return null;
  try {
    const config = JSON.parse(form.jsonContent);
    const configWidth = config.size?.width;
    const configHeight = config.size?.height;
    if (typeof configWidth !== "number" || typeof configHeight !== "number") return null;
    if (uploadedImageWidth.value !== configWidth || uploadedImageHeight.value !== configHeight) {
      return `ขนาดของไฟล์รูปภาพจริง (${uploadedImageWidth.value}x${uploadedImageHeight.value}px) ไม่ตรงกับขนาดที่ระบุใน JSON Configuration (${configWidth}x${configHeight}px)`;
    }
  } catch { }
  return null;
});

const hotspots = computed(() => {
  const config = parsedConfig.value;
  if (!config || !config.size || !Array.isArray(config.areas)) return [];
  const w = config.size.width;
  const h = config.size.height;
  if (!w || !h) return [];
  return config.areas.map((area: any, index: number) => {
    const bounds = area.bounds;
    if (!bounds) return null;
    return {
      index, x: (bounds.x / w) * 100, y: (bounds.y / h) * 100,
      width: (bounds.width / w) * 100, height: (bounds.height / h) * 100,
      action: area.action, rawBounds: bounds,
    };
  }).filter(Boolean);
});

const onSubmit = async () => {
  if (jsonValidationError.value) { notify.error(jsonValidationError.value); return; }
  if (!photoFile.value) { notify.error("กรุณาอัปโหลดรูปภาพ PNG สำหรับ Rich Menu"); return; }
  if (photoFile.value.type !== "image/png" && !photoFile.value.name.endsWith(".png")) { notify.error("รูปภาพต้องเป็นไฟล์ PNG เท่านั้น"); return; }
  if (imageDimensionValidationError.value) { notify.error(imageDimensionValidationError.value); return; }

  isSaving.value = true;
  const fd = new FormData();
  fd.append("name", form.name);
  fd.append("jsonContent", form.jsonContent);
  if (form.targetRole && form.targetRole !== "ALL") fd.append("targetRole", form.targetRole);
  fd.append("isDefault", form.isDefault.toString());
  fd.append("file", photoFile.value);

  try {
    await $fetch("/api/admin/settings/richmenu", { method: "POST", body: fd });
    notify.success("บันทึกและติดตั้ง LINE Rich Menu เรียบร้อยแล้ว 🚀");
    resetForm();
    emit('refresh');
    emit('update:modelValue', false);
  } catch (err: any) {
    console.error(err);
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาดในการติดตั้ง Rich Menu");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <UModal :open="modelValue" @update:open="emit('update:modelValue', $event)" :ui="{ content: 'sm:max-w-5xl' }">
    <template #title>
      <div class="flex items-center gap-2">
        <span class="p-1.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
          <UIcon name="i-lucide-plus-circle" class="w-5 h-5" />
        </span>
        <span class="text-base font-bold text-slate-800 dark:text-white">ติดตั้ง LINE Rich Menu ใหม่</span>
      </div>
    </template>

    <template #body>
      <UForm :state="form" class="space-y-6 pr-1 max-h-[70vh] overflow-y-auto" @submit="onSubmit">
        <div class="grid gap-6 sm:grid-cols-2">
          <!-- Left inputs column -->
          <div class="space-y-4">
            <UFormField label="ชื่อเรียกภายในระบบ (Name)" name="name" required description="ใช้เพื่อระบุและค้นหาตัวเมนูในฝั่งแอดมิน">
              <UInput v-model="form.name" placeholder="เช่น เมนูลูกค้าทั่วไป, เมนูพนักงาน" class="w-full rounded-xl" />
            </UFormField>

            <UFormField label="อัปโหลดรูปภาพเมนู (PNG เท่านั้น)" name="file" required>
              <UIPhotoUpload
                label="รูปภาพ Rich Menu"
                description="ขนาดแนะนำ 2500x1686 หรือ 2500x843 px (ไม่เกิน 1MB)"
                :photos="imagePhotos"
                :max="1"
                @update:photos="onPhotosUpdate"
              />
            </UFormField>

            <!-- Space-out Target Role Block -->
            <div class="space-y-4 rounded-xl border border-default p-4 bg-default/40 dark:bg-slate-900/40">
              <UFormField label="จำกัดสิทธิ์เฉพาะบทบาท" name="targetRole" description="สลับสิทธิ์ Rich Menu บน LINE อัตโนมัติตามระดับบทบาทนี้">
                <USelect
                  v-model="form.targetRole"
                  placeholder="สำหรับทุกคน (เมนูหลัก)"
                  :items="[
                    { label: 'ไม่จำกัดบทบาท (สำหรับทุกคน)', value: 'ALL' },
                    { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
                    { label: 'สมาชิกรายเดือน (MEMBER)', value: 'MEMBER' },
                    { label: 'พนักงาน (EMPLOYEE)', value: 'EMPLOYEE' },
                    { label: 'ผู้ดูแลระบบ (ADMIN)', value: 'ADMIN' },
                  ]"
                  class="w-full"
                />
              </UFormField>

              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center">
                <UCheckbox
                  v-model="form.isDefault"
                  label="ตั้งค่าเป็นเมนูเริ่มต้น (Default)"
                  description="เมนูจะถูกเปิดให้ลูกค้าที่ระบบไม่พบเงื่อนไขสิทธิ์อื่น"
                />
              </div>
            </div>
          </div>

          <!-- Right live schema inspector and visualizer block -->
          <div class="space-y-4">
            <input
              type="file"
              ref="jsonFileInput"
              accept=".json"
              class="hidden"
              @change="onJsonFileChange"
            />

            <UFormField name="jsonContent" required>
              <template #label>
                <div class="flex items-center justify-between w-full">
                  <span class="text-sm font-bold text-slate-800 dark:text-white">JSON Configuration (LINE Schema)</span>
                  <UButton
                    type="button"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-upload"
                    class="font-semibold text-[11px] py-1 px-2.5 rounded-lg"
                    @click="jsonFileInput?.click()"
                  >
                    นำเข้าไฟล์ .json
                  </UButton>
                </div>
              </template>
              <template #description>
                <span class="text-xs text-slate-400">พิกัดปุ่มสัมผัส (areas) และความกว้าง/ความสูง</span>
              </template>
              <UTextarea
                v-model="form.jsonContent"
                placeholder="กรอก JSON Configuration..."
                :rows="13"
                class="w-full font-mono text-xs p-3 bg-slate-900 text-slate-100 rounded-xl border-slate-800"
              />
            </UFormField>

            <!-- Validation Feedback -->
            <div v-if="jsonValidationError" class="p-3 border border-red-500/20 bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
              ⚠️ {{ jsonValidationError }}
            </div>
            <div v-else-if="imageDimensionValidationError" class="p-3 border border-amber-500/20 bg-amber-500/10 text-amber-600 rounded-xl text-xs font-semibold animate-pulse">
              ⚠️ {{ imageDimensionValidationError }}
            </div>
            <div v-else class="p-3 border border-green-500/20 bg-green-500/10 text-green-600 rounded-xl text-xs flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-check-circle" class="w-4 h-4 text-green-500" />
              โครงสร้าง JSON และรูปภาพได้รับการตรวจสอบว่าถูกต้อง!
            </div>
          </div>
        </div>

        <!-- Bottom Hotspot Layout Visual preview inside Create Modal -->
        <div v-if="imagePreviewUrl && hotspots.length" class="border border-default/50 rounded-2xl p-4 bg-slate-950/90 shadow-inner">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <UIcon name="i-lucide-layout" class="w-4 h-4 text-emerald-500 animate-pulse" />
              ภาพจำลองพิกัดปุ่มสัมผัสตามโครงสร้าง JSON (Hotspots)
            </h4>
            <span class="text-[10px] text-muted bg-slate-800 px-2.5 py-0.5 rounded-full font-bold text-emerald-400">
              พบพิกัดทั้งหมด {{ hotspots.length }} ปุ่ม
            </span>
          </div>
          
          <div class="relative w-full max-w-md mx-auto aspect-[2500/1686] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-md">
            <img
              :src="imagePreviewUrl"
              class="w-full h-full object-cover"
              draggable="false"
            />
            <svg class="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <g v-for="hs in hotspots" :key="`ch-${hs.index}`">
                <rect
                  :x="`${hs.x}%`"
                  :y="`${hs.y}%`"
                  :width="`${hs.width}%`"
                  :height="`${hs.height}%`"
                  fill="rgba(16, 185, 129, 0.15)"
                  stroke="rgba(16, 185, 129, 0.85)"
                  stroke-width="1.5"
                />
                <!-- Tiny numeric indicator -->
                <rect
                  :x="`${hs.x + 0.5}%`"
                  :y="`${hs.y + 0.5}%`"
                  width="18"
                  height="18"
                  rx="3"
                  fill="rgba(15, 23, 42, 0.8)"
                />
                <text
                  :x="`${hs.x + 0.5}%`"
                  :y="`${hs.y + 0.5}%`"
                  dx="9"
                  dy="13"
                  font-size="9"
                  fill="#ffffff"
                  font-weight="bold"
                  text-anchor="middle"
                >
                  {{ hs.index + 1 }}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <!-- Deploy Submit Action -->
        <div class="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <UButton
            color="neutral"
            variant="outline"
            class="font-bold rounded-xl px-5"
            @click="emit('update:modelValue', false)"
          >
            ยกเลิก
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="isSaving"
            :disabled="!!jsonValidationError || !!imageDimensionValidationError"
            class="font-bold rounded-xl px-5"
            icon="i-lucide-upload-cloud"
          >
            ปรับใช้ออนไลน์ไปยัง LINE
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
