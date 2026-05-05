<script setup lang="ts">
definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="ที่อยู่จัดส่ง" />

      <div class="p-6 max-w-2xl mx-auto space-y-6 w-full">
        <UCard>
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <UIcon name="i-lucide-map-pin" class="h-12 w-12 text-gray-400 mb-4" />
            <p class="text-gray-500 mb-4">ยังไม่มีข้อมูลที่อยู่จัดส่งของคุณ</p>
            <UButton color="primary" icon="i-lucide-plus">เพิ่มที่อยู่ใหม่</UButton>
          </div>
        </UCard>
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
