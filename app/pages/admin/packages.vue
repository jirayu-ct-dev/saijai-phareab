<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
});

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

const {
  loading,
  getPackagesByTab,
  createPackage,
  updatePackage,
  deletePackage,
  refresh,
} = usePackages();

const tabItems: TabsItem[] = [
  { label: "ทั้งหมด", value: "all" },
  { label: "แพ็กเกจหลัก", value: "main" },
  { label: "แพ็กเกจเสริม", value: "addon" },
];

const activeTab = ref<PackageTabKey>("all");
const filteredPackages = computed(() => getPackagesByTab(activeTab.value));

const isFormOpen = ref(false);
const editingPackage = ref<Package | null>(null);

const openCreateModal = () => {
  editingPackage.value = null;
  isFormOpen.value = true;
};

const openEditModal = (pkg: Package) => {
  editingPackage.value = pkg;
  isFormOpen.value = true;
};

const handleSave = async (data: CreatePackageBody) => {
  const success = editingPackage.value
    ? await updatePackage(editingPackage.value.id, data)
    : await createPackage(data);

  if (success) isFormOpen.value = false;
};

const isDeleteOpen = ref(false);
const deletingPackage = ref<Package | null>(null);
const isDeleting = ref(false);

const openDeleteModal = (pkg: Package) => {
  deletingPackage.value = pkg;
  isDeleteOpen.value = true;
};

const handleConfirmDelete = async () => {
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
};

const isBulkDeleteOpen = ref(false);
const bulkDeletePackages = ref<Package[]>([]);
const isBulkDeleting = ref(false);

const openBulkDeleteModal = (packages: Package[]) => {
  bulkDeletePackages.value = packages;
  isBulkDeleteOpen.value = true;
};

const handleConfirmBulkDelete = async () => {
  if (!bulkDeletePackages.value.length) return;
  isBulkDeleting.value = true;

  for (const pkg of bulkDeletePackages.value) {
    await deletePackage(pkg.id, pkg.name);
  }

  isBulkDeleting.value = false;
  isBulkDeleteOpen.value = false;
  bulkDeletePackages.value = [];
};

const handleRemoveFromBulkDelete = (pkgId: string) => {
  bulkDeletePackages.value = bulkDeletePackages.value.filter((p) => p.id !== pkgId);
  if (!bulkDeletePackages.value.length) isBulkDeleteOpen.value = false;
};
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="จัดการแพ็กเกจ" icon="i-lucide-package">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #right>
          <UButton
            label="เพิ่มแพ็กเกจ"
            trailing-icon="i-lucide-plus"
            color="primary"
            class="shrink-0"
            aria-label="เพิ่มแพ็กเกจ"
            :ui="{ label: 'hidden sm:inline' }"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <UTabs
          v-model="activeTab"
          color="neutral"
          variant="link"
          :content="false"
          :items="tabItems"
          class="w-full"
        />

        <AdminPackagesPackageTable
          :packages="filteredPackages"
          :loading="loading"
          @edit="openEditModal"
          @delete="openDeleteModal"
          @bulk-delete="openBulkDeleteModal"
          @refresh="refresh"
        />
      </div>
    </template>
  </UDashboardPanel>

  <AdminPackagesPackageFormModal
    v-model:open="isFormOpen"
    :edit-package="editingPackage"
    @save="handleSave"
  />

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
      <strong class="text-highlighted">{{ deletingPackage?.name }}</strong>
      หรือไม่?
    </template>

    <template #subMessage>
      <div class="space-y-1">
        <p>
          <span class="text-muted">ประเภท:</span>
          <UBadge
            :color="packageTypeColors[deletingPackage?.packageType as PackageType]"
            variant="subtle"
            size="sm"
            class="ml-1"
          >
            {{ packageTypeLabels[deletingPackage?.packageType as PackageType] }}
          </UBadge>
        </p>
        <p>
          <span class="text-muted">ราคา:</span>
          <strong class="text-highlighted ml-1">
            {{
              Number(deletingPackage?.price) === 0
                ? "ฟรี"
                : formatCurrency(Number(deletingPackage?.price ?? 0))
            }}
          </strong>
        </p>
        <p v-if="deletingPackage?.credits">
          <span class="text-muted">เครดิต:</span>
          <strong class="text-highlighted ml-1">
            {{ deletingPackage.credits.toLocaleString("th-TH") }} เครดิต
          </strong>
        </p>
      </div>
    </template>
  </UIConfirmModal>

  <UModal
    v-model:open="isBulkDeleteOpen"
    title="ลบแพ็กเกจที่เลือก"
    :description="`ยืนยันการลบแพ็กเกจ ${bulkDeletePackages.length} รายการ`"
  >
    <template #body>
      <div
        v-if="bulkDeletePackages.length"
        class="space-y-3 max-h-72 overflow-auto pr-1"
      >
        <div
          v-for="pkg in bulkDeletePackages"
          :key="pkg.id"
          class="flex items-center gap-3"
        >
          <div
            class="size-10 rounded-lg flex items-center justify-center shrink-0"
            :class="pkg.packageType === 'MAIN' ? 'bg-primary/10' : 'bg-info/10'"
          >
            <UIcon
              :name="pkg.packageType === 'MAIN' ? 'i-lucide-package' : 'i-lucide-puzzle'"
              :class="pkg.packageType === 'MAIN' ? 'size-5 text-primary' : 'size-5 text-info'"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-highlighted truncate">{{ pkg.name }}</p>
            <p class="text-sm text-muted truncate">
              {{
                Number(pkg.price) === 0
                  ? "ฟรี"
                  : formatCurrency(Number(pkg.price))
              }}
              <template v-if="pkg.credits">
                - {{ pkg.credits.toLocaleString("th-TH") }} เครดิต
              </template>
            </p>
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            size="xs"
            color="neutral"
            @click="handleRemoveFromBulkDelete(pkg.id)"
          />
        </div>
      </div>
      <p v-else class="text-sm text-muted text-center py-6">
        ไม่มีแพ็กเกจที่จะลบ
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton
          label="ยกเลิก"
          color="neutral"
          variant="outline"
          @click="isBulkDeleteOpen = false"
        />
        <UButton
          label="ลบ"
          color="error"
          :disabled="!bulkDeletePackages.length"
          :loading="isBulkDeleting"
          @click="handleConfirmBulkDelete"
        />
      </div>
    </template>
  </UModal>
</template>
