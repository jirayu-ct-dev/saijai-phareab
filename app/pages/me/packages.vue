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
</script>

<template>
  <UDashboardPage>
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
          <ClientOnly>
            <div v-else class="space-y-20">
              <!-- Main Packages Redesign -->
              <div v-if="mainPackages.length > 0" class="space-y-8">
                <div class="flex flex-col sm:flex-row items-center gap-3 justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                  <div class="flex items-center gap-3">
                    <span class="p-2 rounded-md bg-primary/10 text-primary dark:bg-primary/20">
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
                      'relative flex flex-col rounded-md transition-all duration-300 border backdrop-blur-md group hover:shadow-2xl hover:-translate-y-2',
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

                      <div class="my-6 p-4 rounded-md bg-slate-100/50 dark:bg-slate-800/40 flex items-baseline gap-1">
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
                      <div class="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm">
                        <p class="text-emerald-800 dark:text-emerald-200 font-medium mb-3">หากต้องการซื้อแพ็กเกจนี้ โปรดติดต่อผ่าน LINE</p>
                        <UButton
                          block
                          size="md"
                          class="font-bold bg-[#06C755] hover:bg-[#04a045] text-white"
                          to="https://line.me/R/ti/p/@883vmdct"
                          target="_blank"
                        >
                          <UIcon name="i-simple-icons-line" class="w-4 h-4 mr-1.5" />
                          เพิ่มเพื่อน LINE: @883vmdct
                        </UButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Addon Packages Redesign -->
              <div v-if="addonPackages.length > 0" class="space-y-8 pt-8">
                <div class="flex flex-col sm:flex-row items-center gap-3 justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                  <div class="flex items-center gap-3">
                    <span class="p-2 rounded-md bg-info/10 text-info dark:bg-info/20">
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
                    class="relative flex flex-col p-6 rounded-md border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
                  >
                    <div class="flex-grow space-y-4">
                      <div class="flex items-center justify-between">
                        <span class="p-2 rounded-md bg-info/10 text-info dark:bg-info/20">
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
                    
                    <div class="mt-6 p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm">
                      <p class="text-emerald-800 dark:text-emerald-200 font-medium mb-3">หากต้องการซื้อแพ็กเกจนี้ โปรดติดต่อผ่าน LINE</p>
                      <UButton
                        block
                        size="md"
                        class="font-bold bg-[#06C755] hover:bg-[#04a045] text-white"
                        to="https://line.me/R/ti/p/@883vmdct"
                        target="_blank"
                      >
                        <UIcon name="i-simple-icons-line" class="w-4 h-4 mr-1.5" />
                        เพิ่มเพื่อน LINE: @883vmdct
                      </UButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <template #fallback>
              <div class="space-y-12">
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
            </template>
          </ClientOnly>
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardPage>
</template>
