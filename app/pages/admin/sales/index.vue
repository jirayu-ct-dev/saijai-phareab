<script setup lang="ts">
import PackagePosWorkspace from "~~/app/components/admin/pos/PackagePosWorkspace.vue";
import StorefrontPosWorkspace from "~~/app/components/admin/pos/StorefrontPosWorkspace.vue";
import EditPaymentStateModal from "~~/app/components/admin/payment/EditPaymentStateModal.vue";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

type PaymentTarget = {
  id: string;
  paymentNo: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  slipImage: { id: string; url: string | null; secureUrl: string | null } | null;
};

type CompletedSalePayload = {
  paymentId: string;
  saleType: "PACKAGE" | "STOREFRONT";
  serviceOrderId?: string;
  orderNo?: string | null;
  activationToken?: string | null;
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
  activationToken: null,
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
  latestSaleResult.activationToken = payload.activationToken ?? null;
  latestSaleResult.title = payload.title;
  saleResultModalOpen.value = true;
};

const closeSaleResultModal = () => {
  saleResultModalOpen.value = false;
};

const openDocument = () => {
  if (!latestSaleResult.paymentId) return;

  const documentType = latestSaleResult.saleType === "PACKAGE" ? "receipt" : "quotation";
  const target = `/admin/payment/${latestSaleResult.paymentId}/${documentType}`;
  if (import.meta.client) {
    window.open(target, "_blank", "noopener,noreferrer");
  }

  closeSaleResultModal();
};

const editPaymentOpen = ref(false);
const editPaymentTarget = ref<PaymentTarget | null>(null);
const isLoadingPayment = ref(false);

const openEditPaymentModal = async () => {
  if (!latestSaleResult.paymentId) return;
  isLoadingPayment.value = true;
  try {
    const data = await $fetch<PaymentTarget>(`/api/admin/payments/${latestSaleResult.paymentId}`);
    editPaymentTarget.value = {
      id: data.id,
      paymentNo: data.paymentNo,
      amount: Number(data.amount ?? 0),
      status: data.status,
      method: data.method,
      slipImage: data.slipImage ?? null,
    };
    editPaymentOpen.value = true;
  } catch (error) {
    console.error("Failed to load payment", error);
  } finally {
    isLoadingPayment.value = false;
  }
};

const onPaymentUpdated = async () => {
  const paymentId = editPaymentTarget.value?.id ?? latestSaleResult.paymentId;
  if (!paymentId) return;
  try {
    const data = await $fetch<PaymentTarget>(`/api/admin/payments/${paymentId}`);
    if (data.status === "PAID") {
      await navigateTo(`/admin/payment/${paymentId}/receipt`);
      return;
    }
  } catch (error) {
    console.error("Failed to refresh payment", error);
  }
  await refreshNuxtData();
};

const isRefreshing = ref(false);
const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    await refreshNuxtData();
  } finally {
    isRefreshing.value = false;
  }
};

const resultDescription = computed(() =>
  latestSaleResult.saleType === "PACKAGE"
    ? "บันทึกการขายและรับชำระเงินเรียบร้อยแล้ว คุณสามารถเปิดใบเสร็จได้เลย"
    : "บันทึกรับงานแล้ว คุณสามารถเปิดใบแจ้งราคาหรือไปหน้าการชำระเงินต่อได้",
);

const primaryActionLabel = computed(() =>
  latestSaleResult.saleType === "PACKAGE" ? "เปิดใบเสร็จ" : "เปิดใบแจ้งราคา",
);
const primaryActionIcon = computed(() =>
  latestSaleResult.saleType === "PACKAGE" ? "i-lucide-receipt" : "i-lucide-file-text",
);

const activationUrl = computed(() => {
  if (!latestSaleResult.activationToken) return "";
  const path = `/auth/claim-customer?token=${encodeURIComponent(latestSaleResult.activationToken)}`;
  return import.meta.client ? `${window.location.origin}${path}` : path;
});

const copyActivationLink = async () => {
  if (!activationUrl.value || !import.meta.client) return;
  try {
    await navigator.clipboard.writeText(activationUrl.value);
    useNotify().success("คัดลอกลิงก์เปิดใช้งานแล้ว");
  } catch {
    useNotify().error("ไม่สามารถคัดลอกลิงก์ได้ กรุณาลองใหม่");
  }
};
</script>

<template>
  <div class="flex min-w-0 flex-1">
    <UDashboardPanel id="sales-pos" class="min-w-0 flex-1">
      <template #header>
        <UDashboardNavbar :title="activeModeOption.label" icon="i-lucide-store">
          <template #leading>
            <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
          </template>

          <template #right>
            <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <UButton
                v-if="latestSaleResult.paymentId"
                label="แก้ไขการชำระเงิน"
                icon="i-lucide-wallet"
                color="primary"
                variant="outline"
                class="shrink-0"
                aria-label="แก้ไขการชำระเงินของรายการล่าสุด"
                :ui="{ label: 'hidden md:inline' }"
                :loading="isLoadingPayment"
                @click="openEditPaymentModal"
              />

              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                class="shrink-0"
                title="รีเฟรชข้อมูล"
                aria-label="รีเฟรชข้อมูล"
                :loading="isRefreshing"
                @click="handleRefresh"
              />

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
        <div class="flex w-full min-w-0 flex-col gap-3 p-2 sm:p-6">
          <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
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
                class="grid grid-cols-2 gap-1 rounded-lg border border-default/30 bg-elevated p-1 lg:w-80"
                role="tablist"
                aria-label="เลือกประเภทงานขาย"
              >
                <button
                  v-for="option in modeOptions"
                  :key="option.value"
                  type="button"
                  class="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
                  :class="[
                    activeMode === option.value
                      ? 'bg-default text-highlighted ring-1 ring-default'
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
        <div class="rounded-lg border border-default/30 bg-default p-3 text-sm text-toned dark:border-default/20 dark:bg-elevated/55">
          <p class="font-medium text-highlighted">รหัสรายการชำระเงิน</p>
          <p class="mt-1 break-all font-mono text-xs text-muted">{{ latestSaleResult.paymentId }}</p>

          <div
            v-if="latestSaleResult.saleType === 'STOREFRONT' && latestSaleResult.orderNo"
            class="mt-3 border-t border-default/15 pt-3 dark:border-default/10"
          >
            <p class="font-medium text-highlighted">เลขรับผ้า</p>
            <p class="mt-1 break-all font-mono text-xs text-muted">{{ latestSaleResult.orderNo }}</p>
          </div>

          <div
            v-if="latestSaleResult.activationToken"
            class="mt-3 border-t border-default/15 pt-3 dark:border-default/10"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium text-highlighted">ลิงก์เปิดใช้งานบัญชีลูกค้า</p>
                <p class="mt-1 text-xs text-muted">ลิงก์นี้แสดงครั้งเดียว ส่งให้ลูกค้าเพื่อกำหนดอีเมลและรหัสผ่าน</p>
              </div>
              <UButton label="คัดลอก" icon="i-lucide-copy" size="xs" color="primary" variant="soft" @click="copyActivationLink" />
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton label="เสร็จสิ้น" color="neutral" variant="ghost" @click="closeSaleResultModal" />
          <UButton
            v-if="latestSaleResult.saleType === 'STOREFRONT'"
            label="ดูรายละเอียดงาน"
            color="neutral"
            variant="outline"
            icon="i-lucide-eye"
            @click="navigateTo(`/admin/service-orders/${latestSaleResult.serviceOrderId}`)"
          />
          <UButton :label="primaryActionLabel" color="neutral" :icon="primaryActionIcon" @click="openDocument" />
        </div>
      </template>
    </UModal>

    <EditPaymentStateModal
      v-if="editPaymentTarget?.id"
      v-model:open="editPaymentOpen"
      :payment-id="editPaymentTarget.id"
      :payment-no="editPaymentTarget.paymentNo"
      :amount="editPaymentTarget.amount"
      :status="editPaymentTarget.status"
      :method="editPaymentTarget.method"
      :existing-slip="editPaymentTarget.slipImage"
      @updated="onPaymentUpdated"
    />
  </div>
</template>
