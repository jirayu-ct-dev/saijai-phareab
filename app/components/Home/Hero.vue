<script setup lang="ts">
const { session } = useUser();

const isOpen = ref(false);
let timer: ReturnType<typeof setInterval>;

const checkStoreStatus = () => {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // วันอาทิตย์ (0) ปิดร้าน
  if (day === 0) {
    isOpen.value = false;
    return;
  }
  
  // แปลงเวลาปัจจุบันเป็นนาทีเพื่อเปรียบเทียบง่ายขึ้น
  const currentMinutes = hours * 60 + minutes;
  const openTime = 14 * 60; // 14:00
  const closeTime = 19 * 60 + 30; // 19:30
  
  isOpen.value = currentMinutes >= openTime && currentMinutes <= closeTime;
};

onMounted(() => {
  checkStoreStatus();
  timer = setInterval(checkStoreStatus, 60000); // อัปเดตทุกนาที
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <section class="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
    <!-- Grid Background -->
    <div class="absolute inset-0 pointer-events-none" style="background-image: linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px); background-size: 56px 56px; mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);"></div>
    <div class="absolute inset-0 pointer-events-none hidden dark:block" style="background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 56px 56px; mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);"></div>

    <UContainer class="relative z-10">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <!-- Left Content -->
        <div>
          <div class="flex flex-wrap gap-2 mb-6">
            <UBadge :color="isOpen ? 'success' : 'error'" variant="subtle" class="rounded-full flex items-center gap-1.5 px-3 py-1 text-xs">
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="isOpen ? 'bg-emerald-500' : 'bg-red-500'"></span>
              {{ isOpen ? 'เปิดอยู่' : 'ปิดอยู่' }} · 14:00 – 19:30
            </UBadge>
          </div>
          
          <h1 class="text-4xl md:text-5xl lg:text-[56px] font-bold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-6">
            ซัก-อบ-รีด ด้วยความ<br />
            <span class="text-primary-600 dark:text-primary-400">ใส่ใจ</span>ทุกผืนผ้า
          </h1>
          
          <p class="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-lg leading-relaxed mb-8">
            ร้านซักรีดแบบครบวงจร สะอาด หอม เรียบ พร้อมบริการรับ-ส่งถึงบ้าน ราคาเริ่มต้นกิโลกรัมละ 60 บาท
          </p>
          
          <div class="flex flex-wrap gap-3 mb-12">
            <UButton
              v-if="!session?.user"
              size="xl"
              color="primary"
              class="px-8 font-bold rounded-xl transition-all hover:scale-105"
              to="#packages"
            >
              ดูราคาบริการ
              <template #trailing>
                <UIcon name="i-lucide-arrow-right" class="w-5 h-5" />
              </template>
            </UButton>
            <UButton
              v-else
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
              class="px-8 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800"
              to="#contact"
            >
              ติดต่อเรา
            </UButton>
          </div>
          
          <div class="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">฿60<span class="text-sm font-medium text-gray-500">/กก.</span></div>
              <div class="text-xs text-gray-500 mt-1">ราคาเริ่มต้น</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">24<span class="text-sm font-medium text-gray-500"> ชม.</span></div>
              <div class="text-xs text-gray-500 mt-1">ส่งคืนใน 1 วัน</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">6<span class="text-sm font-medium text-gray-500"> วัน</span></div>
              <div class="text-xs text-gray-500 mt-1">หยุดวันอาทิตย์</div>
            </div>
          </div>
        </div>

        <!-- Right Content - Line Mockup -->
        <div class="relative">
          <UCard class="bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm border-gray-200 dark:border-gray-800 rounded-3xl shadow-xl overflow-hidden">
            <div class="flex items-center gap-2 pb-4 mb-4 border-b border-gray-200 dark:border-gray-800">
              <div class="flex gap-1.5">
                <span class="w-3 h-3 rounded-full bg-red-400"></span>
                <span class="w-3 h-3 rounded-full bg-amber-400"></span>
                <span class="w-3 h-3 rounded-full bg-green-400"></span>
              </div>
              <div class="flex-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md px-3 py-1.5 text-[11px] font-mono text-gray-500 text-center truncate">
                line.me/R/ti/p/@saijai-laundry
              </div>
            </div>

            <div class="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 min-h-[320px] flex flex-col gap-3 relative shadow-inner">
              <div class="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#06C755] to-[#04a045] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white dark:ring-gray-950">
                  ใจ
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm flex items-center gap-1.5 text-gray-900 dark:text-white">
                    ใส่ใจ ผ้าเรียบ
                    <UIcon name="i-ph-check-circle-fill" class="text-[#06C755] w-4 h-4" />
                  </div>
                  <div class="text-[11px] text-gray-500">LINE Official · ออนไลน์</div>
                </div>
                <div class="text-[11px] text-gray-400 font-mono">14:23</div>
              </div>

              <!-- Message 1 -->
              <div class="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm p-3.5 text-sm max-w-[90%] animate-[fade-in_0.5s_ease-out]">
                <div class="font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                  <span class="w-2 h-2 rounded-full bg-[#3BB7DB]"></span>
                  รับผ้าเรียบร้อย ✓
                </div>
                <div class="space-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between"><span>ใบเสร็จ</span><span class="font-mono text-gray-900 dark:text-gray-200">#SJ-2604-018</span></div>
                  <div class="flex justify-between"><span>น้ำหนัก</span><span class="font-medium text-gray-900 dark:text-gray-200">3.2 กก.</span></div>
                  <div class="flex justify-between"><span>บริการ</span><span class="font-medium text-gray-900 dark:text-gray-200">ซัก-อบ-รีด</span></div>
                  <div class="flex justify-between"><span>ยอดชำระ</span><span class="font-medium text-gray-900 dark:text-gray-200">฿320</span></div>
                </div>
              </div>

              <!-- Message 2 -->
              <div class="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm p-3.5 text-sm max-w-[90%] opacity-0 animate-[fade-in_0.5s_ease-out_1s_forwards]">
                <div class="font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-white">
                  <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  กำลังซัก…
                </div>
                <div class="space-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between"><span>เครื่อง</span><span class="font-medium text-gray-900 dark:text-gray-200">W-03</span></div>
                  <div class="flex justify-between"><span>เหลืออีก</span><span class="font-medium text-gray-900 dark:text-gray-200">~ 28 นาที</span></div>
                </div>
                <div class="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mt-3 overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-primary-500 to-[#3BB7DB] w-0 animate-[progress_3s_ease-out_1.5s_forwards] rounded-full"></div>
                </div>
              </div>

            </div>
          </UCard>
          
          <!-- Decorative Floating Elements -->
          <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 blur-2xl pointer-events-none animate-pulse"></div>
          <div class="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[#3BB7DB]/20 blur-2xl pointer-events-none animate-pulse" style="animation-delay: 1s"></div>
        </div>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes progress {
  from { width: 0%; }
  to { width: 75%; }
}
</style>
