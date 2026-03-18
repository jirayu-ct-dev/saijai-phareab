<script setup lang="ts">
import { ref, watch } from "vue";
import type { Package, PackageBonus } from "~~/shared/types/package";
import { formatCurrency, formatCredits, formatDays } from "~~/shared/utils/format";
const notify = useNotify();

const props = defineProps<{
    open: boolean;
    pkg: Package | null;
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    "save": [bonuses: any[]];
}>();

const isSubmitting = ref(false);

const bonusForm = ref({
    storefrontPriceId: "",
    quantity: 1,
});

const draftBonuses = ref<any[]>([]);

watch(() => props.open, (isOpen) => {
    if (isOpen) {
        // Create local clone of existing bonuses
        draftBonuses.value = JSON.parse(JSON.stringify(props.pkg?.packageBonuses || []));
    } else {
        bonusForm.value.storefrontPriceId = "";
        bonusForm.value.quantity = 1;
    }
});

const selectedBonusIds = computed(
    () => new Set(draftBonuses.value.map(b => b.storefrontPriceId))
);

const { data: storefrontPrices } = useFetch<{ id: string; name: string }[]>('/api/admin/storefront-prices', {
    default: () => [],
});

const handleClose = () => {
    emit("update:open", false);
};

const availableStorefrontPrices = computed(() =>
    storefrontPrices.value
        .filter((p) => !selectedBonusIds.value.has(p.id))
        .map((p) => ({ value: p.id, label: p.name }))
);

const getStorefrontName = (id: string): string => {
    return storefrontPrices.value.find((p) => p.id === id)?.name || 'รายการแถม';
};

const handleAddBonus = () => {
    if (!bonusForm.value.storefrontPriceId) return;
    
    draftBonuses.value.push({
        id: `draft-${Date.now()}`,
        packageId: props.pkg?.id,
        storefrontPriceId: bonusForm.value.storefrontPriceId,
        quantity: 1, // Default quantity
        description: null,
        deletedById: null,
    });
    
    // reset form
    bonusForm.value.storefrontPriceId = "";
};

const handleRemoveBonus = (bonusId: string) => {
    draftBonuses.value = draftBonuses.value.filter((b) => b.id !== bonusId);
};

const handleSave = () => {
    isSubmitting.value = true;
    emit("save", draftBonuses.value);
    isSubmitting.value = false;
};

</script>

<template>
    <UModal
        :open="open"
        @update:open="val => emit('update:open', val)"
        title="จัดการโบนัส"
        :description="`เพิ่มรายการแถมให้กับแพ็กเกจ ${pkg?.name || ''}`"
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

                <!-- Existing Bonuses -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-medium flex items-center gap-2">
                            <UIcon name="i-lucide-gift" class="size-4 text-success" />
                            โบนัสปัจจุบัน
                        </h4>
                        <UBadge color="success" variant="subtle" size="xs">
                            {{ draftBonuses.length }} รายการ
                        </UBadge>
                    </div>

                    <div v-if="draftBonuses.length" class="space-y-2 max-h-48 overflow-y-auto pr-1">
                        <div
                            v-for="(bonus, index) in draftBonuses"
                            :key="bonus.id"
                            class="flex items-center gap-2 p-3 bg-success/5 border border-success/15 rounded-lg group"
                        >
                            <UIcon name="i-lucide-sparkles" class="size-4 text-success shrink-0" />
                            <span class="flex-1 text-sm font-medium truncate min-w-0">
                                {{ getStorefrontName(bonus.storefrontPriceId) }}
                            </span>
                            
                            <!-- จำนวน -->
                            <UInput
                                v-model.number="bonus.quantity"
                                type="number"
                                min="1"
                                class="w-16"
                                size="xs"
                            />
                            <span class="text-xs text-muted shrink-0">ชิ้น</span>

                            <UButton
                                icon="i-lucide-trash-2"
                                color="error"
                                variant="ghost"
                                size="xs"
                                class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                @click="handleRemoveBonus(bonus.id)"
                            />
                        </div>
                    </div>
                    <div v-else class="text-center py-6 text-muted border border-dashed border-default rounded-lg">
                        <UIcon name="i-lucide-gift" class="size-8 mx-auto mb-2 opacity-40" />
                        <p class="text-sm">ยังไม่มีโบนัส</p>
                    </div>
                </div>

                <!-- Add New Bonus -->
                <div class="border-t border-default pt-4 space-y-3">
                    <h4 class="text-sm font-medium flex items-center gap-2">
                        <UIcon name="i-lucide-plus-circle" class="size-4 text-primary" />
                        เพิ่มโบนัสใหม่
                    </h4>
                    <div class="flex gap-2">
                        <USelect
                            v-model="bonusForm.storefrontPriceId"
                            :items="availableStorefrontPrices"
                            value-key="value"
                            label-key="label"
                            placeholder="เลือกรายการที่ต้องการแถม..."
                            class="w-full"
                            :disabled="availableStorefrontPrices.length === 0"
                            @update:model-value="handleAddBonus"
                        />
                    </div>
                    <p v-if="availableStorefrontPrices.length === 0" class="text-xs text-muted">
                        ไม่มีรายการผ้าให้เพิ่มแล้ว
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
