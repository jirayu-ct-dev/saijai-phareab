<template>
  <div id="faq" class="py-20 bg-gray-50 dark:bg-gray-900/50">
    <UContainer>
      <div class="text-center mb-16">
        <span
          class="text-primary-600 dark:text-primary-400 font-bold tracking-[0.2em] uppercase text-sm mb-3 block">FAQ</span>
        <h2 class="text-3xl md:text-4xl font-extrabold text-[#1a2b4c] dark:text-white">คำถามที่พบบ่อย</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <!-- Card 1 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 dark:border-gray-700 flex flex-col group">
          <div
            class="text-primary-600 dark:text-primary-400 mb-6 group-hover:scale-110 transition-transform duration-300">
            <UIcon name="i-lucide-clock" class="w-12 h-12" />
          </div>
          <h3 class="text-[1.1rem] font-bold text-[#1a2b4c] dark:text-white mb-4 leading-snug">
            ระยะเวลาในการซักรีดนานแค่ไหน?</h3>
          <p class="text-gray-500 dark:text-gray-400 text-[0.95rem] leading-relaxed">
            โดยปกติบริการแบบมาตรฐานจะใช้เวลา 2-3 วันทำการ สำหรับบริการด่วนพิเศษ (Express) สามารถรับผ้าคืนได้ภายใน 24
            ชั่วโมง
          </p>
        </div>

        <!-- Card 2 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 dark:border-gray-700 flex flex-col group">
          <div
            class="text-primary-600 dark:text-primary-400 mb-6 group-hover:scale-110 transition-transform duration-300">
            <UIcon name="i-lucide-calculator" class="w-12 h-12" />
          </div>
          <h3 class="text-[1.1rem] font-bold text-[#1a2b4c] dark:text-white mb-4 leading-snug">
            หักโควต้ารายเดือนอย่างไร?</h3>
          <p class="text-gray-500 dark:text-gray-400 text-[0.95rem] leading-relaxed">
            ระบบหักโควต้าเป็นรายชิ้น (1 ชิ้น = 1 โควต้า)
            ยกเว้นผ้าขนาดใหญ่อย่างผ้านวมที่อาจมีการคิดโควต้าพิเศษตามเงื่อนไข
          </p>
        </div>

        <!-- Card 3 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 dark:border-gray-700 flex flex-col group">
          <div
            class="text-primary-600 dark:text-primary-400 mb-6 group-hover:scale-110 transition-transform duration-300">
            <UIcon name="i-lucide-truck" class="w-12 h-12" />
          </div>
          <h3 class="text-[1.1rem] font-bold text-[#1a2b4c] dark:text-white mb-4 leading-snug">รับ-ส่งผ้าฟรีหรือไม่?
          </h3>
          <p class="text-gray-500 dark:text-gray-400 text-[0.95rem] leading-relaxed">
            หากสมัครแพ็กเกจเสริมเราจะมีบริการรับ-ส่ง หากใช้แพ็กเกจปกติ จะมีค่าบริการจัดส่งเริ่มต้น 30 บาทต่อครั้ง
          </p>
        </div>

        <!-- Card 4 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 dark:border-gray-700 flex flex-col group">
          <div
            class="text-primary-600 dark:text-primary-400 mb-6 group-hover:scale-110 transition-transform duration-300">
            <UIcon name="i-lucide-shield-check" class="w-12 h-12" />
          </div>
          <h3 class="text-[1.1rem] font-bold text-[#1a2b4c] dark:text-white mb-4 leading-snug">
            สูญหายมีการรับประกันไหม?</h3>
          <p class="text-gray-500 dark:text-gray-400 text-[0.95rem] leading-relaxed">
            รับประกันความเสียหายที่เกิดจากความผิดพลาดของทางร้าน โดยชดเชยสูงสุดไม่เกิน 10 เท่าของค่าบริการ หรือสูงสุด
            2,000 บาท
          </p>
        </div>
      </div>
    </UContainer>
  </div>
</template>
