<script setup lang="ts">

definePageMeta({
    layout: 'default'
})


</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <div class="text-center space-y-6">
      <h1 class="text-4xl font-bold text-gray-900 tracking-tight">
        ยินดีต้อนรับสู่ระบบ
      </h1>
      <p class="text-lg text-gray-500 max-w-sm mx-auto">
        เข้าสู่ระบบเพื่อดำเนินการต่อ
      </p>
      
      <div>
        <NuxtLink 
          to="/auth/login"
          class="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          เข้าสู่ระบบ
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
