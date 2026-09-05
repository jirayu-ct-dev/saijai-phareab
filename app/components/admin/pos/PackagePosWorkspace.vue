<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { today, type CalendarDate } from "@internationalized/date";
import PosCatalogCard from "~~/app/components/admin/pos/PosCatalogCard.vue";
import PosCheckoutPanel from "~~/app/components/admin/pos/PosCheckoutPanel.vue";
import type { AdminSaleItemInput, AdminSaleSlipImage, CreateAdminSaleBody } from "~~/app/composables/useAdminSales";
import type { PackageType, PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency } from "~~/shared/utils/format";
import { backdatedSaleSchema, type BackdatedSaleInput } from "~~/shared/utils/backdatedOrder";

const dashboardCardClass =
  "-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg";
const filterBarClass =
  "-mx-2 rounded-lg border border-default/30 bg-default p-2 dark:border-default/40 dark:bg-default/80 sm:mx-0";
const emptyStateClass =
  "flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30";
const checkoutSectionClass = dashboardCardClass;

type FormItemState = {
  key: string;
  productId: string;
  quantity: number;
};

const props = withDefaults(defineProps<{
  backdated?: boolean;
}>(), {
  backdated: false,
});

const emit = defineEmits<{
  completed: [payload: { paymentId: string; saleType: "PACKAGE"; title: string; activationToken?: string | null }];
}>();

const packageTypeFilters: Array<{ label: string; value: "all" | PackageType }> = [
  { label: "ทั้งหมด", value: "all" },
  { label: "หลัก", value: "MAIN" },
  { label: "เสริม", value: "ADDON" },
];

const packageTypeBadges: Record<PackageType, { label: string; color: "primary" | "warning" }> = {
  MAIN: { label: "แพ็กเกจหลัก", color: "primary" },
  ADDON: { label: "แพ็กเกจเสริม", color: "warning" },
};

const notify = useNotify();
const { createSale } = useAdminSales();
const { customers, isLoading: isCustomersLoading, setSearch: setCustomerSearch } = useAdminCustomerOptions();
const { products, isLoading: isCatalogLoading, refresh } = usePackageCatalog();
const { uploadSlip } = useAdminPayments({ fetchList: false, refreshAfterMutation: false });
const { vatRate, vatIncluded, computeVatPreview } = useBusinessSetting();

const backdatedEnabled = computed(() => props.backdated);
const historicalMaxDate = today("Asia/Bangkok");
const historicalSoldDate = shallowRef<CalendarDate | null>(null);
const historicalSoldTime = ref("00:00");
const historicalSoldTimeSearch = ref("");
const historicalPaymentStatus = ref<"UNPAID" | "PAID">("PAID");
const historicalPaidDate = shallowRef<CalendarDate | null>(null);
const historicalPaidTime = ref("00:00");
const historicalPaidTimeSearch = ref("");
const historicalError = ref("");
const historicalPaid = computed(() => historicalPaymentStatus.value === "PAID");
const historicalDateTime = (date: CalendarDate | null, time: string) => date
  ? `${date.toString()}T${time}`
  : "";
const historicalSoldAt = computed(() => historicalDateTime(historicalSoldDate.value, historicalSoldTime.value));
const historicalPaidAt = computed(() => historicalDateTime(historicalPaidDate.value, historicalPaidTime.value));
const historicalPaymentStatusOptions = [
  { label: paymentStatusLabels.UNPAID, value: "UNPAID" },
  { label: paymentStatusLabels.PAID, value: "PAID" },
];
const normalizeHistoricalTime = (value: string) => {
  const input = value.trim().replace(".", ":");
  const match = input.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return input;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return input;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
const setHistoricalTime = (field: "sold" | "paid", value: string) => {
  if (!value.trim()) return;
  const normalized = normalizeHistoricalTime(value);
  if (field === "sold") historicalSoldTime.value = normalized;
  if (field === "paid") historicalPaidTime.value = normalized;
};
const timeOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ label: value, value });
    }
  }
  return options;
});
const formatHistoricalDateLabel = (value: CalendarDate | null) => {
  if (!value) return "เลือกวันที่";
  const dd = String(value.day).padStart(2, "0");
  const mm = String(value.month).padStart(2, "0");
  return `${dd}/${mm}/${value.year}`;
};
const historicalSoldDateLabel = computed(() => formatHistoricalDateLabel(historicalSoldDate.value));
const historicalPaidDateLabel = computed(() => formatHistoricalDateLabel(historicalPaidDate.value));

const searchQuery = ref("");
const packageTypeFilter = ref<"all" | PackageType>("all");

const productMap = computed(() => new Map((products.value ?? []).map((pkg) => [pkg.id, pkg])));
const customerOptions = computed(() =>
  (customers.value ?? []).map((customer) => ({
    label: customer.label,
    value: customer.id,
    image: customer.image,
    name: customer.name,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
    customerAccountStatus: customer.customerAccountStatus,
  })),
);

const filteredProducts = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return (products.value ?? []).filter((pkg) => {
    if (packageTypeFilter.value !== "all" && pkg.packageType !== packageTypeFilter.value) return false;
    if (!keyword) return true;

    return [pkg.name, pkg.description ?? "", pkg.packageType].join(" ").toLowerCase().includes(keyword);
  });
});

let itemKeySeed = 0;
const createItemKey = () => `package-pos-item-${++itemKeySeed}`;

const createEmptyForm = () => ({
  customerId: "",
  customerMode: "existing" as "existing" | "new",
  newCustomerName: "",
  newCustomerPhone: "",
  newCustomerEmail: "",
  items: [] as FormItemState[],
  discountAmount: 0,
  note: "",
  slipImageId: null as string | null,
  // Backdated intake defaults to bank transfer unless the operator picks cash.
  method: (props.backdated ? "TRANSFER" : "CASH") as PaymentMethod,
  status: "PAID" as PaymentStatus,
});

const paymentMethodOptions: Array<{ label: string; value: PaymentMethod; icon: string }> = [
  { label: "เงินสด", value: "CASH", icon: "i-lucide-banknote" },
  { label: "โอนเงิน", value: "TRANSFER", icon: "i-lucide-credit-card" },
];

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PAID, value: "PAID" },
  { label: paymentStatusLabels.PENDING_VERIFICATION, value: "PENDING_VERIFICATION" },
  { label: paymentStatusLabels.UNPAID, value: "UNPAID" },
];

const form = reactive(createEmptyForm());
const isSubmitting = ref(false);

const isXl = useMediaQuery("(min-width: 1280px)");
const isCartOpen = ref(false);
watch(isXl, (value) => { if (value) isCartOpen.value = false; });
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<AdminSaleSlipImage | null>(null);

const selectedItemMap = computed(() => new Map(form.items.map((item) => [item.productId, item])));

const cartItems = computed(() =>
  form.items
    .map((item) => {
      const product = productMap.value.get(item.productId);
      if (!product) return null;

      return {
        key: item.key,
        productId: item.productId,
        name: product.name,
        packageType: product.packageType,
        validityDays: product.validityDays,
        credits: product.credits,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: product.price * item.quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

const subtotalAmount = computed(() => cartItems.value.reduce((sum, item) => sum + item.totalPrice, 0));
const sanitizedDiscountAmount = computed(() => {
  const raw = Number(form.discountAmount || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  return Math.min(raw, subtotalAmount.value);
});
const beforeVatAmount = computed(() => subtotalAmount.value - sanitizedDiscountAmount.value);
const vatPreview = computed(() => computeVatPreview(beforeVatAmount.value));
const totalAmount = computed(() => vatPreview.value.totalAmount);
const totalQuantity = computed(() => cartItems.value.reduce((sum, item) => sum + item.quantity, 0));

const normalizedItems = computed<AdminSaleItemInput[]>(() =>
  cartItems.value.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  })),
);

const resetSlip = () => {
  slipFile.value = null;
  uploadedSlip.value = null;
  form.slipImageId = null;
};

const resetForm = () => {
  historicalSoldDate.value = null;
  historicalSoldTime.value = "00:00";
  historicalSoldTimeSearch.value = "";
  historicalPaidDate.value = null;
  historicalPaidTime.value = "00:00";
  historicalPaidTimeSearch.value = "";
  historicalPaymentStatus.value = "PAID";
  historicalError.value = "";
  Object.assign(form, createEmptyForm());
  resetSlip();
};

const addProductToCart = (productId: string) => {
  const existing = selectedItemMap.value.get(productId);
  if (existing) {
    existing.quantity += 1;
    return;
  }

  form.items.push({ key: createItemKey(), productId, quantity: 1 });
};

const incrementProduct = (productId: string) => addProductToCart(productId);

const decrementItemByKey = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;

  if (item.quantity <= 1) {
    form.items = form.items.filter((entry) => entry.key !== key);
    return;
  }

  item.quantity -= 1;
};

const decrementProduct = (productId: string) => {
  const item = selectedItemMap.value.get(productId);
  if (!item) return;
  decrementItemByKey(item.key);
};

const removeItem = (key: string) => {
  form.items = form.items.filter((entry) => entry.key !== key);
};

const setItemQuantity = (key: string, value: number | string | null | undefined) => {
  const qty = Math.max(0, Math.floor(Number(value) || 0));
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;
  if (qty === 0) {
    form.items = form.items.filter((entry) => entry.key !== key);
    return;
  }
  item.quantity = qty;
};

const setProductQuantity = (productId: string, qty: number) => {
  const value = Math.max(0, Math.floor(qty));
  const existing = selectedItemMap.value.get(productId);
  if (value === 0) {
    if (existing) form.items = form.items.filter((e) => e.key !== existing.key);
    return;
  }
  if (existing) {
    existing.quantity = value;
  } else {
    form.items.push({ key: createItemKey(), productId, quantity: value });
  }
};

const uploadSlipIfNeeded = async () => {
  if (!slipFile.value) return;
  const image = await uploadSlip(slipFile.value);
  if (!image) throw new Error("upload-failed");
  uploadedSlip.value = image;
  form.slipImageId = image.id;
};

const handleSubmit = async () => {
  if (form.customerMode === "existing" && !form.customerId) return notify.validationError("กรุณาเลือกลูกค้า");
  if (form.customerMode === "new" && !form.newCustomerName.trim()) return notify.validationError("กรุณากรอกชื่อลูกค้า");
  if (form.customerMode === "new" && !form.newCustomerPhone.trim()) return notify.validationError("กรุณากรอกเบอร์โทรลูกค้า");
  if (normalizedItems.value.length === 0) return notify.validationError("กรุณาเลือกแพ็กเกจอย่างน้อย 1 รายการ");
  historicalError.value = "";
  const history: BackdatedSaleInput | undefined = backdatedEnabled.value ? {
    soldAt: historicalSoldAt.value,
    ...(historicalPaid.value ? { payment: { paidAt: historicalPaidAt.value, method: form.method } } : {}),
  } : undefined;
  if (history) {
    const validation = backdatedSaleSchema().safeParse(history);
    if (!validation.success) {
      historicalError.value = validation.error.issues[0]?.message || "กรุณาตรวจสอบข้อมูลย้อนหลัง";
      return;
    }
  }

  isSubmitting.value = true;
  try {
    await uploadSlipIfNeeded();
    const payload: CreateAdminSaleBody = {
      customerId: form.customerMode === "existing" ? form.customerId : undefined,
      newCustomer: form.customerMode === "new" ? {
        name: form.newCustomerName.trim(),
        phoneNumber: form.newCustomerPhone.trim(),
        email: form.newCustomerEmail.trim() || null,
      } : null,
      items: normalizedItems.value,
      discountAmount: sanitizedDiscountAmount.value,
      note: form.note.trim() || null,
      slipImageId: form.slipImageId,
      method: form.method,
      status: history ? (historicalPaid.value ? "PAID" : "UNPAID") : form.status,
      ...(history ? { backdated: history } : {}),
    };

    const result = await createSale(payload);
    if (result) {
      emit("completed", {
        paymentId: result.paymentId,
        saleType: "PACKAGE",
        title: history ? "บันทึกรายการขายแพ็กเกจย้อนหลังสำเร็จ" : "บันทึกรายการขายแพ็กเกจสำเร็จ",
        activationToken: result.activationToken ?? null,
      });
      resetForm();
      await refresh();
    }
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode !== 500) {
      notify.error((error as { statusMessage?: string }).statusMessage || "ไม่สามารถบันทึกรายการได้");
    } else {
      notify.error("ไม่สามารถบันทึกรายการขายแพ็กเกจได้");
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
    <div class="min-w-0 space-y-3">
      <section class="flex flex-col gap-3">
        <div :class="dashboardCardClass">
          <div class="min-w-0">
            <p class="text-base font-semibold text-highlighted">ขายแพ็กเกจ</p>
            <p class="mt-0.5 text-sm text-muted">เลือกแพ็กเกจและเพิ่มเข้าตะกร้าแบบ POS</p>
          </div>
        </div>

        <div :class="[filterBarClass, 'flex items-center gap-1.5']">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="ค้นหาชื่อแพ็กเกจ"
            class="min-w-0 flex-[1_1_28rem]"
          />
          <div class="grid shrink-0 grid-cols-3 gap-1 sm:flex sm:justify-end">
            <UButton
              v-for="filter in packageTypeFilters"
              :key="filter.value"
              :label="filter.label"
              color="neutral"
              :variant="packageTypeFilter === filter.value ? 'solid' : 'outline'"
              size="sm"
              class="justify-center"
              @click="packageTypeFilter = filter.value"
            />
          </div>
        </div>

        <div v-if="isCatalogLoading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          <PosCatalogCard v-for="i in 8" :key="`pkg-sk-${i}`" loading />
        </div>

        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          <PosCatalogCard
            v-for="pkg in filteredProducts"
            :key="pkg.id"
            :title="pkg.name"
            :description="pkg.description"
            :badge-label="packageTypeBadges[pkg.packageType].label"
            :badge-color="packageTypeBadges[pkg.packageType].color"
            :price-label="formatCurrency(pkg.price)"
            :meta-label="`${pkg.credits ? `${pkg.credits} เครดิต` : 'ไม่จำกัดเครดิต'} | ${pkg.validityDays ? `${pkg.validityDays} วัน` : 'ไม่กำหนดอายุ'}`"
            :quantity="selectedItemMap.get(pkg.id)?.quantity ?? 0"
            :selected="selectedItemMap.has(pkg.id)"
            :decrement-disabled="!selectedItemMap.has(pkg.id)"
            @select="incrementProduct(pkg.id)"
            @decrement="decrementProduct(pkg.id)"
            @increment="incrementProduct(pkg.id)"
            @change="setProductQuantity(pkg.id, $event)"
          />

          <div v-if="filteredProducts.length === 0" :class="[emptyStateClass, 'col-span-full']">
            ไม่พบแพ็กเกจที่ตรงกับตัวกรอง
          </div>
        </div>
      </section>
    </div>

    <aside
      :class="isXl
        ? 'space-y-3 rounded-lg xl:sticky xl:top-4 xl:self-start'
        : [
            'admin-workspace fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-default transition-transform duration-200',
            isCartOpen ? 'translate-x-0' : 'translate-x-full',
          ]"
    >
      <div v-if="!isXl" class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-default bg-default px-4 py-3 dark:bg-elevated/55">
        <p class="text-base font-semibold text-highlighted">ตะกร้าแพ็กเกจ</p>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" aria-label="ปิด" @click="isCartOpen = false" />
      </div>
      <div :class="!isXl ? 'flex-1 p-2' : ''">
        <PosCheckoutPanel
          title="ตะกร้าแพ็กเกจ"
          description="เลือกลูกค้า รับชำระ และบันทึกรายการในหน้าเดียว"
          :flat="!isXl"
          :section-class="checkoutSectionClass"
          :customer-id="form.customerId"
          :customer-options="customerOptions"
          :customer-loading="isCustomersLoading"
          allow-new-customer
          :customer-mode="form.customerMode"
          :new-customer-name="form.newCustomerName"
          :new-customer-phone="form.newCustomerPhone"
          :new-customer-email="form.newCustomerEmail"
          :note="form.note"
          total-label="ยอดรวมสุทธิ"
          :total-value="formatCurrency(totalAmount)"
          :total-meta="`${cartItems.length} รายการ | ${totalQuantity} ชิ้น`"
          :submit-label="backdatedEnabled ? 'บันทึกขายแพ็กเกจย้อนหลัง' : 'บันทึก'"
          :is-submitting="isSubmitting"
          :slip-file="slipFile"
          :uploaded-slip-url="uploadedSlip?.secureUrl || uploadedSlip?.url"
          :uploaded-slip-label="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
          @update:customer-id="form.customerId = $event"
          @update:customer-mode="form.customerMode = $event"
          @update:new-customer-name="form.newCustomerName = $event"
          @update:new-customer-phone="form.newCustomerPhone = $event"
          @update:new-customer-email="form.newCustomerEmail = $event"
          @search-customer="setCustomerSearch"
          @update:note="form.note = $event"
          @update:slip-file="slipFile = $event"
          @remove-slip="resetSlip"
          @submit="handleSubmit"
          @reset="resetForm"
        >
          <template #cart>
            <div v-if="backdatedEnabled" :class="[checkoutSectionClass, 'space-y-3']">
              <UFormField label="วันและเวลาขายจริง" required>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <UPopover>
                    <UButton
                      :label="historicalSoldDateLabel"
                      icon="i-lucide-calendar"
                      color="neutral"
                      variant="outline"
                      block
                      class="justify-start font-normal"
                    />
                    <template #content>
                      <UCalendar v-model="historicalSoldDate" :max-value="historicalMaxDate" locale="th-TH" class="p-2" />
                    </template>
                  </UPopover>
                  <UInputMenu
                    v-model="historicalSoldTime"
                    v-model:search-term="historicalSoldTimeSearch"
                    :items="timeOptions"
                    value-key="value"
                    create-item="always"
                    icon="i-lucide-clock"
                    placeholder="เช่น 09:15"
                    class="w-full"
                    @create="setHistoricalTime('sold', $event)"
                    @blur="setHistoricalTime('sold', historicalSoldTimeSearch)"
                  />
                </div>
              </UFormField>
              <UFormField label="สถานะการชำระเงิน" required>
                <URadioGroup
                  v-model="historicalPaymentStatus"
                  :items="historicalPaymentStatusOptions"
                  value-key="value"
                  variant="card"
                  orientation="horizontal"
                  :ui="{ fieldset: 'grid grid-cols-2 gap-2' }"
                />
              </UFormField>
              <UFormField v-if="historicalPaid" label="วันและเวลาชำระเงินจริง" required>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <UPopover>
                    <UButton
                      :label="historicalPaidDateLabel"
                      icon="i-lucide-calendar"
                      color="neutral"
                      variant="outline"
                      block
                      class="justify-start font-normal"
                    />
                    <template #content>
                      <UCalendar v-model="historicalPaidDate" :max-value="historicalMaxDate" locale="th-TH" class="p-2" />
                    </template>
                  </UPopover>
                  <UInputMenu
                    v-model="historicalPaidTime"
                    v-model:search-term="historicalPaidTimeSearch"
                    :items="timeOptions"
                    value-key="value"
                    create-item="always"
                    icon="i-lucide-clock"
                    placeholder="เช่น 10:20"
                    class="w-full"
                    @create="setHistoricalTime('paid', $event)"
                    @blur="setHistoricalTime('paid', historicalPaidTimeSearch)"
                  />
                </div>
              </UFormField>
              <p v-if="historicalError" role="alert" class="text-sm text-error">{{ historicalError }}</p>
            </div>
            <div class="rounded-lg border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55">
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium text-highlighted">รายการที่เลือก</p>
                <span class="text-sm text-muted">{{ totalQuantity }} ชิ้น</span>
              </div>

              <div v-if="cartItems.length" class="mt-2 space-y-1">
                <div v-for="item in cartItems" :key="item.key">
                  <div class="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-elevated/30">
                    <p class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ item.name }}</p>
                    <UInputNumber
                      :model-value="item.quantity"
                      :min="0"
                      :step="1"
                      size="xs"
                      class="w-20"
                      @update:model-value="setItemQuantity(item.key, Number.isFinite($event) ? $event : 0)"
                    />
                    <span class="w-16 shrink-0 text-right text-xs font-medium text-muted">
                      {{ formatCurrency(item.totalPrice) }}
                    </span>
                    <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="removeItem(item.key)" />
                  </div>
                </div>
              </div>

              <div v-else class="mt-3 rounded-lg border border-dashed border-default/30 p-5 text-center text-sm text-muted dark:border-default/20">
                ยังไม่ได้เลือกแพ็กเกจ
              </div>
            </div>
          </template>

          <template #discount>
            <UFormField v-if="!backdatedEnabled || historicalPaid" label="ช่องทางการชำระเงิน">
              <div class="grid grid-cols-2 gap-2">
                <UButton
                  v-for="option in paymentMethodOptions"
                  :key="option.value"
                  :label="option.label"
                  :icon="option.icon"
                  :color="form.method === option.value ? 'primary' : 'neutral'"
                  :variant="form.method === option.value ? 'solid' : 'outline'"
                  block
                  @click="form.method = option.value"
                />
              </div>
            </UFormField>

            <UFormField v-if="!backdatedEnabled" label="สถานะการชำระเงิน">
              <USelect
                v-model="form.status"
                :items="paymentStatusOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField label="ส่วนลด">
              <UInputNumber
                v-model="form.discountAmount"
                :min="0"
                :max="subtotalAmount"
                :step="1"
                :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }"
                class="w-full"
              />
            </UFormField>

            <div v-if="vatRate > 0" class="mt-2 flex items-center justify-between text-sm">
              <span class="text-muted">{{ vatIncluded ? `รวม VAT ${vatRate}%` : `VAT ${vatRate}%` }}</span>
              <span class="font-medium text-highlighted">{{ formatCurrency(vatPreview.vatAmount) }}</span>
            </div>
          </template>
        </PosCheckoutPanel>
      </div>
    </aside>
  </div>

  <!-- Mobile/Tablet: FAB + backdrop -->
  <div
    v-if="!isXl && isCartOpen"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
    aria-hidden="true"
    @click="isCartOpen = false"
  />
  <UButton
    v-if="!isXl"
    icon="i-lucide-shopping-cart"
    color="primary"
    size="xl"
    class="fixed bottom-6 right-6 z-30 size-14 justify-center rounded-full"
    aria-label="เปิดตะกร้าแพ็กเกจ"
    @click="isCartOpen = true"
  >
    <span
      v-if="totalQuantity > 0"
      class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-xs font-semibold text-white"
    >{{ totalQuantity }}</span>
  </UButton>
</template>
