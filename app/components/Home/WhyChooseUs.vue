<template>
  <section id="services" class="py-16 md:py-24 relative">
    <UContainer>
      <div class="mb-12 max-w-2xl">
        <span class="inline-block text-primary-600 dark:text-primary-400 font-semibold text-[13px] tracking-wide mb-2">บริการของเรา</span>
        <h2 class="text-[26px] md:text-[38px] font-bold text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-3">
          งานซักรีด ครบ จบที่เดียว
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
          ตั้งแต่เสื้อผ้าใส่ทำงานประจำวัน ไปจนถึงสูทและผ้าไหมที่ต้องการการดูแลเป็นพิเศษ
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Service 1: Wash -->
        <UCard class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all group">
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-droplets" class="w-5 h-5" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">ซักผ้า</h3>
          <div class="font-mono text-xs text-gray-400 dark:text-gray-500 mb-3">wash</div>
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            ซักด้วยน้ำยาคุณภาพ ปลอดภัยกับผ้าทุกชนิด สะอาดล้ำลึก
          </p>
        </UCard>

        <!-- Service 2: Dry -->
        <UCard class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all group">
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-wind" class="w-5 h-5" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">อบผ้า</h3>
          <div class="font-mono text-xs text-gray-400 dark:text-gray-500 mb-3">dry</div>
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            อบแห้งด้วยอุณหภูมิเหมาะสม ผ้านุ่ม ไม่หด ไม่เปลี่ยนรูป
          </p>
        </UCard>

        <!-- Service 3: Dry Clean -->
        <UCard class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all group">
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-shirt" class="w-5 h-5" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">ซักแห้ง</h3>
          <div class="font-mono text-xs text-gray-400 dark:text-gray-500 mb-3">dry-clean</div>
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            สำหรับสูท ผ้าไหม ชุดที่บอบบาง ดูแลเป็นพิเศษ
          </p>
        </UCard>

        <!-- Service 4: Press/Iron -->
        <UCard class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all group">
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-sparkles" class="w-5 h-5" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">รีดผ้า</h3>
          <div class="font-mono text-xs text-gray-400 dark:text-gray-500 mb-3">press-iron</div>
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            รีดเรียบทุกตะเข็บ พร้อมใส่ ดูดี เป็นทางการ
          </p>
        </UCard>
      </div>
    </UContainer>
  </section>
</template>
