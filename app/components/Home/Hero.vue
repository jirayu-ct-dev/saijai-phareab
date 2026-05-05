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
        <!-- ===== RIGHT COLUMN — LINE Mockup ===== -->
        <div class="relative hidden lg:block">

          <!-- Floating glow behind card -->
          <div class="absolute inset-0 bg-gradient-to-br from-primary-200/30 to-blue-200/20 dark:from-primary-900/20 dark:to-blue-900/10 rounded-3xl blur-2xl scale-110 pointer-events-none" />

          <!-- Main chat card -->
          <div class="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden">

            <!-- Browser bar -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/80">
              <div class="flex gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span class="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div class="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 text-[11px] font-mono text-gray-400 text-center truncate">
                line.me/R/ti/p/@saijai-laundry
              </div>
            </div>

            <!-- Chat window -->
            <div class="p-4">
              <!-- LINE Header -->
              <div class="flex items-center gap-3 pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#06C755] to-[#04a045] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow ring-2 ring-white dark:ring-gray-900">
                  ใจ
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm flex items-center gap-1.5 text-gray-900 dark:text-white">
                    ใส่ใจ ผ้าเรียบ
                    <UIcon name="i-ph-check-circle-fill" class="text-[#06C755] w-4 h-4 shrink-0" />
                  </div>
                  <div class="text-[11px] text-gray-500">LINE Official · ออนไลน์</div>
                </div>
                <div class="text-[11px] text-gray-400 font-mono">14:23</div>
              </div>

              <!-- Message 1: Receipt -->
              <div class="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm p-3.5 mb-3 max-w-[92%] animate-[fade-in_0.4s_ease-out]">
                <div class="font-semibold flex items-center gap-2 mb-2.5 text-gray-900 dark:text-white text-[13px]">
                  <span class="w-2 h-2 rounded-full bg-emerald-500" />
                  รับผ้าเรียบร้อย ✓
                </div>
                <div class="space-y-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between gap-4">
                    <span>ใบเสร็จ</span>
                    <span class="font-mono text-gray-900 dark:text-gray-200">#SJ-2604-018</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span>น้ำหนัก</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">3.2 กก.</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span>บริการ</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">ซัก-อบ-รีด</span>
                  </div>
                  <div class="flex justify-between gap-4 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">ยอดชำระ</span>
                    <span class="font-bold text-primary-600 dark:text-primary-400">฿320</span>
                  </div>
                </div>
              </div>

              <!-- Message 2: Progress -->
              <div class="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm p-3.5 max-w-[92%] opacity-0 animate-[fade-in_0.4s_ease-out_1s_forwards]">
                <div class="font-semibold flex items-center gap-2 mb-2.5 text-gray-900 dark:text-white text-[13px]">
                  <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  กำลังดำเนินการ…
                </div>
                <div class="space-y-1.5 text-[12.5px] text-gray-600 dark:text-gray-400 mb-3">
                  <div class="flex justify-between gap-4">
                    <span>เครื่อง</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">W-03</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span>เหลืออีก</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">~ 28 นาที</span>
                  </div>
                </div>
                <div class="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-primary-500 to-blue-400 w-0 animate-[progress_3s_ease-out_1.5s_forwards] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>

