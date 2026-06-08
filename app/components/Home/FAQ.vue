<script setup lang="ts">
const items = [
  {
    label: 'บริการรับส่งใช้ได้กับใครบ้าง?',
    content: 'บริการรับส่งมีเฉพาะลูกค้าที่สมัครแพ็กเกจบริการรับส่งเท่านั้น หากต้องการใช้บริการนี้ให้สอบถามเงื่อนไขและพื้นที่ให้บริการผ่าน LINE'
  },
  {
    label: 'ใช้เวลากี่วันถึงจะรับผ้าคืน?',
    content: 'โดยทั่วไปใช้เวลาประมาณ 1-2 วันทำการ ขึ้นอยู่กับประเภทผ้า จำนวนรายการ และรอบงานของร้าน เมื่อเสร็จแล้วสามารถรับคืนที่ร้าน หรือใช้บริการรับส่งเฉพาะกรณีที่มีแพ็กเกจรับส่ง'
  },
  {
    label: 'ถ้าผ้าเสียหายหรือมีคราบฝังแน่นต้องทำอย่างไร?',
    content: 'ก่อนส่งผ้าควรแจ้งคราบ สีตก หรือจุดชำรุดให้ร้านทราบ และตรวจสิ่งของในกระเป๋าก่อนส่ง หากเกิดความเสียหายจากความผิดพลาดของร้านจะชดใช้ตามเงื่อนไขของร้าน'
  },
  {
    label: 'เลื่อนนัดรับส่งหรือแก้ข้อมูลออเดอร์ได้ไหม?',
    content: 'ได้เฉพาะรายการที่เกี่ยวข้องกับแพ็กเกจบริการรับส่ง หรือตามที่ร้านยืนยัน ให้ติดต่อผ่าน LINE โดยเร็วที่สุด หากร้านเริ่มดำเนินการแล้ว ข้อมูลบางอย่างอาจแก้ไขไม่ได้'
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
            หากมีคำถามเกี่ยวกับราคา แพ็กเกจ ออเดอร์ หรือใบเสร็จ สามารถสอบถามร้านผ่าน LINE ได้
          </p>
          <UButton 
            size="xl" 
            color="primary" 
            variant="outline" 
          class="font-bold rounded-lg px-8 bg-white dark:bg-gray-900"
            to="#contact"
          >
            สอบถามเพิ่มเติม
          </UButton>
        </div>

        <!-- Right Column - Accordion -->
        <div class="lg:col-span-7">
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 sm:p-4 shadow-sm">
            <UAccordion 
              :items="items" 
              multiple
              variant="ghost"
              size="xl"
              class="w-full"
            >
              <template #trailing="{ open }">
                <div class="ml-auto flex items-center justify-end">
                  <UIcon
                    :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="w-5 h-5 text-gray-500 transition-transform duration-200"
                  />
                </div>
              </template>
            </UAccordion>
          </div>
        </div>

      </div>
    </UContainer>
  </section>
</template>
