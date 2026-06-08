<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";

const props = withDefaults(defineProps<{
  embedded?: boolean;
  clientSkeleton?: boolean;
}>(), {
  embedded: false,
  clientSkeleton: false,
});

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
type PricingCell = {
  serviceId: string;
  serviceName: string;
  value: string;
};
type PricingRow = {
  id: string;
  item: string;
  categoryId: string | null;
  categoryName: string;
  prices: PricingCell[];
  [key: string]: string | PricingCell[] | null;
};

const { data: pricingData, pending, status, error, refresh } = useFetch<PricingResponse>("/api/public/pricing", {
  server: !props.clientSkeleton,
  lazy: props.clientSkeleton,
});
const search = ref("");
const filterCategory = ref("all");
const filterService = ref("all");
const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
});

const isLoading = computed(() => pending.value || status.value === "idle");
const showSkeleton = computed(() => props.clientSkeleton ? !hydrated.value || isLoading.value : pending.value);

const formatPrice = (priceRecord: PricingPrice | undefined) => {
  if (!priceRecord) return "-";

  const { price, priceMin, priceMax } = priceRecord;
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `฿${Number(priceMin).toLocaleString()}-${Number(priceMax).toLocaleString()}`;
  }
  return `฿${Number(price).toLocaleString()}`;
};

const services = computed(() => pricingData.value?.services ?? []);
const categories = computed(() => pricingData.value?.categories ?? []);
const categoryOptions = computed(() => [
  { id: "all", name: "ประเภทผ้าทั้งหมด" },
  ...categories.value,
]);
const serviceOptions = computed(() => [
  { id: "all", name: "บริการทั้งหมด" },
  ...services.value,
]);
const visibleServices = computed(() => {
  if (filterService.value === "all") return services.value;
  return services.value.filter((service) => service.id === filterService.value);
});

const rows = computed<PricingRow[]>(() => {
  const data = pricingData.value;
  if (!data?.items || !data.prices) return [];

  return data.items.map((item) => {
    const category = categories.value.find((value) => value.id === item.categoryId);
    const row: PricingRow = {
      id: item.id,
      item: item.name,
      categoryId: item.categoryId ?? null,
      categoryName: category?.name ?? "ไม่ระบุประเภท",
      prices: [],
    };

    visibleServices.value.forEach((service) => {
      const priceRecord = data.prices.find(
        (price) => price.storefrontItemId === item.id && price.storefrontServiceId === service.id,
      );
      const value = formatPrice(priceRecord);
      row[service.id] = value;
      row.prices.push({
        serviceId: service.id,
        serviceName: service.name,
        value,
      });
    });

    return row;
  });
});

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    if (query && !row.item.toLowerCase().includes(query) && !row.categoryName.toLowerCase().includes(query)) {
      return false;
    }
    if (filterCategory.value !== "all" && row.categoryId !== filterCategory.value) {
      return false;
    }
    return true;
  });
});

const columns = computed<TableColumn<PricingRow>[]>(() => [
  {
    accessorKey: "item",
    header: "รายการผ้า",
  },
  ...visibleServices.value.map<TableColumn<PricingRow>>((service) => ({
    accessorKey: service.id,
    header: service.name,
  })),
]);
</script>

<template>
  <div
    :class="embedded
      ? 'contents'
      : 'block overflow-hidden border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg'"
  >
    <div
      v-if="!error"
      class="-mx-2 mb-1 space-y-2 border border-default/30 bg-default p-2 px-3! py-3! dark:border-default/40 dark:bg-default/80 sm:mx-0 sm:rounded-lg md:flex md:items-center md:justify-between md:gap-3 md:space-y-0"
    >
      <div class="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
        <UInput
          v-model="search"
          class="min-w-0 flex-1"
          icon="i-lucide-search"
          placeholder="ค้นหารายการผ้า..."
          :disabled="isLoading || rows.length === 0"
        />
        <UIButtonRefresh
          class="shrink-0 border-default/40 bg-elevated/60 text-toned hover:bg-elevated md:hidden"
          :loading="isLoading"
          @refresh="refresh"
        />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
        <USelect
          v-model="filterCategory"
          :items="categoryOptions"
          label-key="name"
          value-key="id"
          class="min-w-0 sm:w-44"
          aria-label="กรองประเภทผ้า"
          :disabled="isLoading || rows.length === 0"
        />
        <USelect
          v-model="filterService"
          :items="serviceOptions"
          label-key="name"
          value-key="id"
          class="min-w-0 sm:w-40"
          aria-label="กรองบริการ"
          :disabled="isLoading || rows.length === 0"
        />
        <UIButtonRefresh
          class="hidden shrink-0 border-default/40 bg-elevated/60 text-toned hover:bg-elevated md:inline-flex"
          :loading="isLoading"
          @refresh="refresh"
        />
      </div>
    </div>

    <div v-if="showSkeleton" class="space-y-2">
      <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
        <div
          v-for="i in 5"
          :key="`mobile-pricing-skeleton-${i}`"
          class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
        >
          <div class="px-3 py-2.5">
            <div class="min-w-0 space-y-1.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1 space-y-1">
                  <USkeleton class="h-3.5 w-36 rounded-lg" />
                  <USkeleton class="h-2.5 w-24 rounded-lg" />
                </div>
                <USkeleton class="h-4 w-16 rounded-full" />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <USkeleton class="h-6 w-24 rounded-lg" />
                <USkeleton class="h-6 w-24 rounded-lg" />
                <USkeleton class="h-6 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="hidden rounded-lg border border-default/30 bg-default p-0! dark:border-default/20 dark:bg-elevated/55 md:block">
        <div class="space-y-2 p-3">
          <USkeleton v-for="i in 8" :key="`desktop-pricing-skeleton-${i}`" class="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center px-3 py-8 text-center text-muted">
      <UIcon name="i-lucide-alert-circle" class="mb-2 size-10 opacity-60" />
      <p class="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูลราคา</p>
    </div>

    <div v-else-if="filteredRows.length === 0" class="flex flex-col items-center justify-center px-3 py-8 text-center text-muted">
      <UIcon name="i-lucide-search" class="mb-2 size-10 opacity-60" />
      <p class="text-sm">ไม่พบข้อมูลราคา</p>
    </div>

    <template v-else>
      <div class="-mx-2 space-y-1 sm:mx-0 md:hidden">
        <div
          v-for="row in filteredRows"
          :key="row.id"
          class="overflow-hidden border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
        >
          <div class="px-3 py-2.5">
            <div class="min-w-0">
              <div class="flex min-w-0 items-start justify-between gap-2">
                <p class="truncate text-sm font-medium text-highlighted">{{ row.item }}</p>
                <UBadge variant="subtle" color="primary" size="xs" class="shrink-0">
                  {{ row.categoryName }}
                </UBadge>
              </div>
              <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  v-for="price in row.prices"
                  :key="price.serviceId"
                  class="inline-flex min-w-0 items-baseline gap-1 rounded-lg border border-default/25 bg-elevated/30 px-2 py-1 dark:border-default/15 dark:bg-elevated/25"
                >
                  <span class="max-w-24 truncate text-[10px] text-muted">{{ price.serviceName }}</span>
                  <span class="text-xs font-semibold tabular-nums text-highlighted">{{ price.value }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="hidden overflow-x-auto md:block"
        :class="embedded ? 'rounded-lg border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55' : ''"
      >
        <UTable
          :columns="columns"
          :data="filteredRows"
          class="w-full"
          :ui="{
            root: 'relative overflow-x-auto',
            base: 'table-fixed border-separate border-spacing-0',
            thead: 'sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45',
            th: 'border-b border-default bg-default py-2.5 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80',
            td: 'border-b border-default py-2.5 text-sm transition-colors dark:border-default/25',
            separator: 'h-0',
          }"
        >
          <template #item-cell="{ row }">
            <span class="font-medium text-highlighted">{{ row.original.item }}</span>
          </template>
          <template #empty>
            <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
              <UIcon name="i-lucide-search" class="mb-3 size-10 opacity-60" />
              <span>ไม่พบรายการ</span>
            </div>
          </template>
        </UTable>
      </div>
    </template>
  </div>
</template>
