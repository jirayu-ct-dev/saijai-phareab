<template>
  <section id="delivery" class="py-16 md:py-24 bg-gray-50 dark:bg-gray-900/50 border-y border-gray-200 dark:border-gray-800">
    <UContainer>
      <div class="mb-12 max-w-2xl mx-auto text-center">
        <span class="inline-block text-primary-600 dark:text-primary-400 font-semibold text-[13px] tracking-wide mb-2">รับ-ส่งถึงบ้าน</span>
        <h2 class="text-[26px] md:text-[38px] font-bold text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-3">
          ง่าย ๆ แค่ 4 ขั้นตอน
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-base leading-relaxed max-w-lg mx-auto">
          ไม่ต้องออกจากบ้าน ไม่ต้องยกของหนัก เราจัดการให้ตั้งแต่ต้นจนจบ
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        <!-- 4 Steps -->
        <div class="space-y-3">
          <div class="flex gap-4 bg-white dark:bg-gray-900 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center font-semibold text-sm font-mono">01</div>
            <div>
              <h4 class="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">ทักไลน์ จองคิว</h4>
              <p class="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed">แอดไลน์ @saijai-laundry แจ้งวัน-เวลาที่สะดวก</p>
            </div>
          </div>
          <div class="flex gap-4 bg-white dark:bg-gray-900 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center font-semibold text-sm font-mono">02</div>
            <div>
              <h4 class="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">รับผ้าถึงบ้าน</h4>
              <p class="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed">พนักงานเข้ารับผ้าตามนัด ชั่งและออกใบรับสินค้า</p>
            </div>
          </div>
          <div class="flex gap-4 bg-white dark:bg-gray-900 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center font-semibold text-sm font-mono">03</div>
            <div>
              <h4 class="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">ซัก-อบ-รีด</h4>
              <p class="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed">ดำเนินการตามบริการที่เลือก พร้อมถ่ายรูปอัปเดต</p>
            </div>
          </div>
          <div class="flex gap-4 bg-white dark:bg-gray-900 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center font-semibold text-sm font-mono">04</div>
            <div>
              <h4 class="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">ส่งคืนถึงมือ</h4>
              <p class="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed">พับเรียบร้อย ส่งคืนภายใน 24 ชม. ตรวจรับก่อนชำระ</p>
            </div>
          </div>
        </div>

        <!-- Delivery Package Card -->
        <UCard class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-3xl p-2 md:p-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <UIcon name="i-lucide-truck" class="w-5 h-5" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white leading-tight">แพ็กเกจรับ-ส่งถึงบ้าน</h3>
          </div>
          
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[32px] font-bold text-gray-900 dark:text-white tracking-tight">฿300</span>
            <span class="text-[13px] text-gray-500 dark:text-gray-400">/ เดือน · 8 ครั้ง</span>
          </div>
          
          <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
            รับและส่งคืนผ้าถึงบ้านสัปดาห์ละ 2 ครั้ง รวม 8 ครั้งต่อเดือน เลือกได้สำหรับลูกค้าที่ต้องการความสะดวก ไม่ต้องเดินทาง
          </p>

          <div class="flex flex-wrap gap-2 mb-5">
            <UBadge color="primary" variant="subtle" class="rounded-full px-2.5 py-1 text-xs font-medium">
              <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 mr-1" />
              ทุกวันพุธ
            </UBadge>
            <UBadge color="primary" variant="subtle" class="rounded-full px-2.5 py-1 text-xs font-medium">
              <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 mr-1" />
              ทุกวันเสาร์
            </UBadge>
            <UBadge color="primary" variant="subtle" class="rounded-full px-2.5 py-1 text-xs font-medium">
              2 ครั้ง/สัปดาห์
            </UBadge>
          </div>

          <div class="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl mb-5">
            <div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-1">เวลารับผ้า</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white leading-tight">14:00 – 19:30</div>
              <div class="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">วันรับของสัปดาห์</div>
            </div>
            <div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-1">รวม</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white leading-tight">8 ครั้ง</div>
              <div class="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">ต่อเดือน</div>
            </div>
            <div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-1">รอบส่งคืน</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white leading-tight">24 – 48 ชม.</div>
              <div class="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">หลังรับผ้า</div>
            </div>
            <div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-1">ราคา</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white leading-tight">฿300</div>
              <div class="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">ต่อเดือน</div>
            </div>
          </div>

          <UButton
            block
            size="lg"
            class="bg-[#06C755] hover:bg-[#05B04C] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            to="#contact"
          >
            <UIcon name="i-ph-chat-circle-fill" class="w-5 h-5" />
            นัดรับผ้าทาง LINE
          </UButton>
        </UCard>
      </div>
    </UContainer>
  </section>
</template>
