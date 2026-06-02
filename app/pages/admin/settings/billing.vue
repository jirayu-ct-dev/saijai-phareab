<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const { settings, isLoading, updateSettings } = useBusinessSetting();

const form = reactive({
  hangerPricePerUnit: 10,
  washFoldPricePerKg: 60,
  washFoldMinKg: 0,
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
    form.washFoldPricePerKg = val.washFoldPricePerKg;
    form.washFoldMinKg = val.washFoldMinKg;
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
      washFoldPricePerKg: Number(form.washFoldPricePerKg) || 0,
      washFoldMinKg: Number(form.washFoldMinKg) || 0,
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
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <h1 class="text-xl font-semibold text-highlighted">ตั้งค่าธุรกิจ</h1>
      <p class="mt-1 text-sm text-muted">ค่าบริการเสริม ภาษี และเลขเอกสาร</p>
    </section>

    <template v-if="isLoading">
      <div v-for="i in 3" :key="`bill-sk-${i}`" class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="space-y-1.5 border-b border-default/40 pb-3">
          <USkeleton class="h-4 w-40 rounded" />
          <USkeleton class="h-3 w-56 rounded" />
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div v-for="j in 2" :key="`bill-f-${i}-${j}`" class="space-y-1.5">
            <USkeleton class="h-3 w-24 rounded" />
            <USkeleton class="h-9 w-full rounded-lg" />
          </div>
        </div>
      </div>
      <USkeleton class="h-10 w-28 rounded-lg self-end" />
    </template>

    <template v-else>
      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <p class="font-semibold text-highlighted">ค่าบริการเสริม</p>
          <p class="mt-1 text-xs text-muted">ค่าใช้จ่ายเพิ่มเติมที่คิดในออเดอร์</p>
        </div>

        <UFormField label="ค่าไม้แขวน/ชิ้น (บาท)" required>
          <UInputNumber v-model="form.hangerPricePerUnit" :min="0" :step="1" class="w-full" />
        </UFormField>
      </section>

      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <p class="font-semibold text-highlighted">ซัก-พับ ชั่งกิโล</p>
          <p class="mt-1 text-xs text-muted">ใช้กับโหมด "ซัก-พับ ชั่งกิโล" บนหน้า POS</p>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <UFormField label="ราคา/กิโล (บาท)" required>
            <UInputNumber v-model="form.washFoldPricePerKg" :min="0" :step="1" class="w-full" />
          </UFormField>
          <UFormField label="กิโลขั้นต่ำ (กก.)">
            <UInputNumber v-model="form.washFoldMinKg" :min="0" :step="0.5" class="w-full" />
            <template #help>
              <span class="text-xs text-muted">0 = ไม่จำกัด</span>
            </template>
          </UFormField>
        </div>
      </section>

      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <p class="font-semibold text-highlighted">ภาษี (VAT)</p>
          <p class="mt-1 text-xs text-muted">ตั้งเฉพาะกรณีร้านจดทะเบียน VAT</p>
        </div>

        <div class="space-y-3">
          <UFormField label="อัตรา VAT (%)">
            <UInputNumber v-model="form.vatRate" :min="0" :max="100" :step="0.1" class="w-full" />
            <template #help>
              <span class="text-xs text-muted">0 = ไม่ใช้ VAT</span>
            </template>
          </UFormField>
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">ราคารวม VAT แล้ว</p>
              <p class="mt-1 text-xs text-muted">ปิด = บวก VAT ตอนคิดเงิน, เปิด = ราคารวม VAT แล้ว</p>
            </div>
            <USwitch v-model="form.vatIncluded" />
          </div>
        </div>
      </section>

      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <p class="font-semibold text-highlighted">เลขเอกสาร</p>
          <p class="mt-1 text-xs text-muted">Prefix สำหรับเลขใบเสร็จและเลขรับผ้า</p>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <UFormField label="Prefix เลขใบเสร็จ" required>
            <UInput v-model="form.paymentNoPrefix" placeholder="PAY-" class="w-full" />
          </UFormField>
          <UFormField label="Prefix เลขรับผ้า" required>
            <UInput v-model="form.orderNoPrefix" placeholder="ORD-" class="w-full" />
          </UFormField>
        </div>
        <div class="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
          <span>การเปลี่ยน prefix ส่งผลกับเอกสารใหม่เท่านั้น เอกสารเก่าจะใช้ prefix เดิม</span>
        </div>
      </section>

      <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
        <div class="mb-4">
          <p class="font-semibold text-highlighted">เงื่อนไขอื่น ๆ</p>
        </div>

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
      </section>

      <div class="flex justify-end">
        <UButton :loading="isSaving" icon="i-lucide-save" @click="onSubmit">บันทึกการตั้งค่า</UButton>
      </div>
    </template>
  </div>
</template>
