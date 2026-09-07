<script setup lang="ts">
import type { Package } from "~~/shared/types/package";
import type { CreatePackageBody } from "~~/app/composables/usePackages";
import { packageTypeLabels } from "~~/shared/config/packageConfig";

const props = defineProps<{
  open: boolean;
  editPackage: Package | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [data: CreatePackageBody];
}>();

interface FormState {
  name: string;
  description: string;
  packageType: "MAIN" | "ADDON";
  isDelivery: boolean;
  deductOn: "CREATED" | "COMPLETED";
  price: number | null;
  credits: number | null;
  validityDays: number | null;
  isActive: boolean;
  isPublic: boolean;
  serviceId: string | undefined;
}

const defaultState = (): FormState => ({
  name: "",
  description: "",
  packageType: "MAIN",
  isDelivery: false,
  deductOn: "CREATED",
  price: null,
  credits: null,
  validityDays: null,
  isActive: true,
  isPublic: true,
  serviceId: undefined,
});

const deductOnOptions = [
  { label: "ตอนรับผ้า (ทันที)", value: "CREATED" },
  { label: "ตอนจัดส่งสำเร็จ", value: "COMPLETED" },
];

const state = reactive<FormState>(defaultState());
const errors = ref<{ name?: string; price?: string; serviceId?: string }>({});
const { items: storefrontItems } = useStorefrontCatalog();
const serviceOptions = computed(() => {
  const services = new Map<string, string>();
  for (const item of storefrontItems.value ?? []) services.set(item.serviceId, item.serviceName);
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
      state.description = pkg.description ?? "";
      state.packageType = pkg.packageType as "MAIN" | "ADDON";
      state.isDelivery = Boolean(pkg.isDelivery);
      state.deductOn = pkg.deductOn as "CREATED" | "COMPLETED";
      state.price = Number(pkg.price);
      state.credits = pkg.credits ?? null;
      state.validityDays = pkg.validityDays ?? null;
      state.isActive = pkg.isActive;
      state.isPublic = pkg.isPublic;
      state.serviceId = pkg.serviceId ?? undefined;
      return;
    }

    Object.assign(state, defaultState());
  },
  { immediate: true },
);

const validate = () => {
  const nextErrors: { name?: string; price?: string; serviceId?: string } = {};

  if (!state.name.trim()) nextErrors.name = "กรุณากรอกชื่อแพ็กเกจ";
  if (state.price === null || state.price < 0) {
    nextErrors.price = "กรุณากรอกราคาที่ถูกต้อง";
  }
  if (state.packageType === "MAIN" && !state.serviceId) {
    nextErrors.serviceId = "กรุณาเลือกบริการของแพ็กเกจ";
  }

  errors.value = nextErrors;
  return Object.keys(nextErrors).length === 0;
};

const handleSubmit = async () => {
  if (props.saving) return;
  if (!validate()) return;

  emit("save", {
    name: state.name.trim(),
    description: state.description.trim() || null,
    packageType: state.packageType,
    isDelivery: state.packageType === "ADDON" ? state.isDelivery : false,
    deductOn: state.packageType === "ADDON" && !state.isDelivery ? state.deductOn : "CREATED",
    price: state.price ?? 0,
    credits: state.isDelivery ? null : state.credits,
    validityDays: state.validityDays,
    isActive: state.isActive,
    isPublic: state.isPublic,
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

        <UFormField
          v-if="state.packageType === 'MAIN'"
          label="บริการที่ใช้แพ็กเกจ"
          required
          :error="errors.serviceId"
          description="เครดิตของแพ็กเกจจะใช้ได้เฉพาะรายการในบริการนี้"
        >
          <USelect
            v-model="state.serviceId"
            :items="serviceOptions"
            value-key="value"
            placeholder="เลือกบริการ"
            class="w-full"
            :color="errors.serviceId ? 'error' : undefined"
          />
        </UFormField>

        <UFormField
          label="การแสดงผลหน้าลูกค้า"
          description="ปิดได้สำหรับแพ็กเกจเฉพาะบุคคล โดยพนักงานยังขายแพ็กเกจที่เปิดใช้งานได้"
        >
          <div class="flex h-9 items-center gap-2">
            <USwitch v-model="state.isPublic" color="primary" />
            <span class="text-sm" :class="state.isPublic ? 'text-primary' : 'text-muted'">
              {{ state.isPublic ? "แสดงให้ผู้ใช้เห็น" : "ซ่อนจากผู้ใช้" }}
            </span>
          </div>
        </UFormField>

        <UFormField
          v-if="state.packageType === 'ADDON'"
          label="นี่คือบริการรับ-ส่งถึงบ้าน"
          description="เมื่อลูกค้าซื้อแพ็กเกจนี้และ active อยู่ ระบบจะถือว่าออเดอร์ของลูกค้ามีบริการจัดส่งถึงบ้าน"
        >
          <USwitch v-model="state.isDelivery" color="primary" />
        </UFormField>

        <UFormField v-if="state.packageType === 'ADDON' && !state.isDelivery" label="หักเครดิตเมื่อ">
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

        <UFormField v-if="!state.isDelivery" label="เครดิต">
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
