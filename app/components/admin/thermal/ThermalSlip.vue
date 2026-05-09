<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useElementSize, useWindowSize } from "@vueuse/core";
import { useThermalPrinter } from "~~/app/composables/useThermalPrinter";
import PrinterConnectModal from "./PrinterConnectModal.vue";

defineProps<{
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
  isPrinting?: boolean;
  isDownloadingPdf?: boolean;
  isDownloadingPng?: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  print: [];
  back: [];
  downloadPdf: [];
  downloadPng: [];
}>();

const { state: printerState } = useThermalPrinter();
const showPrinterModal = ref(false);

// Export/print still uses the exact printer dot count. The admin preview below
// is visually scaled only, so it is easier to read without horizontal scrolling.
const previewWidthPx = computed(() => (printerState.value.paperWidth === 58 ? 384 : 576));
const previewHost = useTemplateRef<HTMLElement>("previewHost");
const previewCard = useTemplateRef<HTMLElement>("previewCard");
const { width: previewHostWidth } = useElementSize(previewHost);
const { height: previewCardHeight } = useElementSize(previewCard);
const { height: viewportHeight } = useWindowSize();
const previewScale = computed(() => {
  const availableWidth = Math.max(0, previewHostWidth.value - 24);
  const availableHeight = Math.max(360, viewportHeight.value - 190);
  const widthScale = availableWidth ? availableWidth / previewWidthPx.value : 1;
  const heightScale = previewCardHeight.value ? availableHeight / previewCardHeight.value : 1;
  return Math.min(1, Math.max(0.42, Math.min(widthScale, heightScale)));
});
const previewStageStyle = computed(() => ({
  width: `${previewWidthPx.value * previewScale.value}px`,
  height: previewCardHeight.value ? `${previewCardHeight.value * previewScale.value}px` : "auto",
}));
const previewCardStyle = computed(() => ({
  width: `${previewWidthPx.value}px`,
  transform: `scale(${previewScale.value})`,
}));

function goBack() {
  if (import.meta.client && window.history.length > 1) window.history.back();
  else emit("back");
}
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
              label="PDF"
              color="neutral"
              variant="outline"
              icon="i-lucide-file-down"
              class="shrink-0"
              :loading="isDownloadingPdf"
              :ui="{ label: 'hidden sm:inline' }"
              @click="emit('downloadPdf')"
            />
            <UButton
              label="PNG"
              color="neutral"
              variant="outline"
              icon="i-lucide-image-down"
              class="shrink-0"
              :loading="isDownloadingPng"
              :ui="{ label: 'hidden sm:inline' }"
              @click="emit('downloadPng')"
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
              :loading="isPrinting || printerState.isConnecting"
              @click="emit('print')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div ref="previewHost" class="thermal-scroll">
        <div v-if="isLoading" class="thermal-card rounded-2xl border border-default bg-default p-6" :style="{ width: `${previewWidthPx}px`, maxWidth: '100%' }">
          <USkeleton class="mx-auto h-5 w-40" />
          <USkeleton class="mx-auto mt-2 h-4 w-56" />
          <USkeleton class="mt-6 h-80 w-full" />
        </div>

        <div v-else-if="hasError" class="thermal-card rounded-2xl border border-default bg-default p-6" :style="{ width: `${previewWidthPx}px`, maxWidth: '100%' }">
          <p class="text-base font-semibold text-highlighted">{{ emptyTitle || "ไม่พบข้อมูล" }}</p>
          <p class="mt-2 text-sm text-muted">{{ emptyMessage || "รายการนี้อาจถูกลบหรือยังไม่พร้อมสำหรับพิมพ์" }}</p>
          <div class="mt-4">
            <UButton label="ลองใหม่" color="neutral" variant="outline" @click="emit('retry')" />
          </div>
        </div>

        <div v-else class="thermal-stage" :style="previewStageStyle">
          <article ref="previewCard" class="thermal-card bg-white text-black shadow-sm" :style="previewCardStyle">
            <slot />
          </article>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <PrinterConnectModal v-model:open="showPrinterModal" />
</template>

<style scoped>
/* Preview only: the actual document keeps the printer width, but the wrapper
   scales it visually so the admin page can show the whole document width. */
.thermal-scroll {
  width: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 16px 12px 32px;
}

.thermal-stage {
  position: relative;
  flex-shrink: 0;
}

.thermal-card {
  flex-shrink: 0;
  transform-origin: top center;
  /* Force every descendant onto the same font baseline used by the renderer.
     Tailwind's preflight on the admin layout sets a smaller base font, which
     would otherwise leak into the document via inheritance. */
  font-size: 22px;
  line-height: 1.7;
  color: #000;
}
</style>
