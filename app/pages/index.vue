<script setup lang="ts">
const { handleLiffAutoLogin } = useLiffAuth();
const { session } = useUser();

onMounted(async () => {
  if (session.value?.user) {
    return;
  }

  await handleLiffAutoLogin();
});
</script>

<template>
  <div>
    <HomeHero />
    <HomeHowItWorks />
    <HomeWhyChooseUs />
    <HomePricing />
    <HomePackages />
    <HomeFAQ />
    <HomeContact />
  </div>
</template>
