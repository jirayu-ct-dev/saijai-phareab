<script setup lang="ts">
import PackagePosWorkspace from "~~/app/components/admin/pos/PackagePosWorkspace.vue";
import StorefrontPosWorkspace from "~~/app/components/admin/pos/StorefrontPosWorkspace.vue";

type CompletedSalePayload = {
  paymentId: string;
  saleType: "PACKAGE" | "STOREFRONT";
  title: string;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const activeMode = ref<"packages" | "storefront">("packages");
const saleResultModalOpen = ref(false);
const latestSaleResult = reactive<CompletedSalePayload>({
  paymentId: "",
  saleType: "PACKAGE",
  title: "",
});

const modeOptions = [
  { value: "packages" as const, label: "เธเธฒเธขเนเธเนเธเน€เธเธ", description: "เน€เธฅเธทเธญเธเนเธเนเธเน€เธเธเนเธฅเธฐเธเธฒเธขเนเธเธ POS" },
  { value: "storefront" as const, label: "เธเธฒเธขเธเธฃเธดเธเธฒเธฃเธซเธเนเธฒเธฃเนเธฒเธ", description: "เธเธฑเธเธเนเธฒ เธเธดเธ”เธฃเธฒเธเธฒ เนเธฅเธฐเธฃเธงเธกเธเนเธฒเนเธกเนเนเธเธงเธ" },
];

const handleCompleted = (payload: CompletedSalePayload) => {
  latestSaleResult.paymentId = payload.paymentId;
  latestSaleResult.saleType = payload.saleType;
  latestSaleResult.title = payload.title;
  saleResultModalOpen.value = true;
};

const closeSaleResultModal = () => {
  saleResultModalOpen.value = false;
};

const openReceipt = () => {
  if (!latestSaleResult.paymentId) return;
  const target = `/admin/payment/${latestSaleResult.paymentId}/receipt?print=1`;
  if (import.meta.client) {
    window.open(target, "_blank", "noopener,noreferrer");
  }
  closeSaleResultModal();
};

const goToPaymentPage = async () => {
  closeSaleResultModal();
  await navigateTo("/admin/payment");
};

const resultDescription = computed(() =>
  latestSaleResult.saleType === "PACKAGE"
    ? "รายการขายถูกบันทึกแล้ว คุณสามารถพิมพ์ใบเสร็จทันทีหรือไปดูข้อมูลที่หน้าการชำระเงินต่อได้"
    : "รายการบริการหน้าร้านถูกบันทึกแล้ว คุณสามารถพิมพ์ใบเสร็จทันทีหรือไปดูข้อมูลที่หน้าการชำระเงินต่อได้",
);
</script>

<template>
  <UDashboardPanel id="sales-pos">
    <template #header>
      <UDashboardNavbar title="POS หน้าร้าน" icon="i-lucide-store">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <UButton label="ดูประวัติชำระเงิน" icon="i-lucide-receipt" color="neutral" variant="outline" @click="navigateTo('/admin/payment')" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <section class="rounded-2xl border border-default bg-default p-4">
          <div class="grid gap-3 md:grid-cols-2">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              type="button"
              class="rounded-2xl border p-4 text-left transition"
              :class="activeMode === option.value ? 'border-inverted bg-neutral-100' : 'border-default bg-elevated/20 hover:border-neutral-400'"
              @click="activeMode = option.value"
            >
              <p class="font-semibold text-highlighted">{{ option.label }}</p>
              <p class="mt-1 text-sm text-muted">{{ option.description }}</p>
            </button>
          </div>
        </section>

        <PackagePosWorkspace v-if="activeMode === 'packages'" @completed="handleCompleted" />
        <StorefrontPosWorkspace v-else @completed="handleCompleted" />
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="saleResultModalOpen" :title="latestSaleResult.title" :description="resultDescription">
    <template #body>
      <div class="rounded-xl border border-default bg-neutral-50 p-4 text-sm text-toned">
        <p class="font-medium text-highlighted">เลขอ้างอิงการชำระเงิน</p>
        <p class="mt-1 break-all font-mono text-xs text-muted">{{ latestSaleResult.paymentId }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton label="เสร็จสิ้น" color="neutral" variant="ghost" @click="closeSaleResultModal" />
        <UButton label="ไปหน้าการชำระเงิน" color="neutral" variant="outline" icon="i-lucide-arrow-right" @click="goToPaymentPage" />
        <UButton label="พิมพ์ใบเสร็จ" color="neutral" icon="i-lucide-printer" @click="openReceipt" />
      </div>
    </template>
  </UModal>
</template>
