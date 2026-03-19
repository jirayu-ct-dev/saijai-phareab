<template>
  <div id="contact" class="py-20">
    <UContainer>
      <div class="text-center mb-16">
        <span
          class="text-primary-600 dark:text-primary-400 font-bold tracking-[0.2em] uppercase text-sm mb-3 block">CONTACT</span>
        <h2 class="text-3xl md:text-4xl font-extrabold text-[#1a2b4c] dark:text-white">สนใจบริการ ติดต่อเรา</h2>
        <p class="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          ทีมงานพร้อมดูแลคุณในเวลาทำการ (07:00 - 20:00 น.)
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 sm:px-0">
        <!-- Contact Card 1 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 hover:border-primary-500 flex flex-col items-center text-center group cursor-pointer dark:border-gray-700">
          <div
            class="w-20 h-20 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-6 text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300">
            <UIcon name="i-lucide-phone-call" class="w-10 h-10" />
          </div>
          <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">เบอร์โทรศัพท์</h3>
          <p class="text-gray-500 dark:text-gray-400 text-lg">XXX-XXX-XXXX</p>
        </div>

        <!-- Contact Card 2 -->
        <a href="https://line.me/R/ti/p/@883vmdct" target="_blank" rel="noopener noreferrer"
          class="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 hover:border-[#00B900] flex flex-col items-center text-center group cursor-pointer dark:border-gray-700">
          <div
            class="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-6 text-[#00B900] group-hover:bg-[#00B900] group-hover:text-white transition-colors duration-300">
            <UIcon name="i-simple-icons-line" class="w-10 h-10" />
          </div>
          <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">LINE Official</h3>
          <p class="text-gray-500 dark:text-gray-400 text-lg">@SaiJaiLaundry</p>
        </a>

        <!-- Contact Card 3 (Location) -->
        <a href="https://maps.app.goo.gl/BR6A8RFBuUgXniZN6" target="_blank" rel="noopener noreferrer"
          class="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 border border-gray-100 hover:border-red-500 flex flex-col items-center text-center group cursor-pointer dark:border-gray-700">
          <div
            class="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-6 text-red-500 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300">
            <UIcon name="i-lucide-map-pin" class="w-10 h-10" />
          </div>
          <h3 class="text-xl font-bold text-[#1a2b4c] dark:text-white mb-2">พิกัดร้าน</h3>
          <h4>14:00 - 19:30 น. (หยุดทุกวันอาทิตย์)</h4>
          <p class="text-gray-500 dark:text-gray-400 text-lg group-hover:text-red-500 transition-colors">คลิกเพื่อดู Google Maps</p>
        </a>
      </div>
    </UContainer>
  </div>
</template>
