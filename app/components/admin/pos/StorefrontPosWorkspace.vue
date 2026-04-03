<script setup lang="ts">
import { CalendarDate } from "@internationalized/date";
import PosCatalogCard from "~~/app/components/admin/pos/PosCatalogCard.vue";
import PosCheckoutPanel from "~~/app/components/admin/pos/PosCheckoutPanel.vue";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import type { AdminSaleSlipImage } from "~~/app/composables/useAdminSales";
import { DEFAULT_HANGER_PRICE_PER_UNIT } from "~~/shared/config/posConfig";
import { formatCurrency } from "~~/shared/utils/format";

type FormItemState = {
  key: string;
  storefrontPriceId: string;
  quantity: number;
};

const emit = defineEmits<{
  completed: [payload: { paymentId: string; serviceOrderId: string; orderNo: string | null; saleType: "STOREFRONT"; title: string }];
}>();

const notify = useNotify();
const { customers, isLoading: isCustomersLoading } = useAdminCustomerOptions();
const { items, refresh } = useStorefrontCatalog();
const { createServiceOrder } = useAdminServiceOrders();
const { uploadSlip } = useAdminPayments();

const searchQuery = ref("");
const categoryFilter = ref<"all" | string>("all");
const serviceFilter = ref<"all" | string>("all");

const catalogMap = computed(() => new Map((items.value ?? []).map((item) => [item.id, item])));
const categoryOptions = computed(() => {
  const map = new Map<string, string>();
  for (const item of items.value ?? []) {
    if (item.categoryId && item.categoryName) map.set(item.categoryId, item.categoryName);
  }

  return [{ label: "ทุกหมวดหมู่", value: "all" }, ...Array.from(map.entries()).map(([value, label]) => ({ label, value }))];
});
const serviceOptions = computed(() => {
  const map = new Map<string, string>();
  for (const item of items.value ?? []) {
    map.set(item.serviceId, item.serviceName);
  }

  return [{ label: "ทุกบริการ", value: "all" }, ...Array.from(map.entries()).map(([value, label]) => ({ label, value }))];
});
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

const filteredCatalog = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  return (items.value ?? []).filter((item) => {
    if (categoryFilter.value !== "all" && item.categoryId !== categoryFilter.value) return false;
    if (serviceFilter.value !== "all" && item.serviceId !== serviceFilter.value) return false;
    if (!keyword) return true;

    return [item.label, item.categoryName ?? "", item.serviceName, item.itemName].join(" ").toLowerCase().includes(keyword);
  });
});

let itemKeySeed = 0;
const createItemKey = () => `service-pos-item-${++itemKeySeed}`;

const createEmptyForm = () => ({
  customerId: "",
  items: [] as FormItemState[],
  hangerCount: 0,
  discountAmount: 0,
  paymentMethod: "CASH" as PaymentMethod,
  status: "VERIFIED" as PaymentStatus,
  note: "",
  slipImageId: null as string | null,
});

const form = reactive(createEmptyForm());
const dueDate = shallowRef<CalendarDate | null>(null);
const dueTime = ref("00:00");
const isSubmitting = ref(false);
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<AdminSaleSlipImage | null>(null);

const selectedItemMap = computed(() => new Map(form.items.map((item) => [item.storefrontPriceId, item])));
const cartItems = computed(() =>
  form.items
    .map((item) => {
      const catalog = catalogMap.value.get(item.storefrontPriceId);
      if (!catalog) return null;

      return {
        key: item.key,
        storefrontPriceId: item.storefrontPriceId,
        label: catalog.label,
        categoryName: catalog.categoryName,
        quantity: item.quantity,
        unitPrice: catalog.price,
        totalPrice: catalog.price * item.quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
);

const subtotalAmount = computed(() => cartItems.value.reduce((sum, item) => sum + item.totalPrice, 0));
const totalQuantity = computed(() => cartItems.value.reduce((sum, item) => sum + item.quantity, 0));
watch(
  totalQuantity,
  (value) => {
    if (form.hangerCount < value) form.hangerCount = value;
  },
  { immediate: true },
);

const hangerCharge = computed(() => ({
  count: form.hangerCount,
  pricePerUnit: DEFAULT_HANGER_PRICE_PER_UNIT,
  total: form.hangerCount * DEFAULT_HANGER_PRICE_PER_UNIT,
}));
const sanitizedDiscountAmount = computed(() => {
  const raw = Number(form.discountAmount || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  return Math.min(raw, subtotalAmount.value);
});
const dueTimeOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ label: value, value });
    }
  }

  return options;
});
const dueTimeLabel = computed(() => dueTime.value || "00:00");
const dueAtValue = computed(() => {
  if (!dueDate.value) return null;
  return `${dueDate.value.toString()}T${dueTimeLabel.value}`;
});
const totalAmount = computed(() => subtotalAmount.value - sanitizedDiscountAmount.value + hangerCharge.value.total);

const normalizedItems = computed(() =>
  cartItems.value.map((item) => ({
    storefrontPriceId: item.storefrontPriceId,
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
  dueDate.value = null;
  dueTime.value = "00:00";
  resetSlip();
};

const addCatalogToCart = (storefrontPriceId: string) => {
  const existing = selectedItemMap.value.get(storefrontPriceId);
  if (existing) {
    existing.quantity += 1;
    return;
  }

  form.items.push({ key: createItemKey(), storefrontPriceId, quantity: 1 });
};

const decrementItemByKey = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (!item) return;

  if (item.quantity <= 1) {
    form.items = form.items.filter((entry) => entry.key !== key);
    return;
  }

  item.quantity -= 1;
};

const incrementItemByKey = (key: string) => {
  const item = form.items.find((entry) => entry.key === key);
  if (item) item.quantity += 1;
};

const decrementCatalog = (storefrontPriceId: string) => {
  const item = selectedItemMap.value.get(storefrontPriceId);
  if (item) decrementItemByKey(item.key);
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
  if (normalizedItems.value.length === 0) return notify.validationError("กรุณาเลือกบริการอย่างน้อย 1 รายการ");

  isSubmitting.value = true;
  try {
    await uploadSlipIfNeeded();
    const result = await createServiceOrder({
      customerId: form.customerId,
      items: normalizedItems.value,
      hangerCount: form.hangerCount,
      dueAt: dueAtValue.value,
      discountAmount: sanitizedDiscountAmount.value,
      paymentMethod: form.paymentMethod,
      status: form.status,
      note: form.note.trim() || null,
      slipImageId: form.slipImageId,
    });

    if (result) {
      emit("completed", {
        paymentId: result.paymentId,
        serviceOrderId: result.id,
        orderNo: result.orderNo,
        saleType: "STOREFRONT",
        title: "บันทึกรายการรับผ้าสำเร็จ",
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
        <div class="flex flex-col gap-4">
          <div>
            <p class="text-lg font-semibold text-highlighted">รับงานหน้าร้าน</p>
            <p class="text-sm text-muted">นับผ้าตามชิ้น ใส่วันนัดรับ คิดค่าไม้แขวน และส่วนลดได้ในหน้าเดียว</p>
          </div>

          <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
            <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="ค้นหาบริการหรือชนิดผ้า" class="w-full lg:w-72" />
            <USelect v-model="categoryFilter" :items="categoryOptions" value-key="value" class="w-full lg:w-52" />
            <USelect v-model="serviceFilter" :items="serviceOptions" value-key="value" class="w-full lg:w-52" />
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <PosCatalogCard
            v-for="item in filteredCatalog"
            :key="item.id"
            :title="item.label"
            :description="item.categoryName || item.serviceName"
            badge-label="บริการหน้าร้าน"
            badge-color="info"
            :price-label="formatCurrency(item.price)"
            :meta-label="item.categoryName ? `${item.categoryName} · ${item.serviceName}` : item.serviceName"
            :quantity="selectedItemMap.get(item.id)?.quantity ?? 0"
            :selected="selectedItemMap.has(item.id)"
            :decrement-disabled="!selectedItemMap.has(item.id)"
            @select="addCatalogToCart(item.id)"
            @decrement="decrementCatalog(item.id)"
            @increment="addCatalogToCart(item.id)"
          />

          <div v-if="filteredCatalog.length === 0" class="col-span-full rounded-2xl border border-dashed border-default p-10 text-center text-muted">
            ไม่พบบริการที่ตรงกับตัวกรอง
          </div>
        </div>
      </section>
    </div>

    <aside class="space-y-6 xl:sticky xl:top-4 xl:self-start">
      <PosCheckoutPanel
        title="ตะกร้ารับผ้า"
        description="สรุปรายการผ้า วันนัดรับ และการชำระเงินในหน้าเดียว"
        :customer-id="form.customerId"
        :customer-options="customerOptions"
        :customer-loading="isCustomersLoading"
        :payment-method="form.paymentMethod"
        :status="form.status"
        :note="form.note"
        total-label="ยอดสุทธิ"
        :total-value="formatCurrency(totalAmount)"
        :total-meta="`${cartItems.length} รายการ · ${totalQuantity} ชิ้น`"
        submit-label="บันทึกรับผ้า"
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
                    <p class="wrap-break-word font-medium text-highlighted">{{ item.label }}</p>
                    <p class="text-xs text-muted">{{ item.categoryName || "หน้าร้าน" }}</p>
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

              <div class="rounded-xl border border-default bg-default p-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted">รวมค่าบริการ</span>
                  <span class="font-medium text-highlighted">{{ formatCurrency(subtotalAmount) }}</span>
                </div>

                <div class="mt-3 rounded-xl border border-default bg-neutral-50 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-muted">รวมจำนวนผ้าทั้งหมด</span>
                    <span class="font-medium text-highlighted">{{ totalQuantity }} ชิ้น</span>
                  </div>

                  <div class="mt-3 flex items-end gap-3">
                    <UFormField label="จำนวนไม้แขวน" class="flex-1">
                      <UInputNumber v-model="form.hangerCount" :min="0" :step="1" orientation="vertical" class="w-full" />
                    </UFormField>
                    <UButton label="ใช้ตามจำนวนผ้า" color="neutral" variant="outline" @click="form.hangerCount = totalQuantity" />
                  </div>

                  <div class="mt-2 flex items-center justify-between gap-3">
                    <span class="text-muted">ค่าไม้แขวน {{ hangerCharge.count }} ชิ้น</span>
                    <span class="font-medium text-highlighted">{{ formatCurrency(hangerCharge.total) }}</span>
                  </div>

                  <div class="mt-3">
                    <p class="mb-2 text-sm font-medium text-highlighted">วันนัดรับ</p>
                    <div class="grid grid-cols-2 gap-2">
                      <UPopover>
                        <UInputDate v-model="dueDate" icon="i-lucide-calendar" class="w-full" />
                        <template #content>
                          <UCalendar v-model="dueDate" locale="th-TH" class="p-2" />
                        </template>
                      </UPopover>

                      <USelect
                        v-model="dueTime"
                        :items="dueTimeOptions"
                        value-key="value"
                        icon="i-lucide-clock"
                        class="w-full"
                      />
                    </div>
                  </div>

                  <div class="mt-3">
                    <p class="mb-2 text-sm font-medium text-highlighted">ส่วนลด</p>
                    <UInputNumber
                      v-model="form.discountAmount"
                      :min="0"
                      :max="subtotalAmount"
                      :step="1"
                      :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }"
                      class="w-full"
                    />
                  </div>

                  <div class="mt-2 flex items-center justify-between gap-3">
                    <span class="text-muted">ส่วนลด</span>
                    <span class="font-medium text-highlighted">-{{ formatCurrency(sanitizedDiscountAmount) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="mt-4 rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted">
              ยังไม่ได้เลือกบริการ
            </div>
          </div>
        </template>
      </PosCheckoutPanel>
    </aside>
  </div>
</template>
