<script setup lang="ts">
import PosCatalogCard from "~~/app/components/admin/pos/PosCatalogCard.vue";
import PosCheckoutPanel from "~~/app/components/admin/pos/PosCheckoutPanel.vue";
import type { PaymentMethod, PaymentStatus, PackageType } from "~~/shared/types/enums";
import type { AdminSaleItemInput, AdminSaleSlipImage, CreateAdminSaleBody } from "~~/app/composables/useAdminSales";
import { formatCurrency } from "~~/shared/utils/format";

type FormItemState = {
  key: string;
  productId: string;
  quantity: number;
};

const emit = defineEmits<{
  completed: [payload: { paymentId: string; saleType: "PACKAGE"; title: string }];
}>();

const PACKAGE_TYPE_FILTERS: Array<{ label: string; value: "all" | PackageType }> = [
  { label: "ทั้งหมด", value: "all" },
  { label: "หลัก", value: "MAIN" },
  { label: "เสริม", value: "ADDON" },
];

const PACKAGE_TYPE_BADGES: Record<PackageType, { label: string; color: "primary" | "warning" }> = {
  MAIN: { label: "แพ็กเกจหลัก", color: "primary" },
  ADDON: { label: "แพ็กเกจเสริม", color: "warning" },
};

const notify = useNotify();
const { createSale } = useAdminSales();
const { customers, isLoading: isCustomersLoading } = useAdminCustomerOptions();
const { products, refresh } = usePackageCatalog();
const { uploadSlip } = useAdminPayments();

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
  paymentMethod: "CASH" as PaymentMethod,
  status: "VERIFIED" as PaymentStatus,
  note: "",
  slipImageId: null as string | null,
});

const form = reactive(createEmptyForm());
const isSubmitting = ref(false);
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
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: product.price * item.quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

const totalAmount = computed(() => cartItems.value.reduce((sum, item) => sum + item.totalPrice, 0));
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

const handleSlipSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  slipFile.value = target.files?.[0] ?? null;
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
  if (normalizedItems.value.length === 0) return notify.validationError("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");

  isSubmitting.value = true;
  try {
    await uploadSlipIfNeeded();
    const payload: CreateAdminSaleBody = {
      customerId: form.customerId,
      items: normalizedItems.value,
      paymentMethod: form.paymentMethod,
      status: form.status,
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

const openUploadedSlip = () => {
  const url = uploadedSlip.value?.secureUrl || uploadedSlip.value?.url;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
};
</script>

<template>
  <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
    <div class="space-y-6">
      <section class="rounded-2xl border border-default bg-default p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-lg font-semibold text-highlighted">ขายแพ็กเกจ</p>
            <p class="text-sm text-muted">เลือกแพ็กเกจและเพิ่มเข้าตะกร้าแบบ POS</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="ค้นหาชื่อแพ็กเกจ" class="w-full md:w-72" />
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="filter in PACKAGE_TYPE_FILTERS"
                :key="filter.value"
                :label="filter.label"
                :color="packageTypeFilter === filter.value ? 'neutral' : 'neutral'"
                :variant="packageTypeFilter === filter.value ? 'solid' : 'outline'"
                size="sm"
                @click="packageTypeFilter = filter.value"
              />
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <PosCatalogCard
            v-for="pkg in filteredProducts"
            :key="pkg.id"
            :title="pkg.name"
            :description="pkg.description"
            :badge-label="PACKAGE_TYPE_BADGES[pkg.packageType].label"
            :badge-color="PACKAGE_TYPE_BADGES[pkg.packageType].color"
            :price-label="formatCurrency(pkg.price)"
            :meta-label="`${pkg.credits ? `${pkg.credits} เครดิต` : 'ไม่จำกัดเครดิต'} • ${pkg.validityDays ? `${pkg.validityDays} วัน` : 'ไม่กำหนดอายุ'}`"
            :quantity="selectedItemMap.get(pkg.id)?.quantity ?? 0"
            :selected="selectedItemMap.has(pkg.id)"
            :decrement-disabled="!selectedItemMap.has(pkg.id)"
            @select="incrementProduct(pkg.id)"
            @decrement="decrementProduct(pkg.id)"
            @increment="incrementProduct(pkg.id)"
          />

          <div v-if="filteredProducts.length === 0" class="col-span-full rounded-2xl border border-dashed border-default p-10 text-center text-muted">
            ไม่พบแพ็กเกจที่ตรงกับตัวกรอง
          </div>
        </div>
      </section>
    </div>

    <aside class="space-y-6 xl:sticky xl:top-4 xl:self-start">
      <PosCheckoutPanel
        title="ตะกร้าแพ็กเกจ"
        description="เลือกลูกค้า รับชำระ และบันทึกรายการในหน้าเดียว"
        :customer-id="form.customerId"
        :customer-options="customerOptions"
        :customer-loading="isCustomersLoading"
        :payment-method="form.paymentMethod"
        :status="form.status"
        :note="form.note"
        total-label="ยอดรวมสุทธิ"
        :total-value="formatCurrency(totalAmount)"
        :total-meta="`${cartItems.length} รายการ • ${totalQuantity} ชิ้น`"
        submit-label="บันทึกรายการขายแพ็กเกจ"
        :is-submitting="isSubmitting"
        :uploaded-slip-url="uploadedSlip?.secureUrl || uploadedSlip?.url"
        :uploaded-slip-label="uploadedSlip?.secureUrl || uploadedSlip?.url || null"
        @update:customer-id="form.customerId = $event"
        @update:payment-method="form.paymentMethod = $event"
        @update:status="form.status = $event"
        @update:note="form.note = $event"
        @select-slip="handleSlipSelected"
        @open-slip="openUploadedSlip"
        @remove-slip="resetSlip"
        @submit="handleSubmit"
        @reset="resetForm"
      >
        <template #cart>
          <div class="rounded-2xl border border-default bg-neutral-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="font-medium text-highlighted">รายการที่เลือก</p>
              <span class="text-sm text-muted">{{ totalQuantity }} ชิ้น</span>
            </div>

            <div v-if="cartItems.length" class="mt-4 space-y-3">
              <div v-for="item in cartItems" :key="item.key" class="rounded-xl border border-default bg-default p-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate font-medium text-highlighted">{{ item.name }}</p>
                    <p class="text-xs text-muted">{{ PACKAGE_TYPE_BADGES[item.packageType].label }} • {{ item.validityDays ? `${item.validityDays} วัน` : "ไม่กำหนดอายุ" }}</p>
                  </div>
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="removeItem(item.key)" />
                </div>

                <div class="mt-3 flex items-center justify-between gap-3">
                  <div class="inline-flex items-center rounded-full border border-default">
                    <UButton icon="i-lucide-minus" color="neutral" variant="ghost" size="xs" @click="decrementItemByKey(item.key)" />
                    <span class="min-w-10 text-center text-sm font-medium">{{ item.quantity }}</span>
                    <UButton icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" @click="incrementItemByKey(item.key)" />
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-muted">{{ formatCurrency(item.unitPrice) }} / ชิ้น</p>
                    <p class="font-semibold text-highlighted">{{ formatCurrency(item.totalPrice) }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="mt-4 rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted">
              ยังไม่ได้เลือกแพ็กเกจ
            </div>
          </div>
        </template>
      </PosCheckoutPanel>
    </aside>
  </div>
</template>
