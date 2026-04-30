<template>
  <section class="py-24 bg-gray-50 dark:bg-gray-950">
    <UContainer>
      <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <h2 class="text-3xl md:text-5xl font-bold text-[#1a365d] dark:text-white">
          4 ขั้นตอนง่ายๆ เพื่อผ้าที่เรียบเนี้ยบ
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-lg">
          เปลี่ยนเรื่องซักรีดที่ยุ่งยาก ให้เป็นเรื่องง่ายเพียงไม่กี่ขั้นตอน
        </p>
      </div>

      <div class="relative grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
        <!-- Connecting Line (Desktop) -->
        <div class="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-primary-200 via-primary-500 to-primary-200 z-0 opacity-30" />

        <!-- Step 1 -->
        <div class="relative z-10 flex flex-col items-center text-center group">
          <div class="w-20 h-20 rounded-full bg-white dark:bg-gray-900 shadow-xl border-4 border-white dark:border-gray-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-lg">1</span>
            <UIcon name="i-lucide-message-square" class="w-8 h-8 text-primary-600" />
          </div>
          <h4 class="text-lg font-bold text-[#1a365d] dark:text-white mb-2">สั่งงานผ่าน LINE</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 px-4">เลือกแพ็กเกจหรือบริการที่ต้องการผ่านหน้าเว็บหรือ LINE OA</p>
        </div>

        <!-- Step 2 -->
        <div class="relative z-10 flex flex-col items-center text-center group">
          <div class="w-20 h-20 rounded-full bg-white dark:bg-gray-900 shadow-xl border-4 border-white dark:border-gray-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-lg">2</span>
            <UIcon name="i-lucide-truck" class="w-8 h-8 text-primary-600" />
          </div>
          <h4 class="text-lg font-bold text-[#1a365d] dark:text-white mb-2">พนักงานเข้ารับผ้า</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 px-4">เราจะนัดเวลาเข้ารับผ้าถึงที่หน้าบ้านคุณตามเวลาที่สะดวก</p>
        </div>

        <!-- Step 3 -->
        <div class="relative z-10 flex flex-col items-center text-center group">
          <div class="w-20 h-20 rounded-full bg-white dark:bg-gray-900 shadow-xl border-4 border-white dark:border-gray-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-lg">3</span>
            <UIcon name="i-lucide-wind" class="w-8 h-8 text-primary-600" />
          </div>
          <h4 class="text-lg font-bold text-[#1a365d] dark:text-white mb-2">ดำเนินการซักรีด</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 px-4">ผ้าทุกชิ้นจะถูกดูแลด้วยความประณีตและสะอาดสูงสุด</p>
        </div>

        <!-- Step 4 -->
        <div class="relative z-10 flex flex-col items-center text-center group">
          <div class="w-20 h-20 rounded-full bg-white dark:bg-gray-900 shadow-xl border-4 border-white dark:border-gray-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-lg">4</span>
            <UIcon name="i-lucide-package-check" class="w-8 h-8 text-primary-600" />
          </div>
          <h4 class="text-lg font-bold text-[#1a365d] dark:text-white mb-2">ส่งมอบผ้าเรียบกริบ</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 px-4">ส่งคืนผ้าถึงมือคุณพร้อมใช้งานทันที ในสภาพที่เนี้ยบที่สุด</p>
        </div>
      </div>
    </UContainer>
  </section>
</template>
