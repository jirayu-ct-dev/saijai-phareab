<script setup lang="ts">
type CustomerOption = {
  label: string;
  value: string;
  image?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  customerAccountStatus?: "OFFLINE" | "ACTIVE";
};

const props = defineProps<{
  title: string;
  description: string;
  customerId: string;
  customerOptions: CustomerOption[];
  customerLoading?: boolean;
  allowNewCustomer?: boolean;
  customerMode?: "existing" | "new";
  newCustomerName?: string;
  newCustomerPhone?: string;
  newCustomerEmail?: string;
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
  "update:customerMode": [value: "existing" | "new"];
  "update:newCustomerName": [value: string];
  "update:newCustomerPhone": [value: string];
  "update:newCustomerEmail": [value: string];
  "search-customer": [value: string];
  "update:note": [value: string];
  "update:slipFile": [value: File | null];
  "remove-slip": [];
  submit: [];
  reset: [];
}>();

const customerModeOptions: Array<{ label: string; value: "existing" | "new" }> = [
  { label: "เลือกลูกค้าเดิม", value: "existing" },
  { label: "เพิ่มลูกค้าใหม่", value: "new" },
];

const selectedCustomer = computed(() => props.customerOptions.find((item) => item.value === props.customerId) ?? null);
const selectedMode = computed({
  get: () => props.customerMode ?? "existing",
  set: (value: "existing" | "new") => emit("update:customerMode", value),
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
        <div v-if="props.allowNewCustomer" class="space-y-3">
          <UFormField label="ประเภทลูกค้า">
            <URadioGroup v-model="selectedMode" orientation="horizontal" :items="customerModeOptions" value-key="value" />
          </UFormField>

          <div v-if="selectedMode === 'new'" class="grid w-full grid-cols-1 gap-4">
            <UFormField label="ชื่อลูกค้า" required>
              <UInput
                :model-value="props.newCustomerName || ''"
                class="w-full"
                placeholder="เช่น คุณเอ"
                @update:model-value="emit('update:newCustomerName', String($event || ''))"
              />
            </UFormField>

            <UFormField label="เบอร์โทร" required>
              <UInput
                :model-value="props.newCustomerPhone || ''"
                class="w-full"
                placeholder="เช่น 08xxxxxxxx"
                inputmode="tel"
                @update:model-value="emit('update:newCustomerPhone', String($event || ''))"
              />
            </UFormField>

            <UFormField label="อีเมล (ถ้ามี)">
              <UInput
                :model-value="props.newCustomerEmail || ''"
                class="w-full"
                type="email"
                placeholder="customer@example.com"
                autocomplete="off"
                @update:model-value="emit('update:newCustomerEmail', String($event || ''))"
              />
              <template #help>ลูกค้าต้องเปิดใช้งานบัญชีก่อนเข้าสู่ระบบ</template>
            </UFormField>
          </div>
        </div>

        <UFormField v-if="!props.allowNewCustomer || selectedMode === 'existing'" label="ลูกค้า" required>
          <USelectMenu
            :model-value="props.customerId"
            :items="props.customerOptions"
            value-key="value"
            label-key="label"
            searchable
            :loading="props.customerLoading"
            :avatar="getAvatarProps(selectedCustomer)"
            class="w-full"
            @update:search-term="emit('search-customer', String($event || ''))"
            @update:model-value="emit('update:customerId', String($event || ''))"
          >
            <template #item="{ item }">
              <div class="flex items-center gap-3">
                <UAvatar v-bind="getAvatarProps(item)" size="sm" />
                <div class="min-w-0">
                  <div class="flex min-w-0 items-center gap-2">
                    <p class="truncate font-medium text-highlighted">{{ item.name || item.email || 'ไม่ระบุชื่อ' }}</p>
                    <UBadge v-if="item.customerAccountStatus === 'OFFLINE'" label="ยังไม่เปิดใช้งาน" color="warning" variant="subtle" size="xs" />
                  </div>
                  <p class="truncate text-xs text-muted">
                    {{ item.phoneNumber || "ไม่ระบุเบอร์" }}<template v-if="item.email"> | {{ item.email }}</template>
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
