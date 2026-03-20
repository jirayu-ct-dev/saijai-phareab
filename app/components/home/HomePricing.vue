<template>
  <UContainer id="per-item-pricing" class="py-20 border-b border-gray-100 dark:border-gray-800">
    <div class="text-center mb-16">
      <span class="text-primary-600 dark:text-primary-400 font-bold tracking-[0.2em] uppercase text-sm mb-3 block">PRICING</span>
      <h2 class="text-3xl md:text-4xl font-extrabold text-[#1a2b4c] dark:text-white">อัตราค่าบริการรายชิ้น</h2>
      <p class="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
        ซักอบรีดรายชิ้น ราคาโปร่งใส ชัดเจน แจกแจงตามประเภทผ้าและบริการ
      </p>
    </div>

    <div class="max-w-4xl mx-auto">
      <AppPricingTable />
    </div>
  </UContainer>
</template>
