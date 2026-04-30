<template>
  <section class="py-24 bg-white dark:bg-[#0a0a0a]">
    <UContainer>
      <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <UBadge color="primary" variant="subtle" class="rounded-full">ทำไมต้องเลือกเรา?</UBadge>
        <h2 class="text-3xl md:text-5xl font-bold text-[#1a365d] dark:text-white">
          มากกว่าการซักรีด คือการดูแลที่ "ใส่ใจ"
        </h2>
        <p class="text-gray-500 dark:text-gray-400">
          เราเชื่อว่าเสื้อผ้าที่เรียบเนี้ยบช่วยสร้างความมั่นใจให้คุณ เราจึงทุ่มเทดูแลผ้าทุกชิ้นเสมือนเป็นของเราเอง
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Card 1 -->
        <div class="p-8 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-primary-500/30 transition-all group">
          <div class="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <UIcon name="i-lucide-sparkles" class="w-7 h-7 text-primary-600" />
          </div>
          <h3 class="text-xl font-bold text-[#1a365d] dark:text-white mb-3">ความประณีตระดับมืออาชีพ</h3>
          <p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
            ช่างรีดผู้เชี่ยวชาญ ใส่ใจทุกรอยพับและรอยยับ เพื่อให้ผ้าของคุณเรียบกริบ ทรงสวยเหมือนใหม่
          </p>
        </div>

        <!-- Card 2 -->
        <div class="p-8 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-primary-500/30 transition-all group">
          <div class="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <UIcon name="i-lucide-droplets" class="w-7 h-7 text-primary-600" />
          </div>
          <h3 class="text-xl font-bold text-[#1a365d] dark:text-white mb-3">ความสะอาดที่เหนือกว่า</h3>
          <p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
            ใช้ผลิตภัณฑ์ซักผ้าเกรดพรีเมียม และระบบซักที่ถนอมใยผ้า ขจัดคราบสะอาดหมดจด พร้อมกลิ่นหอมสดชื่น
          </p>
        </div>

        <!-- Card 3 -->
        <div class="p-8 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-primary-500/30 transition-all group">
          <div class="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <UIcon name="i-lucide-smartphone" class="w-7 h-7 text-primary-600" />
          </div>
          <h3 class="text-xl font-bold text-[#1a365d] dark:text-white mb-3">สะดวกสบายผ่าน LINE</h3>
          <p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
            นัดหมายรับ-ส่งผ้า ตรวจสอบสถานะ และชำระเงินได้ทันทีผ่านแอป LINE ไม่ต้องเสียเวลาเดินทาง
          </p>
        </div>
      </div>
    </UContainer>
  </section>
</template>
