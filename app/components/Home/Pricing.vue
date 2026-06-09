<script setup lang="ts">
type ShopSettings = {
  washFoldPricePerKg?: number | null;
};

type PricingItem = {
  id: string;
  name: string;
  categoryId?: string | null;
};

type PricingService = {
  id: string;
  name: string;
};

type PricingCategory = {
  id: string;
  name: string;
};

type PricingPrice = {
  storefrontItemId: string;
  storefrontServiceId: string;
  price: number;
  priceMin?: number | null;
  priceMax?: number | null;
};

type PricingResponse = {
  items: PricingItem[];
  services: PricingService[];
  prices: PricingPrice[];
  categories: PricingCategory[];
};

type PreviewPricingItem = {
  id: string;
  name: string;
  categoryName: string;
  prices: {
    serviceId: string;
    serviceName: string;
    value: string;
  }[];
};

const { data: shopSettings } = useFetch<ShopSettings>("/api/public/shop-settings", {
  key: "home-pricing-shop-settings",
  lazy: true,
});

const { data: pricingData, pending: pricingPending, error: pricingError } = useFetch<PricingResponse>("/api/public/pricing", {
  key: "home-pricing-preview",
  lazy: true,
  default: () => ({
    items: [],
    services: [],
    prices: [],
    categories: [],
  }),
});

const washFoldPrice = computed(() => shopSettings.value?.washFoldPricePerKg ?? 60);

const formatPrice = (priceRecord: PricingPrice | undefined) => {
  if (!priceRecord) return "-";

  const { price, priceMin, priceMax } = priceRecord;
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `฿${Number(priceMin).toLocaleString("th-TH")}-${Number(priceMax).toLocaleString("th-TH")}`;
  }

  return `฿${Number(price).toLocaleString("th-TH")}`;
};

const previewServices = computed(() => pricingData.value.services.slice(0, 3));

const previewItems = computed<PreviewPricingItem[]>(() => {
  const data = pricingData.value;

  return data.items.slice(0, 6).map((item) => {
    const category = data.categories.find((value) => value.id === item.categoryId);

    return {
      id: item.id,
      name: item.name,
      categoryName: category?.name ?? "ไม่ระบุประเภท",
      prices: previewServices.value.map((service) => {
        const priceRecord = data.prices.find(
          (price) => price.storefrontItemId === item.id && price.storefrontServiceId === service.id,
        );

        return {
          serviceId: service.id,
          serviceName: service.name,
          value: formatPrice(priceRecord),
        };
      }),
    };
  });
});

const notes = [
  "ราคาหน้าร้านใช้กับลูกค้าทั่วไป และรายการที่ไม่ได้อยู่ในสิทธิ์แพ็กเกจ",
  "รายการที่อยู่ในแพ็กเกจจะหักเครดิตตามเงื่อนไขของแพ็กเกจ",
  "ราคาบางรายการอาจเปลี่ยนตามสภาพผ้า โดยร้านจะแจ้งก่อนดำเนินการ",
];
</script>

<template>
  <section id="per-item-pricing" class="py-16 md:py-24">
    <UContainer>
      <div class="mb-10 flex flex-col justify-between gap-4 md:mb-12 md:flex-row md:items-end">
        <div class="max-w-2xl">
          <span class="mb-2 inline-block text-[13px] font-semibold tracking-wide text-primary-600 dark:text-primary-400">ราคาหน้าร้าน</span>
          <h2 class="mb-3 text-[26px] font-bold leading-[1.15] tracking-tight text-gray-900 dark:text-white md:text-[38px]">
            ดูราคาคร่าว ๆ ก่อนส่งผ้า
          </h2>
          <p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
            แสดงเฉพาะราคาตัวอย่างจากระบบ หากต้องการค้นหาตามชนิดผ้าหรือบริการทั้งหมดให้เปิดหน้าราคาหน้าร้าน
          </p>
        </div>

        <UButton
          size="lg"
          color="primary"
          variant="soft"
          to="/pricing"
          class="shrink-0 justify-center rounded-lg font-bold"
        >
          ดูราคาทั้งหมด
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="size-4" />
          </template>
        </UButton>
      </div>

      <div class="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 md:p-6">
          <div class="mb-4 flex size-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-primary-600 dark:border-gray-800 dark:bg-gray-800 dark:text-primary-400">
            <UIcon name="i-lucide-scale" class="size-5" />
          </div>
          <p class="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">บริการซักพับแบบชั่งกิโล</p>
          <div class="mt-3 flex items-baseline gap-2 text-4xl font-bold leading-none tracking-tight text-gray-900 dark:text-white">
            ฿{{ washFoldPrice }}
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">/ กิโลกรัม</span>
          </div>
          <p class="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            เหมาะสำหรับเสื้อผ้าทั่วไปที่คิดราคาตามน้ำหนักรวม และไม่รวมรายการที่ต้องคิดราคาแยกชิ้น
          </p>
          <UButton
            to="/pricing"
            variant="outline"
            color="neutral"
            class="mt-5 w-full justify-center rounded-lg font-bold"
          >
            ดูรายละเอียดราคา
          </UButton>
        </div>

        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <div>
              <h3 class="m-0 text-base font-semibold text-gray-900 dark:text-white">ตัวอย่างราคาซักแยกชิ้น</h3>
              <p class="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">แสดงบางรายการจากราคาหน้าร้าน</p>
            </div>
            <UBadge color="neutral" variant="outline" class="rounded-full bg-white px-3 py-1 font-medium dark:bg-gray-900">
              บาท/ชิ้น
            </UBadge>
          </div>

          <div v-if="pricingPending" class="grid gap-1 p-2 sm:grid-cols-2">
            <div
              v-for="i in 6"
              :key="`home-pricing-skeleton-${i}`"
              class="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            >
              <USkeleton class="h-4 w-32 rounded-lg" />
              <USkeleton class="mt-2 h-3 w-20 rounded-lg" />
              <div class="mt-3 flex gap-1.5">
                <USkeleton class="h-6 w-20 rounded-lg" />
                <USkeleton class="h-6 w-20 rounded-lg" />
              </div>
            </div>
          </div>

          <div v-else-if="pricingError" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            โหลดข้อมูลราคาไม่สำเร็จ
          </div>

          <div v-else-if="previewItems.length === 0" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            ยังไม่มีข้อมูลราคาซักแยกชิ้น
          </div>

          <div v-else class="grid gap-1 p-2 sm:grid-cols-2">
            <article
              v-for="item in previewItems"
              :key="item.id"
              class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ item.name }}</p>
                  <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{{ item.categoryName }}</p>
                </div>
              </div>
              <div class="mt-3 flex min-w-0 flex-wrap gap-1.5">
                <span
                  v-for="price in item.prices"
                  :key="price.serviceId"
                  class="inline-flex min-w-0 items-baseline gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-800/70"
                >
                  <span class="max-w-20 truncate text-[10px] text-gray-500 dark:text-gray-400">{{ price.serviceName }}</span>
                  <span class="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">{{ price.value }}</span>
                </span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="mt-3 grid gap-1 md:grid-cols-3">
        <div
          v-for="note in notes"
          :key="note"
          class="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        >
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>{{ note }}</span>
        </div>
      </div>
    </UContainer>
  </section>
</template>
