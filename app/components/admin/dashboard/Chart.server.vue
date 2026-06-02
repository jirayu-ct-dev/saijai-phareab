<template>
  <section class="-mx-2 shrink-0 border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
    <div class="p-3">
      <p class="mb-1.5 text-xs text-muted">
        รายได้รวม
      </p>
      <p class="text-3xl font-semibold text-highlighted">
        ---
      </p>
    </div>

    <!-- Loading skeleton สำหรับ Chart -->
    <div class="flex h-96 items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
    </div>
  </section>
</template>
