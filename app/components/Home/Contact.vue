<template>
  <section id="contact" class="py-16 md:py-24">
    <UContainer>
      <div class="bg-[#1a365d] dark:bg-gray-900 rounded-[2rem] md:rounded-[3rem] overflow-hidden relative shadow-xl">
        <!-- Background Ornaments -->
        <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/20 rounded-full -mr-64 -mt-64 blur-[100px] pointer-events-none" />
        <div class="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#3BB7DB]/20 rounded-full -ml-64 -mb-64 blur-[100px] pointer-events-none" />

        <div class="grid grid-cols-1 lg:grid-cols-2">
          <!-- Content Side -->
          <div class="relative z-10 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
            <div class="mb-8">
              <span class="inline-block text-primary-300 font-semibold text-[13px] tracking-wide mb-2 uppercase">ติดต่อเรา</span>
              <h2 class="text-[32px] md:text-[46px] font-bold text-white leading-[1.15] tracking-tight mb-4">
                เปิดให้บริการ <br/>
                <span class="text-primary-300">จันทร์ – เสาร์</span>
              </h2>
              <p class="text-blue-100/80 text-lg leading-relaxed max-w-md">
                จองคิวซักรีดง่ายๆ ผ่าน LINE หรือสอบถามข้อมูลเพิ่มเติมได้ทันที พนักงานของเราพร้อมให้บริการคุณด้วยความใส่ใจ
              </p>
            </div>
            
            <div class="flex flex-col sm:flex-row items-center gap-4 mb-12">
              <UButton
                size="xl"
                class="bg-[#06C755] hover:bg-[#05B04C] text-white px-8 py-4 rounded-xl font-bold text-base w-full sm:w-auto shadow-lg shadow-[#06C755]/20 flex items-center justify-center gap-2"
                to="#line"
              >
                <UIcon name="i-ph-chat-circle-fill" class="w-6 h-6" />
                แอดไลน์ @saijai-laundry
              </UButton>
              
              <UButton
                size="xl"
                variant="outline"
                class="px-8 py-4 rounded-xl font-bold text-base w-full sm:w-auto border-white/20 text-white hover:bg-white/10 flex items-center justify-center gap-2"
                to="tel:0812345678"
              >
                <UIcon name="i-lucide-phone" class="w-5 h-5" />
                โทร: 081-234-5678
              </UButton>
            </div>

            <div class="grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
              <div>
                <p class="text-primary-300 text-[11px] mb-1.5 uppercase tracking-wider font-semibold">เวลาทำการ</p>
                <p class="font-medium text-white text-sm md:text-base">14:00 – 19:30 <span class="block text-blue-200/60 text-xs mt-0.5">หยุดวันอาทิตย์</span></p>
              </div>
              <!-- <div>
                <p class="text-primary-300 text-[11px] mb-1.5 uppercase tracking-wider font-semibold">สถานที่</p>
                <p class="font-medium text-white text-sm md:text-base">หมู่บ้านพฤกษา <span class="block text-blue-200/60 text-xs mt-0.5">สมุทรปราการ</span></p>
              </div> -->
            </div>
          </div>

          <!-- Image Side -->
          <div class="relative min-h-[300px] lg:min-h-full hidden md:block">
            <img 
              src="https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=2070&auto=format&fit=crop" 
              alt="Premium Laundry Shop" 
              class="absolute inset-0 w-full h-full object-cover rounded-b-[2rem] lg:rounded-l-none lg:rounded-r-[3rem] opacity-90 mix-blend-luminosity"
            />
            <div class="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#1a365d] dark:from-gray-900 to-transparent"></div>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>
