<template>
  <UContainer id="why-choose-us" class="py-20 border-b border-gray-100 dark:border-gray-800">
    <div class="text-center mb-16">
      <span class="text-primary-600 dark:text-primary-400 font-bold tracking-[0.2em] uppercase text-sm mb-3 block">WHY
        CHOOSE US</span>
      <h2 class="text-3xl md:text-4xl font-extrabold text-[#1a2b4c] dark:text-white">ทำไมลูกค้าถึงไว้วางใจเรา</h2>
      <p class="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
        เรามุ่งมั่นให้บริการซักอบรีดที่ได้มาตรฐานสูงสุด เพื่อให้เสื้อผ้าของคุณสะอาด หอม และคงทนอยู่เสมอ
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <!-- Feature 1 -->
      <div
        class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center">
        <div
          class="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mb-6">
          <UIcon name="i-lucide-droplets" class="w-8 h-8" />
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-3">น้ำยาเกรดพรีเมียม</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          เลือกใช้น้ำยาซักผ้าและน้ำยาปรับผ้านุ่มคุณภาพสูง ถนอมใยผ้า ไม่ระคายเคืองผิว ปลอดภัยแม้ผิวแพ้ง่าย
        </p>
      </div>

      <!-- Feature 2 -->
      <div
        class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center">
        <div
          class="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mb-6">
          <UIcon name="i-lucide-washing-machine" class="w-8 h-8" />
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-3">แยกซักทุกตะกร้า</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          มั่นใจในความสะอาดและสุขอนามัย ด้วยนโยบายการแยกซักผ้าของลูกค้าแต่ละท่านอย่างเด็ดขาด ไม่ซักรวมกัน
        </p>
      </div>

      <!-- Feature 3 -->
      <div
        class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center">
        <div
          class="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mb-6">
          <UIcon name="i-lucide-shield-check" class="w-8 h-8" />
        </div>
        <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-3">รับประกันคุณภาพ</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          เราดูแลเสื้อผ้าของคุณอย่างมืออาชีพ พร้อมรับผิดชอบและชดเชยหากเกิดความเสียหายระหว่างการให้บริการ
        </p>
      </div>
    </div>
  </UContainer>
</template>
