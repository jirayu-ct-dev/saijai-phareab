<script setup lang="ts">
import { formatCurrency } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: packages, pending } = useFetch("/api/public/packages");
const { settings: shopSettings } = useShopSettings();

const mainPackages = computed(() => packages.value?.filter((p: any) => p.packageType === 'MAIN') || []);
const addonPackages = computed(() => packages.value?.filter((p: any) => p.packageType === 'ADDON') || []);

const isOpen = ref(false);
const selectedPackage = ref<any>(null);

const handleBuy = (pkg: any) => {
  selectedPackage.value = pkg;
  isOpen.value = true;
};
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="เลือกซื้อแพ็กเกจ" />

      <div class="p-6 max-w-6xl mx-auto space-y-12 w-full pb-20">
        <!-- Header -->
        <div class="text-center space-y-3">
          <h1 class="text-3xl font-bold tracking-tight text-[#1a2b4c] dark:text-white">แพ็กเกจซักอบรีดสุดคุ้ม</h1>
          <p class="text-lg text-gray-500 max-w-2xl mx-auto">เลือกแพ็กเกจที่เหมาะกับคุณ เพื่อความประหยัดและสะดวกสบายยิ่งขึ้น</p>
        </div>

        <div v-if="pending" class="space-y-12">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <UCard v-for="i in 3" :key="i" class="animate-pulse">
              <template #header>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </template>
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />
              <div class="space-y-4">
                <div v-for="j in 3" :key="j" class="flex items-center gap-3">
                  <div class="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <div v-else class="space-y-16">
          <!-- Main Packages Section -->
          <div v-if="mainPackages.length > 0" class="space-y-6">
            <div class="flex items-center gap-3 justify-center md:justify-start">
              <UIcon name="i-lucide-package" class="w-6 h-6 text-primary-500" />
              <h2 class="text-2xl font-bold text-[#1a2b4c] dark:text-white">แพ็กเกจหลัก</h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch pt-4">
              <div
                v-for="(pkg, index) in mainPackages"
                :key="pkg.id"
                class="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border group"
                :class="index === 1 ? 'border-primary-500 shadow-md transform md:-translate-y-4' : 'border-gray-100 dark:border-gray-700 mt-0 md:mt-4'"
              >
                <div v-if="index === 1" class="absolute -top-4 inset-x-0 flex justify-center">
                  <span class="bg-primary-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm tracking-wider uppercase">
                    Best Value
                  </span>
                </div>

                <div class="p-8 flex-1">
                  <h3 class="text-2xl font-bold text-[#1a2b4c] dark:text-white mb-2">{{ pkg.name }}</h3>
                  <p class="text-gray-500 dark:text-gray-400 text-sm h-10">
                    {{ pkg.description || "แพ็กเกจสุดคุ้มสำหรับครอบครัว" }}
                  </p>

                  <div class="my-6">
                    <span class="text-4xl font-extrabold text-primary-600 dark:text-primary-400">
                      {{ formatCurrency(pkg.price) }}
                    </span>
                    <span v-if="pkg.validityDays" class="text-gray-500 dark:text-gray-400 ml-2">
                      / {{ pkg.validityDays }} วัน
                    </span>
                  </div>

                  <UDivider class="my-6" />

                  <ul class="space-y-4 mb-8">
                    <li v-for="(feature, fIndex) in pkg.features" :key="fIndex" class="flex items-start gap-3">
                      <UIcon name="i-lucide-check-circle-2" class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ feature }}</span>
                    </li>
                  </ul>
                </div>

                <div class="p-8 pt-0 mt-auto">
                  <UButton
                    block
                    size="lg"
                    :color="index === 1 ? 'primary' : 'neutral'"
                    :variant="index === 1 ? 'solid' : 'outline'"
                    @click="handleBuy(pkg)"
                    class="font-bold text-base transition-transform group-hover:scale-105"
                  >
                    สนใจซื้อแพ็กเกจนี้
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Addon Packages Section -->
          <div v-if="addonPackages.length > 0" class="space-y-6 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div class="flex items-center gap-3 justify-center md:justify-start">
              <UIcon name="i-lucide-plus-circle" class="w-6 h-6 text-blue-500" />
              <h2 class="text-2xl font-bold text-[#1a2b4c] dark:text-white">แพ็กเกจเสริม</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <UCard 
                v-for="pkg in addonPackages" 
                :key="pkg.id"
                class="hover:shadow-lg transition-all group"
                :ui="{ body: { padding: 'p-6' } }"
              >
                <div class="text-center space-y-3 flex flex-col h-full">
                  <div class="flex-grow space-y-3">
                    <UIcon name="i-lucide-sparkles" class="w-8 h-8 text-blue-500 mx-auto" />
                    <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white">{{ pkg.name }}</h3>
                    <div class="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {{ formatCurrency(pkg.price) }}
                    </div>
                    <p class="text-xs text-gray-500 min-h-[2rem]">{{ pkg.description }}</p>
                  </div>
                  
                  <UButton
                    block
                    color="blue"
                    variant="soft"
                    @click="handleBuy(pkg)"
                    class="mt-4 transition-transform group-hover:scale-105"
                  >
                    สนใจซื้อเพิ่ม
                  </UButton>
                </div>
              </UCard>
            </div>
          </div>
        </div>

        <!-- Contact Admin Modal -->
        <UModal v-model="isOpen">
          <UCard>
            <template #header>
              <h3 class="text-lg font-bold">ติดต่อแอดมินเพื่อสั่งซื้อ</h3>
            </template>
            
            <div class="text-center space-y-6 py-4">
              <UIcon name="i-lucide-message-circle" class="w-16 h-16 text-green-500 mx-auto" />
              <div>
                <p class="text-lg font-medium mb-2">คุณเลือก: <span class="text-primary-600">{{ selectedPackage?.name }}</span></p>
                <p class="text-gray-500">
                  กรุณาติดต่อแอดมินผ่าน LINE OA เพื่อชำระเงินและเปิดใช้งานแพ็กเกจ
                  <br>แอดมินจะดำเนินการเพิ่มแพ็กเกจเข้าสู่บัญชีของคุณทันทีหลังตรวจสอบการชำระเงิน
                </p>
              </div>

              <UButton 
                color="success" 
                size="xl" 
                block
                target="_blank"
                href="https://line.me/R/ti/p/@saijai"
              >
                <UIcon name="i-ph-chat-circle-dots-fill" class="w-5 h-5 mr-2" />
                แชทกับแอดมิน
              </UButton>
            </div>

            <template #footer>
              <div class="flex justify-end">
                <UButton color="neutral" variant="ghost" @click="isOpen = false">ปิด</UButton>
              </div>
            </template>
          </UCard>
        </UModal>
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
