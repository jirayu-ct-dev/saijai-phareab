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
  includedItemIds: string[];
};

type PackageServicesResponse = {
  services: PackageService[];
  items: Array<{ id: string; name: string; categoryId?: string | null; isActive: boolean; deletedAt: string | null }>;
  categories: Array<{ id: string; name: string }>;
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
  data: packageServicesResponse,
  status: packageServicesStatus,
  refresh: refreshPackageServices,
} = useFetch<PackageServicesResponse>("/api/admin/package-services", {
  server: false,
  lazy: true,
});
const packageServices = ref<PackageService[]>([]);
watch(packageServicesResponse, (response) => {
  if (response) packageServices.value = [...response.services];
}, { immediate: true });
const isLoadingServices = computed(() =>
  packageServicesStatus.value === "pending" || packageServicesStatus.value === "idle",
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
const serviceForm = ref({ name: "", description: "", includedItemIds: [] as string[] });
const isServiceDetailsModalOpen = ref(false);
const serviceDetailsDraft = ref({ name: "", description: "" });
const serviceDetailsError = ref("");
const serviceItemSearch = ref("");
const serviceItemCategoryId = ref("all");
const serviceCategoryOptions = computed(() => [
  { label: "ทุกประเภท", value: "all" },
  ...(packageServicesResponse.value?.categories ?? []).map((category) => ({
    label: category.name,
    value: category.id,
  })),
]);
const serviceCatalogItems = computed(() => {
  const response = packageServicesResponse.value;
  if (!response) return [];
  const categories = new Map(response.categories.map((category) => [category.id, category.name]));
  return response.items.map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.categoryId ?? null,
    categoryName: item.categoryId ? categories.get(item.categoryId) ?? null : null,
    isActive: item.isActive,
  }));
});
const filteredServiceCatalogItems = computed(() => {
  const keyword = serviceItemSearch.value.trim().toLowerCase();
  return serviceCatalogItems.value.filter((item) => {
    const matchesCategory = serviceItemCategoryId.value === "all"
      || item.categoryId === serviceItemCategoryId.value;
    const matchesKeyword = !keyword
      || [item.name, item.categoryName ?? ""].join(" ").toLowerCase().includes(keyword);
    return matchesCategory && matchesKeyword;
  });
});
const selectableServiceItems = computed(() => filteredServiceCatalogItems.value.filter((item) =>
  item.isActive || serviceForm.value.includedItemIds.includes(item.id),
));
const allServiceItemsSelected = computed(() => selectableServiceItems.value.length > 0
  && selectableServiceItems.value.every((item) => serviceForm.value.includedItemIds.includes(item.id)));

const resetServiceForm = () => {
  editingService.value = null;
  serviceForm.value = { name: "", description: "", includedItemIds: [] };
  serviceItemSearch.value = "";
  serviceItemCategoryId.value = "all";
};

const openServiceModal = () => {
  resetServiceForm();
  isServiceModalOpen.value = true;
};

const openCreateServiceDetails = () => {
  resetServiceForm();
  serviceDetailsDraft.value = { name: "", description: "" };
  serviceDetailsError.value = "";
  isServiceDetailsModalOpen.value = true;
};

const openEditService = (service: PackageService) => {
  editingService.value = service;
  serviceForm.value = {
    name: service.name,
    description: service.description ?? "",
    includedItemIds: [...(service.includedItemIds ?? [])],
  };
};

const openEditServiceDetails = (service: PackageService) => {
  openEditService(service);
  serviceDetailsDraft.value = {
    name: service.name,
    description: service.description ?? "",
  };
  serviceDetailsError.value = "";
  isServiceDetailsModalOpen.value = true;
};

const saveServiceDetailsDraft = async () => {
  const name = serviceDetailsDraft.value.name.trim();
  if (!name) {
    serviceDetailsError.value = "กรุณากรอกชื่อบริการ";
    return;
  }

  if (!editingService.value) {
    if (isSavingService.value) return;
    isSavingService.value = true;
    try {
      const created = await $fetch<PackageService>("/api/admin/package-services", {
        method: "POST",
        body: {
          name,
          description: serviceDetailsDraft.value.description.trim() || undefined,
          includedItemIds: [],
        },
      });
      packageServices.value.push(created);
      packageServices.value.sort((left, right) => left.name.localeCompare(right.name, "th"));
      openEditService(created);
      isServiceDetailsModalOpen.value = false;
      notify.success("เพิ่มบริการเรียบร้อยแล้ว เลือกรายการผ้าเพิ่มเติมได้ภายหลัง");
    } catch (error: unknown) {
      const message = error && typeof error === "object" && "data" in error
        ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage || "ไม่สามารถเพิ่มบริการได้")
        : "ไม่สามารถเพิ่มบริการได้";
      notify.error(message);
    } finally {
      isSavingService.value = false;
    }
    return;
  }

  serviceForm.value.name = name;
  serviceForm.value.description = serviceDetailsDraft.value.description.trim();
  isServiceDetailsModalOpen.value = false;
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
      includedItemIds: serviceForm.value.includedItemIds,
    };

    if (editingService.value) {
      const updated = await $fetch<PackageService>(`/api/admin/package-services/${editingService.value.id}`, {
        method: "PUT",
        body,
      });
      const index = packageServices.value.findIndex((service) => service.id === updated.id);
      if (index >= 0) packageServices.value[index] = updated;
    } else {
      const created = await $fetch<PackageService>("/api/admin/package-services", {
        method: "POST",
        body,
      });
      packageServices.value.push(created);
    }

    packageServices.value.sort((left, right) => left.name.localeCompare(right.name, "th"));
    await refreshPackageServices();
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

const setServiceItem = (itemId: string, selected: boolean | "indeterminate") => {
  const next = new Set(serviceForm.value.includedItemIds);
  if (selected === true) next.add(itemId);
  else next.delete(itemId);
  serviceForm.value.includedItemIds = [...next];
};

const toggleAllServiceItems = () => {
  const next = new Set(serviceForm.value.includedItemIds);
  for (const item of selectableServiceItems.value) {
    if (allServiceItemsSelected.value) next.delete(item.id);
    else next.add(item.id);
  }
  serviceForm.value.includedItemIds = [...next];
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

const closeServiceModal = (): void => {
  isServiceModalOpen.value = false;
};

const closeBulkDeleteModal = (): void => {
  isBulkDeleteOpen.value = false;
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
              <UButton label="เพิ่ม / แก้ไขบริการ" icon="i-lucide-sparkles" color="neutral" variant="outline"
                class="shrink-0" aria-label="เพิ่มหรือแก้ไขบริการ" :ui="{ label: 'hidden sm:inline' }"
                @click="openServiceModal" />
              <UButton label="เพิ่มแพ็กเกจ" trailing-icon="i-lucide-plus" color="primary" class="shrink-0"
                aria-label="เพิ่มแพ็กเกจ" :ui="{ label: 'hidden sm:inline' }" @click="openCreateModal" />
            </div>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-3 p-2 sm:p-6">
          <div v-if="tabItems.length > 1"
            class="-mx-2 border border-default/30 bg-default px-3! py-1! dark:border-default/40 dark:bg-default/80 sm:mx-0 sm:rounded-lg">
            <UTabs v-model="activeTab" color="neutral" variant="link" :content="false" :items="tabItems"
              class="w-full" />
          </div>

          <AdminPackagesPackageTable :packages="filteredPackages" :loading="loading"
            :toggling-public-package-id="togglingPublicPackageId" @edit="openEditModal" @delete="openDeleteModal"
            @bulk-delete="openBulkDeleteModal" @toggle-public="handleTogglePublic" @refresh="refresh" />
        </div>
      </template>
    </UDashboardPanel>

    <AdminPackagesPackageFormModal v-model:open="isFormOpen" :edit-package="editingPackage" :saving="isSavingPackage"
      :services="packageServices" :services-loading="isLoadingServices" @save="handleSave" />

    <UModal v-model:open="isServiceModalOpen" title="เพิ่ม / แก้ไขบริการ"
      description="จัดการบริการสำหรับกำหนดให้แพ็กเกจหลัก" :dismissible="!isSavingService"
      :ui="{ content: 'max-w-6xl' }">
      <template #body>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,2fr)]">
          <div
            class="-mx-2 space-y-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">รายการบริการ</p>
              <UButton label="เพิ่ม" icon="i-lucide-plus" size="xs" color="primary"
                :disabled="isSavingService" @click="openCreateServiceDetails" />
            </div>
            <div v-if="isLoadingServices" class="space-y-2">
              <USkeleton v-for="index in 3" :key="index" class="h-12 w-full" />
            </div>
            <div v-else-if="packageServices.length" class="space-y-1">
              <div v-for="service in packageServices" :key="service.id"
                class="flex items-center gap-1 border px-2 py-2 transition-colors sm:rounded-lg"
                :class="editingService?.id === service.id
                  ? 'border-info/30 bg-info/5 dark:border-info/25 dark:bg-elevated/65'
                  : 'border-default/25 bg-elevated/30 dark:border-default/15 dark:bg-elevated/25'">
                <button type="button"
                  class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:bg-elevated/50"
                  :disabled="isSavingService"
                  :aria-pressed="editingService?.id === service.id"
                  @click="openEditService(service)">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-highlighted">{{ service.name }}</span>
                  <span v-if="service.description" class="block truncate text-xs text-muted">{{ service.description
                    }}</span>
                </span>
                </button>
                <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs"
                  :disabled="isSavingService" :aria-label="`แก้ไขข้อมูลบริการ ${service.name}`"
                  @click="openEditServiceDetails(service)" />
              </div>
            </div>
            <p v-else
              class="rounded-lg border border-dashed border-default/30 p-4 text-center text-sm text-muted dark:border-default/20">
              ยังไม่มีบริการ
            </p>
          </div>

          <section
            class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-highlighted">
                  {{ serviceForm.name || "รายการผ้าในบริการ" }}
                </p>
                <p class="text-xs text-muted">
                  {{ serviceForm.name ? (serviceForm.includedItemIds.length ? "เลือกรายการผ้าที่รวมอยู่ในบริการนี้" : "ยังไม่มีรายการผ้า · เพิ่มภายหลังได้") : "เลือกบริการเดิม หรือเพิ่มบริการใหม่เพื่อจัดการรายการผ้า" }}
                </p>
              </div>
              <UButton v-if="editingService" label="แก้ไขข้อมูลบริการ" icon="i-lucide-pencil"
                color="neutral" variant="outline" size="sm" :disabled="isSavingService"
                @click="openEditServiceDetails(editingService)" />
            </div>

            <div v-if="serviceForm.name || editingService" class="space-y-3">
              <UFormField label="รายการผ้าที่ใช้บริการนี้" required>
              <div class="rounded-lg border border-default/40">
                <div class="grid gap-2 border-b border-default/40 p-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
                  <UInput v-model="serviceItemSearch" icon="i-lucide-search" placeholder="ค้นหารายการผ้า"
                    class="w-full" :disabled="isSavingService" />
                  <USelect v-model="serviceItemCategoryId" :items="serviceCategoryOptions" value-key="value"
                    label-key="label" icon="i-lucide-list-filter" aria-label="กรองตามประเภทผ้า" class="w-full"
                    :disabled="isSavingService" />
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default/40 px-3 py-2">
                  <span class="text-xs text-muted">
                    แสดง {{ filteredServiceCatalogItems.length }} รายการ · เลือกแล้ว
                    {{ serviceForm.includedItemIds.length }} รายการ
                  </span>
                  <UButton :label="allServiceItemsSelected ? 'ยกเลิกที่แสดง' : 'เลือกทั้งหมดที่แสดง'" color="neutral"
                    variant="outline" size="xs" type="button"
                    :disabled="isSavingService || !filteredServiceCatalogItems.length"
                    @click="toggleAllServiceItems" />
                </div>
                <div class="grid max-h-[min(32rem,55vh)] grid-cols-1 gap-1 overflow-y-auto p-2 sm:grid-cols-2 2xl:grid-cols-3">
                  <label v-for="item in filteredServiceCatalogItems" :key="item.id"
                    class="flex min-w-0 items-start gap-2 rounded-md p-2.5 hover:bg-elevated/60"
                    :class="item.isActive || serviceForm.includedItemIds.includes(item.id) ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'">
                    <UCheckbox :model-value="serviceForm.includedItemIds.includes(item.id)"
                      :disabled="isSavingService || (!item.isActive && !serviceForm.includedItemIds.includes(item.id))"
                      :aria-label="`เลือก ${item.name}`" @update:model-value="setServiceItem(item.id, $event)" />
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-medium text-highlighted">{{ item.name }}</span>
                      <span v-if="item.categoryName" class="block truncate text-xs text-muted">{{ item.categoryName }}</span>
                      <UBadge v-if="!item.isActive" color="warning" variant="subtle" size="xs" class="mt-1">
                        ปิดจากราคาหน้าร้าน · รายการแพ็กเกจเดิมยังใช้ได้
                      </UBadge>
                    </span>
                  </label>
                  <p v-if="!filteredServiceCatalogItems.length"
                    class="p-6 text-center text-sm text-muted sm:col-span-2 2xl:col-span-3">
                    {{ serviceCatalogItems.length ? "ไม่พบรายการผ้าที่ค้นหา" : "ยังไม่มีรายการผ้าในระบบ" }}
                  </p>
                </div>
              </div>
              </UFormField>
              <div class="flex justify-end">
                <UButton :label="editingService ? 'บันทึกการแก้ไข' : 'เพิ่มบริการ'"
                  :icon="editingService ? 'i-lucide-check' : 'i-lucide-plus'" color="primary" size="sm"
                  :loading="isSavingService" :disabled="isSavingService" @click="saveService" />
              </div>
            </div>
            <p v-else
              class="rounded-lg border border-dashed border-default/40 p-8 text-center text-sm text-muted">
              เลือกบริการทางซ้าย หรือกด “เพิ่ม” เพื่อเริ่มสร้างบริการใหม่
            </p>
          </section>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end">
          <UButton label="ปิด" color="neutral" variant="outline" :disabled="isSavingService"
            @click="closeServiceModal" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isServiceDetailsModalOpen"
      :title="editingService ? 'แก้ไขข้อมูลบริการ' : 'เพิ่มบริการใหม่'"
      description="กรอกชื่อและคำอธิบายก่อนเลือกรายการผ้าที่รวมในบริการ"
      :ui="{ content: 'max-w-lg' }">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveServiceDetailsDraft">
          <UFormField label="ชื่อบริการ" required :error="serviceDetailsError || undefined">
            <UInput v-model="serviceDetailsDraft.name" class="w-full" placeholder="เช่น ซักแห้ง, ซักพร้อมรีด"
              :color="serviceDetailsError ? 'error' : undefined" />
          </UFormField>
          <UFormField label="คำอธิบาย">
            <UInput v-model="serviceDetailsDraft.description" class="w-full" placeholder="ไม่บังคับ" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton label="ยกเลิก" color="neutral" variant="ghost" type="button"
              @click="isServiceDetailsModalOpen = false" />
            <UButton type="submit" :label="editingService ? 'ใช้ข้อมูลนี้' : 'เพิ่มบริการ'"
              :icon="editingService ? 'i-lucide-check' : 'i-lucide-plus'" color="primary"
              :loading="isSavingService" :disabled="isSavingService" />
          </div>
        </form>
      </template>
    </UModal>

    <UIConfirmModal v-model:open="isDeleteOpen" title="ลบแพ็กเกจ" description="ยืนยันการลบแพ็กเกจนี้ออกจากระบบ"
      icon="i-lucide-trash-2" icon-color="error" confirm-label="ลบแพ็กเกจ" confirm-color="error" :loading="isDeleting"
      @confirm="handleConfirmDelete" @cancel="isDeleteOpen = false">
      <template #message>
        คุณต้องการลบแพ็กเกจ
        <strong class="text-highlighted">{{ deletingPackage?.name }}</strong>
        หรือไม่?
      </template>

      <template #subMessage>
        <div class="space-y-1">
          <p>
            <span class="text-muted">ประเภท:</span>
            <UBadge :color="packageTypeColors[deletingPackage?.packageType as PackageType]" variant="subtle" size="sm"
              class="ml-1">
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
            <UButton icon="i-lucide-x" variant="ghost" size="xs" color="neutral"
              @click="handleRemoveFromBulkDelete(pkg.id)" />
          </div>
        </div>
        <p v-else class="text-sm text-muted text-center py-6">
          ไม่มีแพ็กเกจที่จะลบ
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3 w-full">
          <UButton label="ยกเลิก" color="neutral" variant="outline" @click="closeBulkDeleteModal" />
          <UButton label="ลบ" color="error" :disabled="!bulkDeletePackages.length" :loading="isBulkDeleting"
            @click="handleConfirmBulkDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
