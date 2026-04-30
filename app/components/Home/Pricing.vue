<template>
  <section id="pricing" class="py-24 bg-white dark:bg-[#0a0a0a]">
    <UContainer>
      <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <h2 class="text-3xl md:text-5xl font-bold text-[#1a365d] dark:text-white">
          อัตราค่าบริการรายชิ้น
        </h2>
        <p class="text-gray-500 dark:text-gray-400">
          ราคาโปร่งใส ตรงไปตรงมา ตรวจสอบได้ทันที
        </p>
      </div>

      <AppPricingTable />
      
      <div class="mt-12 p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-4 text-primary-900 dark:text-primary-100">
          <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <UIcon name="i-lucide-info" class="w-6 h-6" />
          </div>
          <p class="font-medium text-sm md:text-base">ราคานี้ยังไม่รวมค่าบริการรับ-ส่งผ้าในบางพื้นที่ (โปรดตรวจสอบผ่าน LINE)</p>
        </div>
        <UButton color="primary" size="lg" class="rounded-full px-8" to="/login">
          สอบถามราคาพื้นที่ให้บริการ
        </UButton>
      </div>
    </UContainer>
  </section>
</template>
