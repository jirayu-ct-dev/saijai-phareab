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
  title: 'ใส่ใจผ้าเรียบ - บริการซักรีดพรีเมียมที่คุณไว้วางใจ',
  description: 'บริการซักรีดที่เน้นความประณีตและความสะอาด เพื่อผ้าที่เรียบเนี้ยบระดับพรีเมียม สั่งงานง่ายผ่าน LINE',
  ogTitle: 'ใส่ใจผ้าเรียบ - บริการซักรีดพรีเมียม',
  ogDescription: 'ใส่ใจทุกเส้นใย คืนความเนี้ยบให้เสื้อผ้าคุณ สั่งซักรีดออนไลน์ได้ทันที',
})
</script>

<template>
  <div class="min-h-screen">
    <!-- LIFF Loading State -->
    <div v-if="showLiffLoading" class="min-h-screen flex items-center justify-center px-6">
      <div class="text-center">
        <div class="inline-block h-10 w-10 rounded-full border-4 border-gray-200 border-t-[#1a365d] animate-spin" />
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">กำลังเตรียมการเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else>
      <HomeHero />
      <HomeWhyChooseUs />
      <HomeHowItWorks />
      <HomePricing />
      <HomePackages id="packages" />
      <HomeFAQ />
      <HomeContact id="contact" />
    </div>
  </div>
</template>
