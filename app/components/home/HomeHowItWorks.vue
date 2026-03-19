<template>
  <UContainer id="how-it-works" class="py-20 border-b border-gray-100 dark:border-gray-800">
    <div class="text-center mb-16">
      <span class="text-primary-600 dark:text-primary-400 font-bold tracking-[0.2em] uppercase text-sm mb-3 block">HOW
        IT WORKS</span>
      <h2 class="text-3xl md:text-4xl font-extrabold text-[#1a2b4c] dark:text-white">4 ขั้นตอนง่ายๆ สะอาด หอมฉุย</h2>
      <p class="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
        ไม่ต้องเหนื่อยซักผ้าเองอีกต่อไป เพียงทำตามขั้นตอนง่ายๆ เราพร้อมดูแลเสื้อผ้าของคุณให้สะอาดเหมือนใหม่
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
      <!-- Connecting Line (Desktop only) -->
      <div
        class="hidden lg:block absolute top-[45px] left-[12%] right-[12%] h-[2px] bg-gradient-to-r from-primary-100 via-primary-300 to-primary-100 dark:from-primary-900 dark:via-primary-700 dark:to-primary-900 border-dashed z-0">
      </div>

      <!-- Step 1 -->
      <div class="relative z-10 flex flex-col items-center text-center group">
        <div
          class="w-24 h-24 bg-white dark:bg-gray-800 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center mb-6 border-4 border-gray-50 dark:border-gray-900 group-hover:scale-110 group-hover:border-primary-100 dark:group-hover:border-primary-900 transition-all duration-300">
          <UIcon name="i-lucide-smartphone" class="w-10 h-10 text-primary-500" />
          <div
            class="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
            1</div>
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">สมัครสมาชิก</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">
          เลือกแพ็กเกจที่โดนใจ หรือใช้บริการรายชิ้น และระบุวันเวลารับผ้า
        </p>
      </div>

      <!-- Step 2 -->
      <div class="relative z-10 flex flex-col items-center text-center group">
        <div
          class="w-24 h-24 bg-white dark:bg-gray-800 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center mb-6 border-4 border-gray-50 dark:border-gray-900 group-hover:scale-110 group-hover:border-primary-100 dark:group-hover:border-primary-900 transition-all duration-300 lg:mt-6">
          <UIcon name="i-lucide-truck" class="w-10 h-10 text-primary-500" />
          <div
            class="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
            2</div>
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">พนักงานเข้ารับผ้า</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">
          ไรเดอร์ของเราจะไปรับผ้าถึงหน้าบ้านคุณตามเวลาที่นัดหมายไว้
        </p>
      </div>

      <!-- Step 3 -->
      <div class="relative z-10 flex flex-col items-center text-center group">
        <div
          class="w-24 h-24 bg-white dark:bg-gray-800 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center mb-6 border-4 border-gray-50 dark:border-gray-900 group-hover:scale-110 group-hover:border-primary-100 dark:group-hover:border-primary-900 transition-all duration-300">
          <UIcon name="i-lucide-sparkles" class="w-10 h-10 text-primary-500" />
          <div
            class="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
            3</div>
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">ซักอบรีด</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">
          เราดูแลผ้าของคุณด้วยความใส่ใจ ซักสะอาด รีดเรียบเนี้ยบทุกจุด
        </p>
      </div>

      <!-- Step 4 -->
      <div class="relative z-10 flex flex-col items-center text-center group">
        <div
          class="w-24 h-24 bg-white dark:bg-gray-800 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center mb-6 border-4 border-gray-50 dark:border-gray-900 group-hover:scale-110 group-hover:border-primary-100 dark:group-hover:border-primary-900 transition-all duration-300 lg:mt-6">
          <UIcon name="i-lucide-package-check" class="w-10 h-10 text-primary-500" />
          <div
            class="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
            4</div>
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">ส่งผ้าคืนกลิ่นหอมฟุ้ง</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">
          ผ้าที่หอมสะอาดและพับอย่างเรียบร้อย จะถูกส่งคืนถึงมือคุณทันเวลา
        </p>
      </div>
    </div>
  </UContainer>
</template>
