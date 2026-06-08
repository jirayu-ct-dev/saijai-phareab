<script setup lang="ts">
type CustomerOption = {
  label: string;
  value: string;
  image?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
};

const props = defineProps<{
  title: string;
  description: string;
  customerId: string;
  customerOptions: CustomerOption[];
  customerLoading?: boolean;
  allowWalkIn?: boolean;
  isWalkIn?: boolean;
  walkInName?: string;
  walkInPhone?: string;
  note: string;
  totalLabel: string;
  totalValue: string;
  totalMeta: string;
  submitLabel: string;
  isSubmitting?: boolean;
  slipFile?: File | null;
  uploadedSlipUrl?: string | null;
  uploadedSlipLabel?: string | null;
  hidePaymentFields?: boolean;
  flat?: boolean;
  sectionClass?: string;
}>();

const emit = defineEmits<{
  "update:customerId": [value: string];
  "update:isWalkIn": [value: boolean];
  "update:walkInName": [value: string];
  "update:walkInPhone": [value: string];
  "update:note": [value: string];
  "update:slipFile": [value: File | null];
  "remove-slip": [];
  submit: [];
  reset: [];
}>();

const customerModeOptions: Array<{ label: string; value: "member" | "walk-in" }> = [
  { label: "เลือกลูกค้าในระบบ", value: "member" },
  { label: "ลูกค้าหน้าร้าน", value: "walk-in" },
];

const selectedCustomer = computed(() => props.customerOptions.find((item) => item.value === props.customerId) ?? null);
const customerMode = computed({
  get: () => (props.isWalkIn ? "walk-in" : "member"),
  set: (value: "member" | "walk-in") => emit("update:isWalkIn", value === "walk-in"),
});

const getAvatarProps = (customer?: CustomerOption | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});

const slipObjectUrl = ref<string>("");
const slipPreviewOpen = ref(false);
const slipRemoveOpen = ref(false);

watch(
  () => props.slipFile,
  (file) => {
    if (slipObjectUrl.value && import.meta.client) URL.revokeObjectURL(slipObjectUrl.value);
    slipObjectUrl.value = file && import.meta.client ? URL.createObjectURL(file) : "";
  },
);

onBeforeUnmount(() => {
  if (slipObjectUrl.value && import.meta.client) URL.revokeObjectURL(slipObjectUrl.value);
});

const slipDisplayUrl = computed(() => props.uploadedSlipUrl || slipObjectUrl.value || "");
const slipLabel = "หลักฐานการชำระเงิน";

const performRemoveSlip = () => {
  emit("remove-slip");
  slipRemoveOpen.value = false;
};

const panelClass = computed(() =>
  props.flat
    ? "space-y-2"
    :
    "-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg sm:p-5",
);
const panelContentClass = computed(() => props.flat ? "space-y-2" : "mt-5 space-y-4");
const panelSectionClass = computed(() =>
  props.sectionClass
  ?? "-mx-2 border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg",
);
</script>

<template>
  <section :class="panelClass">
    <div v-if="!props.flat">
      <p class="text-lg font-semibold text-highlighted">{{ props.title }}</p>
      <p class="text-sm text-muted">{{ props.description }}</p>
    </div>

    <div :class="panelContentClass">
      <div :class="props.flat ? panelSectionClass : 'space-y-3'">
        <div v-if="props.allowWalkIn" class="space-y-3">
          <UFormField label="ประเภทลูกค้า">
            <URadioGroup v-model="customerMode" orientation="horizontal" :items="customerModeOptions" value-key="value" />
          </UFormField>

          <div v-if="props.isWalkIn" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <UFormField label="ชื่อลูกค้าหน้าร้าน">
              <UInput
                :model-value="props.walkInName || ''"
                placeholder="เช่น คุณเอ"
                @update:model-value="emit('update:walkInName', String($event || ''))"
              >
                <template #trailing>
                  <UBadge
                    label="ไม่ระบุ"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    class="cursor-pointer"
                    @click="emit('update:walkInName', 'ไม่ระบุ')"
                  />
                </template>
              </UInput>
            </UFormField>

            <UFormField label="เบอร์โทร">
              <UInput
                :model-value="props.walkInPhone || ''"
                placeholder="เช่น 08xxxxxxxx"
                @update:model-value="emit('update:walkInPhone', String($event || ''))"
              />
            </UFormField>
          </div>
        </div>

        <UFormField v-if="!props.allowWalkIn || !props.isWalkIn" label="ลูกค้า" required>
          <USelectMenu
            :model-value="props.customerId"
            :items="props.customerOptions"
            value-key="value"
            label-key="label"
            searchable
            :loading="props.customerLoading"
            :avatar="getAvatarProps(selectedCustomer)"
            class="w-full"
            @update:model-value="emit('update:customerId', String($event || ''))"
          >
            <template #item="{ item }">
              <div class="flex items-center gap-3">
                <UAvatar v-bind="getAvatarProps(item)" size="sm" />
                <div class="min-w-0">
                  <p class="truncate font-medium text-highlighted">{{ item.name || item.email }}</p>
                  <p class="truncate text-xs text-muted">
                    {{ item.phoneNumber ? `${item.phoneNumber} | ` : "" }}{{ item.email }}
                  </p>
                </div>
              </div>
            </template>

            <template #empty>
              <div class="px-3 py-2 text-sm text-muted">ไม่พบรายชื่อลูกค้า</div>
            </template>
          </USelectMenu>
        </UFormField>
      </div>

      <slot name="cart" />
      <slot name="summary" />

      <!-- comment ไว้ก่อน ไม่ต้องมาลบ -->
      <!-- <div v-if="!props.hidePaymentFields" class="rounded-lg border border-dashed border-default p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-medium text-highlighted">{{ slipLabel }}</p>
            <p v-if="!slipDisplayUrl" class="text-sm text-muted">ยังไม่ได้แนบรูป</p>
          </div>
          <UButton
            v-if="!slipDisplayUrl"
            label="เพิ่มรูป"
            icon="i-lucide-camera"
            color="neutral"
            variant="solid"
            :disabled="props.isSubmitting"
            @click="openSlipPicker"
          />
        </div>
        <input
          ref="slipFileInputRef"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onSlipFileSelected"
        >
        <div v-if="slipDisplayUrl" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="group relative overflow-hidden rounded-lg border border-default bg-muted/30">
            <img
              :src="slipDisplayUrl"
              :alt="slipLabel"
              class="h-28 w-full cursor-pointer object-cover"
              @click="openSlipPreview"
            >
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="solid"
              size="xs"
              class="absolute right-1 top-1"
              :disabled="props.isSubmitting"
              @click.stop="requestRemoveSlip"
            />
          </div>
        </div>
      </div> -->

      <UIImagePreviewModal
        v-model:open="slipPreviewOpen"
        :title="slipLabel"
        :image-url="slipDisplayUrl"
        :image-alt="slipLabel"
      />

      <UIConfirmModal
        v-model:open="slipRemoveOpen"
        :title="props.slipFile ? 'ยกเลิกไฟล์ที่เลือก' : 'ลบรูปหลักฐาน'"
        icon="i-lucide-trash-2"
        icon-color="error"
        confirm-label="ลบรูป"
        confirm-color="error"
        :message="props.slipFile ? 'ต้องการล้างไฟล์ที่เลือกไว้หรือไม่' : 'ต้องการลบรูปหลักฐานการชำระเงินนี้หรือไม่'"
        :sub-message="props.slipFile ? 'ไฟล์นี้จะไม่ถูกอัปโหลดจนกว่าจะเลือกใหม่อีกครั้ง' : 'หากยืนยัน ระบบจะถอดรูปนี้ออกจากรายการปัจจุบัน'"
        @confirm="performRemoveSlip"
      />

      <div
        v-if="props.hidePaymentFields"
        :class="props.flat ? [panelSectionClass, 'text-sm'] : 'rounded-lg border border-default/35 bg-elevated/70 p-3 text-sm dark:border-default/25 dark:bg-elevated/45'"
      >
        <p class="font-medium text-success">ใช้สิทธิ์แพ็กเกจรายเดือน</p>
        <p class="text-muted">ไม่ต้องชำระเงินเพิ่ม ระบบจะตัดเครดิตให้อัตโนมัติ</p>
      </div>

      <div :class="props.flat ? panelSectionClass : ''">
        <UFormField label="หมายเหตุ">
          <UTextarea
            :model-value="props.note"
            class="w-full"
            :rows="3"
            placeholder="รายละเอียดเพิ่มเติมของรายการนี้"
            @update:model-value="emit('update:note', String($event || ''))"
          />
        </UFormField>
      </div>

      <slot name="discount" />

      <div :class="props.flat ? [panelSectionClass, 'text-default'] : 'rounded-lg bg-elevated/35 p-4 text-default dark:bg-elevated/25'">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm/5 text-muted">{{ props.totalLabel }}</p>
            <p class="text-3xl font-semibold text-highlighted">{{ props.totalValue }}</p>
          </div>
          <div class="text-right text-sm text-muted">
            <p>{{ props.totalMeta }}</p>
          </div>
        </div>
      </div>

      <div :class="props.flat ? [panelSectionClass, 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'] : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'">
        <UButton label="ล้างข้อมูล" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" block @click="emit('reset')" />
        <UButton :label="props.submitLabel" icon="i-lucide-check" color="neutral" block :loading="props.isSubmitting" @click="emit('submit')" />
      </div>
    </div>
  </section>
</template>
