<template>
  <section id="contact" class="py-16 md:py-24">
    <UContainer>
      <div class="mb-12 max-w-2xl mx-auto text-center">
        <span class="inline-block text-primary-600 dark:text-primary-400 font-semibold text-[13px] tracking-wide mb-2 uppercase">ติดต่อเรา</span>
        <h2 class="text-[26px] md:text-[38px] font-bold text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-3">
          พร้อมให้บริการ <span class="text-primary-600 dark:text-primary-400">จันทร์ – เสาร์</span>
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
          สามารถติดต่อสอบถามข้อมูลเพิ่มเติมได้ทันที พนักงานของเราพร้อมให้บริการคุณด้วยความใส่ใจ
        </p>
      </div>

      <!-- Contact Cards Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

        <!-- LINE Card -->
        <a
          href="https://line.me/R/ti/p/@883vmdct"
          target="_blank"
          class="group flex flex-col items-center text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#06C755]/50 dark:hover:border-[#06C755]/50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div class="w-14 h-14 rounded-2xl bg-[#06C755]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UIcon name="i-ph-chat-circle-fill" class="w-7 h-7 text-[#06C755]" />
          </div>
          <p class="text-[11px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-1">LINE Official</p>
          <p class="text-[18px] font-bold text-gray-900 dark:text-white mb-1">@saijai-laundry</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">แชทรับข่าวสาร</p>
          <span class="mt-4 inline-flex items-center gap-1 text-[#06C755] text-sm font-semibold group-hover:gap-2 transition-all">
            แอดไลน์เลย
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
          </span>
        </a>

        <!-- Phone Card -->
        <a
          href="tel:0860222196"
          class="group flex flex-col items-center text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-400/50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div class="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UIcon name="i-lucide-phone" class="w-7 h-7 text-primary-600 dark:text-primary-400" />
          </div>
          <p class="text-[11px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-1">โทรศัพท์</p>
          <p class="text-[18px] font-bold text-gray-900 dark:text-white mb-1">086-022-2196</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">จันทร์ – เสาร์ 14:00 – 19:30</p>
          <span class="mt-4 inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 text-sm font-semibold group-hover:gap-2 transition-all">
            โทรเลย
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
          </span>
        </a>

        <!-- Facebook Card -->
        <a
          href="https://www.facebook.com/saijaiburiram/?rdid=amPWW1eNJg7Yb6OB"
          target="_blank"
          class="group flex flex-col items-center text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#4267B2]/50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div class="w-14 h-14 rounded-2xl bg-[#4267B2]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UIcon name="i-simple-icons-facebook" class="w-7 h-7 text-[#4267B2]" />
          </div>
          <p class="text-[11px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-1">Facebook</p>
          <p class="text-[18px] font-bold text-gray-900 dark:text-white mb-1">ใส่ใจ ผ้าเรียบ</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">ติดตามโปรโมชั่นและข่าวสาร</p>
          <span class="mt-4 inline-flex items-center gap-1 text-[#4267B2] text-sm font-semibold group-hover:gap-2 transition-all">
            ติดตาม
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
          </span>
        </a>
      </div>

      <!-- Hours Banner -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-clock" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p class="text-[11px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-0.5">เวลาทำการ</p>
            <p class="font-semibold text-gray-900 dark:text-white text-[17px]">14:00 – 19:30 น.</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">วันจันทร์ – เสาร์ (หยุดวันอาทิตย์)</p>
          </div>
        </div>
        <UButton
          size="xl"
          class="bg-[#06C755] hover:bg-[#05B04C] text-white font-bold rounded-xl px-8 whitespace-nowrap flex-shrink-0 w-full md:w-auto"
          to="https://line.me/R/ti/p/@883vmdct"
          target="_blank"
        >
          <UIcon name="i-ph-chat-circle-fill" class="w-5 h-5 mr-2" />
          ติดต่อผ่าน LINE
        </UButton>
      </div>
    </UContainer>
  </section>
</template>
