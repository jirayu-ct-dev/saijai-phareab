<script setup lang="ts">
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

type PackageService = {
  id: string;
  name: string;
  description?: string | null;
};

type PricingServicesResponse = {
  services: PackageService[];
};

definePageMeta({
  layout: "admin",
  middleware: ["role-admin"],
});

const {
  loading,
  getPackagesByTab,
  createPackage,
  updatePackage,
  deletePackage,
  refresh,
} = usePackages();

const notify = useNotify();
const {
  data: pricingServicesResponse,
  status: pricingServicesStatus,
} = useFetch<PricingServicesResponse>("/api/admin/pricing", {
  server: false,
  lazy: true,
});
const packageServices = ref<PackageService[]>([]);
watch(pricingServicesResponse, (response) => {
  if (response) packageServices.value = [...response.services];
}, { immediate: true });
const isLoadingServices = computed(() =>
  pricingServicesStatus.value === "pending" || pricingServicesStatus.value === "idle",
);

const hasMainPackages = computed(() => getPackagesByTab("main").length > 0);
const hasAddonPackages = computed(() => getPackagesByTab("addon").length > 0);

const tabItems = computed<TabsItem[]>(() => {
  const items: TabsItem[] = [{ label: "ทั้งหมด", value: "all" }];
  if (hasMainPackages.value) items.push({ label: "แพ็กเกจหลัก", value: "main" });
  if (hasAddonPackages.value) items.push({ label: "แพ็กเกจเสริม", value: "addon" });
  return items;
});

const activeTab = ref<PackageTabKey>("all");
watch(tabItems, (items) => {
  if (!items.some((item) => item.value === activeTab.value)) activeTab.value = "all";
});
const filteredPackages = computed(() => getPackagesByTab(activeTab.value));

const isFormOpen = ref(false);
const editingPackage = ref<Package | null>(null);
const isSavingPackage = ref(false);
const togglingPublicPackageId = ref<string | null>(null);

const isServiceModalOpen = ref(false);
const isSavingService = ref(false);
const editingService = ref<PackageService | null>(null);
const serviceForm = ref({ name: "", description: "" });

const resetServiceForm = () => {
  editingService.value = null;
  serviceForm.value = { name: "", description: "" };
};

const openServiceModal = () => {
  resetServiceForm();
  isServiceModalOpen.value = true;
};

const openEditService = (service: PackageService) => {
  editingService.value = service;
  serviceForm.value = {
    name: service.name,
    description: service.description ?? "",
  };
};

const saveService = async () => {
  if (isSavingService.value) return;

  const name = serviceForm.value.name.trim();
  if (!name) {
    notify.validationError("กรุณากรอกชื่อบริการ");
    return;
  }

  isSavingService.value = true;
  try {
    const body = {
      name,
      description: serviceForm.value.description.trim() || undefined,
    };

    if (editingService.value) {
      const updated = await $fetch<PackageService>("/api/admin/pricing/service", {
        method: "PUT",
        body: { id: editingService.value.id, ...body },
      });
      const index = packageServices.value.findIndex((service) => service.id === updated.id);
      if (index >= 0) packageServices.value[index] = updated;
    } else {
      const created = await $fetch<PackageService>("/api/admin/pricing/service", {
        method: "POST",
        body,
      });
      packageServices.value.push(created);
    }

    packageServices.value.sort((left, right) => left.name.localeCompare(right.name, "th"));
    resetServiceForm();
    notify.success("บันทึกบริการเรียบร้อยแล้ว");
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "data" in error
      ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || "ไม่สามารถบันทึกบริการได้")
      : "ไม่สามารถบันทึกบริการได้";
    notify.error(message);
  } finally {
    isSavingService.value = false;
  }
};

const openCreateModal = () => {
  editingPackage.value = null;
  isFormOpen.value = true;
};

const openEditModal = (pkg: Package) => {
  editingPackage.value = pkg;
  isFormOpen.value = true;
};

const handleSave = async (data: CreatePackageBody) => {
  if (isSavingPackage.value) return;
  isSavingPackage.value = true;
  try {
    const success = editingPackage.value
      ? await updatePackage(editingPackage.value.id, data)
      : await createPackage(data);

    if (success) isFormOpen.value = false;
  } finally {
    isSavingPackage.value = false;
  }
};

const handleTogglePublic = async (pkg: Package, isPublic: boolean) => {
  if (togglingPublicPackageId.value) return;

  togglingPublicPackageId.value = pkg.id;
  try {
    await updatePackage(pkg.id, { isPublic });
  } finally {
    togglingPublicPackageId.value = null;
  }
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

  const targets = [...bulkDeletePackages.value];
  try {
    await Promise.all(targets.map((pkg) =>
      $fetch(`/api/admin/packages/${pkg.id}`, { method: "DELETE" }),
    ));
    await refresh();
    notify.deleted(`${targets.length} แพ็กเกจ`);
  } catch (error: unknown) {
    const message = error && typeof error === "object" && "data" in error
      ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || "ไม่สามารถลบบางรายการได้")
      : "ไม่สามารถลบบางรายการได้";
    notify.error(message);
    await refresh();
  } finally {
    isBulkDeleting.value = false;
    isBulkDeleteOpen.value = false;
    bulkDeletePackages.value = [];
  }
};

const handleRemoveFromBulkDelete = (pkgId: string) => {
  bulkDeletePackages.value = bulkDeletePackages.value.filter((p) => p.id !== pkgId);
  if (!bulkDeletePackages.value.length) isBulkDeleteOpen.value = false;
};
</script>

<template>
  <div class="contents">
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="จัดการแพ็กเกจ" icon="i-lucide-package">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="เพิ่ม / แก้ไขบริการ"
              icon="i-lucide-sparkles"
              color="neutral"
              variant="outline"
              class="shrink-0"
              aria-label="เพิ่มหรือแก้ไขบริการ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="openServiceModal"
            />
            <UButton
              label="เพิ่มแพ็กเกจ"
              trailing-icon="i-lucide-plus"
              color="primary"
              class="shrink-0"
              aria-label="เพิ่มแพ็กเกจ"
              :ui="{ label: 'hidden sm:inline' }"
              @click="openCreateModal"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <div v-if="tabItems.length > 1" class="-mx-2 border border-default/30 bg-default px-3! py-1! dark:border-default/40 dark:bg-default/80 sm:mx-0 sm:rounded-lg">
          <UTabs
            v-model="activeTab"
            color="neutral"
            variant="link"
            :content="false"
            :items="tabItems"
            class="w-full"
          />
        </div>

        <AdminPackagesPackageTable
          :packages="filteredPackages"
          :loading="loading"
          :toggling-public-package-id="togglingPublicPackageId"
          @edit="openEditModal"
          @delete="openDeleteModal"
          @bulk-delete="openBulkDeleteModal"
          @toggle-public="handleTogglePublic"
          @refresh="refresh"
        />
      </div>
    </template>
  </UDashboardPanel>

  <AdminPackagesPackageFormModal
      v-model:open="isFormOpen"
      :edit-package="editingPackage"
      :saving="isSavingPackage"
      :services="packageServices"
      :services-loading="isLoadingServices"
      @save="handleSave"
  />

  <UModal
    v-model:open="isServiceModalOpen"
    title="เพิ่ม / แก้ไขบริการ"
    description="จัดการบริการสำหรับกำหนดให้แพ็กเกจหลัก"
    :dismissible="!isSavingService"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="-mx-2 space-y-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">รายการบริการ</p>
          <div v-if="isLoadingServices" class="space-y-2">
            <USkeleton v-for="index in 3" :key="index" class="h-12 w-full" />
          </div>
          <div v-else-if="packageServices.length" class="space-y-1">
            <button
              v-for="service in packageServices"
              :key="service.id"
              type="button"
              class="flex w-full items-center gap-2 border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:rounded-lg"
              :class="editingService?.id === service.id
                ? 'border-info/30 bg-info/5 dark:border-info/25 dark:bg-elevated/65'
                : 'border-default/25 bg-elevated/30 hover:border-default/40 hover:bg-elevated/50 dark:border-default/15 dark:bg-elevated/25 dark:hover:bg-elevated/45'"
              @click="openEditService(service)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-highlighted">{{ service.name }}</span>
                <span v-if="service.description" class="block truncate text-xs text-muted">{{ service.description }}</span>
              </span>
              <UIcon name="i-lucide-pencil" class="size-4 shrink-0 text-muted" />
            </button>
          </div>
          <p v-else class="rounded-lg border border-dashed border-default/30 p-4 text-center text-sm text-muted dark:border-default/20">
            ยังไม่มีบริการ
          </p>
        </div>

        <form
          class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
          @submit.prevent="saveService"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ editingService ? "แก้ไขบริการ" : "เพิ่มบริการใหม่" }}
          </p>
          <UFormField label="ชื่อบริการ" required>
            <UInput v-model="serviceForm.name" class="w-full" placeholder="เช่น ซักแห้ง, ซักพร้อมรีด" />
          </UFormField>
          <UFormField label="คำอธิบาย">
            <UInput v-model="serviceForm.description" class="w-full" placeholder="ไม่บังคับ" />
          </UFormField>
          <div class="flex gap-2">
            <UButton
              v-if="editingService"
              label="ยกเลิก"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="isSavingService"
              @click="resetServiceForm"
            />
            <UButton
              type="submit"
              :label="editingService ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ'"
              :icon="editingService ? 'i-lucide-check' : 'i-lucide-plus'"
              color="primary"
              size="sm"
              :loading="isSavingService"
              :disabled="isSavingService"
            />
          </div>
        </form>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          label="ปิด"
          color="neutral"
          variant="outline"
          :disabled="isSavingService"
          @click="isServiceModalOpen = false"
        />
      </div>
    </template>
  </UModal>

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
  </div>
</template>
