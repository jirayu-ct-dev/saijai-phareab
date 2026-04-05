<script setup lang="ts">
import SlipUploadField from "~~/app/components/UI/SlipUploadField.vue";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { paymentStatusLabels } from "~~/shared/config/paymentConfig";

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
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  note: string;
  totalLabel: string;
  totalValue: string;
  totalMeta: string;
  submitLabel: string;
  isSubmitting?: boolean;
  slipFile?: File | null;
  uploadedSlipUrl?: string | null;
  uploadedSlipLabel?: string | null;
}>();

const emit = defineEmits<{
  "update:customerId": [value: string];
  "update:isWalkIn": [value: boolean];
  "update:walkInName": [value: string];
  "update:walkInPhone": [value: string];
  "update:paymentMethod": [value: PaymentMethod];
  "update:status": [value: PaymentStatus];
  "update:note": [value: string];
  "update:slipFile": [value: File | null];
  "remove-slip": [];
  submit: [];
  reset: [];
}>();

const paymentMethodOptions: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];

const customerModeOptions: Array<{ label: string; value: "member" | "walk-in" }> = [
  { label: "ลูกค้าหน้าร้าน", value: "walk-in" },
  { label: "เลือกลูกค้าในระบบ", value: "member" },
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
</script>

<template>
  <section class="rounded-2xl border border-default bg-default p-5">
    <div>
      <p class="text-lg font-semibold text-highlighted">{{ props.title }}</p>
      <p class="text-sm text-muted">{{ props.description }}</p>
    </div>

    <div class="mt-5 space-y-4">
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
            />
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

      <slot name="cart" />
      <slot name="summary" />
      

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <UFormField label="ช่องทางชำระเงิน" required>
          <USelect
            :model-value="props.paymentMethod"
            :items="paymentMethodOptions"
            value-key="value"
            class="w-full"
            @update:model-value="emit('update:paymentMethod', $event as PaymentMethod)"
          />
        </UFormField>

        <UFormField label="สถานะการชำระเงิน" required>
          <USelect
            :model-value="props.status"
            :items="paymentStatusOptions"
            value-key="value"
            class="w-full"
            @update:model-value="emit('update:status', $event as PaymentStatus)"
          />
        </UFormField>
      </div>

      <UFormField :label="props.paymentMethod === 'TRANSFER' ? 'สลิปโอนเงิน' : 'หลักฐานการชำระเงิน'">
        <SlipUploadField
          :label="props.paymentMethod === 'TRANSFER' ? 'สลิปโอนเงิน' : 'หลักฐานการชำระเงิน'"
          :description="props.paymentMethod === 'TRANSFER' ? 'แนบสลิปเพื่อใช้ยืนยันรายการ' : 'แนบรูปหลักฐานเพิ่มเติมได้ตามต้องการ'"
          :file="props.slipFile"
          :image-url="props.uploadedSlipUrl"
          :image-label="props.uploadedSlipLabel"
          :disabled="props.isSubmitting"
          confirm-remove
          :confirm-title="props.slipFile ? 'ยกเลิกไฟล์ที่เลือก' : 'ลบรูปหลักฐาน'"
          :confirm-message="props.slipFile ? 'ต้องการล้างไฟล์ที่เลือกไว้หรือไม่' : 'ต้องการลบรูปหลักฐานการชำระเงินนี้หรือไม่'"
          :confirm-sub-message="props.slipFile ? 'ไฟล์นี้จะไม่ถูกอัปโหลดจนกว่าจะเลือกใหม่อีกครั้ง' : 'หากยืนยัน ระบบจะถอดรูปนี้ออกจากรายการปัจจุบัน'"
          @update:file="emit('update:slipFile', $event)"
          @remove="emit('remove-slip')"
        />
      </UFormField>

      <UFormField label="หมายเหตุ">
        <UTextarea
          :model-value="props.note"
          class="w-full"
          :rows="3"
          placeholder="รายละเอียดเพิ่มเติมของรายการนี้"
          @update:model-value="emit('update:note', String($event || ''))"
        />
      </UFormField>

      <slot name="discount" />
      
      <div class="rounded-2xl border border-default bg-default p-4 text-default">
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

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <UButton label="ล้างข้อมูล" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" block @click="emit('reset')" />
        <UButton :label="props.submitLabel" icon="i-lucide-check" color="neutral" block :loading="props.isSubmitting" @click="emit('submit')" />
      </div>
    </div>
  </section>
</template>
