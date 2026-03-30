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
</script>

<template>
  <div>


    <div v-if="showLiffLoading" class="min-h-screen flex items-center justify-center px-6">
      <div class="text-center">
        <div class="inline-block h-10 w-10 rounded-full border-4 border-gray-200 border-t-green-500 animate-spin" />
        <p class="mt-4 text-sm text-gray-600">กำลังเตรียมการเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    </div>

    <div v-else>
      <HomeHero />
      <HomeHowItWorks />
      <HomeWhyChooseUs />
      <HomePricing />
      <HomePackages />
      <HomeFAQ />
      <HomeContact />
    </div>

  </div>
</template>
