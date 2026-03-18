<script setup lang="ts">
/**
 * Admin — หน้าจัดการแพ็กเกจ
 *
 * Flow:
 * 1. ดึงข้อมูลทั้งหมดครั้งเดียวผ่าน usePackages()
 * 2. Filter ฝั่ง client ตาม Tab ที่เลือก (ไม่มี API call เพิ่ม)
 * 3. PackageTable รับข้อมูลที่ filter แล้วและ emit event แก้ไข / ลบ / bulk-delete
 * 4. PackageFormModal ใช้สำหรับทั้งสร้างและแก้ไข
 * 5. Delete / Bulk-delete ยืนยันผ่าน UIConfirmModal (ConfirmModal.vue)
 */

import type { TabsItem } from "@nuxt/ui";
import type { Package } from "~~/shared/types/package";
import type { PackageType } from "~~/shared/types/enums";
import type {
    CreatePackageBody,
    PackageTabKey,
} from "~~/app/composables/usePackages";
import {
    packageTypeLabels,
    packageTypeColors,
} from "~~/shared/config/packageConfig";
import { formatCurrency } from "~~/shared/utils/format";

// ============================================================
// Composable — ข้อมูลและ CRUD Actions
// ============================================================

const {
    loading,
    addonPackages,
    getPackagesByTab,
    createPackage,
    updatePackage,
    deletePackage,
} = usePackages();

// ============================================================
// Tab Configuration
// ============================================================

const tabItems: TabsItem[] = [
    { label: "ทั้งหมด", value: "all" },
    { label: "แพ็กเกจหลัก", value: "main" },
    { label: "แพ็กเกจเสริม", value: "addon" },
    { label: "จัดเซ็ตแพ็กเกจ", value: "bundle" },
];

const activeTab = ref<PackageTabKey>("all");

/** แพ็กเกจที่ถูก filter ตาม Tab ปัจจุบัน */
const filteredPackages = computed(() => getPackagesByTab(activeTab.value));

// ============================================================
// Form Modal State (สร้าง / แก้ไข)
// ============================================================

const isFormOpen = ref(false);
const editingPackage = ref<Package | null>(null);

function openCreateModal() {
    editingPackage.value = null;
    isFormOpen.value = true;
}

function openEditModal(pkg: Package) {
    editingPackage.value = pkg;
    isFormOpen.value = true;
}

async function handleSave(data: CreatePackageBody) {
    let success: boolean;

    if (editingPackage.value) {
        success = await updatePackage(editingPackage.value.id, data);
    } else {
        success = await createPackage(data);
    }

    // ปิด modal เฉพาะเมื่อสำเร็จ
    if (success) {
        isFormOpen.value = false;
    }
}

// ============================================================
// Single Delete State
// ============================================================

const isDeleteOpen = ref(false);
const deletingPackage = ref<Package | null>(null);
const isDeleting = ref(false);

function openDeleteModal(pkg: Package) {
    deletingPackage.value = pkg;
    isDeleteOpen.value = true;
}

async function handleConfirmDelete() {
    if (!deletingPackage.value) return;
    isDeleting.value = true;

    const success = await deletePackage(
        deletingPackage.value.id,
        deletingPackage.value.name,
    );

    isDeleting.value = false;
    if (success) {
        isDeleteOpen.value = false;
        deletingPackage.value = null;
    }
}

// ============================================================
// Bulk Delete State
// ============================================================

const isBulkDeleteOpen = ref(false);
const bulkDeletePackages = ref<Package[]>([]);
const isBulkDeleting = ref(false);

function openBulkDeleteModal(packages: Package[]) {
    bulkDeletePackages.value = packages;
    isBulkDeleteOpen.value = true;
}

async function handleConfirmBulkDelete() {
    if (!bulkDeletePackages.value.length) return;
    isBulkDeleting.value = true;

    // ลบทีละรายการแบบ sequential เพื่อหลีกเลี่ยง race condition
    for (const pkg of bulkDeletePackages.value) {
        await deletePackage(pkg.id, pkg.name);
    }

    isBulkDeleting.value = false;
    isBulkDeleteOpen.value = false;
    bulkDeletePackages.value = [];
}

function handleRemoveFromBulkDelete(pkgId: string) {
    bulkDeletePackages.value = bulkDeletePackages.value.filter(
        (p) => p.id !== pkgId
    );
    if (bulkDeletePackages.value.length === 0) {
        isBulkDeleteOpen.value = false;
    }
}

// ============================================================
// Bonus Modal State
// ============================================================

const isBonusOpen = ref(false);
const bonusPackage = ref<Package | null>(null);

function openBonusModal(pkg: Package) {
    bonusPackage.value = pkg;
    isBonusOpen.value = true;
}

function handleSaveBonus(bonuses: any[]) {
    // Mock behavior for now until API is connected
    if (bonusPackage.value) {
        bonusPackage.value.packageBonuses = bonuses;
    }
}

// ============================================================
// Bundle Modal State
// ============================================================

const isBundleOpen = ref(false);
const bundlePackage = ref<Package | null>(null);

function openBundleModal(pkg: Package) {
    bundlePackage.value = pkg;
    isBundleOpen.value = true;
}

function handleSaveBundle(bundles: any[]) {
    if (bundlePackage.value) {
        bundlePackage.value.bundledAddons = bundles;
    }
}
</script>

<template>
    <UDashboardPanel>
        <!-- ============================= Header ============================= -->
        <template #header>
            <UDashboardNavbar title="จัดการแพ็กเกจ" icon="i-lucide-package">
                <template #leading>
                    <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
                </template>
                <template #right>
                    <UButton
                        label="เพิ่มแพ็กเกจ"
                        icon="i-lucide-package"
                        trailing-icon="i-lucide-plus"
                        color="primary"
                        @click="openCreateModal"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <!-- ============================== Body ============================== -->
        <template #body>
            <div class="flex flex-col gap-4 p-4">
                <!-- Tabs: สลับดูตามประเภทแพ็กเกจ -->
                <UTabs
                    v-model="activeTab"
                    color="neutral"
                    variant="link"
                    :content="false"
                    :items="tabItems"
                    class="w-full"
                />

                <!-- Package Table Card -->
                

                    <!-- ตาราง: Toolbar อยู่ภายใน PackageTable แล้ว -->
                    <div class="px-4 pb-4">
                        <AdminPackagesPackageTable
                            :packages="filteredPackages"
                            :loading="loading"
                            @edit="openEditModal"
                            @delete="openDeleteModal"
                            @bonus="openBonusModal"
                            @bundle="openBundleModal"
                            @bulk-delete="openBulkDeleteModal"
                        />
                    </div>
            </div>
        </template>
    </UDashboardPanel>

    <!-- ============================= Bonus Modal ============================= -->
    <AdminPackagesPackageBonusModal
        v-model:open="isBonusOpen"
        :pkg="bonusPackage"
        @save="handleSaveBonus"
    />

    <!-- ============================= Bundle Modal ============================= -->
    <AdminPackagesPackageBundleModal
        v-model:open="isBundleOpen"
        :pkg="bundlePackage"
        :addon-packages="addonPackages"
        @save="handleSaveBundle"
    />

    <!-- ============================= Form Modal (Create / Edit) ============================= -->
    <AdminPackagesPackageFormModal
        v-model:open="isFormOpen"
        :edit-package="editingPackage"
        :addon-packages="addonPackages"
        @save="handleSave"
    />

    <!-- ============================= Single Delete Confirm ============================= -->
    <UIConfirmModal
        v-model:open="isDeleteOpen"
        title="ลบแพ็กเกจ"
        description="ยืนยันการลบแพ็กเกจนี้ออกจากระบบ"
        icon="i-lucide-trash-2"
        icon-color="error"
        confirm-label="ลบแพ็กเกจ"
        confirm-color="error"
        :loading="isDeleting"
        @confirm="handleConfirmDelete"
        @cancel="isDeleteOpen = false"
    >
        <template #message>
            คุณต้องการลบแพ็กเกจ
            <strong class="text-highlighted">{{
                deletingPackage?.name
            }}</strong>
            หรือไม่?
        </template>

        <template #subMessage>
            <div class="space-y-1">
                <p>
                    <span class="text-muted">ประเภท:</span>
                    <UBadge
                        :color="
                            packageTypeColors[
                                deletingPackage?.packageType as PackageType
                            ]
                        "
                        variant="subtle"
                        size="sm"
                        class="ml-1"
                    >
                        {{
                            packageTypeLabels[
                                deletingPackage?.packageType as PackageType
                            ]
                        }}
                    </UBadge>
                </p>
                <p>
                    <span class="text-muted">ราคา:</span>
                    <strong class="text-highlighted ml-1">
                        {{
                            Number(deletingPackage?.price) === 0
                                ? "ฟรี"
                                : formatCurrency(
                                      Number(deletingPackage?.price ?? 0),
                                  )
                        }}
                    </strong>
                </p>
                <p v-if="deletingPackage?.credits">
                    <span class="text-muted">เครดิต:</span>
                    <strong class="text-highlighted ml-1">
                        {{
                            deletingPackage.credits.toLocaleString("th-TH")
                        }}
                        เครดิต
                    </strong>
                </p>
            </div>
        </template>
    </UIConfirmModal>

    <!-- ============================= Bulk Delete Confirm Modal ============================= -->
    <UModal v-model:open="isBulkDeleteOpen" title="ลบแพ็กเกจที่เลือก"
        :description="`ยืนยันการลบแพ็กเกจ ${bulkDeletePackages.length} รายการ`">
        <template #body>
            <div v-if="bulkDeletePackages.length" class="space-y-3 max-h-72 overflow-auto pr-1">
                <div v-for="pkg in bulkDeletePackages" :key="pkg.id" class="flex items-center gap-3">
                    <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
                        :class="pkg.packageType === 'MAIN' ? 'bg-primary/10' : 'bg-info/10'">
                        <UIcon :name="pkg.packageType === 'MAIN' ? 'i-lucide-package' : 'i-lucide-puzzle'"
                            :class="pkg.packageType === 'MAIN' ? 'size-5 text-primary' : 'size-5 text-info'" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-highlighted truncate">{{ pkg.name }}</p>
                        <p class="text-sm text-muted truncate">
                            {{ Number(pkg.price) === 0 ? 'ฟรี' : formatCurrency(Number(pkg.price)) }}
                            <template v-if="pkg.packageType === 'MAIN' && pkg.credits"> - {{
                                pkg.credits.toLocaleString("th-TH") }} เครดิต</template>
                        </p>
                    </div>
                    <UButton icon="i-lucide-x" variant="ghost" size="xs" color="neutral"
                        @click="handleRemoveFromBulkDelete(pkg.id)" />
                </div>
            </div>
            <p v-else class="text-sm text-muted text-center py-6">ไม่มีแพ็กเกจที่จะลบ</p>
        </template>

        <template #footer>
            <div class="flex justify-end gap-3 w-full">
                <UButton label="ยกเลิก" color="neutral" variant="outline" @click="isBulkDeleteOpen = false" />
                <UButton label="ลบ" color="error" :disabled="!bulkDeletePackages.length" :loading="isBulkDeleting"
                    @click="handleConfirmBulkDelete" />
            </div>
        </template>
    </UModal>
</template>
