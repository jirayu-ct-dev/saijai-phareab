<script setup lang="ts">
const items = [
  {
    label: 'พื้นที่ให้บริการครอบคลุมที่ไหนบ้าง?',
    content: 'ปัจจุบันเราให้บริการครอบคลุมพื้นที่ในเขตกรุงเทพฯ และปริมณฑลบางส่วน คุณสามารถตรวจสอบพื้นที่ให้บริการที่แน่นอนได้โดยการส่งตำแหน่งที่ตั้ง (Location) มาให้เราทาง LINE ครับ'
  },
  {
    label: 'ใช้เวลากี่วันถึงจะได้รับผ้าคืน?',
    content: 'สำหรับบริการซักรีดปกติ จะใช้เวลาดำเนินการประมาณ 2-3 วันทำการครับ แต่หากคุณต้องการบริการด่วน (Express) สามารถแจ้งพนักงานได้ ซึ่งจะได้รับผ้าคืนภายใน 24 ชั่วโมง (มีค่าบริการเพิ่มเติม)'
  },
  {
    label: 'มีการรับประกันกรณีผ้าเสียหายหรือไม่?',
    content: 'เรามีการรับประกันความเสียหายที่เกิดจากการกระบวนการซักรีดของเรา โดยวงเงินชดเชยจะเป็นไปตามเงื่อนไขที่กำหนด (สูงสุดไม่เกิน 5 เท่าของค่าบริการชิ้นนั้นๆ) ทั้งนี้แนะนำให้ตรวจสอบผ้าก่อนส่งมอบครับ'
  },
  {
    label: 'สามารถยกเลิกหรือเลื่อนเวลานัดรับผ้าได้ไหม?',
    content: 'ได้ครับ คุณสามารถแจ้งเลื่อนหรือยกเลิกเวลานัดรับผ้าผ่านทาง LINE ล่วงหน้าอย่างน้อย 2 ชั่วโมงก่อนเวลานัดหมายครับ'
  }
]
</script>

<template>
  <section class="py-24 bg-white dark:bg-[#0a0a0a]">
    <UContainer>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <div class="space-y-6">
          <UBadge color="primary" variant="subtle" class="rounded-full">FAQ</UBadge>
          <h2 class="text-3xl md:text-5xl font-bold text-[#1a365d] dark:text-white leading-tight">
            คำถามที่พบบ่อย <br />
            <span class="text-gray-400">ที่คุณอาจสงสัย</span>
          </h2>
          <p class="text-gray-500 dark:text-gray-400 text-lg max-w-md">
            เราได้รวบรวมคำถามที่ลูกค้าสอบถามบ่อยๆ เพื่อให้คุณมั่นใจในบริการของเรามากขึ้น หากมีคำถามอื่นๆ เพิ่มเติม สามารถสอบถามทาง LINE ได้ตลอดเวลาครับ
          </p>
          <div class="pt-4">
            <UButton 
              icon="i-lucide-message-circle" 
              size="lg" 
              color="primary" 
              variant="outline" 
              class="rounded-full px-8"
              to="/login"
            >
              สอบถามเพิ่มเติมทาง LINE
            </UButton>
          </div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-900 rounded-3xl p-4 md:p-8 border border-gray-100 dark:border-gray-800">
          <UAccordion 
            :items="items" 
            multiple
            variant="ghost"
            size="xl"
            class="w-full"
            :ui="{
              item: 'pb-6 pt-2 text-gray-600 dark:text-gray-400 leading-relaxed',
              button: {
                base: 'py-6 font-bold text-[#1a365d] dark:text-white text-lg hover:text-primary-600 transition-colors',
                trailingIcon: 'text-primary-500'
              }
            }"
          />
        </div>
      </div>
    </UContainer>
  </section>
</template>
