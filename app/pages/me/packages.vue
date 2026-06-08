<script setup lang="ts">
import { formatCurrency } from "~~/shared/utils/format";
import { packageTypeColors, packageTypeLabels } from "~~/shared/config/packageConfig";
import type { PackageType } from "~~/shared/types/enums";

type PublicPackage = {
  id: string;
  name: string;
  description: string | null;
  packageType: PackageType;
  price: number;
  credits: number;
  validityDays: number | null;
  features: string[];
};

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: packages, pending, status, error, refresh } = useFetch<PublicPackage[]>("/api/public/packages", {
  default: () => [],
  server: false,
  lazy: true,
});
const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
});

const isLoading = computed(() => pending.value || status.value === "idle");
const showSkeleton = computed(() => !hydrated.value || isLoading.value);

const mainPackages = computed(() => packages.value.filter((pkg) => pkg.packageType === "MAIN"));
const addonPackages = computed(() => packages.value.filter((pkg) => pkg.packageType === "ADDON"));

const lineUrl = "https://line.me/R/ti/p/@883vmdct";

const getAveragePrice = (pkg: PublicPackage) => {
  if (!pkg.credits) return "-";
  return `${Math.round(pkg.price / pkg.credits).toLocaleString("th-TH")} บาท / ชิ้น`;
};

const getValidityText = (pkg: PublicPackage) => pkg.validityDays ? `${pkg.validityDays} วัน` : "ตามเงื่อนไขร้าน";
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="แพ็กเกจบริการ" icon="i-lucide-package">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UIButtonRefresh
              class="shrink-0 border-default/40 bg-elevated/60 text-toned hover:bg-elevated"
              :loading="isLoading"
              @refresh="refresh"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-3 p-2 sm:p-6">
          <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div class="min-w-0">
                <p class="text-base font-semibold text-highlighted">เลือกแพ็กเกจที่เหมาะกับการใช้งานของคุณ</p>
                <p class="mt-1 text-sm text-muted">
                  แพ็กเกจใช้สำหรับรายการที่อยู่ในสิทธิ์แพ็กเกจเท่านั้น รายการนอกสิทธิ์จะคิดตามราคาหน้าร้าน
                </p>
              </div>
              <UButton
                label="เพิ่มเพื่อน LINE"
                icon="i-simple-icons-line"
                color="primary"
                variant="soft"
                :to="lineUrl"
                target="_blank"
                class="shrink-0 justify-center"
              />
            </div>
          </section>

          <template v-if="showSkeleton">
            <section class="flex flex-col gap-1">
              <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <div class="flex items-center gap-2">
                  <USkeleton class="size-8 rounded-lg" />
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <USkeleton class="h-4 w-40 rounded-lg" />
                    <USkeleton class="h-3 w-64 max-w-full rounded-lg" />
                  </div>
                </div>
              </div>
              <div class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="i in 3"
                  :key="`main-package-skeleton-${i}`"
                  class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
                >
                  <div class="space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0 flex-1 space-y-1.5">
                        <USkeleton class="h-5 w-32 rounded-lg" />
                        <USkeleton class="h-3 w-24 rounded-lg" />
                      </div>
                      <USkeleton class="h-5 w-20 rounded-full" />
                    </div>
                    <USkeleton class="h-8 w-28 rounded-lg" />
                    <div class="space-y-2 border-t border-default/30 pt-3 dark:border-default/20">
                      <USkeleton v-for="j in 4" :key="`main-package-skeleton-line-${i}-${j}`" class="h-4 w-full rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-1">
              <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <div class="flex items-center gap-2">
                  <USkeleton class="size-8 rounded-lg" />
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <USkeleton class="h-4 w-32 rounded-lg" />
                    <USkeleton class="h-3 w-72 max-w-full rounded-lg" />
                  </div>
                </div>
              </div>
              <div class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="i in 2"
                  :key="`addon-package-skeleton-${i}`"
                  class="border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
                >
                  <div class="space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0 flex-1 space-y-1.5">
                        <USkeleton class="h-5 w-40 rounded-lg" />
                        <USkeleton class="h-3 w-48 rounded-lg" />
                      </div>
                      <USkeleton class="h-5 w-20 rounded-full" />
                    </div>
                    <USkeleton class="h-8 w-28 rounded-lg" />
                    <div class="grid grid-cols-2 gap-2">
                      <USkeleton class="h-16 rounded-lg" />
                      <USkeleton class="h-16 rounded-lg" />
                    </div>
                    <div class="space-y-2 border-t border-default/30 pt-3 dark:border-default/20">
                      <USkeleton v-for="j in 3" :key="`addon-package-skeleton-line-${i}-${j}`" class="h-4 w-full rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="error">
            <section class="-mx-2 flex flex-col items-center justify-center border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30 sm:mx-0 sm:rounded-lg">
              <UIcon name="i-lucide-alert-circle" class="mb-3 size-10 opacity-60" />
              <p class="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูลแพ็กเกจ</p>
              <UButton label="ลองใหม่" icon="i-lucide-refresh-cw" color="neutral" variant="outline" class="mt-3" @click="refresh()" />
            </section>
          </template>

          <template v-else-if="!packages.length">
            <section class="-mx-2 flex flex-col items-center justify-center border border-dashed border-default/30 bg-default/55 px-3 py-8 text-center text-muted dark:border-default/20 dark:bg-elevated/30 sm:mx-0 sm:rounded-lg">
              <UIcon name="i-lucide-package-x" class="mb-3 size-10 opacity-60" />
              <p class="text-sm">ยังไม่มีแพ็กเกจเปิดให้บริการในขณะนี้</p>
            </section>
          </template>

          <template v-else>
            <section v-if="mainPackages.length" class="flex flex-col gap-1">
              <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <div class="flex items-center gap-2">
                  <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-default/30 bg-elevated/30 text-primary dark:border-default/20 dark:bg-default/80">
                    <UIcon name="i-lucide-award" class="size-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-base font-semibold text-highlighted">แพ็กเกจรายเดือน</p>
                    <p class="mt-0.5 text-sm text-muted">เครดิตสำหรับบริการที่อยู่ในสิทธิ์แพ็กเกจ</p>
                  </div>
                </div>
              </div>

              <div class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2 lg:grid-cols-3">
                <article
                  v-for="pkg in mainPackages"
                  :key="pkg.id"
                  class="flex min-h-full flex-col border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-base font-semibold text-highlighted">{{ pkg.name }}</p>
                      <p class="mt-1 text-sm text-muted">{{ pkg.description || "แพ็กเกจดูแลเสื้อผ้ารายเดือน" }}</p>
                    </div>
                    <UBadge :color="packageTypeColors[pkg.packageType]" variant="subtle" class="shrink-0">
                      {{ packageTypeLabels[pkg.packageType] }}
                    </UBadge>
                  </div>

                  <div class="mt-4 flex items-baseline gap-1">
                    <span class="text-2xl font-semibold leading-none tabular-nums text-highlighted">{{ formatCurrency(pkg.price) }}</span>
                    <span class="text-sm text-muted">/ {{ getValidityText(pkg) }}</span>
                  </div>

                  <div class="mt-4 grid grid-cols-2 gap-2">
                    <div class="rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25">
                      <p class="text-[11px] text-muted">เครดิต</p>
                      <p class="mt-1 text-sm font-semibold text-highlighted">{{ pkg.credits }} ชิ้น</p>
                    </div>
                    <div class="rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25">
                      <p class="text-[11px] text-muted">เฉลี่ย</p>
                      <p class="mt-1 text-sm font-semibold text-highlighted">{{ getAveragePrice(pkg) }}</p>
                    </div>
                  </div>

                  <ul class="mt-4 flex-1 space-y-2 border-t border-default/30 pt-4 dark:border-default/20">
                    <li
                      v-for="feature in pkg.features"
                      :key="feature"
                      class="flex items-start gap-2 text-sm text-muted"
                    >
                      <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-primary" />
                      <span class="min-w-0">{{ feature }}</span>
                    </li>
                  </ul>

                  <UButton
                    label="สนใจแพ็กเกจนี้"
                    icon="i-simple-icons-line"
                    color="primary"
                    variant="soft"
                    block
                    :to="lineUrl"
                    target="_blank"
                    class="mt-4"
                  />
                </article>
              </div>
            </section>

            <section v-if="addonPackages.length" class="flex flex-col gap-1">
              <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
                <div class="flex items-center gap-2">
                  <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-default/30 bg-elevated/30 text-primary dark:border-default/20 dark:bg-default/80">
                    <UIcon name="i-lucide-plus-circle" class="size-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-base font-semibold text-highlighted">แพ็กเกจเสริม</p>
                    <p class="mt-0.5 text-sm text-muted">บริการเสริมที่ใช้ร่วมกับแพ็กเกจหลักหรือตามเงื่อนไขร้าน</p>
                  </div>
                </div>
              </div>

              <div class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 md:grid-cols-2 lg:grid-cols-3">
                <article
                  v-for="pkg in addonPackages"
                  :key="pkg.id"
                  class="flex min-h-full flex-col border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-base font-semibold text-highlighted">{{ pkg.name }}</p>
                      <p class="mt-1 text-sm text-muted">{{ pkg.description || "บริการอำนวยความสะดวกเพิ่มเติม" }}</p>
                    </div>
                    <UBadge :color="packageTypeColors[pkg.packageType]" variant="subtle" class="shrink-0">
                      {{ packageTypeLabels[pkg.packageType] }}
                    </UBadge>
                  </div>

                  <div class="mt-4 flex items-baseline gap-1">
                    <span class="text-2xl font-semibold leading-none tabular-nums text-highlighted">{{ formatCurrency(pkg.price) }}</span>
                    <span class="text-sm text-muted">/ {{ getValidityText(pkg) }}</span>
                  </div>

                  <div class="mt-4 grid grid-cols-2 gap-2">
                    <div class="rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25">
                      <p class="text-[11px] text-muted">ประเภท</p>
                      <p class="mt-1 text-sm font-semibold text-highlighted">{{ packageTypeLabels[pkg.packageType] }}</p>
                    </div>
                    <div class="rounded-lg border border-default/25 bg-elevated/30 p-3 dark:border-default/15 dark:bg-elevated/25">
                      <p class="text-[11px] text-muted">ระยะเวลา</p>
                      <p class="mt-1 text-sm font-semibold text-highlighted">{{ getValidityText(pkg) }}</p>
                    </div>
                  </div>

                  <ul class="mt-4 flex-1 space-y-2 border-t border-default/30 pt-4 dark:border-default/20">
                    <li
                      v-for="feature in pkg.features"
                      :key="feature"
                      class="flex items-start gap-2 text-sm text-muted"
                    >
                      <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-primary" />
                      <span class="min-w-0">{{ feature }}</span>
                    </li>
                  </ul>

                  <UButton
                    label="สนใจแพ็กเกจนี้"
                    icon="i-simple-icons-line"
                    color="primary"
                    variant="soft"
                    block
                    :to="lineUrl"
                    target="_blank"
                    class="mt-4"
                  />
                </article>
              </div>
            </section>
          </template>

          <section class="-mx-2 overflow-hidden border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex items-center gap-2 border-b border-default/40 p-4 dark:border-default/20">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/25 bg-warning/10 text-warning">
                <UIcon name="i-lucide-info" class="size-4" />
              </div>
              <p class="text-sm font-semibold text-highlighted">เงื่อนไขการซื้อแพ็กเกจ</p>
            </div>
            <div class="space-y-0">
              <div class="flex items-start gap-3 border-b border-default/30 p-4 text-sm text-muted last:border-b-0 dark:border-default/20">
                <span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
                <span class="min-w-0">หากต้องการซื้อแพ็กเกจ กรุณาติดต่อร้านผ่าน LINE เพื่อให้พนักงานตรวจสอบและเปิดสิทธิ์ให้</span>
              </div>
              <div class="flex items-start gap-3 border-b border-default/30 p-4 text-sm text-muted last:border-b-0 dark:border-default/20">
                <span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
                <span class="min-w-0">แพ็กเกจใช้ได้เฉพาะรายการที่อยู่ในสิทธิ์แพ็กเกจ รายการนอกสิทธิ์จะคิดตามราคาหน้าร้าน</span>
              </div>
            </div>
          </section>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
