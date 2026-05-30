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
              <div v-if="mainPackages.length > 0" class="space-y-6">
                <div>
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UIcon name="i-lucide-award" class="w-5 h-5 text-primary" />
                    แพ็กเกจรายเดือนสุดคุ้ม
                  </h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">คุ้มครองครบครัน ดูแลเสื้อผ้าได้ตลอดทั้งเดือน</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  <div
                    v-for="(pkg, index) in mainPackages"
                    :key="pkg.id"
                    class="relative flex flex-col bg-white dark:bg-[#0f172a] rounded-md transition-all duration-500 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 h-full group"
                  >
                    <div class="p-8 flex flex-col h-full justify-between">
                      <div class="flex-grow flex flex-col">
                        <div class="mb-6">
                          <span class="text-[14px] font-medium tracking-[0.2em] text-blue-600/80 dark:text-blue-400/60 uppercase">
                            {{ getPackageLabel(index) }}
                          </span>
                          <h3 class="text-[28px] font-bold text-gray-900 dark:text-white mt-1 group-hover:text-primary transition-colors">
                            {{ pkg.name }}
                          </h3>
                        </div>

                        <div class="mb-8 flex items-baseline gap-1">
                          <span class="text-[44px] font-bold text-gray-900 dark:text-white">฿{{ formatCurrency(pkg.price) }}</span>
                          <span class="text-gray-500 dark:text-gray-400 text-[16px] ml-1">บาท</span>
                        </div>

                        <p class="text-gray-500 dark:text-gray-400 text-[14px] mb-8 mt-[-20px]">
                          ต่อ {{ pkg.validityDays || 30 }} วัน
                        </p>

                        <div class="space-y-5 mb-10 flex-grow">
                          <div v-for="(feature, fIndex) in pkg.features" :key="fIndex" class="flex items-start gap-3">
                            <UIcon name="i-lucide-check" class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            <span class="text-[15px] text-gray-600 dark:text-gray-300 leading-snug">{{ feature }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Addon Packages -->
              <div v-if="addonPackages.length > 0" class="space-y-6 pt-4">
                <div>
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UIcon name="i-lucide-plus-circle" class="w-5 h-5 text-info" />
                    แพ็กเกจเสริม
                  </h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">ปรับแต่งเพิ่มเติมได้ตามความต้องการของคุณ</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <UCard
                    v-for="pkg in addonPackages"
                    :key="pkg.id"
                    class="flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group"
                    :ui="{
                      root: 'ring-1 ring-gray-200 dark:ring-gray-800 hover:ring-info-500/50 dark:hover:ring-info-400/50 transition-colors shadow-sm'
                    }"
                  >
                    <div class="flex-1 space-y-3">
                      <div class="flex justify-between items-start">
                        <div>
                          <h3 class="text-base font-bold text-gray-900 dark:text-white group-hover:text-info transition-colors">{{ pkg.name }}</h3>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 min-h-[2rem]">
                            {{ pkg.description || "สั่งซื้อเพิ่มเพื่อใช้งานเพิ่มเติม" }}
                          </p>
                        </div>
                      </div>
                      <div class="text-xl font-bold text-info-600 dark:text-info-400">
                        {{ formatCurrency(pkg.price) }}
                      </div>
                    </div>
                  </UCard>
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
