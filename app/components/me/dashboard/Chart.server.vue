<template>
  <UCard class="shrink-0" :ui="{ body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div>
        <p class="text-xs text-muted mb-1.5">
          ยอดใช้จ่ายของฉัน
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          ---
        </p>
      </div>
    </template>

    <!-- Loading skeleton สำหรับ Chart -->
    <div class="h-96 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
    </div>
  </UCard>
</template>
