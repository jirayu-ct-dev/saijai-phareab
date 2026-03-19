<script setup lang="ts">
definePageMeta({
    layout: 'admin',
    middleware: ['role-admin'],
})
</script>

<template>
  <div class="flex flex-1 w-full min-w-0">
    <NuxtPage />
  </div>
</template>