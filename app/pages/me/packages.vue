<script setup lang="ts">
import { formatCurrency } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: packages, pending } = useFetch("/api/public/packages");
const { settings: shopSettings } = useShopSettings();

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

      <div class="p-6 max-w-5xl mx-auto space-y-8 w-full">
        <div class="text-center space-y-2">
          <h1 class="text-2xl font-bold">แพ็กเกจซักอบรีดสุดคุ้ม</h1>
          <p class="text-gray-500">เลือกแพ็กเกจที่เหมาะกับคุณ เพื่อความประหยัดและสะดวกสบายยิ่งขึ้น</p>
        </div>

        <div v-if="pending" class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <USkeleton class="h-64 w-full" v-for="i in 3" :key="i" />
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UCard 
            v-for="pkg in packages" 
            :key="pkg.id"
            class="flex flex-col h-full border-t-4 hover:shadow-lg transition-shadow"
            :class="pkg.packageType === 'MAIN' ? 'border-t-primary' : 'border-t-blue-500'"
          >
            <div class="text-center space-y-4 flex-grow">
              <UBadge :color="pkg.packageType === 'MAIN' ? 'primary' : 'info'" variant="subtle" class="mb-2">
                {{ pkg.packageType === 'MAIN' ? 'แพ็กเกจหลัก' : 'แพ็กเกจเสริม' }}
              </UBadge>
              <h3 class="text-xl font-bold">{{ pkg.name }}</h3>
              <p class="text-3xl font-black text-gray-900 dark:text-white">{{ formatCurrency(pkg.price) }}</p>
              
              <p v-if="pkg.description" class="text-sm text-gray-500">{{ pkg.description }}</p>

              <div class="text-left mt-6 space-y-3">
                <div v-for="(feature, idx) in pkg.features" :key="idx" class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" class="text-green-500 w-5 h-5 flex-shrink-0" />
                  <span class="text-sm">{{ feature }}</span>
                </div>
              </div>
            </div>

            <template #footer>
              <UButton 
                block 
                size="lg" 
                :color="pkg.packageType === 'MAIN' ? 'primary' : 'info'"
                @click="handleBuy(pkg)"
              >
                สนใจซื้อแพ็กเกจนี้
              </UButton>
            </template>
          </UCard>
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
                <p class="text-lg font-medium mb-2">คุณเลือก: {{ selectedPackage?.name }}</p>
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
