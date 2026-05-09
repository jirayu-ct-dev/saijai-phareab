<script setup lang="ts">
import type { ComputedRef } from "vue";
import { computed, useTemplateRef } from "vue";
import { useThermalExport } from "~~/app/composables/useThermalExport";
import { useThermalPrinter } from "~~/app/composables/useThermalPrinter";
import ThermalExportDocument from "./ThermalExportDocument.vue";
import PrinterConnectModal from "./PrinterConnectModal.vue";

const props = defineProps<{
  panelId: string;
  navbarTitle: string;
  navbarIcon?: string;
  fileName: string;
  fallbackPath?: string;
  isLoading: boolean;
  hasError: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  printLabel?: string;
}>();

const emit = defineEmits<{
  retry: [];
  print: [];
}>();

type ThermalExportDocumentExpose = {
  element: HTMLElement | null;
};

const exportDocument = useTemplateRef<ThermalExportDocumentExpose>("exportDocument");
const exportElement = computed(() => exportDocument.value?.element ?? null);

const { goBack, downloadPng, isExporting } = useThermalExport(
  exportElement as ComputedRef<HTMLElement | null>,
  () => props.fileName,
  props.fallbackPath ?? "/admin",
);

const { state: printerState } = useThermalPrinter();

const showPrinterModal = ref(false);

defineExpose({ goBack, downloadPng, getPrintElement: () => exportElement.value });
</script>

<template>
  <UDashboardPanel :id="panelId">
    <template #header>
      <UDashboardNavbar :title="navbarTitle" :icon="navbarIcon || 'i-lucide-receipt'">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="กลับ"
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              class="shrink-0"
              aria-label="กลับ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="goBack"
            />
            <UButton
              label="บันทึก PNG"
              color="neutral"
              variant="outline"
              icon="i-lucide-image-down"
              class="shrink-0"
              title="บันทึกเป็นไฟล์ PNG"
              aria-label="บันทึก PNG"
              :loading="isExporting"
              :ui="{ label: 'hidden sm:inline' }"
              @click="downloadPng"
            />

            <!-- Printer status + settings -->
            <div class="relative shrink-0">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-printer"
                aria-label="ตั้งค่าเครื่องพิมพ์"
                @click="showPrinterModal = true"
              />
              <span
                class="pointer-events-none absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-bg"
                :class="printerState.isConnected ? 'bg-green-500' : 'bg-neutral-400'"
              />
            </div>

            <UButton
              :label="printLabel || 'พิมพ์'"
              color="primary"
              icon="i-lucide-printer"
              class="shrink-0"
              aria-label="พิมพ์"
              :ui="{ label: 'hidden sm:inline' }"
              :disabled="!printerState.isConnected"
              :loading="printerState.isConnecting"
              @click="emit('print')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="isLoading" class="thermal-card mx-auto rounded-2xl border border-default bg-default p-6">
        <USkeleton class="mx-auto h-5 w-40" />
        <USkeleton class="mx-auto mt-2 h-4 w-56" />
        <USkeleton class="mt-6 h-80 w-full" />
      </div>

      <div v-else-if="hasError" class="thermal-card mx-auto rounded-2xl border border-default bg-default p-6">
        <p class="text-base font-semibold text-highlighted">{{ emptyTitle || "ไม่พบข้อมูล" }}</p>
        <p class="mt-2 text-sm text-muted">{{ emptyMessage || "รายการนี้อาจถูกลบหรือยังไม่พร้อมสำหรับพิมพ์" }}</p>
        <div class="mt-4">
          <UButton label="ลองใหม่" color="neutral" variant="outline" @click="emit('retry')" />
        </div>
      </div>

      <article v-else class="thermal-card mx-auto bg-white px-4 py-5 text-[13px] leading-5 text-black">
        <slot />
      </article>
    </template>
  </UDashboardPanel>

  <ClientOnly>
    <Teleport to="body">
      <div v-if="!isLoading && !hasError" class="thermal-export-host" aria-hidden="true">
        <ThermalExportDocument ref="exportDocument">
          <slot />
        </ThermalExportDocument>
      </div>
    </Teleport>
  </ClientOnly>

  <PrinterConnectModal v-model:open="showPrinterModal" />
</template>

<style scoped>
.thermal-card {
  width: min(100%, 80mm);
}

.thermal-export-host {
  position: fixed;
  top: 0;
  left: -10000px;
  z-index: -1;
  width: 390px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  pointer-events: none;
  background: #ffffff;
}
</style>
