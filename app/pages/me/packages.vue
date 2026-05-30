<script setup lang="ts">
import { formatCurrency } from "~~/shared/utils/format";
import * as adminUi from "~~/shared/config/adminUi";

const adminDashboardCardClass = adminUi.adminDashboardCardClass;

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: packages, pending } = useFetch("/api/public/packages");
const { settings: shopSettings } = useShopSettings();

const mainPackages = computed(() => packages.value?.filter((p: any) => p.packageType === 'MAIN') || []);
const addonPackages = computed(() => packages.value?.filter((p: any) => p.packageType === 'ADDON') || []);

const getPackageLabel = (index: number) => {
  const labels = ['SMALL', 'MEDIUM', 'LARGE'];
  return labels[index] || '';
};
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="แพ็กเกจบริการ">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div :class="adminUi.adminDashboardBodyClass">

          <ClientOnly>
            <!-- Loading State Redesign -->
            <div v-if="pending" class="space-y-12">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <UCard v-for="i in 3" :key="i">
                  <template #header>
                    <USkeleton class="h-6 w-1/2 mb-2" />
                    <USkeleton class="h-4 w-full" />
                  </template>
                  <USkeleton class="h-8 w-1/3 mb-6" />
                  <div class="space-y-4">
                    <div v-for="j in 3" :key="j" class="flex items-center gap-3">
                      <USkeleton class="w-4 h-4 rounded-full" />
                      <USkeleton class="h-4 w-3/4" />
                    </div>
                  </div>
                </UCard>
              </div>
            </div>

            <!-- Content Grid -->
            <div v-else class="space-y-10">
              <!-- Line Contact Box -->
              <div class="p-4 sm:p-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon name="i-lucide-info" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 class="text-lg font-bold text-emerald-800 dark:text-emerald-200">สนใจสั่งซื้อแพ็กเกจ?</h3>
                  </div>
                  <p class="text-emerald-700/80 dark:text-emerald-300/80 text-sm">หากต้องการซื้อแพ็กเกจใดก็ตาม โปรดติดต่อพูดคุยรายละเอียดและสั่งซื้อผ่านทาง LINE ได้เลยครับ</p>
                </div>
                <div class="shrink-0">
                  <UButton
                    size="md"
                    class="font-bold bg-[#06C755] hover:bg-[#04a045] text-white w-full sm:w-auto justify-center"
                    to="https://line.me/R/ti/p/@883vmdct"
                    target="_blank"
                  >
                    <UIcon name="i-simple-icons-line" class="w-5 h-5 mr-1" />
                    เพิ่มเพื่อน LINE
                  </UButton>
                </div>
              </div>

              <!-- Main Packages -->
              <div v-if="mainPackages.length > 0" class="space-y-4">
                <!-- Header Card Frame -->
                <div class="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UIcon name="i-lucide-award" class="w-5 h-5 text-primary" />
                    แพ็กเกจรายเดือนสุดคุ้ม
                  </h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">คุ้มครองครบครัน ดูแลเสื้อผ้าได้ตลอดทั้งเดือน</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  <div
                    v-for="(pkg, index) in mainPackages"
                    :key="pkg.id"
                    class="relative flex flex-col bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl hover:border-primary-500/50 dark:hover:border-primary-400/50 h-full overflow-hidden"
                  >
                    <!-- Header Gradient in System Theme -->
                    <div class="p-6 text-white relative flex flex-col justify-end min-h-[110px] bg-gradient-to-br from-primary-500 to-primary-700">
                      <h3 class="text-2xl font-bold">
                        {{ pkg.name === 'S' ? 'สเปเชียล S' : pkg.name === 'M' ? 'มัลติ M' : 'ลักชูรี่ L' }}
                      </h3>
                      <p class="text-sm opacity-90 font-medium mt-1">
                        {{ pkg.credits }} เครดิต
                      </p>
                    </div>

                    <!-- Body List in System Theme -->
                    <div class="p-6 flex-grow flex flex-col justify-between divide-y divide-gray-100 dark:divide-gray-800">
                      <div class="py-3.5 first:pt-0">
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">ค่าบริการรายเดือน</p>
                        <p class="text-lg font-bold text-gray-900 dark:text-white mt-1">
                          {{ formatCurrency(pkg.price) }} บาท
                        </p>
                      </div>

                      <div class="py-3.5">
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">เครดิตการบริการ</p>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                          {{ pkg.credits }} เครดิต (ชิ้น)
                        </p>
                      </div>

                      <div class="py-3.5">
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">ราคาเฉลี่ยต่อชิ้น</p>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                          {{ (pkg.price / (pkg.credits || 1)).toFixed(1) }} บาท / ชิ้น
                        </p>
                      </div>

                      <div class="py-3.5 last:pb-0">
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">ระยะเวลาการใช้งาน</p>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                          ต่ออายุทุกๆ {{ pkg.validityDays || 30 }} วัน
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Addon Packages -->
              <div v-if="addonPackages.length > 0" class="space-y-4 pt-4">
                <!-- Header Card Frame -->
                <div class="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UIcon name="i-lucide-plus-circle" class="w-5 h-5 text-primary" />
                    แพ็กเกจเสริม
                  </h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ปรับแต่งเพิ่มเติมได้ตามความต้องการของคุณ</p>
                </div>

                <div class="grid grid-cols-1 gap-6 justify-center">
                  <div
                    v-for="pkg in addonPackages"
                    :key="pkg.id"
                    class="max-w-2xl mx-auto w-full bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl hover:border-primary-500/50 dark:hover:border-primary-400/50 overflow-hidden flex flex-col sm:flex-row"
                  >
                    <!-- Left side: Gradient with Icon -->
                    <div class="sm:w-1/3 bg-gradient-to-br from-primary-500 to-primary-700 p-6 text-white flex flex-col justify-center items-center text-center shrink-0">
                      <UIcon 
                        :name="pkg.name.includes('รับส่ง') || pkg.name.includes('ขนส่ง') ? 'i-lucide-truck' : 'i-lucide-sparkles'" 
                        class="w-12 h-12 mb-3 text-white/90" 
                      />
                      <h3 class="text-xl font-bold leading-tight">{{ pkg.name }}</h3>
                      <p class="text-xs opacity-90 mt-1">บริการเสริมพิเศษ</p>
                    </div>

                    <!-- Right side: Content Details -->
                    <div class="flex-grow p-6 flex flex-col justify-between gap-4">
                      <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                          <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">ค่าบริการเพิ่มเติม</p>
                          <p class="text-xl font-bold text-gray-900 dark:text-white mt-1">
                            {{ formatCurrency(pkg.price) }} บาท
                          </p>
                        </div>
                        <div class="sm:text-right">
                          <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">ระยะเวลาใช้งาน</p>
                          <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                            ตามรอบบิลหลัก ({{ pkg.validityDays || 30 }} วัน)
                          </p>
                        </div>
                      </div>

                      <div class="border-t border-gray-100 dark:border-gray-800 pt-4">
                        <p class="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1.5">สิทธิประโยชน์ที่ได้รับ</p>
                        <p class="text-sm font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
                          {{ pkg.description || "บริการอำนวยความสะดวกเพิ่มเติมสำหรับคุณโดยเฉพาะ" }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <template #fallback>
              <div class="space-y-12">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <UCard v-for="i in 3" :key="i">
                    <template #header>
                      <USkeleton class="h-6 w-1/2 mb-2" />
                      <USkeleton class="h-4 w-full" />
                    </template>
                    <USkeleton class="h-8 w-1/3 mb-6" />
                    <div class="space-y-4">
                      <div v-for="j in 3" :key="j" class="flex items-center gap-3">
                        <USkeleton class="w-4 h-4 rounded-full" />
                        <USkeleton class="h-4 w-3/4" />
                      </div>
                    </div>
                  </UCard>
                </div>
              </div>
            </template>
          </ClientOnly>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
