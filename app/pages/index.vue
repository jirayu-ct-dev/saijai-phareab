<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import Login from './auth/login.vue';

</script>

<template>
  <div>
    <UPageHero headline="บริการซักรีดรับถึงบ้าน" title="ใส่ใจทุกผืนผ้าของคุณ"
      description="สะดวก รวดเร็ว และปลอดภัยด้วยทีมงานมืออาชีพ บริการรับ-ส่งผ้าถึงหน้าบ้าน พร้อมอัปเดตสถานะการซักรีดแบบเรียลไทม์"
      orientation="horizontal" :links="[
      ]">
      <img src="/logo-saijai-phareab.png" alt="SaiJai-Phareab laundry service"
        class="w-full max-w-sm lg:max-w-md mx-auto p-6 hidden lg:inline" />
    </UPageHero>

    <!-- ขั้นตอนการใช้บริการ (How it works) -->
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

    <!-- ทำไมต้องเลือกเรา (Why Choose Us) -->
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


    <!-- คำถามที่พบบ่อย (FAQ) -->
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
  </div>
</template>