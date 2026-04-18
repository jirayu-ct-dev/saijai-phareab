<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center h-screen">
    <h1>{{ error.status }}</h1>
    <p>ไม่พบหน้าที่ต้องการ</p>
    <UButton label="ย้านกลับ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="$router.back()" />
  </div>
</template>
