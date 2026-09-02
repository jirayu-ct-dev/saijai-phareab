<script setup lang="ts">
import type { PrinterFormValue } from "~~/app/utils/printFormOptions";

// Shared printer profile fields (PRN-06): used by the register form (no
// printer yet) and the edit form on the admin printing page. Field values are
// bound via defineModel; option lists live in app/utils/printFormOptions.ts.

const model = defineModel<PrinterFormValue>({ required: true });
</script>

<template>
  <div class="space-y-4">
    <UFormField label="ชื่อเครื่องพิมพ์" name="name" required>
      <UInput v-model="model.name" placeholder="เช่น เครื่องพิมพ์หน้าร้าน" class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="การเชื่อมต่อหลัก" name="defaultTransport">
        <USelect v-model="model.defaultTransport" :items="TRANSPORT_OPTIONS" value-key="value" class="w-full" />
      </UFormField>

      <UFormField label="โหมดเรนเดอร์" name="renderMode">
        <USelect v-model="model.renderMode" :items="RENDER_MODE_OPTIONS" value-key="value" class="w-full" />
      </UFormField>

      <UFormField label="ความกว้างกระดาษ" name="paperWidthMm">
        <USelect v-model="model.paperWidthMm" :items="PAPER_WIDTH_OPTIONS" value-key="value" class="w-full" />
      </UFormField>

      <UFormField label="ความละเอียดพิมพ์" name="printableDots">
        <USelect v-model="model.printableDots" :items="PRINTABLE_DOTS_OPTIONS" value-key="value" class="w-full" />
      </UFormField>
    </div>

    <UFormField name="capabilities">
      <template #label>
        <span class="text-sm font-medium text-highlighted">ความสามารถเสริม (capabilities)</span>
      </template>
      <template #help>
        เปิดได้เฉพาะเมื่อยืนยันกับเครื่องจริงแล้ว หากไม่แน่ใจให้ปิดไว้ก่อน
      </template>
      <div class="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
        <USwitch
          v-for="item in CAPABILITY_ITEMS"
          :key="item.key"
          v-model="model.capabilities[item.key]"
          :label="item.label"
          size="sm"
        />
      </div>
    </UFormField>
  </div>
</template>
