<script setup lang="ts">
const { session } = useUser();

type ShopSettings = {
  washFoldPricePerKg?: number | null;
};

const { data: shopSettings } = useFetch<ShopSettings>("/api/public/shop-settings", {
  key: "home-hero-shop-settings",
  lazy: true,
});
const washFoldPrice = computed(() => shopSettings.value?.washFoldPricePerKg ?? 60);

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

    <!-- Glow accents -->
    <div class="absolute top-0 left-1/4 w-150 h-100 bg-primary-400/8 dark:bg-primary-500/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
    <div class="absolute top-1/3 right-0 w-100 h-100 bg-blue-400/8 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2" />

    <UContainer class="relative z-10">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

        <!-- ===== LEFT COLUMN ===== -->
        <div class="flex flex-col">

          <!-- Status badge -->
          <ClientOnly>
            <div class="flex items-center gap-2 mb-6">
              <div class="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium"
                :class="isOpen
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'"
              >
                <span class="w-1.5 h-1.5 rounded-full animate-pulse"
                  :class="isOpen ? 'bg-emerald-500' : 'bg-red-500'" />
                {{ isOpen ? 'เปิดให้บริการอยู่' : 'ปิดให้บริการ' }} · 14:00 – 19:30
              </div>
            </div>
            <template #fallback>
              <div class="flex items-center gap-2 mb-6">
                <div class="h-7 w-48 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
            </template>
          </ClientOnly>

          <!-- Headline -->
          <h1 class="text-[38px] sm:text-[42px] md:text-[52px] lg:text-[60px] font-bold text-gray-900 dark:text-white leading-[1.06] tracking-tight mb-5 max-w-[11ch] sm:max-w-none">
            ซัก อบ รีด
            <span class="block text-primary-600 dark:text-primary-400">ติดตามออเดอร์</span>
            <span class="block">ในระบบสมาชิก</span>
          </h1>

          <!-- Description -->
          <p class="text-[17px] md:text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-8 max-w-md">
            ดูราคาหน้าร้าน เลือกแพ็กเกจ ติดตามออเดอร์ และรับใบแจ้งราคา/ใบเสร็จผ่านระบบสมาชิก ราคาเริ่มต้น <strong class="text-gray-700 dark:text-gray-200 font-semibold">{{ washFoldPrice }} บาท/กก.</strong>
          </p>

          <!-- Feature chips -->
          <div class="flex flex-wrap gap-2 mb-8">
            <span class="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full px-3 py-1.5 text-[13px] font-medium">
              <UIcon name="i-lucide-check" class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              ดูราคาและแพ็กเกจได้ก่อนใช้บริการ
            </span>
            <span class="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full px-3 py-1.5 text-[13px] font-medium">
              <UIcon name="i-lucide-check" class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              รับแจ้งเตือนผ่าน LINE และดูเอกสารในระบบ
            </span>

          </div>

          <!-- CTAs -->
          <div class="flex flex-wrap gap-3 mb-10">
            <template v-if="!session?.user">
              <UButton
                size="xl"
                color="primary"
                class="px-7 font-bold rounded-lg transition-all hover:scale-[1.02] shadow-lg shadow-primary-500/20"
                to="#per-item-pricing"
              >
                ดูราคาบริการ
                <template #trailing>
                  <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
                </template>
              </UButton>
              <UButton
                size="xl"
                variant="outline"
                color="neutral"
                class="px-7 font-bold rounded-lg"
                to="#contact"
              >
                ติดต่อเรา
              </UButton>
            </template>
            <template v-else>
              <UButton
                size="xl"
                color="primary"
                class="px-7 font-bold rounded-lg transition-all hover:scale-[1.02]"
                to="/me"
              >
                ดูออเดอร์ของฉัน
                <template #trailing>
                  <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
                </template>
              </UButton>
            </template>
          </div>

          <!-- Stats row -->
          <div class="flex items-center gap-8 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">฿{{ washFoldPrice }}<span class="text-sm font-medium text-gray-500">/กก.</span></p>
              <p class="text-xs text-gray-500 mt-0.5">ราคาเริ่มต้น</p>
            </div>
            <div class="w-px h-10 bg-gray-200 dark:bg-gray-800" />
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">6<span class="text-sm font-medium text-gray-500"> วัน</span></p>
              <p class="text-xs text-gray-500 mt-0.5">หยุดวันอาทิตย์</p>
            </div>
            <div class="w-px h-10 bg-gray-200 dark:bg-gray-800" />
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">LINE<span class="text-sm font-medium text-gray-500"> แจ้งเตือน</span></p>
              <p class="text-xs text-gray-500 mt-0.5">ติดตามสถานะออเดอร์</p>
            </div>
          </div>
        </div>

        <!-- ===== RIGHT COLUMN — LINE Mockup ===== -->
        <div class="relative hidden lg:block">

          <!-- Floating glow behind card -->
          <div class="absolute inset-0 bg-linear-to-br from-primary-200/30 to-blue-200/20 dark:from-primary-900/20 dark:to-blue-900/10 rounded-lg blur-2xl scale-110 pointer-events-none" />

          <!-- Main chat card -->
          <div class="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl overflow-hidden">

            <!-- Browser bar -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/80">
              <div class="flex gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span class="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div class="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1 text-[11px] font-mono text-gray-400 text-center truncate">
                line.me/R/ti/p/@saijai-laundry
              </div>
            </div>


            <!-- Chat window -->
            <div class="p-4">
              <!-- LINE Header -->
              <div class="flex items-center gap-3 pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
                <div class="w-10 h-10 rounded-full bg-linear-to-br from-[#06C755] to-[#04a045] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow ring-2 ring-white dark:ring-gray-900">
                  ใจ
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm flex items-center gap-1.5 text-gray-900 dark:text-white">
                    ใส่ใจ ผ้าเรียบ
                    <UIcon name="i-ph-check-circle-fill" class="text-[#06C755] w-4 h-4 shrink-0" />
                  </div>
                  <div class="text-[11px] text-gray-500">LINE แจ้งเตือน · พร้อมใช้งาน</div>
                </div>
                <div class="text-[11px] text-gray-400 font-mono">14:23</div>
              </div>

              <!-- Message 1: Receipt -->
              <div class="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-lg rounded-tl-sm p-3.5 mb-3 max-w-[92%] animate-[fade-in_0.4s_ease-out]">
                <div class="font-semibold flex items-center gap-2 mb-2.5 text-gray-900 dark:text-white text-[13px]">
                  <span class="w-2 h-2 rounded-full bg-emerald-500" />
                  รับผ้าเข้าระบบแล้ว
                </div>
                <div class="space-y-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between gap-4">
                    <span>ออเดอร์</span>
                    <span class="font-mono text-gray-900 dark:text-gray-200">#SO-2604-018</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span>น้ำหนัก</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">3.2 กก.</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span>บริการ</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">ซัก อบ รีด</span>
                  </div>
                  <div class="flex justify-between gap-4 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">ยอดประเมิน</span>
                    <span class="font-bold text-primary-600 dark:text-primary-400">320 บาท</span>
                  </div>
                </div>
              </div>

              <!-- Message 2: Ready -->
              <div class="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-lg rounded-tl-sm p-3.5 max-w-[92%] opacity-0 animate-[fade-in_0.4s_ease-out_1s_forwards]">
                <div class="font-semibold flex items-center gap-2 mb-2.5 text-gray-900 dark:text-white text-[13px]">
                  <span class="w-2 h-2 rounded-full bg-emerald-500" />
                  สถานะอัปเดต: งานเสร็จแล้ว
                </div>
                <div class="space-y-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between gap-4">
                    <span>ออเดอร์</span>
                    <span class="font-mono text-gray-900 dark:text-gray-200">#SO-2604-018</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span>การรับคืน</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">รับคืนที่ร้าน หรือใช้แพ็กเกจรับส่ง</span>
                  </div>
                  <div class="flex justify-between gap-4 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                    <span class="font-semibold text-gray-700 dark:text-gray-300">สถานะ</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">รอรับคืน</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </UContainer>
  </section>
</template>


<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes progress {
  from { width: 0%; }
  to { width: 72%; }
}
</style>
