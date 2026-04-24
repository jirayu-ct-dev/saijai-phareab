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

const modeOptions = [
  {
    value: "storefront" as const,
    label: "รับงานหน้าร้าน",
    description: "รับผ้า นับชิ้น กำหนดวันนัดรับ และคิดค่าบริการในหน้าเดียว",
  },
  {
    value: "packages" as const,
    label: "ขายแพ็กเกจ",
    description: "เลือกลูกค้าและแพ็กเกจหลายรายการในรูปแบบ POS",
  },
];

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
      <UDashboardNavbar title="POS หน้าร้าน" icon="i-lucide-store">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <UButton
            label="ดูประวัติการชำระเงิน"
            icon="i-lucide-receipt"
            color="neutral"
            variant="outline"
            @click="navigateTo('/admin/payment')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <section class="rounded-2xl border border-default bg-default p-2 md:p-0">
          <div class="grid md:grid-cols-2">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              type="button"
              class="bg-default p-4 text-left transition cursor-pointer first:rounded-t-xl last:rounded-b-xl md:first:rounded-none md:last:rounded-none"
              :class="[
                activeMode === option.value ? 'bg-elevated/50' : '',
                option.value === 'storefront' ? 'border-t border-default md:border-t-0 md:border-l' : ''
              ]"
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
        <UButton label="ไปหน้าการชำระเงิน" color="neutral" variant="outline" icon="i-lucide-arrow-right" @click="goToPaymentPage" />
        <UButton label="เปิดใบเสร็จ" color="neutral" icon="i-lucide-printer" @click="openReceipt" />
      </div>
    </template>
  </UModal>
</template>
