<script setup lang="ts">
const { data: shopSettings } = await useFetch('/api/public/shop-settings')
const washFoldPrice = computed(() => shopSettings.value?.washFoldPricePerKg ?? 60)
</script>

<template>
  <section id="per-item-pricing" class="py-16 md:py-24">
    <UContainer>
      <div class="mb-12 max-w-2xl mx-auto text-center">
        <span class="inline-block text-primary-600 dark:text-primary-400 font-semibold text-[13px] tracking-wide mb-2">ราคาหน้าร้าน</span>
        <h2 class="text-[26px] md:text-[38px] font-bold text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-3">
          โปร่งใส ทุกราคา
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
          มีให้เลือกทั้งบริการชั่งกิโล และคิดเป็นชิ้นตามประเภทผ้า เลือกแบบที่คุ้มที่สุดสำหรับคุณ
        </p>
      </div>

      <!-- Kilo Service Headline -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <div class="text-xs tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">บริการชั่งกิโล</div>
          <div class="flex items-baseline gap-2 text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white leading-none">
            ฿{{ washFoldPrice }} <span class="text-[15px] font-medium text-gray-500 dark:text-gray-400">/ กิโลกรัม</span>
          </div>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
            เหมาะสำหรับเสื้อผ้าใส่ทุกวัน รวมซักและอบแห้ง พร้อมพับเรียบร้อย
          </p>
        </div>
        <UButton
          size="xl"
          color="primary"
          class="font-bold rounded-md px-8 flex-shrink-0"
          to="#contact"
        >
          สอบถามเพิ่มเติม
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="w-5 h-5" />
          </template>
        </UButton>
      </div>

      <!-- Pricing Table Container -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden mb-6 shadow-sm">
        <div class="p-5 md:p-6 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h3 class="m-0 text-base font-semibold text-gray-900 dark:text-white">ราคาคิดเป็นชิ้น — ตามประเภทผ้า</h3>
            <p class="m-0 text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">ราคาแยกตามบริการ ผ้าบางชนิดคิดเฉพาะบริการที่เหมาะสม</p>
          </div>
          <UBadge color="neutral" variant="outline" class="rounded-full px-3 py-1 font-medium bg-white dark:bg-gray-900">หน่วย: บาท/ชิ้น</UBadge>
        </div>
        
        <div class="p-0">
          <AppPricingTable />
        </div>
      </div>

      <!-- Notice List -->
      <div class="mt-8 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden shadow-sm">
        <div class="p-4 md:p-5 flex items-center gap-2.5 font-semibold text-[15px] text-gray-900 dark:text-white bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div class="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center">
            <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
          </div>
          สิ่งที่ลูกค้าควรทราบก่อนใช้บริการ
        </div>
        <ul class="flex flex-col m-0 p-0">
          <li class="flex items-start gap-3 p-3.5 md:p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 last:border-b-0">
            <span class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2"></span>
            ราคาขึ้นอยู่กับสภาพผ้า และจะแจ้งให้ทราบก่อนดำเนินการ
          </li>
          <li class="flex items-start gap-3 p-3.5 md:p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 last:border-b-0">
            <span class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2"></span>
            คราบฝังแน่นอาจไม่สามารถขจัดได้หมด
          </li>
          <li class="flex items-start gap-3 p-3.5 md:p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 last:border-b-0">
            <span class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2"></span>
            กรุณาแจ้งหากผ้ามีโอกาสสีตก
          </li>
          <li class="flex items-start gap-3 p-3.5 md:p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 last:border-b-0">
            <span class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2"></span>
            กรุณาตรวจสอบสิ่งของในกระเป๋าก่อนส่งซัก ทางร้านไม่รับผิดชอบทรัพย์สินที่ตกค้าง
          </li>
          <li class="flex items-start gap-3 p-3.5 md:p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 last:border-b-0">
            <span class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2"></span>
            กรณีผ้าเสียหายจากความผิดพลาดของทางร้าน ชดใช้ไม่เกิน 10 เท่าของค่าบริการในรายการนั้น
          </li>
        </ul>
      </div>

    </UContainer>
  </section>
</template>
