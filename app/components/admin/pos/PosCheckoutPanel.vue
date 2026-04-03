<script setup lang="ts">
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
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  note: string;
  totalLabel: string;
  totalValue: string;
  totalMeta: string;
  submitLabel: string;
  isSubmitting?: boolean;
  uploadedSlipUrl?: string | null;
  uploadedSlipLabel?: string | null;
}>();

const emit = defineEmits<{
  "update:customerId": [value: string];
  "update:paymentMethod": [value: PaymentMethod];
  "update:status": [value: PaymentStatus];
  "update:note": [value: string];
  "select-slip": [event: Event];
  "open-slip": [];
  "remove-slip": [];
  submit: [];
  reset: [];
}>();

const PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];

const PAYMENT_STATUS_OPTIONS: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];

const selectedCustomer = computed(() => props.customerOptions.find((item) => item.value === props.customerId) ?? null);

const getAvatarProps = (customer?: CustomerOption | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || customer?.email || "ลูกค้า",
  loading: "lazy" as const,
});
</script>

<template>
  <section class="rounded-2xl border border-default bg-default p-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-lg font-semibold text-highlighted">{{ props.title }}</p>
        <p class="text-sm text-muted">{{ props.description }}</p>
      </div>
    </div>

    <div class="mt-5 space-y-4">
      <UFormField label="ลูกค้า" required>
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
                  {{ item.phoneNumber ? `${item.phoneNumber} • ` : "" }}{{ item.email }}
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

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <UFormField label="ช่องทางชำระเงิน" required>
          <USelect
            :model-value="props.paymentMethod"
            :items="PAYMENT_METHOD_OPTIONS"
            value-key="value"
            class="w-full"
            @update:model-value="emit('update:paymentMethod', $event as PaymentMethod)"
          />
        </UFormField>

        <UFormField label="สถานะการชำระเงิน" required>
          <USelect
            :model-value="props.status"
            :items="PAYMENT_STATUS_OPTIONS"
            value-key="value"
            class="w-full"
            @update:model-value="emit('update:status', $event as PaymentStatus)"
          />
        </UFormField>
      </div>

      <UFormField :label="props.paymentMethod === 'TRANSFER' ? 'สลิปโอนเงิน' : 'หลักฐานการชำระเงิน'">
        <div class="space-y-3">
          <input
            type="file"
            accept="image/*"
            class="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            @change="emit('select-slip', $event)"
          >

          <div v-if="props.uploadedSlipUrl" class="rounded-xl border border-default bg-default p-3">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ props.uploadedSlipLabel || props.uploadedSlipUrl }}
            </p>
            <div class="mt-3 flex items-center gap-2">
              <UButton label="เปิดดู" size="sm" color="neutral" variant="outline" @click="emit('open-slip')" />
              <UButton label="ลบ" size="sm" color="error" variant="ghost" @click="emit('remove-slip')" />
            </div>
          </div>
        </div>
      </UFormField>

      <UFormField label="หมายเหตุ">
        <UTextarea
          :model-value="props.note"
          class="w-full"
          :rows="3"
          placeholder="รายละเอียดเพิ่มเติมของการขายหรือการรับชำระ"
          @update:model-value="emit('update:note', String($event || ''))"
        />
      </UFormField>

      <div class="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-default">
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
        <UButton :label="props.submitLabel" icon="i-lucide-check" color="neutral" block :loading="props.isSubmitting" @click="emit('submit')" />
        <UButton label="ล้างข้อมูล" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" block @click="emit('reset')" />
      </div>
    </div>
  </section>
</template>
