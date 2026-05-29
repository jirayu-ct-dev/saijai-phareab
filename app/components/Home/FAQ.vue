<script setup lang="ts">
const items = [
  {
    label: 'พื้นที่ให้บริการรับ-ส่งครอบคลุมที่ไหนบ้าง?',
    content: 'ปัจจุบันเราให้บริการครอบคลุมพื้นที่ในเขตรัศมี 10 กม. จากร้าน หากอยู่นอกพื้นที่ สามารถสอบถามค่าบริการเพิ่มเติมทาง LINE ได้ครับ'
  },
  {
    label: 'ซัก-อบ-รีด ใช้เวลากี่วันถึงจะได้รับผ้าคืน?',
    content: 'สำหรับบริการซักรีดปกติ จะใช้เวลาดำเนินการประมาณ 1-2 วันทำการครับ แต่หากคุณต้องการบริการด่วน (Express) สามารถแจ้งพนักงานได้ ซึ่งจะได้รับผ้าคืนภายใน 24 ชั่วโมง (มีค่าบริการเพิ่มเติม)'
  },
  {
    label: 'มีการรับประกันกรณีผ้าเสียหายหรือไม่?',
    content: 'เรามีการรับประกันความเสียหายที่เกิดจากการกระบวนการซักรีดของเรา โดยวงเงินชดเชยจะชดใช้ไม่เกิน 10 เท่าของค่าบริการในรายการนั้น ทั้งนี้แนะนำให้ตรวจสอบผ้าและสิ่งของในกระเป๋าก่อนส่งมอบครับ'
  },
  {
    label: 'สามารถยกเลิกหรือเลื่อนเวลานัดรับผ้าได้ไหม?',
    content: 'ได้ครับ คุณสามารถแจ้งเลื่อนหรือยกเลิกเวลานัดรับผ้าผ่านทาง LINE ล่วงหน้าอย่างน้อย 2 ชั่วโมงก่อนเวลานัดหมายครับ'
  }
]
</script>

<template>
  <section id="faq" class="py-16 md:py-24">
    <UContainer>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        
        <!-- Left Column -->
        <div class="lg:col-span-5 lg:sticky lg:top-24">
          <span class="inline-block text-primary-600 dark:text-primary-400 font-semibold text-[13px] tracking-wide mb-2">คำถามที่พบบ่อย</span>
          <h2 class="text-[26px] md:text-[38px] font-bold text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-4">
            ข้อสงสัยที่ลูกค้า<br class="hidden lg:block">มักจะถามเราบ่อยๆ
          </h2>
          <p class="text-gray-500 dark:text-gray-400 text-base leading-relaxed mb-8">
            หากมีคำถามอื่นๆ ที่ไม่พบในนี้ สามารถสอบถามทีมงานของเราได้ทาง LINE เลยครับ ยินดีให้บริการ
          </p>
          <UButton 
            size="xl" 
            color="primary" 
            variant="outline" 
          class="font-bold rounded-md px-8 bg-white dark:bg-gray-900"
            to="#contact"
          >
            สอบถามเพิ่มเติม
          </UButton>
        </div>

        <!-- Right Column - Accordion -->
        <div class="lg:col-span-7">
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-2 sm:p-4 shadow-sm">
            <UAccordion 
              :items="items" 
              multiple
              variant="ghost"
              size="xl"
              class="w-full"
            />
          </div>
        </div>

      </div>
    </UContainer>
  </section>
</template>
