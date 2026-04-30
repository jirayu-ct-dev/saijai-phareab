<script setup lang="ts">
const { session } = useUser();
</script>

<template>
  <section class="relative min-h-[90vh] flex items-center overflow-hidden">
    <!-- Background with Gradient & Image Overlay -->
    <div class="absolute inset-0 bg-[#1a365d] z-0">
      <div class="absolute inset-0 bg-gradient-to-r from-[#1a365d] via-[#1a365d]/90 to-transparent z-10" />
      <img 
        src="https://images.unsplash.com/photo-1545173168-9f1947eebb7f?q=80&w=2071&auto=format&fit=crop" 
        alt="Premium Laundry" 
        class="absolute inset-0 w-full h-full object-cover opacity-30 object-right"
      />
    </div>

    <UContainer class="relative z-20 w-full py-20">
      <div class="max-w-2xl space-y-8">
        <div class="space-y-4">
          <UBadge color="primary" variant="subtle" size="lg" class="px-4 py-1 text-xs tracking-widest uppercase font-bold">
            Premium Ironing & Laundry
          </UBadge>
          <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1]">
            ใส่ใจทุกเส้นใย <br />
            <span class="text-[#d4af37]">คืนความเนี้ยบ</span> <br />
            ให้เสื้อผ้าคุณ
          </h1>
          <p class="text-lg md:text-xl text-gray-300 max-w-lg leading-relaxed">
            สัมผัสประสบการณ์ซักรีดที่เหนือระดับ ด้วยความประณีตและการดูแลที่พิถีพิถัน เพื่อให้เสื้อผ้าชุดโปรดของคุณดูดีที่สุดเสมอ
          </p>
        </div>

        <div class="flex flex-wrap gap-4 pt-4">
          <UButton
            v-if="!session?.user"
            size="xl"
            color="primary"
            class="px-8 font-bold rounded-full transition-transform hover:scale-105"
            to="/login"
          >
            <template #leading>
              <UIcon name="i-lucide-message-circle" class="w-5 h-5" />
            </template>
            เข้าสู่ระบบด้วย LINE
          </UButton>
          <UButton
            v-else
            size="xl"
            color="primary"
            class="px-8 font-bold rounded-full transition-transform hover:scale-105"
            to="/dashboard"
          >
            ไปที่หน้าจัดการ
          </UButton>
          
          <UButton
            size="xl"
            variant="ghost"
            class="px-8 font-bold text-white hover:bg-white/10 rounded-full"
            to="#pricing"
          >
            ดูอัตราค่าบริการ
          </UButton>
        </div>

        <!-- Trust Badges -->
        <div class="pt-8 flex items-center gap-8 text-gray-400">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-shield-check" class="w-6 h-6" />
            <span class="text-sm font-medium">รับประกันความเสียหาย</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-clock" class="w-6 h-6" />
            <span class="text-sm font-medium">ตรงต่อเวลา</span>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>
