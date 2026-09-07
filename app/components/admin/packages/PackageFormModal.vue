<script setup lang="ts">
import type { Package } from "~~/shared/types/package";
import type { CreatePackageBody } from "~~/app/composables/usePackages";
import { packageTypeLabels } from "~~/shared/config/packageConfig";
import { hasUsablePackageCredits, normalizePackageUsageSettings } from "~~/shared/utils/packageUsage";

const props = defineProps<{
  open: boolean;
  editPackage: Package | null;
  saving?: boolean;
  services?: Array<{
    id: string;
    name: string;
  }>;
  servicesLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [data: CreatePackageBody];
}>();

interface FormState {
  name: string;
  packageType: "MAIN" | "ADDON";
  addonMode: "CREDIT" | "DELIVERY";
  price: number | null;
  credits: number | null;
  validityDays: number | null;
  serviceId: string | undefined;
}

const defaultState = (): FormState => ({
  name: "",
  packageType: "MAIN",
  addonMode: "CREDIT",
  price: null,
  credits: null,
  validityDays: 30,
  serviceId: undefined,
});

const addonModeOptions = [
  { label: "บริการเสริมแบบใช้เครดิต", value: "CREDIT" },
  { label: "บริการรับ-ส่งแบบไม่ใช้เครดิต", value: "DELIVERY" },
];

const state = reactive<FormState>(defaultState());
const errors = ref<{ name?: string; price?: string; credits?: string; validityDays?: string; serviceId?: string }>({});
const serviceOptions = computed(() => {
  const services = new Map<string, string>();
  for (const service of props.services ?? []) services.set(service.id, service.name);
  if (props.editPackage?.service) services.set(props.editPackage.service.id, props.editPackage.service.name);
  return Array.from(services, ([value, label]) => ({ value, label }));
});

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
      state.packageType = pkg.packageType as "MAIN" | "ADDON";
      state.addonMode = pkg.isDelivery ? "DELIVERY" : "CREDIT";
      state.price = Number(pkg.price);
      state.credits = pkg.credits ?? null;
      state.validityDays = pkg.validityDays ?? null;
      state.serviceId = pkg.serviceId ?? undefined;
      return;
    }

    Object.assign(state, defaultState());
  },
  { immediate: true },
);

const validate = () => {
  const nextErrors: { name?: string; price?: string; credits?: string; validityDays?: string; serviceId?: string } = {};
  const usageSettings = normalizePackageUsageSettings({
    packageType: state.packageType,
    isDelivery: state.addonMode === "DELIVERY",
    credits: state.credits,
  });

  if (!state.name.trim()) nextErrors.name = "กรุณากรอกชื่อแพ็กเกจ";
  if (state.price === null || state.price < 0) {
    nextErrors.price = "กรุณากรอกราคาที่ถูกต้อง";
  }
  if (state.validityDays !== null && (!Number.isInteger(state.validityDays) || state.validityDays < 1)) {
    nextErrors.validityDays = "กรุณากรอกจำนวนวันเป็นจำนวนเต็มอย่างน้อย 1 วัน";
  }
  if (state.packageType === "MAIN" && !state.serviceId) {
    nextErrors.serviceId = "กรุณาเลือกบริการของแพ็กเกจ";
  }
  if (!hasUsablePackageCredits(usageSettings)) {
    nextErrors.credits = "กรุณากรอกเครดิตเป็นจำนวนเต็มอย่างน้อย 1 เครดิต";
  }

  errors.value = nextErrors;
  return Object.keys(nextErrors).length === 0;
};

const handleSubmit = async () => {
  if (props.saving) return;
  if (!validate()) return;

  const usageSettings = normalizePackageUsageSettings({
    packageType: state.packageType,
    isDelivery: state.addonMode === "DELIVERY",
    credits: state.credits,
  });

  emit("save", {
    name: state.name.trim(),
    packageType: state.packageType,
    isDelivery: usageSettings.isDelivery,
    deductOn: usageSettings.deductOn,
    price: state.price ?? 0,
    credits: usageSettings.credits,
    validityDays: state.validityDays,
    serviceId: state.packageType === "MAIN" ? state.serviceId : null,
  });
};

const handleClose = () => {
  if (!props.saving) emit("update:open", false);
};
const handleOpenChange = (value: boolean) => {
  if (!props.saving) emit("update:open", value);
};
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :ui="{ content: 'max-w-lg' }"
    @update:open="handleOpenChange"
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

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="ประเภทแพ็กเกจ" required>
            <USelect
              v-model="state.packageType"
              :items="typeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="state.packageType === 'MAIN'"
            label="บริการที่ใช้แพ็กเกจ"
            required
            :error="errors.serviceId"
          >
            <USelect
              v-model="state.serviceId"
              :items="serviceOptions"
              value-key="value"
              placeholder="เลือกบริการ"
              class="w-full"
              :loading="servicesLoading"
              :color="errors.serviceId ? 'error' : undefined"
            />
          </UFormField>

          <UFormField v-else label="รูปแบบบริการเสริม" required>
            <USelect
              v-model="state.addonMode"
              :items="addonModeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="state.packageType === 'ADDON' && state.addonMode === 'DELIVERY'"
          color="info"
          variant="subtle"
          icon="i-lucide-truck"
          title="บริการรับ-ส่งไม่ใช้เครดิต"
          description="พนักงานจะเลือกบันทึกการใช้บริการรับ-ส่งในออเดอร์แต่ละครั้ง"
        />

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

          <UFormField label="อายุการใช้งาน (วัน)" :error="errors.validityDays">
            <UInput
              v-model.number="state.validityDays"
              type="number"
              min="1"
              placeholder="ไม่จำกัด"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          v-if="state.packageType === 'MAIN' || state.addonMode === 'CREDIT'"
          label="เครดิต"
          required
          :error="errors.credits"
        >
          <UInput
            v-model.number="state.credits"
            type="number"
            min="1"
            step="1"
            placeholder="1"
            class="w-full"
            :color="errors.credits ? 'error' : undefined"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="ยกเลิก"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            @click="handleClose"
          />
          <UButton
            type="submit"
            :label="isEditMode ? 'บันทึกการแก้ไข' : 'สร้างแพ็กเกจ'"
            :icon="isEditMode ? 'i-lucide-save' : 'i-lucide-plus'"
            color="primary"
            :loading="saving"
            :disabled="saving"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
