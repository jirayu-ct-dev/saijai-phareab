<script setup lang="ts">
import { formatCurrency } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

const adminDashboardCardClass = adminUi.adminDashboardCardClass;
const notify = useNotify();

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: packages, pending } = useFetch("/api/public/packages");
const { settings: shopSettings } = useShopSettings();

const mainPackages = computed(() => packages.value?.filter((p: any) => p.packageType === 'MAIN') || []);
const addonPackages = computed(() => packages.value?.filter((p: any) => p.packageType === 'ADDON') || []);

const isSuccessModalOpen = ref(false);
const isLinkModalOpen = ref(false);
const isProcessing = ref(false);
const selectedPackage = ref<any>(null);
const pushFailed = ref(false);

const handleBuy = async (pkg: any) => {
  selectedPackage.value = pkg;
  isProcessing.value = true;
  pushFailed.value = false;
  
  try {
    const response = await $fetch<{ success: boolean; hasLineLinked: boolean; pushFailed?: boolean }>("/api/me/packages/interest", {
      method: "POST",
      body: { packageId: pkg.id }
    });

    if (response.success && response.hasLineLinked) {
      pushFailed.value = !!response.pushFailed;
      isSuccessModalOpen.value = true;
    } else {
      isLinkModalOpen.value = true;
    }
  } catch (error: any) {
    notify.error(error.statusMessage || "เกิดข้อผิดพลาดในการซื้อแพ็กเกจ");
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="แพ็กเกจบริการ">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <div class="relative overflow-hidden min-h-screen bg-gradient-to-b from-slate-50/50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/80">
        <!-- Background Glows -->
        <div class="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute bottom-1/3 left-1/4 w-96 h-96 bg-info/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative p-6 max-w-6xl mx-auto space-y-12 w-full pb-32">
          <!-- Header Redesign -->
          <div class="text-center space-y-4 max-w-3xl mx-auto pt-6">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:bg-primary/20">
              <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
              Laundry Package Plans
            </span>
            <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-slate-800 dark:text-white leading-tight">
              คุ้มค่า สะดวกสบาย <br>
              <span class="bg-clip-text text-transparent bg-gradient-to-r from-primary via-indigo-500 to-info">
                กับแพ็กเกจซักอบรีดที่ใส่ใจคุณ
              </span>
            </h1>
            <p class="text-base sm:text-lg text-slate-500 dark:text-slate-400 font-medium">
              เลือกแผนบริการที่ตอบโจทย์รูปแบบการใช้ชีวิตของคุณ เพื่อการดูแลเสื้อผ้าที่สมบูรณ์แบบในราคาที่คุ้มค่ากว่าเดิม
            </p>
          </div>

          <!-- Loading State Redesign -->
          <div v-if="pending" class="space-y-12">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              <UCard v-for="i in 3" :key="i" class="border border-default/30 dark:border-default/20 bg-default/40 backdrop-blur-md">
                <template #header>
                  <USkeleton class="h-6 w-1/2 mb-2" />
                  <USkeleton class="h-4 w-full" />
                </template>
                <USkeleton class="h-10 w-1/3 mb-6" />
                <div class="space-y-4">
                  <div v-for="j in 3" :key="j" class="flex items-center gap-3">
                    <USkeleton class="w-5 h-5 rounded-full" />
                    <USkeleton class="h-4 w-3/4" />
                  </div>
                </div>
              </UCard>
            </div>
          </div>

          <!-- Content Grid -->
          <div v-else class="space-y-20">
            <!-- Main Packages Redesign -->
            <div v-if="mainPackages.length > 0" class="space-y-8">
              <div class="flex flex-col sm:flex-row items-center gap-3 justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                <div class="flex items-center gap-3">
                  <span class="p-2 rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
                    <UIcon name="i-lucide-award" class="w-6 h-6" />
                  </span>
                  <div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white">แพ็กเกจรายเดือนสุดคุ้ม</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400">คุ้มครองครบครัน ดูแลเสื้อผ้าได้ตลอดทั้งเดือน</p>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch pt-2">
                <div
                  v-for="(pkg, index) in mainPackages"
                  :key="pkg.id"
                  :class="[
                    'relative flex flex-col rounded-2xl transition-all duration-300 border backdrop-blur-md group hover:shadow-2xl hover:-translate-y-2',
                    index === 1 
                      ? 'border-primary dark:border-primary/80 shadow-lg shadow-primary/5 bg-slate-50/80 dark:bg-slate-900/95 ring-2 ring-primary ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-950 scale-105 z-10' 
                      : 'border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 shadow-sm'
                  ]"
                >
                  <!-- Premium Badge for Popular Option -->
                  <div v-if="index === 1" class="absolute -top-4 inset-x-0 flex justify-center">
                    <span class="bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-black px-5 py-1.5 rounded-full shadow-md tracking-wider uppercase flex items-center gap-1">
                      <UIcon name="i-lucide-star" class="w-3.5 h-3.5 animate-pulse" />
                      คุ้มที่สุด & ยอดนิยม
                    </span>
                  </div>

                  <div class="p-8 flex-1 flex flex-col">
                    <div class="flex items-start justify-between">
                      <div>
                        <h3 class="text-2xl font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">{{ pkg.name }}</h3>
                        <p class="text-slate-500 dark:text-slate-400 text-sm mt-2 min-h-[2.5rem]">
                          {{ pkg.description || "ดูแลเสื้อผ้าอย่างพิถีพิถัน เหมาะสำหรับใช้งานในชีวิตประจำวัน" }}
                        </p>
                      </div>
                    </div>

                    <div class="my-6 p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/40 flex items-baseline gap-1">
                      <span class="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
                        {{ formatCurrency(pkg.price) }}
                      </span>
                      <span v-if="pkg.validityDays" class="text-sm font-semibold text-slate-500 dark:text-slate-400 ml-1">
                        / {{ pkg.validityDays }} วัน
                      </span>
                    </div>

                    <ul class="space-y-4 mb-8 flex-1">
                      <li v-for="(feature, fIndex) in pkg.features" :key="fIndex" class="flex items-start gap-3">
                        <span class="p-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 mt-0.5 flex-shrink-0">
                          <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
                        </span>
                        <span class="text-sm font-medium text-slate-600 dark:text-slate-300">{{ feature }}</span>
                      </li>
                    </ul>
                  </div>

                  <div class="p-8 pt-0 mt-auto">
                    <UButton
                      block
                      size="lg"
                      :color="index === 1 ? 'primary' : 'neutral'"
                      :variant="index === 1 ? 'solid' : 'outline'"
                      :loading="isProcessing && selectedPackage?.id === pkg.id"
                      @click="handleBuy(pkg)"
                      class="font-extrabold text-sm py-3 rounded-xl transition-all duration-300 shadow-md group-hover:shadow-primary/20"
                    >
                      <UIcon name="i-simple-icons-line" class="w-4 h-4 mr-1.5" />
                      สนใจซื้อแพ็กเกจนี้
                    </UButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Addon Packages Redesign -->
            <div v-if="addonPackages.length > 0" class="space-y-8 pt-8">
              <div class="flex flex-col sm:flex-row items-center gap-3 justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                <div class="flex items-center gap-3">
                  <span class="p-2 rounded-xl bg-info/10 text-info dark:bg-info/20">
                    <UIcon name="i-lucide-plus-circle" class="w-6 h-6" />
                  </span>
                  <div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white">แพ็กเกจเสริมสุดพิเศษ</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400">ปรับแต่งความต้องการเพิ่มเติมได้ตามความต้องการ</p>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                  v-for="pkg in addonPackages" 
                  :key="pkg.id"
                  class="relative flex flex-col p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
                >
                  <div class="flex-grow space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="p-2 rounded-xl bg-info/10 text-info dark:bg-info/20">
                        <UIcon name="i-lucide-sparkles" class="w-5 h-5" />
                      </span>
                    </div>
                    <div>
                      <h3 class="text-lg font-bold text-slate-800 dark:text-white group-hover:text-info transition-colors">{{ pkg.name }}</h3>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[2.5rem]">
                        {{ pkg.description || "สั่งซื้อเพิ่มเพื่อขยายขอบเขตการซักอบรีดในราคาสุดประหยัด" }}
                      </p>
                    </div>
                    <div class="text-2xl font-black text-info">
                      {{ formatCurrency(pkg.price) }}
                    </div>
                  </div>
                  
                  <UButton
                    block
                    color="info"
                    variant="soft"
                    :loading="isProcessing && selectedPackage?.id === pkg.id"
                    @click="handleBuy(pkg)"
                    class="mt-6 font-bold py-2.5 rounded-xl transition-all duration-300"
                  >
                    <UIcon name="i-simple-icons-line" class="w-4 h-4 mr-1.5" />
                    สนใจซื้อเพิ่ม
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UDashboardPanel>

    <!-- Success / LINE Message Sent Modal -->
    <UModal v-model:open="isSuccessModalOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #title>
        <div class="flex items-center gap-2">
          <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <UIcon name="i-lucide-badge-check" class="w-5 h-5" />
          </span>
          <span class="text-base font-bold text-slate-800 dark:text-white">แจ้งความสนใจสำเร็จ!</span>
        </div>
      </template>
      
      <template #body>
        <div class="p-6 text-center space-y-4" v-if="selectedPackage">
          <div class="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto scale-110 shadow-lg shadow-emerald-500/10">
            <UIcon name="i-lucide-check-circle" class="w-10 h-10 animate-bounce" />
          </div>
          
          <div class="space-y-2">
            <h4 class="text-xl font-black text-slate-800 dark:text-white">{{ selectedPackage.name }}</h4>
            <p class="text-2xl font-black text-primary">{{ formatCurrency(selectedPackage.price) }}</p>
          </div>
          
          <p v-if="pushFailed" class="text-sm font-medium text-amber-600 dark:text-amber-400 leading-relaxed px-3 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30 text-left">
            ⚠️ ระบบบันทึกความสนใจแพ็กเกจของคุณแล้ว แต่ไม่สามารถแจ้งเตือนทางแชท LINE อัตโนมัติได้ในขณะนี้ กรุณากดปุ่ม <strong>"เปิดดูแชท LINE"</strong> ด้านล่างเพื่อส่งข้อความหรือสอบถามแอดมินโดยตรงได้เลยครับ
          </p>
          <p v-else class="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-2">
            ระบบได้แจ้งรายละเอียดแพ็กเกจที่คุณสนใจไปยังห้องแชท <strong class="text-slate-800 dark:text-white font-bold">LINE ส่วนตัว</strong> ของคุณเรียบร้อยแล้ว แอดมินกำลังเริ่มดำเนินการสมัครและตรวจสอบความถูกต้องให้คุณทันทีครับ!
          </p>

          <div class="p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-500 text-left space-y-1.5">
            <div class="flex justify-between">
              <span>ประเภท:</span>
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ selectedPackage.packageType === 'MAIN' ? 'แพ็กเกจหลัก' : 'แพ็กเกจเสริม' }}</span>
            </div>
            <div class="flex justify-between" v-if="selectedPackage.validityDays">
              <span>อายุการใช้งาน:</span>
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ selectedPackage.validityDays }} วัน</span>
            </div>
          </div>
        </div>
      </template>
        
      <template #footer>
        <div class="flex flex-col sm:flex-row gap-3 w-full">
          <UButton color="neutral" variant="outline" class="flex-1 font-bold py-2.5 rounded-xl" @click="isSuccessModalOpen = false">ปิดหน้าต่าง</UButton>
          <UButton color="primary" class="flex-1 font-bold py-2.5 rounded-xl" to="https://line.me/R/ti/p/@883vmdct" target="_blank">
            <UIcon name="i-simple-icons-line" class="w-4 h-4 mr-1.5" />
            เปิดดูแชท LINE
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Connect / Link LINE Required Modal -->
    <UModal v-model:open="isLinkModalOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #title>
        <div class="flex items-center gap-2">
          <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5" />
          </span>
          <span class="text-base font-bold text-slate-800 dark:text-white">จำเป็นต้องเชื่อมต่อ LINE</span>
        </div>
      </template>
      
      <template #body>
        <div class="p-6 text-center space-y-4">
          <div class="w-20 h-20 bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto scale-110 shadow-lg shadow-amber-500/10">
            <UIcon name="i-simple-icons-line" class="w-10 h-10 text-[#06C755]" />
          </div>
          
          <div class="space-y-1">
            <h4 class="text-lg font-bold text-slate-800 dark:text-white">ยังไม่พบการเชื่อมโยงบัญชี LINE</h4>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              เพื่อความปลอดภัยและการอัปเดตสิทธิ์การใช้งานผ่านแชท LINE ที่ถูกต้องและรวดเร็ว กรุณาเชื่อมต่อบัญชี LINE ของคุณก่อนทำรายการซื้อแพ็กเกจครับ
            </p>
          </div>
        </div>
      </template>
        
      <template #footer>
        <div class="flex flex-col sm:flex-row gap-3 w-full">
          <UButton color="neutral" variant="outline" class="flex-1 font-bold py-2.5 rounded-xl" @click="isLinkModalOpen = false">ยกเลิก</UButton>
          <UButton color="primary" class="flex-1 font-bold py-2.5 rounded-xl" to="/me/settings/profile?highlight=line#line-link-section" @click="isLinkModalOpen = false">
            <UIcon name="i-lucide-link" class="w-4 h-4 mr-1.5" />
            เชื่อมบัญชี LINE ที่นี่
          </UButton>
        </div>
      </template>
    </UModal>
  </UDashboardPage>
</template>
