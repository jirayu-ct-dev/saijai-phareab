<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const notify = useNotify();

// Fetch Rich Menus
const { data: richMenuResponse, refresh: refreshMenus, status } = useFetch<any>("/api/admin/settings/richmenu", {
  key: "admin-richmenus",
  default: () => ({ richMenus: [], syncedUsersCount: 0 }),
});

const richMenus = computed(() => richMenuResponse.value?.richMenus ?? []);
const isLoading = computed(() => status.value === "pending");

// Form & Modal States
const isCreateModalOpen = ref(false);
const isManageModalOpen = ref(false);
const searchQuery = ref("");
const selectedRoleFilter = ref("ALL");

const selectedMenu = ref<any>(null);
const createModalRef = ref<any>(null);

const filteredRichMenus = computed(() => {
  if (!richMenus.value) return [];
  return richMenus.value.filter((menu: any) => {
    const nameMatch = menu.name?.toLowerCase().includes(searchQuery.value.toLowerCase());
    const idMatch = menu.richMenuId?.toLowerCase().includes(searchQuery.value.toLowerCase());
    const aliasMatch = menu.aliasId?.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchesSearch = nameMatch || idMatch || aliasMatch;

    let matchesRole = true;
    if (selectedRoleFilter.value === "DEFAULT") {
      matchesRole = menu.isDefault;
    } else if (selectedRoleFilter.value && selectedRoleFilter.value !== "ALL") {
      matchesRole = menu.targetRole === selectedRoleFilter.value;
    }

    return matchesSearch && matchesRole;
  });
});

const openManageDetails = (menu: any) => {
  selectedMenu.value = menu;
  isManageModalOpen.value = true;
};

const handleDuplicate = (menu: any) => {
  createModalRef.value?.duplicate(menu);
};

const copyToClipboard = (text: string) => {
  if (typeof window !== "undefined" && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
    notify.success("คัดลอก Rich Menu ID เรียบร้อยแล้ว 📋");
  } else {
    notify.error("ไม่สามารถคัดลอกได้ในขณะนี้");
  }
};
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-3 p-2 sm:p-6">
    <div class="flex items-center justify-between rounded-md border border-default/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <div>
        <h1 class="text-xl font-semibold">LINE Rich Menu</h1>
        <p class="mt-1 text-sm text-muted">อัปโหลด ติดตั้ง และกำหนดสิทธิ์การแสดงผลของ Rich Menu ตามบทบาทผู้ใช้</p>
      </div>
      <UButton
        icon="i-lucide-plus"
        size="md"
        color="primary"
        @click="isCreateModalOpen = true; createModalRef?.resetForm();"
      >
        สร้าง Rich Menu ใหม่
      </UButton>
    </div>

    <!-- Filters and Search Bar -->
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between bg-default/40 dark:bg-elevated/20 p-4 rounded-xl border border-default/30">
      <div class="w-full md:w-96 relative">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="ค้นหา Rich Menu ตามชื่อ, ID, หรือ Alias..."
          class="w-full rounded-xl"
          size="md"
        />
      </div>
      <div class="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
        <span class="text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">บทบาทสิทธิ์:</span>
        <USelect
          v-model="selectedRoleFilter"
          placeholder="แสดงตามบทบาททั้งหมด"
          :items="[
            { label: 'บทบาททั้งหมด', value: 'ALL' },
            { label: 'เมนูเริ่มต้น (DEFAULT)', value: 'DEFAULT' },
            { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
            { label: 'สมาชิก (MEMBER)', value: 'MEMBER' },
            { label: 'พนักงาน (EMPLOYEE)', value: 'EMPLOYEE' },
            { label: 'ผู้ดูแลระบบ (ADMIN)', value: 'ADMIN' },
          ]"
          class="w-full sm:w-60"
          size="md"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="i in 3" :key="`rm-skeleton-${i}`" class="p-4 space-y-4 border border-default/30">
        <USkeleton class="h-6 w-3/4 rounded" />
        <USkeleton class="h-40 w-full rounded" />
        <USkeleton class="h-8 w-full rounded" />
      </UCard>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredRichMenus.length" class="relative flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-default/40 backdrop-blur-md px-6 shadow-sm">
      <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
        <UIcon name="i-lucide-menu" class="w-8 h-8" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">ไม่พบข้อมูล LINE Rich Menu</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm font-medium">
        ลองปรับเปลี่ยนคำค้นหาหรือตัวกรอง หรือเริ่มต้นสร้างเมนูใหม่เพื่อส่งไปยังระบบ LINE OA ได้ทันที
      </p>
      <UButton
        class="mt-6 font-extrabold px-6 py-3 rounded-xl shadow-md hover:shadow-primary/20 transition-all duration-300"
        icon="i-lucide-plus"
        @click="isCreateModalOpen = true; createModalRef?.resetForm();"
      >
        สร้าง Rich Menu แรก
      </UButton>
    </div>

    <div v-else class="grid grid-cols-1 gap-6">
      <AdminRichMenuCard
        v-for="menu in filteredRichMenus"
        :key="menu.id"
        :menu="menu"
        @manage="openManageDetails"
        @copy="copyToClipboard"
      />
    </div>

    <AdminRichMenuCreateModal
      v-model="isCreateModalOpen"
      ref="createModalRef"
      @refresh="refreshMenus"
    />

    <AdminRichMenuManageModal
      v-model="isManageModalOpen"
      :selected-menu="selectedMenu"
      @refresh="refreshMenus"
      @duplicate="handleDuplicate"
    />
  </div>
</template>
