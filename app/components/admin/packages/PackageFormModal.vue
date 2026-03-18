<script setup lang="ts">
import type { Package } from "~~/shared/types/package";
import type { CreatePackageBody } from "~~/app/composables/usePackages";
import { packageTypeLabels } from "~~/shared/config/packageConfig";

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
    open: boolean;
    /** null = โหมดสร้างใหม่, Package = โหมดแก้ไข */
    editPackage: Package | null;
    /** รายการแพ็กเกจเสริม (ADDON) ที่ Active สำหรับเลือกใน Bundle */
    addonPackages: Package[];
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    save: [data: CreatePackageBody];
}>();

// ============================================================
// Form State
// ============================================================

interface BundleAddonRow {
    addonPackageId: string;
    quantity: number;
}

interface BonusRow {
    storefrontPriceId: string;
    quantity: number;
}

interface FormState {
    name: string;
    description: string;
    packageType: "MAIN" | "ADDON";
    price: number | null;
    credits: number | null;
    bonusCredits: number | null;
    validityDays: number | null;
    isActive: boolean;
    bundledAddons: BundleAddonRow[];
    packageBonuses: BonusRow[];
}

const defaultState = (): FormState => ({
    name: "",
    description: "",
    packageType: "MAIN",
    price: null,
    credits: null,
    bonusCredits: 0,
    validityDays: null,
    isActive: true,
    bundledAddons: [],
    packageBonuses: [],
});

const state = reactive<FormState>(defaultState());

// ============================================================
// Computed
// ============================================================

const isEditMode = computed(() => props.editPackage !== null);
const modalTitle = computed(() =>
    isEditMode.value ? "แก้ไขแพ็กเกจ" : "เพิ่มแพ็กเกจใหม่",
);

const typeOptions = [
    { label: packageTypeLabels.MAIN, value: "MAIN" },
    { label: packageTypeLabels.ADDON, value: "ADDON" },
];

// ============================================================
// Bundle
// ============================================================

const addonOptions = computed(() =>
    props.addonPackages.map((p) => ({ label: p.name, value: p.id })),
);

const selectedAddonIds = computed(
    () => new Set(state.bundledAddons.map((b) => b.addonPackageId)),
);

const availableAddonOptions = computed(() =>
    addonOptions.value.filter((o) => !selectedAddonIds.value.has(o.value)),
);

const selectedNewAddon = ref<string | undefined>(undefined);
const bundleSelectKey = ref(0);

const getAddonName = (id: string): string =>
    props.addonPackages.find((p) => p.id === id)?.name ?? id;

const addBundleAddon = () => {
    if (!selectedNewAddon.value) return;
    state.bundledAddons.push({
        addonPackageId: selectedNewAddon.value,
        quantity: 1,
    });
    selectedNewAddon.value = undefined;
    bundleSelectKey.value++;
};

const removeBundleAddon = (index: number) => {
    state.bundledAddons.splice(index, 1);
    bundleSelectKey.value++;
};

// ============================================================
// Bonus
// ============================================================

const { data: storefrontPrices } = useFetch<{ id: string; name: string }[]>(
    "/api/admin/storefront-prices",
    { default: () => [] },
);

const selectedBonusIds = computed(
    () => new Set(state.packageBonuses.map((b) => b.storefrontPriceId)),
);

const availableBonusOptions = computed(() =>
    storefrontPrices.value
        .filter((p) => !selectedBonusIds.value.has(p.id))
        .map((p) => ({ value: p.id, label: p.name })),
);

const selectedNewBonus = ref<string | undefined>(undefined);
const bonusSelectKey = ref(0);

const getStorefrontName = (id: string): string =>
    storefrontPrices.value.find((p) => p.id === id)?.name ?? id;

const addBonus = () => {
    if (!selectedNewBonus.value) return;
    state.packageBonuses.push({
        storefrontPriceId: selectedNewBonus.value,
        quantity: 1,
    });
    selectedNewBonus.value = undefined;
    bonusSelectKey.value++;
};

const removeBonus = (index: number) => {
    state.packageBonuses.splice(index, 1);
    bonusSelectKey.value++;
};

// ============================================================
// Validation
// ============================================================

interface FormErrors {
    name?: string;
    price?: string;
}

const errors = ref<FormErrors>({});

const validate = (): boolean => {
    const e: FormErrors = {};
    if (!state.name.trim()) e.name = "กรุณากรอกชื่อแพ็กเกจ";
    if (state.price === null || state.price < 0)
        e.price = "กรุณากรอกราคาที่ถูกต้อง (≥ 0)";
    errors.value = e;
    return Object.keys(e).length === 0;
};

// ============================================================
// Sync: populate form เมื่อ open / editPackage เปลี่ยน
// ============================================================

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        errors.value = {};
        selectedNewAddon.value = undefined;
        selectedNewBonus.value = undefined;

        if (props.editPackage) {
            const p = props.editPackage;
            state.name = p.name;
            state.description = p.description ?? "";
            state.packageType = p.packageType as "MAIN" | "ADDON";
            state.price = Number(p.price);
            state.credits = p.credits ?? null;
            state.bonusCredits = p.bonusCredits ?? 0;
            state.validityDays = p.validityDays ?? null;
            state.isActive = p.isActive;
            state.bundledAddons =
                p.bundledAddons?.map((b) => ({
                    addonPackageId: b.addonPackageId,
                    quantity: b.quantity,
                })) ?? [];
            state.packageBonuses =
                p.packageBonuses?.map((b) => ({
                    storefrontPriceId: b.storefrontPriceId,
                    quantity: b.quantity,
                })) ?? [];
        } else {
            Object.assign(state, defaultState());
        }
    },
    { immediate: true },
);

// เปลี่ยน packageType → ADDON ล้าง bundle + bonus
watch(
    () => state.packageType,
    (type) => {
        if (type === "ADDON") {
            state.bundledAddons = [];
            state.packageBonuses = [];
        }
    },
);

// ============================================================
// Submit
// ============================================================

const submitting = ref(false);

const handleSubmit = async () => {
    if (!validate()) return;
    submitting.value = true;

    const isMain = state.packageType === "MAIN";

    emit("save", {
        name: state.name.trim(),
        description: state.description.trim() || null,
        packageType: state.packageType,
        price: state.price!,
        credits: state.credits,
        bonusCredits: state.bonusCredits ?? 0,
        validityDays: state.validityDays,
        isActive: state.isActive,
        bundledAddons: isMain ? state.bundledAddons : [],
        packageBonuses: isMain ? state.packageBonuses : [],
    });

    submitting.value = false;
};

const handleClose = () => emit("update:open", false);
</script>

<template>
    <UModal
        :open="open"
        :title="modalTitle"
        :ui="{ content: 'max-w-lg' }"
        @update:open="emit('update:open', $event)"
    >
        <template #body>
            <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
                <!-- ชื่อแพ็กเกจ -->
                <UFormField label="ชื่อแพ็กเกจ" required :error="errors.name">
                    <UInput
                        v-model="state.name"
                        placeholder="เช่น แพ็กเกจรายเดือน S"
                        class="w-full"
                        :color="errors.name ? 'error' : undefined"
                    />
                </UFormField>

                <!-- คำอธิบาย -->
                <UFormField label="คำอธิบาย (ไม่บังคับ)">
                    <UInput
                        v-model="state.description"
                        placeholder="รายละเอียดแพ็กเกจโดยย่อ..."
                        class="w-full"
                    />
                </UFormField>

                <!-- ประเภท + สถานะ -->
                <div class="grid grid-cols-2 gap-4">
                    <UFormField label="ประเภทแพ็กเกจ" required>
                        <USelect
                            v-model="state.packageType"
                            :items="typeOptions"
                            value-key="value"
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField label="สถานะ">
                        <div class="flex items-center gap-2 h-9">
                            <USwitch v-model="state.isActive" color="success" />
                            <span
                                class="text-sm"
                                :class="
                                    state.isActive
                                        ? 'text-success'
                                        : 'text-muted'
                                "
                            >
                                {{
                                    state.isActive
                                        ? "เปิดใช้งาน"
                                        : "ปิดการใช้งาน"
                                }}
                            </span>
                        </div>
                    </UFormField>
                </div>

                <!-- ราคา + วันหมดอายุ -->
                <div class="grid grid-cols-2 gap-4">
                    <UFormField
                        label="ราคา (บาท)"
                        required
                        :error="errors.price"
                    >
                        <UInput
                            v-model.number="state.price"
                            type="number"
                            min="0"
                            placeholder="0"
                            class="w-full"
                            :color="errors.price ? 'error' : undefined"
                        >
                            <template #trailing>
                                <span class="text-muted text-xs">฿</span>
                            </template>
                        </UInput>
                    </UFormField>

                    <UFormField label="อายุการใช้งาน (วัน)">
                        <UInput
                            v-model.number="state.validityDays"
                            type="number"
                            min="1"
                            placeholder="ไม่จำกัด"
                            class="w-full"
                        >
                            <template #trailing>
                                <span class="text-muted text-xs">วัน</span>
                            </template>
                        </UInput>
                    </UFormField>
                </div>

                <!-- เครดิต + เครดิตโบนัส -->
                <div class="grid grid-cols-2 gap-4">
                    <UFormField label="เครดิต">
                        <UInput
                            v-model.number="state.credits"
                            type="number"
                            min="0"
                            placeholder="ไม่มีเครดิต"
                            class="w-full"
                        >
                            <template #trailing>
                                <span class="text-muted text-xs">เครดิต</span>
                            </template>
                        </UInput>
                    </UFormField>

                    <UFormField label="เครดิตโบนัส (แถมฟรี)">
                        <UInput
                            v-model.number="state.bonusCredits"
                            type="number"
                            min="0"
                            placeholder="0"
                            class="w-full"
                        >
                            <template #trailing>
                                <span class="text-success text-xs font-medium"
                                    >+โบนัส</span
                                >
                            </template>
                        </UInput>
                    </UFormField>
                </div>

                <!-- ======================================================== -->
                <!-- MAIN-only sections: Bundle + Bonus                        -->
                <!-- ======================================================== -->
                <template v-if="state.packageType === 'MAIN'">
                    <!-- Bundle -->
                    <USeparator label="จัดเซ็ตโปรโมชัน" />

                    <div class="flex flex-col gap-3">
                        <p class="text-sm text-muted">
                            เลือกแพ็กเกจเสริมที่ต้องการผูกเข้ากับแพ็กเกจนี้
                        </p>

                        <div
                            v-if="state.bundledAddons.length"
                            class="flex flex-col gap-2"
                        >
                            <div
                                v-for="(bundle, index) in state.bundledAddons"
                                :key="bundle.addonPackageId"
                                class="flex items-center gap-2 p-2 rounded-lg bg-elevated border border-default"
                            >
                                <UBadge
                                    variant="subtle"
                                    color="secondary"
                                    class="shrink-0"
                                >
                                    เสริม
                                </UBadge>
                                <span
                                    class="flex-1 text-sm font-medium truncate"
                                >
                                    {{ getAddonName(bundle.addonPackageId) }}
                                </span>
                                <UInput
                                    v-model.number="bundle.quantity"
                                    type="number"
                                    min="1"
                                    class="w-16"
                                    size="xs"
                                />
                                <span class="text-xs text-muted shrink-0"
                                    >ชิ้น</span
                                >
                                <UButton
                                    icon="i-lucide-x"
                                    size="xs"
                                    color="error"
                                    variant="ghost"
                                    @click="removeBundleAddon(index)"
                                />
                            </div>
                        </div>

                        <USelect
                            :key="bundleSelectKey"
                            v-model="selectedNewAddon"
                            :items="availableAddonOptions"
                            value-key="value"
                            placeholder="เลือกแพ็กเกจเสริม..."
                            class="w-full"
                            :disabled="availableAddonOptions.length === 0"
                            @update:model-value="addBundleAddon"
                        />
                        <p v-if="availableAddonOptions.length === 0" class="text-xs text-muted">
                            ไม่มีแพ็กเกจเสริมที่สามารถเลือกได้ในระบบ
                        </p>

                        <p
                            v-if="
                                availableAddonOptions.length === 0 &&
                                !addonPackages.length
                            "
                            class="text-xs text-muted"
                        >
                            ยังไม่มีแพ็กเกจเสริมที่สามารถเลือกได้ในระบบ
                        </p>
                    </div>

                    <!-- Bonus -->
                    <USeparator label="โบนัสแพ็กเกจ (ของแถม)" />

                    <div class="flex flex-col gap-3">
                        <p class="text-sm text-muted">
                            เลือกรายการบริการที่ต้องการแถมให้กับแพ็กเกจนี้
                        </p>

                        <div
                            v-if="state.packageBonuses.length"
                            class="flex flex-col gap-2"
                        >
                            <div
                                v-for="(bonus, index) in state.packageBonuses"
                                :key="bonus.storefrontPriceId"
                                class="flex items-center gap-2 p-2 rounded-lg bg-success/5 border border-success/15"
                            >
                                <UIcon
                                    name="i-lucide-gift"
                                    class="size-4 text-success shrink-0"
                                />
                                <span
                                    class="flex-1 text-sm font-medium truncate"
                                >
                                    {{
                                        getStorefrontName(
                                            bonus.storefrontPriceId,
                                        )
                                    }}
                                </span>
                                <UInput
                                    v-model.number="bonus.quantity"
                                    type="number"
                                    min="1"
                                    class="w-16"
                                    size="xs"
                                />
                                <span class="text-xs text-muted shrink-0"
                                    >ชิ้น</span
                                >
                                <UButton
                                    icon="i-lucide-x"
                                    size="xs"
                                    color="error"
                                    variant="ghost"
                                    @click="removeBonus(index)"
                                />
                            </div>
                        </div>

                        <USelect
                            :key="bonusSelectKey"
                            v-model="selectedNewBonus"
                            :items="availableBonusOptions"
                            value-key="value"
                            placeholder="เลือกรายการที่ต้องการแถม..."
                            class="w-full"
                            :disabled="availableBonusOptions.length === 0"
                            @update:model-value="addBonus"
                        />

                        <p
                            v-if="
                                availableBonusOptions.length === 0 &&
                                !storefrontPrices.length
                            "
                            class="text-xs text-muted"
                        >
                            ยังไม่มีรายการบริการในระบบ
                        </p>
                    </div>
                </template>

                <!-- Actions -->
                <div class="flex justify-end gap-2 pt-2">
                    <UButton
                        label="ยกเลิก"
                        color="neutral"
                        variant="ghost"
                        @click="handleClose"
                    />
                    <UButton
                        type="submit"
                        :label="isEditMode ? 'บันทึกการแก้ไข' : 'สร้างแพ็กเกจ'"
                        :icon="isEditMode ? 'i-lucide-save' : 'i-lucide-plus'"
                        color="primary"
                        :loading="submitting"
                    />
                </div>
            </form>
        </template>
    </UModal>
</template>
