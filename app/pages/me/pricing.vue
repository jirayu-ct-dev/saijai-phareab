<script setup lang="ts">
import * as adminUi from "~~/shared/config/adminUi";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: shopSettings } = useFetch('/api/public/shop-settings')
const washFoldPrice = computed(() => shopSettings.value?.washFoldPricePerKg ?? 60)
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="อัตราค่าบริการ">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div :class="[adminUi.adminDashboardBodyClass, 'max-w-5xl mx-auto w-full']">
          <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">อัตราค่าบริการของร้าน</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ตรวจสอบราคาซักอบรีดและซักแห้งตามประเภทผ้า สำหรับสมาชิกร้าน
              </p>
            </div>
            <UButton
              color="primary"
              variant="soft"
              to="/me/service-orders"
              icon="i-lucide-shopping-basket"
            >
              ออเดอร์ของฉัน
            </UButton>
          </div>

          <!-- Kilo Service -->
          <UCard class="mb-6" :ui="{ header: 'sm:p-4', body: 'sm:p-4 sm:py-6' }">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="flex items-start gap-4">
                <div class="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
                  <UIcon name="i-lucide-scale" class="w-6 h-6" />
                </div>
                <div>
                  <h3 class="text-base font-medium text-gray-900 dark:text-white">บริการซักอบพับ (ชั่งกิโล)</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    เหมาะสำหรับเสื้อผ้าที่ใส่ในชีวิตประจำวันทั่วไป รวมซัก อบแห้ง และพับให้เรียบร้อย
                  </p>
                </div>
              </div>
              <div class="text-right flex items-baseline gap-1 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
                <span class="text-2xl font-bold text-gray-900 dark:text-white">฿{{ washFoldPrice }}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">/ กิโลกรัม</span>
              </div>
            </div>
          </UCard>

          <!-- Pricing Table -->
          <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mb-6 overflow-hidden">
            <template #header>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 class="text-base font-medium text-gray-900 dark:text-white">ราคาบริการแบบซักแยกชิ้น</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ราคาแยกตามประเภทการบริการและชนิดของผ้า</p>
                </div>
                <UBadge color="neutral" variant="soft">หน่วย: บาท/ชิ้น</UBadge>
              </div>
            </template>
            
            <div class="p-0">
              <AppPricingTable class="!rounded-none !border-0 !shadow-none !p-0" />
            </div>
          </UCard>

          <!-- Conditions / Warnings -->
          <UAlert
            icon="i-lucide-info"
            color="warning"
            variant="soft"
            title="สิ่งที่ควรทราบก่อนใช้บริการ"
            class="mb-6 border border-amber-200 dark:border-amber-800/50 shadow-sm"
          >
            <template #description>
              <ul class="list-disc pl-5 mt-2 space-y-1.5 text-sm text-amber-700 dark:text-amber-400">
                <li>ราคาอาจมีการเปลี่ยนแปลงขึ้นอยู่กับสภาพความยากง่ายของผ้าแต่ละชิ้น (จะแจ้งให้ทราบก่อนดำเนินการ)</li>
                <li>คราบฝังแน่นบางชนิดอาจไม่สามารถขจัดออกได้ทั้งหมด</li>
                <li>หากผ้ามีโอกาสสีตก กรุณาแจ้งพนักงานให้ทราบล่วงหน้า</li>
                <li>กรุณาตรวจสอบสิ่งของในกระเป๋าก่อนส่งซัก ทางร้านไม่รับผิดชอบกรณีทรัพย์สินตกค้างหรือสูญหาย</li>
                <li>กรณีเกิดความเสียหายจากทางร้าน ทางร้านยินดีชดใช้ตามเงื่อนไข (สูงสุดไม่เกิน 10 เท่าของค่าบริการชิ้นนั้น)</li>
              </ul>
            </template>
          </UAlert>

        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
