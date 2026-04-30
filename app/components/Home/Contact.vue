<template>
  <section id="contact" class="py-24 bg-gray-50 dark:bg-gray-950">
    <UContainer>
      <div class="bg-[#1a365d] rounded-[3rem] p-8 md:p-16 text-center text-white overflow-hidden relative">
        <!-- Background Ornaments -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div class="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full -ml-32 -mb-32 blur-3xl" />

        <div class="relative z-10 max-w-3xl mx-auto space-y-8">
          <h2 class="text-3xl md:text-5xl font-bold leading-tight">
            พร้อมรับความเนี้ยบ <br />
            ถึงหน้าบ้านคุณแล้วหรือยัง?
          </h2>
          <p class="text-blue-100/70 text-lg md:text-xl">
            ทักแชทสั่งงาน หรือสอบถามข้อมูลเพิ่มเติมได้ทันที พนักงานของเราพร้อมให้บริการคุณด้วยความใส่ใจ
          </p>
          
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <UButton
              size="xl"
              color="primary"
              class="px-10 py-4 rounded-full font-bold text-lg w-full sm:w-auto transition-transform hover:scale-105"
              to="/login"
            >
              <template #leading>
                <UIcon name="i-lucide-message-circle" class="w-6 h-6" />
              </template>
              สั่งซักรีดผ่าน LINE
            </UButton>
            
            <UButton
              size="xl"
              variant="outline"
              class="px-10 py-4 rounded-full font-bold text-lg w-full sm:w-auto border-white/20 text-white hover:bg-white/10"
              to="tel:02-123-4567"
            >
              <template #leading>
                <UIcon name="i-lucide-phone" class="w-6 h-6" />
              </template>
              โทร: 02-123-4567
            </UButton>
          </div>

          <div class="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 border-t border-white/10 mt-12">
            <div>
              <p class="text-blue-200/50 text-sm mb-1 uppercase tracking-widest font-bold">Location</p>
              <p class="font-medium">ถ.สุขุมวิท, กรุงเทพมหานคร</p>
            </div>
            <div>
              <p class="text-blue-200/50 text-sm mb-1 uppercase tracking-widest font-bold">Hours</p>
              <p class="font-medium">จันทร์ - เสาร์: 08:00 - 20:00</p>
            </div>
            <div>
              <p class="text-blue-200/50 text-sm mb-1 uppercase tracking-widest font-bold">Social</p>
              <p class="font-medium">Line: @saijai_phareab</p>
            </div>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>
