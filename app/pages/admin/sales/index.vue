<script setup lang="ts">
import PackagePosWorkspace from "~~/app/components/admin/pos/PackagePosWorkspace.vue";
import StorefrontPosWorkspace from "~~/app/components/admin/pos/StorefrontPosWorkspace.vue";

type CompletedSalePayload = {
  paymentId: string;
  saleType: "PACKAGE" | "STOREFRONT";
  serviceOrderId?: string;
  orderNo?: string | null;
  title: string;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const activeMode = ref<"packages" | "storefront">("storefront");
const saleResultModalOpen = ref(false);
const latestSaleResult = reactive<CompletedSalePayload>({
  paymentId: "",
  saleType: "PACKAGE",
  serviceOrderId: "",
  orderNo: null,
  title: "",
});

type ModeOption = {
  value: "storefront" | "packages";
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
};

const modeOptions = [
  {
    value: "storefront",
    label: "รับงานหน้าร้าน",
    shortLabel: "รับผ้า",
    icon: "i-lucide-shirt",
    description: "รับผ้า นับชิ้น นัดรับ และคิดค่าบริการ",
  },
  {
    value: "packages",
    label: "ขายแพ็กเกจ",
    shortLabel: "แพ็กเกจ",
    icon: "i-lucide-package",
    description: "ขายแพ็กเกจสมาชิกและรับชำระเงิน",
  },
] satisfies ModeOption[];

const modeOptionMap = Object.fromEntries(modeOptions.map((option) => [option.value, option])) as Record<
  ModeOption["value"],
  ModeOption
>;
const activeModeOption = computed(() => modeOptionMap[activeMode.value]);

const handleCompleted = (payload: CompletedSalePayload) => {
  latestSaleResult.paymentId = payload.paymentId;
  latestSaleResult.saleType = payload.saleType;
  latestSaleResult.serviceOrderId = payload.serviceOrderId ?? "";
  latestSaleResult.orderNo = payload.orderNo ?? null;
  latestSaleResult.title = payload.title;
  saleResultModalOpen.value = true;
};

const closeSaleResultModal = () => {
  saleResultModalOpen.value = false;
};

const openReceipt = () => {
  if (!latestSaleResult.paymentId) return;

  const target = `/admin/payment/${latestSaleResult.paymentId}/receipt`;
  if (import.meta.client) {
    window.open(target, "_blank", "noopener,noreferrer");
  }

  closeSaleResultModal();
};

const goToPaymentPage = async () => {
  closeSaleResultModal();
  await refreshNuxtData("admin-payments");
  await navigateTo("/admin/payment");
};

const resultDescription = computed(() =>
  latestSaleResult.saleType === "PACKAGE"
    ? "บันทึกรายการขายแล้ว คุณสามารถเปิดใบเสร็จหรือไปหน้าการชำระเงินต่อได้"
    : "บันทึกรับงานแล้ว คุณสามารถเปิดใบเสร็จหรือไปหน้าการชำระเงินต่อได้",
);
</script>

<template>
  <UDashboardPanel id="sales-pos">
    <template #header>
      <UDashboardNavbar :title="activeModeOption.label" icon="i-lucide-store">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <UButton
              label="ชำระเงิน"
              icon="i-lucide-receipt"
              color="neutral"
              variant="outline"
              class="shrink-0"
              aria-label="ดูประวัติการชำระเงิน"
              :ui="{ label: 'hidden md:inline' }"
              @click="navigateTo('/admin/payment')"
            />

            <UButton
              label="รายการรับผ้า"
              icon="i-lucide-shopping-basket"
              color="neutral"
              variant="outline"
              class="shrink-0"
              aria-label="ดูรายงานการขาย"
              :ui="{ label: 'hidden md:inline' }"
              @click="navigateTo('/admin/service-orders')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <section class="rounded-xl border border-default bg-default p-3">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-highlighted">
                <UIcon :name="activeModeOption.icon" class="size-5" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-highlighted">{{ activeModeOption.label }}</p>
                <p class="truncate text-xs text-muted">{{ activeModeOption.description }}</p>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-1 lg:w-80"
              role="tablist"
              aria-label="เลือกประเภทงานขาย"
            >
              <button
                v-for="option in modeOptions"
                :key="option.value"
                type="button"
                class="flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition cursor-pointer"
                :class="[
                  activeMode === option.value
                    ? 'bg-default text-highlighted shadow-sm ring-1 ring-default'
                    : 'text-muted hover:text-highlighted'
                ]"
                role="tab"
                :aria-selected="activeMode === option.value"
                @click="activeMode = option.value"
              >
                <UIcon :name="option.icon" class="size-4 shrink-0" />
                <span class="truncate">{{ option.shortLabel }}</span>
              </button>
            </div>
          </div>
        </section>

        <PackagePosWorkspace v-if="activeMode === 'packages'" @completed="handleCompleted" />
        <StorefrontPosWorkspace v-else @completed="handleCompleted" />
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="saleResultModalOpen" :title="latestSaleResult.title" :description="resultDescription">
    <template #body>
      <div class="rounded-xl border border-default bg-default p-4 text-sm text-toned">
        <p class="font-medium text-highlighted">รหัสรายการชำระเงิน</p>
        <p class="mt-1 break-all font-mono text-xs text-muted">{{ latestSaleResult.paymentId }}</p>

        <div v-if="latestSaleResult.saleType === 'STOREFRONT' && latestSaleResult.orderNo" class="mt-3 border-t border-default pt-3">
          <p class="font-medium text-highlighted">เลขรับผ้า</p>
          <p class="mt-1 break-all font-mono text-xs text-muted">{{ latestSaleResult.orderNo }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton label="เสร็จสิ้น" color="neutral" variant="ghost" @click="closeSaleResultModal" />
        <!-- <UButton label="ไปหน้าการชำระเงิน" color="neutral" variant="outline" icon="i-lucide-arrow-right" @click="goToPaymentPage" /> -->
        <UButton
          v-if="latestSaleResult.saleType === 'STOREFRONT'"
          label="ดูรายละเอียดงาน"
          color="neutral"
          variant="outline"
          icon="i-lucide-eye"
          @click="navigateTo(`/admin/service-orders/${latestSaleResult.serviceOrderId}`)"
        />
        <UButton label="เปิดใบเสร็จ" color="neutral" icon="i-lucide-printer" @click="openReceipt" />
      </div>
    </template>
  </UModal>
</template>
