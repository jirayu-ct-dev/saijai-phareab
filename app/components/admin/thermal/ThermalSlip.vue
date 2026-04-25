<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useThermalExport } from "~~/app/composables/useThermalExport";

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
}>();

const slipElement = useTemplateRef<HTMLElement>("slipElement");

const { goBack, handlePrint, downloadPng } = useThermalExport(
  slipElement,
  () => props.fileName,
  props.fallbackPath ?? "/admin",
);

defineExpose({ goBack, handlePrint, downloadPng });
</script>

<template>
  <UDashboardPanel :id="panelId">
    <template #header>
      <UDashboardNavbar :title="navbarTitle" :icon="navbarIcon || 'i-lucide-receipt'">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex thermal-actions" />
        </template>

        <template #right>
          <div class="thermal-actions flex items-center gap-2">
            <UButton label="กลับ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack" />
            <UButton label="บันทึก PNG" color="neutral" variant="outline" icon="i-lucide-image-down" @click="downloadPng" />
            <UButton :label="printLabel || 'พิมพ์'" color="neutral" icon="i-lucide-printer" @click="handlePrint" />
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

      <article v-else ref="slipElement" class="thermal-card mx-auto bg-white px-4 py-5 text-[13px] leading-5 text-black">
        <slot />
      </article>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.thermal-card {
  width: min(100%, 80mm);
}

@media print {
  .thermal-actions {
    display: none !important;
  }

  .thermal-card {
    width: 80mm;
    max-width: 80mm;
    border: 0;
    box-shadow: none;
    margin: 0 auto;
    padding-left: 10px;
    padding-right: 10px;
  }

  :global(body) {
    background: #fff !important;
  }
}
</style>
