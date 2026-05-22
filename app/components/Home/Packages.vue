<script setup lang="ts">
const { data: packages, pending, error } = await useFetch<any[]>("/api/public/packages");

const formatPrice = (price: number) => new Intl.NumberFormat("th-TH").format(price);

const mainPackages = computed(() => {
  if (!packages.value) return [];
  return packages.value.filter(p => p.packageType !== 'ADDON').slice(0, 3);
});

const addonPackages = computed(() => {
  if (!packages.value) return [];
  return packages.value.filter(p => p.packageType === 'ADDON');
});

const getPackageLabel = (index: number) => {
  const labels = ['SMALL', 'MEDIUM', 'LARGE'];
  return labels[index] || '';
};
</script>

<template>
  <section id="monthly-membership" class="py-24">
    <UContainer>
      <!-- Header -->
      <div class="mb-16 max-w-2xl mx-auto text-center">
        <span class="inline-block text-blue-400 font-semibold text-[13px] tracking-[0.2em] uppercase mb-3">แพ็กเกจรายเดือน</span>
        <h2 class="text-[32px] md:text-[44px] font-bold text-gray-900 dark:text-white leading-[1.2] mb-4">
          เลือกแพ็กเกจที่ใช่สำหรับคุณ
        </h2>
        <p class="text-gray-400 text-lg">
          ประหยัดกว่าด้วยแพ็กเกจรายเดือนที่ออกแบบมาเพื่อคุณ
        </p>
      </div>

      <!-- Main Packages Grid -->
      <div v-if="pending" class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <UCard v-for="i in 3" :key="i" class="h-[600px] animate-pulse rounded-[32px] bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800" />
      </div>

      <div v-else-if="error" class="text-center py-12 text-red-400">
        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-stretch">
        <div
          v-for="(pkg, index) in mainPackages"
          :key="pkg.id"
          class="relative flex flex-col bg-white dark:bg-[#0f172a] rounded-[32px] transition-all duration-500 border h-full group"
          :class="[
            index === 1
              ? 'border-blue-600 shadow-[0_0_40px_-10px_rgba(37,99,235,0.3)] scale-[1.02] z-10'
              : 'border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700'
          ]"
        >
          <!-- Recommended Badge -->
          <div
            v-if="index === 1"
            class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[12px] font-bold px-4 py-1 rounded-full z-20 shadow-lg"
          >
            แนะนำ
          </div>

          <div class="p-8 md:p-10 flex flex-col h-full">
            <div class="mb-6">
              <span class="text-[14px] font-medium tracking-[0.2em] text-blue-600/80 dark:text-blue-400/60 uppercase">
                {{ getPackageLabel(index) }}
              </span>
              <h3 class="text-[28px] font-bold text-gray-900 dark:text-white mt-1">
                {{ pkg.name }}
              </h3>
            </div>

            <div class="mb-8 flex items-baseline gap-1">
              <span class="text-[44px] font-bold text-gray-900 dark:text-white">฿{{ formatPrice(pkg.price) }}</span>
              <span class="text-gray-500 dark:text-gray-400 text-[16px] ml-1">บาท</span>
            </div>

            <p class="text-gray-500 dark:text-gray-400 text-[14px] mb-8 mt-[-20px]">ต่อเดือน</p>

            <div class="space-y-5 mb-10 flex-grow">
              <div v-for="(feature, fIndex) in pkg.features" :key="fIndex" class="flex items-start gap-3">
                <UIcon name="i-lucide-check" class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <span class="text-[15px] text-gray-600 dark:text-gray-300 leading-snug">{{ feature }}</span>
              </div>
            </div>

            <UButton
              block
              size="xl"
              to="/me/packages"
              :variant="index === 1 ? 'solid' : 'outline'"
              :class="[
                'rounded-[16px] py-4 text-[16px] font-bold transition-all group/btn',
                index === 1
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
                  : 'bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700'
              ]"
            >
              เลือกแพ็กเกจนี้
              <UIcon name="i-lucide-arrow-right" class="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </UButton>
          </div>
        </div>
      </div>

      <!-- Add-on Card (from API) -->
      <div v-if="!pending && addonPackages.length > 0" class="space-y-6">
        <div
          v-for="addon in addonPackages"
          :key="addon.id"
          class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-800 rounded-[24px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
        >
          <div class="flex items-center gap-6 flex-1 w-full md:w-auto">
            <div class="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-sm shrink-0 border border-gray-100 dark:border-gray-800">
              <UIcon name="i-lucide-truck" class="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <span class="text-[12px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">ADD-ON</span>
                <span class="text-[12px] text-gray-500 font-medium">บริการเสริม</span>
              </div>
              <h4 class="text-[20px] font-bold text-gray-900 dark:text-white mb-1">{{ addon.name }}</h4>
              <p class="text-gray-500 dark:text-gray-400 text-[14px]">{{ addon.description || 'รับและส่งคืนผ้า 8 ครั้ง/เดือน • ทุกวันพุธและวันเสาร์ (สัปดาห์ละ 2 ครั้ง)' }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between md:justify-end gap-8 md:gap-12 w-full md:w-auto border-t md:border-t-0 border-gray-200 dark:border-gray-800 pt-6 md:pt-0">
            <div class="text-center">
              <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">ครั้ง/เดือน</p>
              <p class="text-[20px] font-bold text-gray-900 dark:text-white">8</p>
            </div>
            <div class="text-center">
              <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">วัน</p>
              <p class="text-[20px] font-bold text-gray-900 dark:text-white">พุธ • เสาร์</p>
            </div>
            <div class="flex flex-col items-end min-w-[120px]">
              <div class="flex items-baseline gap-1 mb-2">
                <span class="text-[26px] font-bold text-gray-900 dark:text-white">฿{{ formatPrice(addon.price) }}</span>
                <span class="text-gray-500 text-[12px]">/เดือน</span>
              </div>
              <UButton
                variant="link"
                to="/me/packages"
                class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold p-0 group"
              >
                เพิ่มบริการนี้
                <UIcon name="i-lucide-arrow-right" class="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Delivery Package Static Card (fallback หาก API ไม่มี addon) -->
      <div v-else-if="!pending" class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-800 rounded-[24px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        <div class="flex items-center gap-6 flex-1 w-full md:w-auto">
          <div class="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-sm shrink-0 border border-gray-100 dark:border-gray-800">
            <UIcon name="i-lucide-truck" class="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div class="flex items-center gap-3 mb-1">
              <span class="text-[12px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">ADD-ON</span>
              <span class="text-[12px] text-gray-500 font-medium">บริการเสริม</span>
            </div>
            <h4 class="text-[20px] font-bold text-gray-900 dark:text-white mb-1">รับ-ส่งผ้าถึงบ้าน</h4>
            <p class="text-gray-500 dark:text-gray-400 text-[14px]">รับและส่งคืนผ้า 8 ครั้ง/เดือน • ทุกวันพุธและวันเสาร์ (สัปดาห์ละ 2 ครั้ง)</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between md:justify-end gap-8 md:gap-12 w-full md:w-auto border-t md:border-t-0 border-gray-200 dark:border-gray-800 pt-6 md:pt-0">
          <div class="text-center">
            <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">ครั้ง/เดือน</p>
            <p class="text-[20px] font-bold text-gray-900 dark:text-white">8</p>
          </div>
          <div class="text-center">
            <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">วัน</p>
            <p class="text-[20px] font-bold text-gray-900 dark:text-white">พุธ • เสาร์</p>
          </div>
          <div class="flex flex-col items-end min-w-[120px]">
            <div class="flex items-baseline gap-1 mb-2">
              <span class="text-[26px] font-bold text-gray-900 dark:text-white">฿300</span>
              <span class="text-gray-500 text-[12px]">/เดือน</span>
            </div>
            <UButton
              variant="link"
              to="#contact"
              class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold p-0 group"
            >
              สอบถามเพิ่มเติม
              <UIcon name="i-lucide-arrow-right" class="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </UButton>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
/* No extra styles needed as we use Tailwind classes for all design elements */
</style>
