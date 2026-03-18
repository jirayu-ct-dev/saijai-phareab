<script setup lang="ts">
/**
 * PackageFormModal — Modal สำหรับสร้างและแก้ไขแพ็กเกจ
 *
 * - ถ้า `editPackage` เป็น null  → โหมดสร้างใหม่
 * - ถ้า `editPackage` มีค่า      → โหมดแก้ไข (populate form อัตโนมัติ)
 * - Bundle section จะแสดงเฉพาะตอน packageType === 'MAIN'
 */

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
});

const state = reactive<FormState>(defaultState());

// ============================================================
// Computed
// ============================================================

const isEditMode = computed(() => props.editPackage !== null);
const modalTitle = computed(() =>
    isEditMode.value ? "แก้ไขแพ็กเกจ" : "เพิ่มแพ็กเกจใหม่",
);

/** Package type select options */
const typeOptions = [
    { label: packageTypeLabels.MAIN, value: "MAIN" },
    { label: packageTypeLabels.ADDON, value: "ADDON" },
];

/** Addon package select options สำหรับ Bundle picker */
const addonOptions = computed(() =>
    props.addonPackages.map((p) => ({ label: p.name, value: p.id })),
);

/** IDs ที่ถูกเลือกไปแล้ว (ป้องกันเลือกซ้ำ) */
const selectedAddonIds = computed(
    () => new Set(state.bundledAddons.map((b) => b.addonPackageId)),
);

/** Addon options ที่ยังไม่ถูกเลือก */
const availableAddonOptions = computed(() =>
    addonOptions.value.filter((o) => !selectedAddonIds.value.has(o.value)),
);

// สถานะ dropdown เลือก addon ใหม่
const selectedNewAddon = ref<string | undefined>(undefined);

// ============================================================
// Validation
// ============================================================

interface FormErrors {
    name?: string;
    price?: string;
    bundledAddons?: string;
}

const errors = ref<FormErrors>({});

function validate(): boolean {
    const e: FormErrors = {};
    if (!state.name.trim()) e.name = "กรุณากรอกชื่อแพ็กเกจ";
    if (state.price === null || state.price < 0)
        e.price = "กรุณากรอกราคาที่ถูกต้อง (≥ 0)";
    errors.value = e;
    return Object.keys(e).length === 0;
}

// ============================================================
// Bundle Management
// ============================================================

function addBundleAddon() {
    if (!selectedNewAddon.value) return;
    state.bundledAddons.push({
        addonPackageId: selectedNewAddon.value,
        quantity: 1,
    });
    selectedNewAddon.value = undefined;
}

function removeBundleAddon(index: number) {
    state.bundledAddons.splice(index, 1);
}

function getAddonName(id: string): string {
    return props.addonPackages.find((p) => p.id === id)?.name ?? id;
}

// ============================================================
// Sync: populate form เมื่อ editPackage เปลี่ยน
// ============================================================

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        errors.value = {};
        selectedNewAddon.value = undefined;

        if (props.editPackage) {
            // โหมดแก้ไข: เติมข้อมูลจาก editPackage
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
        } else {
            // โหมดสร้างใหม่: reset
            Object.assign(state, defaultState());
        }
    },
    { immediate: true },
);

// ถ้าเปลี่ยน packageType เป็น ADDON ให้ล้าง bundledAddons
watch(
    () => state.packageType,
    (type) => {
        if (type === "ADDON") state.bundledAddons = [];
    },
);

// ============================================================
// Submit
// ============================================================

const submitting = ref(false);

async function handleSubmit() {
    if (!validate()) return;
    submitting.value = true;

    const payload: CreatePackageBody = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        packageType: state.packageType,
        price: state.price!,
        credits: state.credits,
        bonusCredits: state.bonusCredits ?? 0,
        validityDays: state.validityDays,
        isActive: state.isActive,
        bundledAddons: state.packageType === "MAIN" ? state.bundledAddons : [],
    };

    emit("save", payload);
    submitting.value = false;
}

function handleClose() {
    emit("update:open", false);
}
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

                <!-- เครดิต + โบนัส -->
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

                <!-- ======================================== -->
                <!-- Bundle Section (เฉพาะ packageType MAIN) -->
                <!-- ======================================== -->
                <template v-if="state.packageType === 'MAIN'">
                    <USeparator label="จัดเซ็ตโปรโมชัน (Bundle)" />

                    <div class="flex flex-col gap-3">
                        <p class="text-sm text-muted">
                            เลือกแพ็กเกจเสริม (ADDON)
                            ที่ต้องการผูกเข้ากับแพ็กเกจนี้
                        </p>

                        <!-- รายการ bundle ที่เลือกไว้ -->
                        <div
                            v-if="state.bundledAddons.length > 0"
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
                                    >เสริม</UBadge
                                >
                                <span
                                    class="flex-1 text-sm font-medium truncate"
                                >
                                    {{ getAddonName(bundle.addonPackageId) }}
                                </span>

                                <!-- จำนวน -->
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

                                <!-- ลบ bundle -->
                                <UButton
                                    icon="i-lucide-x"
                                    size="xs"
                                    color="error"
                                    variant="ghost"
                                    @click="removeBundleAddon(index)"
                                />
                            </div>
                        </div>

                        <!-- เพิ่ม addon ใหม่ -->
                        <div class="flex gap-2">
                            <USelect
                                v-model="selectedNewAddon"
                                :items="availableAddonOptions"
                                value-key="value"
                                placeholder="เลือกแพ็กเกจเสริม..."
                                class="w-full"
                                :disabled="availableAddonOptions.length === 0"
                                @update:model-value="addBundleAddon"
                            />
                        </div>

                        <p
                            v-if="
                                availableAddonOptions.length === 0 &&
                                addonPackages.length === 0
                            "
                            class="text-xs text-muted"
                        >
                            ยังไม่มีแพ็กเกจเสริม (ADDON) ในระบบ
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
