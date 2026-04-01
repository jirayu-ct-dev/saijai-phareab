<script setup lang="ts">
import type { PaymentMethod, PaymentStatus, PackageType } from "~~/shared/types/enums";
import type { AdminSaleItemInput, AdminSaleSlipImage, CreateAdminSaleBody } from "~~/app/composables/useAdminSales";
import { paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency } from "~~/shared/utils/format";

definePageMeta({
  layout: "admin",
});

type FormItemState = {
  key: string;
  productId: string;
  quantity: number;
};

const PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: PaymentMethod }> = [
  { label: "เงินสด", value: "CASH" },
  { label: "โอน", value: "TRANSFER" },
];

const PAYMENT_STATUS_OPTIONS: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.PENDING, value: "PENDING" },
  { label: paymentStatusLabels.VERIFIED, value: "VERIFIED" },
  { label: paymentStatusLabels.FAILED, value: "FAILED" },
];

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
const { isLoading, refresh, createSale } = useAdminSales();
const { users } = useAdminUsers();
const { packages } = usePackages();
const { uploadSlip } = useAdminPayments();

const searchQuery = ref("");
const packageTypeFilter = ref<"all" | PackageType>("all");

const packageMap = computed(() => new Map((packages.value ?? []).map((pkg) => [pkg.id, pkg])));

const customerOptions = computed(() =>
  (users.value ?? []).map((user) => ({
    label: `${user.name || user.email}${user.phoneNumber ? ` (${user.phoneNumber})` : ""}`,
    value: user.id,
  })),
);

const filteredPackages = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return (packages.value ?? []).filter((pkg) => {
    if (pkg.deletedAt || !pkg.isActive) return false;
    if (packageTypeFilter.value !== "all" && pkg.packageType !== packageTypeFilter.value) return false;
    if (!keyword) return true;

    return [pkg.name, pkg.description ?? "", pkg.packageType].join(" ").toLowerCase().includes(keyword);
  });
});

let itemKeySeed = 0;
const createItemKey = () => `sale-item-${++itemKeySeed}`;

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
const slipFileInput = ref<HTMLInputElement | null>(null);
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<AdminSaleSlipImage | null>(null);

const selectedItemMap = computed(() => new Map(form.items.map((item) => [item.productId, item])));

const cartItems = computed(() =>
  form.items
    .map((item) => {
      const product = packageMap.value.get(item.productId);
      if (!product) return null;

      const unitPrice = Number(product.price ?? 0);
      return {
        key: item.key,
        productId: item.productId,
        name: product.name,
        description: product.description,
        packageType: product.packageType,
        credits: product.credits,
        validityDays: product.validityDays,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

const totalAmount = computed(() => cartItems.value.reduce((sum, item) => sum + item.totalPrice, 0));
const totalQuantity = computed(() => cartItems.value.reduce((sum, item) => sum + item.quantity, 0));

const resetSlip = () => {
  slipFile.value = null;
  uploadedSlip.value = null;
  form.slipImageId = null;
  if (slipFileInput.value) {
    slipFileInput.value.value = "";
  }
};

const resetForm = () => {
  Object.assign(form, createEmptyForm());
  resetSlip();
};

const addProductToCart = (productId: string) => {
  const existingItem = selectedItemMap.value.get(productId);
  if (existingItem) {
    existingItem.quantity += 1;
    return;
  }

  form.items.push({
    key: createItemKey(),
    productId,
    quantity: 1,
  });
};

const incrementItem = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (item) item.quantity += 1;
};

const decrementItem = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;

  if (item.quantity <= 1) {
    form.items = form.items.filter((entry) => entry.key !== key);
    return;
  }

  item.quantity -= 1;
};

const removeItem = (key: string) => {
  form.items = form.items.filter((entry) => entry.key !== key);
};

const incrementProduct = (productId: string) => {
  const item = selectedItemMap.value.get(productId);
  if (item) {
    item.quantity += 1;
    return;
  }

  addProductToCart(productId);
};

const decrementProduct = (productId: string) => {
  const item = selectedItemMap.value.get(productId);
  if (!item) return;

  decrementItem(item.key);
};

const handleProductCardClick = (productId: string) => {
  incrementProduct(productId);
};

const handleProductCardContextMenu = (event: MouseEvent, productId: string) => {
  event.preventDefault();
  decrementProduct(productId);
};

const handleSlipSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  slipFile.value = target.files?.[0] ?? null;
};

const uploadSlipIfNeeded = async () => {
  if (!slipFile.value) return;

  const image = await uploadSlip(slipFile.value);
  if (!image) {
    throw new Error("upload-failed");
  }

  uploadedSlip.value = image;
  form.slipImageId = image.id;
};

const normalizedItems = computed<AdminSaleItemInput[]>(() =>
  cartItems.value.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  })),
);

const handleSubmit = async () => {
  if (!form.customerId) {
    notify.validationError("กรุณาเลือกลูกค้า");
    return;
  }

  if (normalizedItems.value.length === 0) {
    notify.validationError("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
    return;
  }

  isSubmitting.value = true;

  try {
    await uploadSlipIfNeeded();

    const payload: CreateAdminSaleBody = {
      customerId: form.customerId,
      items: normalizedItems.value,
      paymentMethod: form.paymentMethod,
      status: form.status,
      note: form.note.trim() || null,
      slipImageId: form.slipImageId ?? null,
    };

    const ok = await createSale(payload);

    if (ok) {
      resetForm();
      await refresh();
    }
  } catch {
    notify.error("ไม่สามารถอัปโหลดสลิปได้");
  } finally {
    isSubmitting.value = false;
  }
};

const handleRefresh = async () => {
  await refresh();
};

const openUploadedSlip = () => {
  const url = uploadedSlip.value?.secureUrl || uploadedSlip.value?.url;
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};
</script>

<template>
  <UDashboardPanel id="sales-pos">
    <template #header>
      <UDashboardNavbar title="หน้าคิดเงิน" icon="i-lucide-shopping-cart">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="รีเฟรช"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              :loading="isLoading"
              @click="handleRefresh"
            />
            <UButton
              label="ดูประวัติชำระเงิน"
              icon="i-lucide-receipt"
              color="neutral"
              variant="outline"
              @click="navigateTo('/admin/payment')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <div class="space-y-6">
          <section class="rounded-2xl border border-default bg-default p-5 shadow-sm">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-lg font-semibold text-highlighted">เลือกสินค้า</p>
                <p class="text-sm text-muted">ค้นหาและกดเลือก package เพื่อเพิ่มเข้าตะกร้าได้ทันที</p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <UInput
                  v-model="searchQuery"
                  icon="i-lucide-search"
                  placeholder="ค้นหาชื่อ package"
                  class="w-full md:w-72"
                />

                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="filter in PACKAGE_TYPE_FILTERS"
                    :key="filter.value"
                    :label="filter.label"
                    :color="packageTypeFilter === filter.value ? 'primary' : 'neutral'"
                    :variant="packageTypeFilter === filter.value ? 'solid' : 'outline'"
                    size="sm"
                    @click="packageTypeFilter = filter.value"
                  />
                </div>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <div
                v-for="pkg in filteredPackages"
                :key="pkg.id"
                role="button"
                tabindex="0"
                class="group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                :class="selectedItemMap.has(pkg.id)
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-default bg-elevated/40 hover:border-primary/40'"
                @click="handleProductCardClick(pkg.id)"
                @contextmenu.prevent="handleProductCardContextMenu($event, pkg.id)"
                @keydown.enter.prevent="handleProductCardClick(pkg.id)"
                @keydown.space.prevent="handleProductCardClick(pkg.id)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-base font-semibold text-highlighted">
                      {{ pkg.name }}
                    </p>
                    <p class="mt-1 line-clamp-2 min-h-10 text-sm text-muted">
                      {{ pkg.description || 'ไม่มีรายละเอียดเพิ่มเติม' }}
                    </p>
                  </div>

                  <UBadge
                    :color="PACKAGE_TYPE_BADGES[pkg.packageType].color"
                    class="min-w-22 flex items-center justify-center"
                    variant="subtle"
                  >
                    {{ PACKAGE_TYPE_BADGES[pkg.packageType].label }}
                  </UBadge>
                </div>

                <div class="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p class="text-xl font-semibold text-highlighted">
                      {{ formatCurrency(Number(pkg.price ?? 0)) }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ pkg.credits ? `${pkg.credits} เครดิต` : 'ไม่จำกัดเครดิต' }}
                      ·
                      {{ pkg.validityDays ? `${pkg.validityDays} วัน` : 'ไม่กำหนดอายุ' }}
                    </p>
                  </div>

                  <div class="text-right">
                    <p class="text-xs text-muted">เลือกแล้ว</p>
                    <div class="mt-1 inline-flex items-center gap-1 rounded-md border border-default bg-default/70 px-1 py-1">
                      <UButton
                        icon="i-lucide-minus"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :disabled="!selectedItemMap.has(pkg.id)"
                        @click.stop="decrementProduct(pkg.id)"
                      />
                      <p class="min-w-8 text-center text-lg font-semibold text-primary">
                        {{ selectedItemMap.get(pkg.id)?.quantity ?? 0 }}
                      </p>
                      <UButton
                        icon="i-lucide-plus"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click.stop="incrementProduct(pkg.id)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="filteredPackages.length === 0"
                class="col-span-full rounded-2xl border border-dashed border-default p-10 text-center text-muted"
              >
                ไม่พบ package ที่ตรงกับตัวกรอง
              </div>
            </div>
          </section>
        </div>

        <aside class="space-y-6 xl:sticky xl:top-4 xl:self-start">
          <section class="rounded-2xl border border-default bg-default p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-lg font-semibold text-highlighted">ตะกร้าและชำระเงิน</p>
                <p class="text-sm text-muted">เลือกสินค้า ลูกค้า และรับชำระในหน้าเดียว</p>
              </div>
            </div>

            <div class="mt-5 space-y-4">
              <UFormField label="ลูกค้า" required>
                <USelect
                  v-model="form.customerId"
                  :items="customerOptions"
                  value-key="value"
                  searchable
                  class="w-full"
                />
              </UFormField>

              <div class="rounded-2xl border border-default bg-elevated/20 p-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-medium text-highlighted">รายการที่เลือก</p>
                  <span class="text-sm text-muted">{{ totalQuantity }} ชิ้น</span>
                </div>

                <div v-if="cartItems.length" class="mt-4 space-y-3">
                  <div
                    v-for="item in cartItems"
                    :key="item.key"
                    class="rounded-xl border border-default bg-default p-3"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="truncate font-medium text-highlighted">{{ item.name }}</p>
                        <p class="text-xs text-muted">
                          {{ PACKAGE_TYPE_BADGES[item.packageType].label }}
                          ·
                          {{ item.validityDays ? `${item.validityDays} วัน` : 'ไม่กำหนดอายุ' }}
                        </p>
                      </div>

                      <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        @click="removeItem(item.key)"
                      />
                    </div>

                    <div class="mt-3 flex items-center justify-between gap-3">
                      <div class="inline-flex items-center rounded-full border border-default">
                        <UButton
                          icon="i-lucide-minus"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="decrementItem(item.key)"
                        />
                        <span class="min-w-10 text-center text-sm font-medium">{{ item.quantity }}</span>
                        <UButton
                          icon="i-lucide-plus"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="incrementItem(item.key)"
                        />
                      </div>

                      <div class="text-right">
                        <p class="text-xs text-muted">{{ formatCurrency(item.unitPrice) }} / ชิ้น</p>
                        <p class="font-semibold text-highlighted">{{ formatCurrency(item.totalPrice) }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="mt-4 rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted">
                  ยังไม่ได้เลือกสินค้า
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <UFormField label="ช่องทางชำระเงิน" required>
                  <USelect
                    v-model="form.paymentMethod"
                    :items="PAYMENT_METHOD_OPTIONS"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="สถานะการชำระเงิน" required>
                  <USelect
                    v-model="form.status"
                    :items="PAYMENT_STATUS_OPTIONS"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <UFormField :label="form.paymentMethod === 'TRANSFER' ? 'สลิปโอนเงิน' : 'หลักฐานการชำระเงิน'">
                <div class="space-y-3">
                  <input
                    ref="slipFileInput"
                    type="file"
                    accept="image/*"
                    class="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                    @change="handleSlipSelected"
                  >

                  <div
                    v-if="uploadedSlip?.secureUrl || uploadedSlip?.url"
                    class="rounded-xl border border-default bg-elevated/20 p-3"
                  >
                    <p class="truncate text-sm font-medium text-highlighted">
                      {{ uploadedSlip?.secureUrl || uploadedSlip?.url }}
                    </p>
                    <div class="mt-3 flex items-center gap-2">
                      <UButton
                        label="เปิดดู"
                        size="sm"
                        color="neutral"
                        variant="outline"
                        @click="openUploadedSlip"
                      />
                      <UButton
                        label="ลบ"
                        size="sm"
                        color="error"
                        variant="ghost"
                        @click="resetSlip"
                      />
                    </div>
                  </div>
                </div>
              </UFormField>

              <UFormField label="หมายเหตุ">
                <UTextarea
                  v-model="form.note"
                  class="w-full"
                  :rows="3"
                  placeholder="รายละเอียดเพิ่มเติมของการขายหรือการรับชำระ"
                />
              </UFormField>

              <div class="rounded-2xl bg-primary text-primary-foreground p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm/5 opacity-80">ยอดรวมสุทธิ</p>
                    <p class="text-3xl font-semibold">{{ formatCurrency(totalAmount) }}</p>
                  </div>
                  <div class="text-right text-sm opacity-90">
                    <p>{{ cartItems.length }} รายการ</p>
                    <p>{{ totalQuantity }} ชิ้น</p>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <UButton
                  label="ชำระเงินและบันทึกรายการ"
                  icon="i-lucide-check"
                  color="primary"
                  block
                  :loading="isSubmitting"
                  @click="handleSubmit"
                />
                <UButton
                  label="ล้างข้อมูล"
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="outline"
                  block
                  @click="resetForm"
                />
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </UDashboardPanel>
</template>
