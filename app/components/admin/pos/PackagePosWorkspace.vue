<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import PosCatalogCard from "~~/app/components/admin/pos/PosCatalogCard.vue";
import PosCheckoutPanel from "~~/app/components/admin/pos/PosCheckoutPanel.vue";
import type { AdminSaleItemInput, AdminSaleSlipImage, CreateAdminSaleBody } from "~~/app/composables/useAdminSales";
import type { PackageType } from "~~/shared/types/enums";
import * as adminUi from "~~/shared/config/adminUi";
import { formatCurrency } from "~~/shared/utils/format";

const dashboardCardClass =
  adminUi.adminDashboardCardClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55";
const filterBarClass =
  adminUi.adminFilterBarClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55";
const emptyStateClass = adminUi.adminEmptyStateClass;
const checkoutSectionClass = dashboardCardClass;

type FormItemState = {
  key: string;
  productId: string;
  quantity: number;
};

const emit = defineEmits<{
  completed: [payload: { paymentId: string; saleType: "PACKAGE"; title: string }];
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
const { customers, isLoading: isCustomersLoading } = useAdminCustomerOptions();
const { products, isLoading: isCatalogLoading, refresh } = usePackageCatalog();
const { uploadSlip } = useAdminPayments({ fetchList: false, refreshAfterMutation: false });
const { vatRate, vatIncluded, computeVatPreview } = useBusinessSetting();

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
  items: [] as FormItemState[],
  discountAmount: 0,
  note: "",
  slipImageId: null as string | null,
});

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

const incrementItemByKey = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (item) item.quantity += 1;
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
  if (!form.customerId) return notify.validationError("กรุณาเลือกลูกค้า");
  if (normalizedItems.value.length === 0) return notify.validationError("กรุณาเลือกแพ็กเกจอย่างน้อย 1 รายการ");

  isSubmitting.value = true;
  try {
    await uploadSlipIfNeeded();
    const payload: CreateAdminSaleBody = {
      customerId: form.customerId,
      items: normalizedItems.value,
      discountAmount: sanitizedDiscountAmount.value,
      note: form.note.trim() || null,
      slipImageId: form.slipImageId,
    };

    const result = await createSale(payload);
    if (result) {
      emit("completed", {
        paymentId: result.paymentId,
        saleType: "PACKAGE",
        title: "บันทึกรายการขายแพ็กเกจสำเร็จ",
      });
      resetForm();
      await refresh();
    }
  } catch {
    notify.error("ไม่สามารถอัปโหลดสลิปได้");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
    <div class="min-w-0 space-y-4 sm:space-y-6">
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
        ? 'space-y-4 rounded-md sm:space-y-6 xl:sticky xl:top-4 xl:self-start'
        : [
            'admin-workspace fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-default shadow-2xl transition-transform duration-200',
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
          :note="form.note"
          total-label="ยอดรวมสุทธิ"
          :total-value="formatCurrency(totalAmount)"
          :total-meta="`${cartItems.length} รายการ | ${totalQuantity} ชิ้น`"
          submit-label="บันทึก"
          :is-submitting="isSubmitting"
          :slip-file="slipFile"
          :uploaded-slip-url="uploadedSlip?.secureUrl || uploadedSlip?.url"
          :uploaded-slip-label="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
          @update:customer-id="form.customerId = $event"
          @update:note="form.note = $event"
          @update:slip-file="slipFile = $event"
          @remove-slip="resetSlip"
          @submit="handleSubmit"
          @reset="resetForm"
        >
          <template #cart>
            <div class="rounded-md border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55">
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium text-highlighted">รายการที่เลือก</p>
                <span class="text-sm text-muted">{{ totalQuantity }} ชิ้น</span>
              </div>

              <div v-if="cartItems.length" class="mt-2 space-y-1">
                <div v-for="item in cartItems" :key="item.key">
                  <div class="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-elevated/30">
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

              <div v-else class="mt-3 rounded-md border border-dashed border-default/30 p-5 text-center text-sm text-muted dark:border-default/20">
                ยังไม่ได้เลือกแพ็กเกจ
              </div>
            </div>
          </template>

          <template #discount>
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
    class="fixed bottom-6 right-6 z-30 size-14 justify-center rounded-full shadow-lg"
    aria-label="เปิดตะกร้าแพ็กเกจ"
    @click="isCartOpen = true"
  >
    <span
      v-if="totalQuantity > 0"
      class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-xs font-semibold text-white"
    >{{ totalQuantity }}</span>
  </UButton>
</template>
