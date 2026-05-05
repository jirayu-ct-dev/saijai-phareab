<script setup lang="ts">
const { session } = useUser();
const { addLineFriend } = useLiffAuth();

const isOpen = ref(false);
let timer: ReturnType<typeof setInterval>;

const checkStoreStatus = () => {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (day === 0) {
    isOpen.value = false;
    return;
  }

  const currentMinutes = hours * 60 + minutes;
  const openTime = 14 * 60;
  const closeTime = 19 * 60 + 30;

  isOpen.value = currentMinutes >= openTime && currentMinutes <= closeTime;
};

onMounted(() => {
  checkStoreStatus();
  timer = setInterval(checkStoreStatus, 60000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <section class="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">

    <!-- Subtle grid background -->
    <div class="absolute inset-0 pointer-events-none"
      style="background-image: linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px); background-size: 56px 56px; mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);" />
    <div class="absolute inset-0 pointer-events-none hidden dark:block"
      style="background-image: linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px); background-size: 56px 56px; mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);" />

    <!-- Centered Glow accents -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary-400/10 dark:bg-primary-500/15 rounded-full blur-[120px] pointer-events-none" />

    <UContainer class="relative z-10">
      <div class="flex flex-col items-center text-center max-w-4xl mx-auto">
        <!-- Status badge -->
        <div class="flex justify-center mb-6">
          <div class="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
            :class="isOpen
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'"
          >
            <span class="w-2 h-2 rounded-full animate-pulse"
              :class="isOpen ? 'bg-emerald-500' : 'bg-red-500'" />
            {{ isOpen ? 'เปิดให้บริการอยู่' : 'ปิดให้บริการ' }} · 14:00 – 19:30
          </div>
        </div>

        <!-- Headline -->
        <h1 class="text-[46px] md:text-[56px] lg:text-[72px] font-bold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-6">
          ซัก-อบ-รีด ด้วยความ<br />
          <span class="text-primary-600 dark:text-primary-400">ใส่ใจ</span> ทุกผืนผ้า
        </h1>

        <!-- Description -->
        <p class="text-lg md:text-xl text-gray-500 dark:text-gray-400 leading-relaxed mb-10 max-w-2xl mx-auto">
          บริการซักรีดครบวงจร สะอาด หอม เรียบ พร้อมบริการรับ-ส่งถึงบ้าน<br class="hidden md:block" /> ราคาเริ่มต้น <strong class="text-gray-700 dark:text-gray-200 font-semibold">60 บาท/กก.</strong>
        </p>

        <!-- Feature chips -->
        <div class="flex flex-wrap justify-center gap-3 mb-12">
          <span class="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-700 dark:text-gray-300 rounded-full px-4 py-2 text-sm font-medium">
            <UIcon name="i-lucide-check" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
            ซัก-อบ-รีด ครบในที่เดียว
          </span>
          <span class="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-700 dark:text-gray-300 rounded-full px-4 py-2 text-sm font-medium">
            <UIcon name="i-lucide-check" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
            รับ-ส่งถึงบ้าน
          </span>
          <span class="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-700 dark:text-gray-300 rounded-full px-4 py-2 text-sm font-medium">
            <UIcon name="i-lucide-check" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
            ส่งคืนใน 24 ชม.
          </span>
        </div>

        <!-- CTAs -->
        <div class="flex flex-wrap justify-center gap-4 mb-16">
          <template v-if="!session?.user">
            <UButton
              size="xl"
              color="primary"
              class="px-8 py-4 text-base font-bold rounded-2xl transition-all hover:scale-105 shadow-xl shadow-primary-500/20"
              to="#per-item-pricing"
            >
              ดูราคาบริการ
              <template #trailing>
                <UIcon name="i-lucide-arrow-right" class="w-5 h-5" />
              </template>
            </UButton>
            <UButton
              size="xl"
              color="primary"
              class="px-8 font-bold rounded-xl transition-all hover:scale-105"
              to="/dashboard"
            >
              ไปที่หน้าจัดการ
            </UButton>
               
            <UButton
              size="xl"
              color="neutral"

              variant="outline"
              color="neutral"
              class="px-8 py-4 text-base font-bold rounded-2xl border-2"
              to="#contact"
            >
              ติดต่อเรา
            </UButton>
          </template>
          <template v-else>
            <UButton
              size="xl"
              color="primary"
              class="px-8 py-4 text-base font-bold rounded-2xl transition-all hover:scale-105 shadow-xl shadow-primary-500/20"
              to="/me"
            >
              ดูคำสั่งของฉัน
              <template #trailing>
                <UIcon name="i-lucide-arrow-right" class="w-5 h-5" />
              </template>
            </UButton>
          </template>
        </div>

        <!-- Stats row -->
        <div class="flex flex-wrap justify-center items-center gap-8 md:gap-16 pt-8 border-t border-gray-200 dark:border-gray-800 w-full max-w-3xl">
          <div class="text-center">
            <p class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">฿60<span class="text-lg font-medium text-gray-500">/กก.</span></p>
            <p class="text-sm text-gray-500 font-medium">ราคาเริ่มต้น</p>
          </div>
          <div class="hidden md:block w-px h-12 bg-gray-200 dark:bg-gray-800" />
          <div class="text-center">
            <p class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">24<span class="text-lg font-medium text-gray-500"> ชม.</span></p>
            <p class="text-sm text-gray-500 font-medium">ส่งคืนไว</p>
          </div>
          <div class="hidden md:block w-px h-12 bg-gray-200 dark:bg-gray-800" />
          <div class="text-center">
            <p class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">6<span class="text-lg font-medium text-gray-500"> วัน</span></p>
            <p class="text-sm text-gray-500 font-medium">หยุดวันอาทิตย์</p>
          </div>
        </div>

      </div>
    </UContainer>
  </section>
</template>
