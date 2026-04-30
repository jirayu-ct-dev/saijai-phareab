<script setup lang="ts">
const { data: packages, pending, error } = await useFetch<any>("/api/public/packages");

const formatPrice = (price: number) => new Intl.NumberFormat("th-TH").format(price);
const packageTypeLabel = (packageType: string) =>
  packageType === "ADDON" ? "แพ็กเกจเสริม" : "แพ็กเกจหลัก";

const scrollContainer = ref<HTMLElement | null>(null);

const scrollLeft = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollBy({ left: -400, behavior: 'smooth' });
  }
};

const scrollRight = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollBy({ left: 400, behavior: 'smooth' });
  }
};
</script>

<template>
  <section class="py-24 bg-gray-50 dark:bg-gray-950 overflow-hidden">
    <UContainer>
      <div class="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div class="space-y-4 max-w-2xl text-left">
          <UBadge color="primary" variant="subtle" class="rounded-full">Special Offers</UBadge>
          <h2 class="text-3xl md:text-5xl font-bold text-[#1a365d] dark:text-white">
            แพ็กเกจสมาชิกสุดคุ้ม
          </h2>
          <p class="text-gray-500 dark:text-gray-400 text-lg">
            เลือกแพ็กเกจที่เหมาะกับคุณ เพื่อความคุ้มค่าและความสะดวกที่มากกว่าเดิม
          </p>
        </div>
        <div class="flex gap-3">
          <UButton 
            icon="i-lucide-arrow-left" 
            color="neutral" 
            variant="outline" 
            class="rounded-full h-12 w-12 flex items-center justify-center p-0 border-gray-200 dark:border-gray-800" 
            @click="scrollLeft" 
          />
          <UButton 
            icon="i-lucide-arrow-right" 
            color="neutral" 
            variant="outline" 
            class="rounded-full h-12 w-12 flex items-center justify-center p-0 border-gray-200 dark:border-gray-800" 
            @click="scrollRight" 
          />
        </div>
      </div>
    </UContainer>

    <!-- Horizontal Scroll Container -->
    <div 
      ref="scrollContainer"
      class="flex overflow-x-auto gap-8 px-[5%] md:px-[10%] pb-12 snap-x snap-mandatory no-scrollbar scroll-smooth"
    >
      <div v-if="pending" class="flex gap-8">
        <UCard v-for="i in 3" :key="i" class="w-[350px] md:w-[400px] flex-shrink-0 animate-pulse rounded-3xl">
          <div class="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </UCard>
      </div>

      <div v-else-if="error" class="w-full text-center py-12 text-red-500">
        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>

      <template v-else>
        <div
          v-for="(pkg, index) in packages"
          :key="pkg.id"
          class="relative flex flex-col flex-shrink-0 w-[320px] md:w-[400px] bg-white dark:bg-gray-900 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-800 snap-center group overflow-hidden"
        >
          <!-- Accent top bar for best value -->
          <div v-if="index === 1" class="absolute top-0 inset-x-0 h-2 bg-primary-500 z-10" />
          
          <div class="p-8 md:p-10 flex-1">
            <div class="flex justify-between items-start mb-6">
              <h3 class="text-2xl font-bold text-[#1a365d] dark:text-white">{{ pkg.name }}</h3>
              <UBadge v-if="index === 1" color="primary" size="sm" class="rounded-full">ยอดนิยม</UBadge>
            </div>
            
            <p class="text-xs font-bold tracking-widest text-primary-600 dark:text-primary-400 mb-4 uppercase">
              {{ packageTypeLabel(pkg.packageType) }}
            </p>
            
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-8 line-clamp-2">
              {{ pkg.description || "แพ็กเกจที่ออกแบบให้เลือกใช้งานได้ตามความต้องการ" }}
            </p>

            <div class="mb-8">
              <span class="text-5xl font-black text-[#1a365d] dark:text-white">
                {{ formatPrice(pkg.price) }}
              </span>
              <span class="text-gray-400 ml-2 font-medium">
                บาท
                <template v-if="pkg.validityDays">
                  / {{ pkg.validityDays }} วัน
                </template>
              </span>
            </div>

            <div class="space-y-4">
              <div v-for="(feature, fIndex) in pkg.features" :key="fIndex" class="flex items-center gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-50 dark:bg-primary-950 flex items-center justify-center">
                  <UIcon name="i-lucide-check" class="w-3 h-3 text-primary-600 font-bold" />
                </div>
                <span class="text-sm text-gray-600 dark:text-gray-300 font-medium">{{ feature }}</span>
              </div>
            </div>
          </div>

          <div class="p-8 md:p-10 pt-0">
            <UButton
              block
              size="xl"
              :color="index === 1 ? 'primary' : 'neutral'"
              :variant="index === 1 ? 'solid' : 'outline'"
              to="#contact"
              class="font-bold rounded-2xl py-4 transition-all group-hover:scale-[1.02]"
            >
              เลือกแพ็กเกจนี้
            </UButton>
          </div>
        </div>
      </template>
    </div>

    <style scoped>
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    </style>
  </section>
</template>
