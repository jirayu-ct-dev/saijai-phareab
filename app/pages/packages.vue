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

const { data: packages, pending, error, refresh } = await useFetch<PublicPackage[]>("/api/public/packages", {
  key: "public-packages-page",
  default: () => [],
});

const lineUrl = "https://line.me/R/ti/p/@883vmdct";

const mainPackages = computed(() => packages.value.filter((pkg) => pkg.packageType === "MAIN"));
const addonPackages = computed(() => packages.value.filter((pkg) => pkg.packageType === "ADDON"));

const getAveragePrice = (pkg: PublicPackage) => {
  if (!pkg.credits) return "-";
  return `${Math.round(pkg.price / pkg.credits).toLocaleString("th-TH")} บาท / ชิ้น`;
};

const getValidityText = (pkg: PublicPackage) => pkg.validityDays ? `${pkg.validityDays} วัน` : "ตามเงื่อนไขร้าน";

useSeoMeta({
  title: "แพ็กเกจบริการ - ใส่ใจผ้าเรียบ",
  description: "ดูรายละเอียดแพ็กเกจหลัก แพ็กเกจเสริม ราคา เครดิต และเงื่อนไขก่อนสมัครใช้บริการ",
});
</script>

<template>
  <div class="py-12 md:py-16">
    <UContainer>
      <section class="mb-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 md:p-6">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-primary-600 dark:text-primary-400">แพ็กเกจบริการ</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
              ดูแพ็กเกจก่อนตัดสินใจสมัคร
            </h1>
            <p class="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400 md:text-base">
              แพ็กเกจใช้สำหรับรายการที่อยู่ในสิทธิ์แพ็กเกจเท่านั้น รายการนอกสิทธิ์จะคิดตามราคาหน้าร้าน
            </p>
          </div>
          <UButton
            label="ติดต่อผ่าน LINE"
            icon="i-simple-icons-line"
            color="primary"
            :to="lineUrl"
            target="_blank"
            class="shrink-0 justify-center rounded-lg"
          />
        </div>
      </section>

      <template v-if="pending">
        <section class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="i in 3"
            :key="i"
            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div class="space-y-3">
              <USkeleton class="h-5 w-32 rounded-lg" />
              <USkeleton class="h-3 w-48 rounded-lg" />
              <USkeleton class="h-8 w-28 rounded-lg" />
              <USkeleton v-for="j in 4" :key="j" class="h-4 w-full rounded-lg" />
            </div>
          </div>
        </section>
      </template>

      <section
        v-else-if="error"
        class="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-8 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
      >
        <UIcon name="i-lucide-alert-circle" class="mx-auto mb-3 size-10 opacity-60" />
        <p class="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูลแพ็กเกจ</p>
        <UButton label="ลองใหม่" icon="i-lucide-refresh-cw" color="neutral" variant="outline" class="mt-3 rounded-lg" @click="refresh()" />
      </section>

      <section
        v-else-if="!packages.length"
        class="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-8 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
      >
        <UIcon name="i-lucide-package-x" class="mx-auto mb-3 size-10 opacity-60" />
        <p class="text-sm">ยังไม่มีแพ็กเกจเปิดให้บริการในขณะนี้</p>
      </section>

      <template v-else>
        <section v-if="mainPackages.length" class="mb-8">
          <div class="mb-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div class="flex items-center gap-2">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-primary-600 dark:border-gray-800 dark:bg-gray-800 dark:text-primary-400">
                <UIcon name="i-lucide-award" class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white">แพ็กเกจหลัก</p>
                <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">เครดิตสำหรับบริการที่อยู่ในสิทธิ์แพ็กเกจ</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="pkg in mainPackages"
              :key="pkg.id"
              class="flex min-h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ pkg.name }}</p>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ pkg.description || "แพ็กเกจดูแลเสื้อผ้ารายเดือน" }}</p>
                </div>
                <UBadge :color="packageTypeColors[pkg.packageType]" variant="subtle" class="shrink-0">
                  {{ packageTypeLabels[pkg.packageType] }}
                </UBadge>
              </div>

              <div class="mt-4 flex items-baseline gap-1">
                <span class="text-2xl font-semibold leading-none tabular-nums text-gray-900 dark:text-white">{{ formatCurrency(pkg.price) }}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">/ {{ getValidityText(pkg) }}</span>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-2">
                <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/60">
                  <p class="text-[11px] text-gray-500 dark:text-gray-400">เครดิต</p>
                  <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{{ pkg.credits }} ชิ้น</p>
                </div>
                <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/60">
                  <p class="text-[11px] text-gray-500 dark:text-gray-400">เฉลี่ย</p>
                  <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{{ getAveragePrice(pkg) }}</p>
                </div>
              </div>

              <ul class="mt-4 flex-1 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <li v-for="feature in pkg.features" :key="feature" class="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-primary-600 dark:text-primary-400" />
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
                class="mt-4 rounded-lg"
              />
            </article>
          </div>
        </section>

        <section v-if="addonPackages.length" class="mb-8">
          <div class="mb-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div class="flex items-center gap-2">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-primary-600 dark:border-gray-800 dark:bg-gray-800 dark:text-primary-400">
                <UIcon name="i-lucide-plus-circle" class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white">แพ็กเกจเสริม</p>
                <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">บริการเสริมที่ใช้ตามเงื่อนไขของร้าน</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="pkg in addonPackages"
              :key="pkg.id"
              class="flex min-h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ pkg.name }}</p>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ pkg.description || "บริการอำนวยความสะดวกเพิ่มเติม" }}</p>
                </div>
                <UBadge :color="packageTypeColors[pkg.packageType]" variant="subtle" class="shrink-0">
                  {{ packageTypeLabels[pkg.packageType] }}
                </UBadge>
              </div>

              <div class="mt-4 flex items-baseline gap-1">
                <span class="text-2xl font-semibold leading-none tabular-nums text-gray-900 dark:text-white">{{ formatCurrency(pkg.price) }}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">/ {{ getValidityText(pkg) }}</span>
              </div>

              <ul class="mt-4 flex-1 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <li v-for="feature in pkg.features" :key="feature" class="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-primary-600 dark:text-primary-400" />
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
                class="mt-4 rounded-lg"
              />
            </article>
          </div>
        </section>
      </template>
    </UContainer>
  </div>
</template>
