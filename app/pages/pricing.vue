<script setup lang="ts">
const { data: shopSettings } = await useFetch<{ washFoldPricePerKg?: number | null }>("/api/public/shop-settings", {
  key: "public-pricing-shop-settings",
  default: () => ({ washFoldPricePerKg: 60 }),
});
const washFoldPrice = computed(() => shopSettings.value?.washFoldPricePerKg ?? 60);

const serviceConditions = [
  "ราคานี้เป็นราคาหน้าร้านสำหรับลูกค้าทั่วไป และใช้กับรายการที่อยู่นอกสิทธิ์แพ็กเกจ",
  "ลูกค้าที่สมัครแพ็กเกจจะใช้สิทธิ์ตามรายการและจำนวนเครดิตที่แพ็กเกจกำหนด",
  "ผ้าหรือบริการที่ไม่อยู่ในรายการแพ็กเกจ จะคิดราคาตามอัตราหน้าร้านนี้",
  "ราคาอาจมีการเปลี่ยนแปลงขึ้นอยู่กับสภาพความยากง่ายของผ้าแต่ละชิ้น โดยร้านจะแจ้งให้ทราบก่อนดำเนินการ",
  "คราบฝังแน่นบางชนิดอาจไม่สามารถขจัดออกได้ทั้งหมด",
  "หากผ้ามีโอกาสสีตก กรุณาแจ้งพนักงานให้ทราบล่วงหน้า",
  "กรุณาตรวจสอบสิ่งของในกระเป๋าก่อนส่งซัก ทางร้านไม่รับผิดชอบกรณีทรัพย์สินตกค้างหรือสูญหาย",
  "กรณีเกิดความเสียหายจากทางร้าน ทางร้านยินดีชดใช้ตามเงื่อนไข สูงสุดไม่เกิน 10 เท่าของค่าบริการชิ้นนั้น",
];

useSeoMeta({
  title: "ราคาหน้าร้าน - ใส่ใจผ้าเรียบ",
  description: "ดูราคาซักพับแบบชั่งกิโลและราคาซักแยกชิ้นตามบริการของร้าน",
});
</script>

<template>
  <div class="py-12 md:py-16">
    <UContainer>
      <section class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 md:p-6">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-primary-600 dark:text-primary-400">ราคาหน้าร้าน</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
              ดูราคาก่อนส่งผ้า
            </h1>
            <p class="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400 md:text-base">
              ราคานี้ใช้กับลูกค้าทั่วไป และรายการที่ไม่ได้อยู่ในสิทธิ์แพ็กเกจ
            </p>
          </div>
          <UButton
            label="ดูแพ็กเกจ"
            icon="i-lucide-package"
            color="primary"
            variant="soft"
            to="/packages"
            class="shrink-0 justify-center rounded-lg"
          />
        </div>
      </section>

      <section class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 md:p-6">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <div class="hidden size-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-primary-600 dark:border-gray-800 dark:bg-gray-800 dark:text-primary-400 sm:flex">
              <UIcon name="i-lucide-scale" class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="text-base font-semibold text-gray-900 dark:text-white">บริการซักพับแบบชั่งกิโล</p>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">ราคาหน้าร้านสำหรับงานซักพับทั่วไป</p>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end text-right sm:flex-row sm:items-baseline sm:gap-1">
            <span class="text-xl font-semibold leading-none tabular-nums text-gray-900 dark:text-white sm:text-2xl">฿{{ washFoldPrice }}</span>
            <span class="mt-1 text-[11px] leading-none text-gray-500 dark:text-gray-400 sm:mt-0 sm:text-sm">/ กิโลกรัม</span>
          </div>
        </div>
      </section>

      <section class="mb-4">
        <div class="mb-1 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-base font-semibold text-gray-900 dark:text-white">ราคาซักแยกชิ้น</p>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">ราคาแยกตามบริการและชนิดผ้า สำหรับรายการที่คิดราคาหน้าร้าน</p>
            </div>
            <div class="flex shrink-0 items-baseline gap-1 text-right">
              <span class="text-lg font-semibold leading-none text-gray-900 dark:text-white">บาท</span>
              <span class="text-sm text-gray-500 dark:text-gray-400">/ ชิ้น</span>
            </div>
          </div>
        </div>
        <AppPricingTable embedded client-skeleton />
      </section>

      <section class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-800">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/25 bg-warning/10 text-warning">
            <UIcon name="i-lucide-info" class="size-4" />
          </div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">สิ่งที่ควรทราบก่อนใช้บริการ</p>
        </div>
        <ul>
          <li
            v-for="condition in serviceConditions"
            :key="condition"
            class="flex items-start gap-3 border-b border-gray-200 p-4 text-sm text-gray-500 last:border-b-0 dark:border-gray-800 dark:text-gray-400"
          >
            <span class="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
            <span class="min-w-0">{{ condition }}</span>
          </li>
        </ul>
      </section>
    </UContainer>
  </div>
</template>
