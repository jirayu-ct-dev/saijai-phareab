<script setup lang="ts">
const { data: packages, pending, error } = await useFetch<any>('/api/public/packages')

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('th-TH').format(price)
}
</script>

<template>
  <div class="py-12">
    <!-- Loading State -->
    <div v-if="pending" class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <UCard v-for="i in 3" :key="i" class="animate-pulse">
        <template #header>
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </template>
        <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
        <div class="space-y-4">
          <div v-for="j in 4" :key="j" class="flex items-center gap-3">
            <div class="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8 text-red-500">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>เกิดข้อผิดพลาดในการโหลดข้อมูลแพ็กเกจ</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!packages?.length" class="text-center py-8 text-gray-500">
      ยังไม่มีแพ็กเกจเปิดให้บริการในขณะนี้
    </div>

    <!-- Package Cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch pt-4">
      <div 
        v-for="(pkg, index) in packages" 
        :key="pkg.id"
        class="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border group"
        :class="index === 1 ? 'border-primary-500 shadow-md transform md:-translate-y-4' : 'border-gray-100 dark:border-gray-700 mt-0 md:mt-4'"
      >
        <!-- Recommended Badge for middle item -->
        <div v-if="index === 1" class="absolute -top-4 inset-x-0 flex justify-center">
          <span class="bg-primary-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm tracking-wider uppercase">
            ขายดีที่สุด (Best Value)
          </span>
        </div>

        <div class="p-8 flex-1">
          <h3 class="text-2xl font-bold text-[#1a2b4c] dark:text-white mb-2">{{ pkg.name }}</h3>
          <p class="text-gray-500 dark:text-gray-400 text-sm h-10">{{ pkg.description || 'แพ็กเกจสุดคุ้ม ตอบโจทย์ทุกการใช้งาน' }}</p>
          
          <div class="my-6">
            <span class="text-4xl font-extrabold text-primary-600 dark:text-primary-400">{{ formatPrice(pkg.price) }}</span>
            <span class="text-gray-500 dark:text-gray-400 ml-2">บาท / {{ pkg.validityDays }} วัน</span>
          </div>

          <UDivider class="my-6" />

          <ul class="space-y-4 mb-8">
            <li v-for="(feature, fIndex) in pkg.features" :key="fIndex" class="flex items-start gap-3">
              <UIcon name="i-lucide-check-circle-2" class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ feature }}</span>
            </li>
          </ul>
        </div>

        <div class="p-8 pt-0 mt-auto">
          <UButton 
            block 
            size="lg"
            :color="index === 1 ? 'primary' : 'neutral'"
            :variant="index === 1 ? 'solid' : 'outline'"
            to="#contact"
            class="font-bold text-base transition-transform group-hover:scale-105"
          >
            สมัครแพ็กเกจนี้
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
