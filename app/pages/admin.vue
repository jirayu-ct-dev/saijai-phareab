<script setup lang="ts">
definePageMeta({
    layout: 'admin',
    middleware: ['role-employee'],
})
</script>

<template>
  <div class="flex flex-1 w-full min-w-0">
    <NuxtPage />
  </div>
</template>
