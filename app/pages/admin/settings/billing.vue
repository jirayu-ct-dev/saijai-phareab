<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const { settings, isLoading, updateSettings } = useBusinessSetting();

const form = reactive({
  hangerPricePerUnit: 10,
  vatRate: 0,
  vatIncluded: false,
  paymentNoPrefix: "PAY-",
  orderNoPrefix: "ORD-",
  minimumOrderAmount: 0,
  packageRefundDays: 7,
});

watch(
  settings,
  (val) => {
    if (!val) return;
    form.hangerPricePerUnit = val.hangerPricePerUnit;
    form.vatRate = val.vatRate;
    form.vatIncluded = val.vatIncluded;
    form.paymentNoPrefix = val.paymentNoPrefix;
    form.orderNoPrefix = val.orderNoPrefix;
    form.minimumOrderAmount = val.minimumOrderAmount;
    form.packageRefundDays = val.packageRefundDays;
  },
  { immediate: true },
);

const isSaving = ref(false);
const onSubmit = async () => {
  isSaving.value = true;
  try {
    await updateSettings({
      hangerPricePerUnit: Number(form.hangerPricePerUnit) || 0,
      vatRate: Number(form.vatRate) || 0,
      vatIncluded: form.vatIncluded,
      paymentNoPrefix: form.paymentNoPrefix.trim(),
      orderNoPrefix: form.orderNoPrefix.trim(),
      minimumOrderAmount: Number(form.minimumOrderAmount) || 0,
      packageRefundDays: Math.floor(Number(form.packageRefundDays) || 0),
    });
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="w-full p-6 max-w-2xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">ตั้งค่าธุรกิจ</h1>
      <p class="text-sm text-muted mt-1">ค่าบริการเสริม ภาษี และเลขเอกสาร</p>
    </div>

    <USkeleton v-if="isLoading" class="h-64 w-full rounded-lg" />

    <template v-else>
      <UCard>
        <template #header>
          <div>
            <p class="font-semibold">ค่าบริการเสริม</p>
            <p class="text-xs text-muted mt-1">ค่าใช้จ่ายเพิ่มเติมที่คิดในออเดอร์</p>
          </div>
        </template>

        <UFormField label="ค่าไม้แขวน/ชิ้น (บาท)" required>
          <UInputNumber v-model="form.hangerPricePerUnit" :min="0" :step="1" class="w-full" />
        </UFormField>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <p class="font-semibold">ภาษี (VAT)</p>
            <p class="text-xs text-muted mt-1">ตั้งเฉพาะกรณีร้านจดทะเบียน VAT</p>
          </div>
        </template>

        <div class="space-y-3">
          <UFormField label="อัตรา VAT (%)">
            <UInputNumber v-model="form.vatRate" :min="0" :max="100" :step="0.1" class="w-full" />
            <template #help>
              <span class="text-xs text-muted">0 = ไม่ใช้ VAT</span>
            </template>
          </UFormField>
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium">ราคารวม VAT แล้ว</p>
              <p class="text-xs text-muted mt-1">ปิด = บวก VAT ตอนคิดเงิน, เปิด = ราคารวม VAT แล้ว</p>
            </div>
            <USwitch v-model="form.vatIncluded" />
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <p class="font-semibold">เลขเอกสาร</p>
            <p class="text-xs text-muted mt-1">Prefix สำหรับเลขใบเสร็จและเลขรับผ้า</p>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UFormField label="Prefix เลขใบเสร็จ" required>
            <UInput v-model="form.paymentNoPrefix" placeholder="PAY-" class="w-full" />
          </UFormField>
          <UFormField label="Prefix เลขรับผ้า" required>
            <UInput v-model="form.orderNoPrefix" placeholder="ORD-" class="w-full" />
          </UFormField>
        </div>
        <p class="text-xs text-muted mt-3">
          ⚠ การเปลี่ยน prefix ส่งผลกับเอกสารใหม่เท่านั้น เอกสารเก่าจะใช้ prefix เดิม
        </p>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <p class="font-semibold">เงื่อนไขอื่น ๆ</p>
          </div>
        </template>

        <div class="space-y-3">
          <UFormField label="ยอดสั่งขั้นต่ำ (บาท)">
            <UInputNumber v-model="form.minimumOrderAmount" :min="0" :step="1" class="w-full" />
            <template #help>
              <span class="text-xs text-muted">0 = ไม่จำกัด</span>
            </template>
          </UFormField>
          <UFormField label="จำนวนวันคืนสิทธิ์แพ็กเกจ">
            <UInputNumber v-model="form.packageRefundDays" :min="0" :max="365" :step="1" class="w-full" />
            <template #help>
              <span class="text-xs text-muted">ลูกค้าขอคืนเงินได้ภายในกี่วัน หลังซื้อแพ็กเกจ</span>
            </template>
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton :loading="isSaving" icon="i-lucide-save" @click="onSubmit">บันทึกการตั้งค่า</UButton>
      </div>
    </template>
  </div>
</template>
