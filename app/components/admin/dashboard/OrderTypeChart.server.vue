<template>
  <UCard class="shrink-0" :ui="{ body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div class="p-3">
        <p class="text-xs text-muted mb-1.5">
          เปรียบเทียบออเดอร์แต่ละประเภท
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          ---
        </p>
      </div>
    </template>

    <div class="h-96 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-muted" />
    </div>
  </UCard>
</template>
