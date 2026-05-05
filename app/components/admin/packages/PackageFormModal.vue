<script setup lang="ts">
import type { Package } from "~~/shared/types/package";
import type { CreatePackageBody } from "~~/app/composables/usePackages";
import { packageTypeLabels } from "~~/shared/config/packageConfig";

const props = defineProps<{
  open: boolean;
  editPackage: Package | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [data: CreatePackageBody];
}>();

interface FormState {
  name: string;
  description: string;
  packageType: "MAIN" | "ADDON";
  deductOn: "CREATED" | "COMPLETED";
  price: number | null;
  credits: number | null;
  validityDays: number | null;
  isActive: boolean;
}

const defaultState = (): FormState => ({
  name: "",
  description: "",
  packageType: "MAIN",
  deductOn: "CREATED",
  price: null,
  credits: null,
  validityDays: null,
  isActive: true,
});

const deductOnOptions = [
  { label: "ตอนรับผ้า (ทันที)", value: "CREATED" },
  { label: "ตอนจัดส่งสำเร็จ", value: "COMPLETED" },
];

const state = reactive<FormState>(defaultState());
const errors = ref<{ name?: string; price?: string }>({});
const submitting = ref(false);

const isEditMode = computed(() => props.editPackage !== null);
const modalTitle = computed(() =>
  isEditMode.value ? "แก้ไขแพ็กเกจ" : "เพิ่มแพ็กเกจใหม่",
);

const typeOptions = [
  { label: packageTypeLabels.MAIN, value: "MAIN" },
  { label: packageTypeLabels.ADDON, value: "ADDON" },
];

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    errors.value = {};

    if (props.editPackage) {
      const pkg = props.editPackage;
      state.name = pkg.name;
      state.description = pkg.description ?? "";
      state.packageType = pkg.packageType as "MAIN" | "ADDON";
      state.deductOn = pkg.deductOn as "CREATED" | "COMPLETED";
      state.price = Number(pkg.price);
      state.credits = pkg.credits ?? null;
      state.validityDays = pkg.validityDays ?? null;
      state.isActive = pkg.isActive;
      return;
    }

    Object.assign(state, defaultState());
  },
  { immediate: true },
);

const validate = () => {
  const nextErrors: { name?: string; price?: string } = {};

  if (!state.name.trim()) nextErrors.name = "กรุณากรอกชื่อแพ็กเกจ";
  if (state.price === null || state.price < 0) {
    nextErrors.price = "กรุณากรอกราคาที่ถูกต้อง";
  }

  errors.value = nextErrors;
  return Object.keys(nextErrors).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;

  submitting.value = true;
  emit("save", {
    name: state.name.trim(),
    description: state.description.trim() || null,
    packageType: state.packageType,
    deductOn: state.packageType === "ADDON" ? state.deductOn : "CREATED",
    price: state.price ?? 0,
    credits: state.credits,
    validityDays: state.validityDays,
    isActive: state.isActive,
  });
  submitting.value = false;
};

const handleClose = () => emit("update:open", false);
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
        <UFormField label="ชื่อแพ็กเกจ" required :error="errors.name">
          <UInput
            v-model="state.name"
            placeholder="เช่น แพ็กเกจรายเดือน S"
            class="w-full"
            :color="errors.name ? 'error' : undefined"
          />
        </UFormField>

        <UFormField label="คำอธิบาย">
          <UInput
            v-model="state.description"
            placeholder="รายละเอียดแพ็กเกจโดยย่อ"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="ประเภทแพ็กเกจ" required>
            <USelect
              v-model="state.packageType"
              :items="typeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="สถานะ">
            <div class="flex items-center gap-2 h-9">
              <USwitch v-model="state.isActive" color="success" />
              <span
                class="text-sm"
                :class="state.isActive ? 'text-success' : 'text-muted'"
              >
                {{ state.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน" }}
              </span>
            </div>
          </UFormField>
        </div>

        <UFormField v-if="state.packageType === 'ADDON'" label="หักเครดิตเมื่อ">
          <USelect
            v-model="state.deductOn"
            :items="deductOnOptions"
            value-key="value"
            class="w-full"
          />
          <template #hint>
            <span class="text-xs text-muted">
              {{ state.deductOn === 'CREATED' ? 'เครดิตถูกหักทันทีที่รับผ้า' : 'เครดิตถูกหักเมื่อจัดส่งสำเร็จ' }}
            </span>
          </template>
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="ราคา (บาท)" required :error="errors.price">
            <UInput
              v-model.number="state.price"
              type="number"
              min="0"
              placeholder="0"
              class="w-full"
              :color="errors.price ? 'error' : undefined"
            />
          </UFormField>

          <UFormField label="อายุการใช้งาน (วัน)">
            <UInput
              v-model.number="state.validityDays"
              type="number"
              min="1"
              placeholder="ไม่จำกัด"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="เครดิต">
          <UInput
            v-model.number="state.credits"
            type="number"
            min="0"
            placeholder="ไม่มีเครดิต"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="ยกเลิก"
            color="neutral"
            variant="ghost"
            @click="handleClose"
          />
          <UButton
            type="submit"
            :label="isEditMode ? 'บันทึกการแก้ไข' : 'สร้างแพ็กเกจ'"
            :icon="isEditMode ? 'i-lucide-save' : 'i-lucide-plus'"
            color="primary"
            :loading="submitting"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
