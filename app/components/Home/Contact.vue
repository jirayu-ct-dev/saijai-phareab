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
          class="group flex flex-col items-center text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#06C755]/50 dark:hover:border-[#06C755]/50 rounded-md p-8 shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div class="w-14 h-14 rounded-md bg-[#06C755]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UIcon name="i-simple-icons-line" class="w-7 h-7 text-[#06C755]" />
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
          class="group flex flex-col items-center text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-400/50 rounded-md p-8 shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div class="w-14 h-14 rounded-md bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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
          class="group flex flex-col items-center text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#4267B2]/50 rounded-md p-8 shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div class="w-14 h-14 rounded-md bg-[#4267B2]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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

      <!-- Maps & Location Section -->
      <div class="mt-12 overflow-hidden border border-gray-200 dark:border-gray-800 rounded-md shadow-sm bg-white dark:bg-gray-900">
        <div class="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
          <!-- Info Side -->
          <div class="lg:w-1/3 flex flex-col justify-between">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 mb-4">
                <UIcon name="i-lucide-map-pin" class="w-4 h-4" />
                <span class="text-[11px] font-bold tracking-widest uppercase">สถานที่ตั้ง</span>
              </div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3">แวะมาหาเราได้ที่ร้าน</h3>
              <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                ใส่ใจ ผ้าเรียบ - บริการ ซัก อบ รีด คุ้มค่า สะดวกสบาย <br>
                อำเภอเมือง จังหวัดบุรีรัมย์
              </p>
              
              <div class="space-y-4">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700">
                    <UIcon name="i-lucide-clock" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">เวลาทำการ</p>
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">14:00 – 19:30 น.</p>
                    <p class="text-[12px] text-gray-500 dark:text-gray-400">จันทร์ – เสาร์ (หยุดวันอาทิตย์)</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8">
              <UButton
                size="xl"
                class="bg-[#06C755] hover:bg-[#05B04C] text-white font-bold rounded-md px-8 w-full justify-center"
                to="https://line.me/R/ti/p/@883vmdct"
                target="_blank"
              >
                <UIcon name="i-simple-icons-line" class="w-5 h-5 mr-2" />
                ติดต่อผ่าน LINE
              </UButton>
            </div>
          </div>

          <!-- Map Side -->
          <div class="lg:w-2/3 h-[300px] lg:h-[400px] rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 relative group">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3854.0986966515134!2d103.0807595!3d14.9872255!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31199506b4a82a99%3A0xf5206a7506c788e3!2z4LmD4Liq4LmI4LmD4LiI4Lic4LmJ4Liy4LmA4Lij4Li14Lii4LiaIC0g4LiL4Lix4LiBIOC4reC4miDguKPguLXguJQg4Lia4Li44Lij4Li14Lij4Lix4Lih4Lii4LmM!5e0!3m2!1sth!2sth!4v1778601481868!5m2!1sth!2sth"
              width="100%"
              height="100%"
              style="border:0;"
              allowfullscreen=""
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              class="filter grayscale-[0.2] contrast-[1.1] hover:grayscale-0 transition-all duration-500"
            ></iframe>
            <div class="absolute inset-0 pointer-events-none border border-black/5 dark:border-white/5 rounded-md"></div>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>
