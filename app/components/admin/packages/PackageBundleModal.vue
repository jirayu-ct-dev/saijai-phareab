<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Package } from "~~/shared/types/package";
import { formatCurrency, formatCredits, formatDays } from "~~/shared/utils/format";

const props = defineProps<{
    open: boolean;
    pkg: Package | null;
    addonPackages: Package[];
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    "save": [bundles: any[]];
}>();

const draftBundles = ref<any[]>([]);
const isSubmitting = ref(false);

watch(() => props.open, (isOpen) => {
    if (isOpen) {
        draftBundles.value = JSON.parse(JSON.stringify(props.pkg?.bundledAddons || []));
    } else {
        selectedNewAddon.value = undefined;
    }
});

const selectedNewAddon = ref<string | undefined>(undefined);

const addonOptions = computed(() =>
    props.addonPackages.map((p) => ({ label: p.name, value: p.id })),
);

const selectedAddonIds = computed(
    () => new Set(draftBundles.value.map((b) => b.addonPackageId)),
);

const availableAddonOptions = computed(() =>
    addonOptions.value.filter((o) => !selectedAddonIds.value.has(o.value)),
);

function getAddonName(id: string): string {
    return props.addonPackages.find((p) => p.id === id)?.name ?? id;
}

function handleClose() {
    emit("update:open", false);
}

function handleAddBundle() {
    if (!selectedNewAddon.value) return;
    
    draftBundles.value.push({
        id: `draft-${Date.now()}`,
        mainPackageId: props.pkg?.id,
        addonPackageId: selectedNewAddon.value,
        quantity: 1,
    });
    
    selectedNewAddon.value = undefined;
}

function handleRemoveBundle(addonPackageId: string) {
    draftBundles.value = draftBundles.value.filter(b => b.addonPackageId !== addonPackageId);
}

function handleSave() {
    isSubmitting.value = true;
    setTimeout(() => {
        emit("save", draftBundles.value);
        isSubmitting.value = false;
        emit("update:open", false);
    }, 400);
}
</script>

<template>
    <UModal
        :open="open"
        @update:open="val => emit('update:open', val)"
        title="จัดเซ็ทแพ็กเกจเสริม"
        :description="`เพิ่มหรือลบแพ็กเกจเสริมที่ผูกติดกับ ${pkg?.name || ''}`"
    >
        <template #body>
            <div v-if="pkg" class="space-y-5">
                <!-- Package Summary -->
                <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg border border-default">
                    <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <UIcon name="i-lucide-package" class="size-5 text-primary" />
                    </div>
                    <div class="min-w-0">
                        <p class="font-semibold text-highlighted truncate">{{ pkg.name }}</p>
                        <p class="text-xs text-muted">
                            {{ Number(pkg.price) === 0 ? 'ฟรี' : formatCurrency(Number(pkg.price)) }} /
                            {{ formatCredits(pkg.credits) }} เครดิต /
                            {{ formatDays(pkg.validityDays) }}
                        </p>
                    </div>
                </div>

                <!-- Existing Bundles -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-medium flex items-center gap-2">
                            <UIcon name="i-lucide-layers" class="size-4 text-secondary" />
                            แพ็กเกจเสริมปัจจุปัน
                        </h4>
                        <UBadge color="secondary" variant="subtle" size="xs">
                            {{ draftBundles.length }} รายการ
                        </UBadge>
                    </div>

                    <div v-if="draftBundles.length > 0" class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                        <div
                            v-for="(bundle, index) in draftBundles"
                            :key="bundle.addonPackageId"
                            class="flex items-center gap-2 p-3 rounded-lg bg-elevated border border-default group"
                        >
                            <UBadge variant="subtle" color="secondary" class="shrink-0">เสริม</UBadge>
                            <span class="flex-1 text-sm font-medium truncate min-w-0">
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
                            <span class="text-xs text-muted shrink-0">ชิ้น</span>

                            <!-- ลบ bundle -->
                            <UButton
                                icon="i-lucide-trash-2"
                                size="xs"
                                color="error"
                                variant="ghost"
                                class="opacity-0 group-hover:opacity-100 transition-opacity"
                                @click="handleRemoveBundle(bundle.addonPackageId)"
                            />
                        </div>
                    </div>
                    <div v-else class="text-center py-6 text-muted border border-dashed border-default rounded-lg">
                        <UIcon name="i-lucide-layers" class="size-8 mx-auto mb-2 opacity-40" />
                        <p class="text-sm">ยังไม่มีแพ็กเกจเสริม</p>
                    </div>
                </div>

                <!-- Add New Addon -->
                <div class="border-t border-default pt-4 space-y-3">
                    <h4 class="text-sm font-medium flex items-center gap-2">
                        <UIcon name="i-lucide-plus-circle" class="size-4 text-primary" />
                        เพิ่มแพ็กเกจเสริม
                    </h4>
                    <div class="flex gap-2">
                        <USelect
                            v-model="selectedNewAddon"
                            :items="availableAddonOptions"
                            value-key="value"
                            label-key="label"
                            placeholder="เลือกแพ็กเกจเสริม..."
                            class="w-full"
                            :disabled="availableAddonOptions.length === 0"
                            @update:model-value="handleAddBundle"
                        />
                    </div>
                    <p v-if="availableAddonOptions.length === 0 && addonPackages.length === 0" class="text-xs text-muted">
                        ยังไม่มีแพ็กเกจเสริม (ADDON) ในระบบ
                    </p>
                </div>
            </div>
            <div v-else class="py-8 text-center text-muted">
                กำลังโหลด...
            </div>
        </template>
        <template #footer>
            <div class="flex justify-end gap-2 w-full">
                <UButton
                    label="ยกเลิก"
                    color="neutral"
                    variant="ghost"
                    @click="handleClose"
                />
                <UButton
                    color="primary"
                    icon="i-lucide-save"
                    :loading="isSubmitting"
                    @click="handleSave"
                    label="บันทึก"
                />
            </div>
        </template>
    </UModal>
</template>
