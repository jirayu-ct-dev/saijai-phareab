<script setup lang="ts">
definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { data: shopSettings } = await useFetch<{ washFoldPricePerKg?: number | null }>("/api/public/shop-settings", {
  key: "me-pricing-shop-settings",
  default: () => ({ washFoldPricePerKg: 60 }),
});
const washFoldPrice = computed(() => shopSettings.value?.washFoldPricePerKg ?? 60);

const serviceConditions = [
  "ราคานี้เป็นราคาหน้าร้านสำหรับลูกค้าทั่วไป และใช้กับรายการที่อยู่นอกสิทธิ์แพ็กเกจ",
  "ลูกค้าที่สมัครแพ็กเกจจะใช้สิทธิ์ตามรายการและจำนวนเครดิตที่แพ็กเกจกำหนด",
  "ผ้าหรือบริการที่ไม่อยู่ในรายการแพ็กเกจ จะคิดราคาตามอัตราหน้าร้านนี้",
  "ราคาอาจมีการเปลี่ยนแปลงขึ้นอยู่กับสภาพความยากง่ายของผ้าแต่ละชิ้น โดยร้านจะแจ้งให้ทราบก่อนดำเนินการ",
  "คราบฝังแน่นบางชนิดอาจไม่สามารถขจัดออกได้ทั้งหมด",
  "หากผ้ามีโอกาสสีตก กรุณาแจ้งพนักงานให้ทราบล่วงหน้า",
  "กรุณาตรวจสอบสิ่งของในกระเป๋าก่อนส่งซัก ทางร้านไม่รับผิดชอบกรณีทรัพย์สินตกค้างหรือสูญหาย",
  "กรณีเกิดความเสียหายจากทางร้าน ทางร้านยินดีชดใช้ตามเงื่อนไข สูงสุดไม่เกิน 10 เท่าของค่าบริการชิ้นนั้น",
];
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UDashboardPanel grow>
      <template #header>
        <UDashboardNavbar title="ราคาหน้าร้าน" icon="i-lucide-tags">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UButton
              label="ดูแพ็กเกจ"
              icon="i-lucide-package"
              color="primary"
              variant="soft"
              to="/packages"
              class="shrink-0"
              :ui="{ label: 'hidden sm:inline' }"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-3 p-2 sm:p-6">
          <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div class="min-w-0">
                <p class="text-base font-semibold text-highlighted">อัตราค่าบริการของร้าน</p>
                <p class="mt-1 text-sm text-muted">
                  ราคาหน้าร้านสำหรับลูกค้าทั่วไป และรายการที่ไม่อยู่ในสิทธิ์แพ็กเกจ
                </p>
              </div>
            </div>
          </section>

          <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <div class="hidden size-11 shrink-0 items-center justify-center rounded-lg border border-default/30 bg-elevated/30 text-primary dark:border-default/20 dark:bg-default/80 sm:flex">
                  <UIcon name="i-lucide-scale" class="size-5" />
                </div>
                <div class="min-w-0">
                  <p class="text-base font-semibold text-highlighted">บริการซักพับแบบชั่งกิโล</p>
                  <p class="mt-1 text-sm text-muted">ราคาหน้าร้านสำหรับงานซักพับทั่วไป</p>
                </div>
              </div>
              <div class="flex shrink-0 flex-col items-end text-right sm:flex-row sm:items-baseline sm:gap-1">
                <span class="text-xl font-semibold leading-none tabular-nums text-highlighted sm:text-2xl">฿{{ washFoldPrice }}</span>
                <span class="mt-1 text-[11px] leading-none text-muted sm:mt-0 sm:text-sm">/ กิโลกรัม</span>
              </div>
            </div>
          </section>

          <section class="flex flex-col gap-1">
            <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-base font-semibold text-highlighted">ราคาซักแยกชิ้น</p>
                  <p class="mt-1 text-sm text-muted">ราคาแยกตามบริการและชนิดผ้า สำหรับรายการที่คิดราคาหน้าร้าน</p>
                </div>
                <div class="flex shrink-0 items-baseline gap-1 text-right">
                  <span class="text-lg font-semibold leading-none text-highlighted">บาท</span>
                  <span class="text-sm text-muted">/ ชิ้น</span>
                </div>
              </div>
            </div>
            <AppPricingTable embedded client-skeleton />
          </section>

          <section class="-mx-2 overflow-hidden border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex items-center gap-2 border-b border-default/40 p-4">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/25 bg-warning/10 text-warning">
                <UIcon name="i-lucide-info" class="size-4" />
              </div>
              <p class="text-sm font-semibold text-highlighted">สิ่งที่ควรทราบก่อนใช้บริการ</p>
            </div>
            <ul>
              <li
                v-for="condition in serviceConditions"
                :key="condition"
                class="flex items-start gap-3 border-b border-default/30 p-4 text-sm text-muted last:border-b-0 dark:border-default/20"
              >
                <span class="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
                <span class="min-w-0">{{ condition }}</span>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
