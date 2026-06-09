<script setup lang="ts">
type PublicPackage = {
  id: string;
  name: string;
  description: string | null;
  packageType: "MAIN" | "ADDON" | string;
  price: number;
  credits: number | null;
  validityDays: number | null;
  features: string[];
};

const { data: packages, pending, error } = useFetch<PublicPackage[]>("/api/public/packages", {
  key: "home-public-packages",
  lazy: true,
  default: () => [],
});

const formatPrice = (price: number) => new Intl.NumberFormat("th-TH").format(price);

const mainPackages = computed(() => {
  if (!packages.value) return [];
  return packages.value.filter(p => p.packageType !== 'ADDON').slice(0, 3);
});

const addonPackages = computed(() => {
  if (!packages.value) return [];
  return packages.value.filter(p => p.packageType === 'ADDON');
});
const featuredAddonPackages = computed(() => addonPackages.value.slice(0, 1));

const getPreviewFeatures = (pkg: PublicPackage) => pkg.features.slice(0, 4);

const getPackageLabel = (index: number) => {
  const labels = ['แพ็กเกจหลัก', 'แพ็กเกจหลัก', 'แพ็กเกจหลัก'];
  return labels[index] || '';
};

const mainPackageSlider = ref<HTMLElement | null>(null);
const activePackageIndex = ref(0);

const updatePackageSliderState = () => {
  const el = mainPackageSlider.value;
  if (!el) {
    activePackageIndex.value = 0;
    return;
  }

  const cards = Array.from(el.children) as HTMLElement[];
  const current = cards.reduce((best, card, index) => {
    const distance = Math.abs(card.offsetLeft - el.scrollLeft);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Number.POSITIVE_INFINITY });
  activePackageIndex.value = current.index;
};

const goToMainPackage = (index: number) => {
  const el = mainPackageSlider.value;
  const target = el?.children.item(index) as HTMLElement | null;
  if (!el || !target) return;

  el.scrollTo({
    left: target.offsetLeft,
    behavior: "smooth",
  });
};

onMounted(async () => {
  await nextTick();
  updatePackageSliderState();
});

watch(mainPackages, async () => {
  await nextTick();
  updatePackageSliderState();
});
</script>

<template>
  <section id="monthly-membership" class="py-16 md:py-24">
    <UContainer>
      <!-- Header -->
      <div class="mb-10 flex flex-col justify-between gap-4 md:mb-12 md:flex-row md:items-end">
        <div class="max-w-2xl">
          <span class="inline-block text-blue-400 font-semibold text-[13px] tracking-[0.2em] uppercase mb-3">แพ็กเกจบริการ</span>
          <h2 class="text-[32px] md:text-[44px] font-bold text-gray-900 dark:text-white leading-[1.2] mb-4">
            ตัวอย่างแพ็กเกจที่ร้านเปิดให้บริการ
          </h2>
          <p class="text-lg text-gray-500 dark:text-gray-400">
            แพ็กเกจเหมาะกับลูกค้าที่ใช้บริการเป็นประจำ และใช้ได้เฉพาะรายการที่อยู่ในสิทธิ์แพ็กเกจ
          </p>
        </div>
        <UButton
          size="lg"
          color="primary"
          variant="soft"
          to="/packages"
          class="shrink-0 justify-center rounded-lg font-bold"
        >
          ดูแพ็กเกจทั้งหมด
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="size-4" />
          </template>
        </UButton>
      </div>

      <!-- Main Packages Slider -->
      <div v-if="pending" class="mb-16">
        <div class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
          <UCard
            v-for="i in 3"
            :key="i"
            class="h-120 min-w-[82vw] max-w-[420px] shrink-0 snap-start animate-pulse rounded-lg border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900/50 sm:min-w-[360px] lg:min-w-0 lg:max-w-none lg:snap-align-none"
          />
        </div>
      </div>

      <div v-else-if="error" class="text-center py-12 text-red-400">
        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>

      <div v-else class="relative mb-16">
        <div class="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <p class="min-w-0 text-sm font-medium text-gray-500 dark:text-gray-400">เลื่อนดูแพ็กเกจหลักที่ร้านเปิดให้บริการ</p>
        </div>

        <div class="relative">
          <div
            ref="mainPackageSlider"
            class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:items-stretch lg:overflow-visible lg:px-0 lg:pb-0"
            @scroll="updatePackageSliderState"
          >
            <div
              v-for="(pkg, index) in mainPackages"
              :key="pkg.id"
              class="relative flex min-w-[82vw] max-w-[420px] shrink-0 snap-start flex-col rounded-lg border border-gray-200 bg-white transition-all duration-300 hover:border-gray-300 dark:border-gray-800 dark:bg-[#0f172a] dark:hover:border-gray-700 sm:min-w-[360px] lg:min-w-0 lg:max-w-none lg:snap-align-none"
            >
              <div class="flex h-full flex-col p-6 md:p-8 xl:p-10">
                <div class="mb-6">
                  <span class="text-[14px] font-medium tracking-[0.2em] text-blue-600/80 uppercase dark:text-blue-400/60">
                    {{ getPackageLabel(index) }}
                  </span>
                  <h3 class="mt-1 text-2xl font-bold text-gray-900 dark:text-white md:text-[28px]">
                    {{ pkg.name }}
                  </h3>
                </div>

                <div class="mb-8 flex items-baseline gap-1">
                  <span class="text-4xl font-bold text-gray-900 dark:text-white md:text-[44px]">฿{{ formatPrice(pkg.price) }}</span>
                  <span class="ml-1 text-[16px] text-gray-500 dark:text-gray-400">บาท</span>
                </div>

                <p class="-mt-5 mb-8 text-[14px] text-gray-500 dark:text-gray-400">ตามระยะเวลาแพ็กเกจ</p>

                <div class="mb-10 grow space-y-5">
                  <div v-for="(feature, fIndex) in getPreviewFeatures(pkg)" :key="fIndex" class="flex items-start gap-3">
                    <UIcon name="i-lucide-check" class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span class="text-[15px] leading-snug text-gray-600 dark:text-gray-300">{{ feature }}</span>
                  </div>
                  <p v-if="pkg.features.length > 4" class="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                    ดูสิทธิ์และเงื่อนไขทั้งหมดในหน้าแพ็กเกจบริการ
                  </p>
                </div>

                <UButton
                  block
                  size="xl"
                  to="/packages"
                  variant="outline"
                  class="group/btn rounded-lg border-gray-200 bg-transparent py-3 text-[15px] font-bold text-gray-900 transition-all hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-white/5 md:py-4 md:text-[16px]"
                >
                  ดูรายละเอียดแพ็กเกจ
                  <UIcon name="i-lucide-arrow-right" class="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="mainPackages.length > 1"
          class="mt-4 flex items-center justify-center gap-2 lg:hidden"
          aria-label="เลือกแพ็กเกจ"
        >
          <button
            v-for="(pkg, index) in mainPackages"
            :key="`package-dot-${pkg.id}`"
            type="button"
            class="h-2.5 rounded-full transition-all"
            :class="activePackageIndex === index ? 'w-7 bg-blue-600 dark:bg-blue-400' : 'w-2.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600'"
            :aria-label="`ดูแพ็กเกจ ${pkg.name}`"
            :aria-current="activePackageIndex === index ? 'true' : undefined"
            @click="goToMainPackage(index)"
          />
        </div>
      </div>

      <!-- Add-on Card (from API) -->
      <div v-if="!pending && featuredAddonPackages.length > 0" class="space-y-6">
        <div
          v-for="addon in featuredAddonPackages"
          :key="addon.id"
          class="flex flex-col items-center justify-between gap-8 rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-[#0f172a] dark:hover:border-gray-700 md:flex-row md:p-8"
        >
          <div class="flex items-center gap-6 flex-1 w-full md:w-auto">
            <div class="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-gray-100 dark:border-gray-800">
              <UIcon name="i-lucide-truck" class="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <span class="text-[12px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">แพ็กเกจเสริม</span>
                <span class="text-[12px] text-gray-500 font-medium">บริการเสริม</span>
              </div>
              <h4 class="text-[20px] font-bold text-gray-900 dark:text-white mb-1">{{ addon.name }}</h4>
              <p class="text-gray-500 dark:text-gray-400 text-[14px]">{{ addon.description || 'บริการเสริม เช่น แพ็กเกจบริการรับส่ง ตามเงื่อนไขที่ร้านกำหนด' }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between md:justify-end gap-8 md:gap-12 w-full md:w-auto border-t md:border-t-0 border-gray-200 dark:border-gray-800 pt-6 md:pt-0">
            <div class="text-center">
              <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">เครดิต</p>
              <p class="text-[20px] font-bold text-gray-900 dark:text-white">{{ addon.credits || 0 }}</p>
            </div>
            <div class="text-center">
              <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">อายุแพ็กเกจ</p>
              <p class="text-[20px] font-bold text-gray-900 dark:text-white">{{ addon.validityDays ? `${addon.validityDays} วัน` : 'ตามเงื่อนไข' }}</p>
            </div>
            <div class="flex flex-col items-end min-w-30">
              <div class="flex items-baseline gap-1 mb-2">
                <span class="text-[26px] font-bold text-gray-900 dark:text-white">฿{{ formatPrice(addon.price) }}</span>
                <span class="text-gray-500 text-[12px]">ตามแพ็กเกจ</span>
              </div>
              <UButton
                variant="link"
                to="/packages"
                class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold p-0 group"
              >
                ดูแพ็กเกจเสริม
                <UIcon name="i-lucide-arrow-right" class="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Delivery service inquiry fallback (shown only when no add-on package is configured) -->
      <div v-else-if="!pending" class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-800 rounded-lg p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div class="flex items-center gap-5 flex-1 w-full md:w-auto">
          <div class="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-gray-100 dark:border-gray-800">
            <UIcon name="i-lucide-truck" class="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div class="flex items-center gap-3 mb-1">
              <span class="text-[12px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">บริการรับส่ง</span>
              <span class="text-[12px] text-gray-500 font-medium">สำหรับลูกค้าที่มีแพ็กเกจ</span>
            </div>
            <h4 class="text-[20px] font-bold text-gray-900 dark:text-white mb-1">สอบถามบริการรับส่ง</h4>
            <p class="text-gray-500 dark:text-gray-400 text-[14px]">บริการรับส่งไม่ได้เปิดใช้กับทุกออเดอร์ หากต้องการใช้บริการนี้ให้สอบถามเงื่อนไข พื้นที่ และแพ็กเกจที่รองรับผ่าน LINE</p>
          </div>
        </div>

        <UButton
          size="lg"
          to="#contact"
          variant="outline"
          class="rounded-lg font-bold shrink-0 w-full justify-center md:w-auto"
        >
          สอบถามเพิ่มเติม
          <UIcon name="i-lucide-arrow-right" class="ml-1 w-4 h-4" />
        </UButton>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
/* No extra styles needed as we use Tailwind classes for all design elements */
</style>
