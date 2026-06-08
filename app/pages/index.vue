<script setup lang="ts">
const {
  handleLiffAutoLogin,
  isLiffBootstrapping,
  isPotentialLiffClient,
  isInLiffClient,
  isLiffCheckCompleted
} = useLiffAuth();
const { session } = useUser();

const showLiffLoading = computed(() => {
  if (session.value?.user) {
    return false;
  }

  if (!isPotentialLiffClient.value) {
    return false;
  }

  if (!isLiffCheckCompleted.value) {
    return true;
  }

  return isInLiffClient.value && isLiffBootstrapping.value;
});

onMounted(async () => {
  if (session.value?.user) {
    return;
  }

  await handleLiffAutoLogin();
});

useSeoMeta({
  title: 'ใส่ใจผ้าเรียบ - ซัก อบ รีด พร้อมติดตามรายการผ่าน LINE',
  description: 'บริการซัก อบ รีด ดูราคาหน้าร้าน ซื้อแพ็กเกจ ติดตามออเดอร์ และรับใบเสร็จผ่านระบบสมาชิก',
  ogTitle: 'ใส่ใจผ้าเรียบ - บริการซัก อบ รีด',
  ogDescription: 'ดูราคา ติดต่อร้าน ติดตามสถานะผ้า และรับแจ้งเตือนผ่าน LINE',
})
</script>

<template>
  <div class="min-h-screen">
    <!-- LIFF Loading Overlay (fixed ทับ ไม่กั้น DOM render) -->
    <Transition name="fade">
      <div
        v-if="showLiffLoading"
        class="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex items-center justify-center"
      >
        <div class="text-center">
          <div class="inline-block h-10 w-10 rounded-full border-4 border-gray-200 border-t-[#1a365d] animate-spin" />
          <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">กำลังเตรียมการเข้าสู่ระบบผ่าน LINE...</p>
        </div>
      </div>
    </Transition>

    <!-- Main Content — render ทันที ไม่รอ LIFF -->
    <HomeHero />
    <HomeWhyChooseUs />
    <HomeHowItWorks />
    <HomePricing />
    <HomePackages />
    <HomeFAQ />
    <HomeContact />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

