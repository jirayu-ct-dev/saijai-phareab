<script setup lang="ts">
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const notify = useNotify();

// Fetch Rich Menus
const { data: richMenus, refresh: refreshMenus, status } = useFetch<any[]>("/api/admin/settings/richmenu", {
  key: "admin-richmenus",
  default: () => [],
});

const isLoading = computed(() => status.value === "pending");

// Form & Modal States
const isCreateModalOpen = ref(false);
const isManageModalOpen = ref(false);
const activeManageTab = ref("preview");
const searchQuery = ref("");
const selectedRoleFilter = ref("");
const isSaving = ref(false);

const selectedMenu = ref<any>(null);
const assignForm = reactive({
  targetRole: "" as string | null,
  isDefault: false,
});
const aliasForm = reactive({
  aliasId: "",
});

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
    } else if (selectedRoleFilter.value) {
      matchesRole = menu.targetRole === selectedRoleFilter.value;
    }

    return matchesSearch && matchesRole;
  });
});

const quickStats = computed(() => {
  if (!richMenus.value) return { total: 0, active: 0, draft: 0, users: 142 };
  const total = richMenus.value.length;
  const active = richMenus.value.filter((m: any) => m.isDefault || m.targetRole).length;
  const draft = richMenus.value.filter((m: any) => !m.isDefault && !m.targetRole).length;
  return { total, active, draft, users: 142 };
});

const openManageDetails = (menu: any) => {
  selectedMenu.value = menu;
  assignForm.targetRole = menu.targetRole || "";
  assignForm.isDefault = menu.isDefault;
  aliasForm.aliasId = menu.aliasId || "";
  activeManageTab.value = "preview";
  isManageModalOpen.value = true;
};

const onDuplicateMenu = async (menu: any) => {
  form.name = `${menu.name} (คัดลอก)`;
  form.jsonContent = menu.jsonContent;
  form.targetRole = menu.targetRole || "";
  form.isDefault = false;
  
  try {
    const res = await fetch(menu.imageUrl);
    const blob = await res.blob();
    const file = new File([blob], "richmenu-duplicate.png", { type: "image/png" });
    photoFile.value = file;
    form.logoUrl = menu.imageUrl;
    imagePreviewUrl.value = menu.imageUrl;
    isCreateModalOpen.value = true;
    notify.success("คัดลอกโครงสร้าง Rich Menu สำเร็จ!");
  } catch (err) {
    console.error("Failed to copy image blob", err);
    photoFile.value = null;
    form.logoUrl = undefined;
    imagePreviewUrl.value = "";
    isCreateModalOpen.value = true;
    notify.warning("คัดลอกโครงสร้างสำเร็จ! กรุณาอัปโหลดไฟล์ภาพ Rich Menu ใหม่อีกครั้ง");
  }
};

const form = reactive({
  name: "",
  jsonContent: JSON.stringify({
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: "richmenu-template",
    chatBarText: "เมนูหลัก",
    areas: [
      {
        bounds: {
          x: 0,
          y: 0,
          width: 1250,
          height: 1686
        },
        action: {
          type: "uri",
          uri: "https://liff.line.me/your-liff-id/packages"
        }
      },
      {
        bounds: {
          x: 1250,
          y: 0,
          width: 1250,
          height: 1686
        },
        action: {
          type: "message",
          text: "ติดต่อสอบถาม"
        }
      }
    ]
  }, null, 2),
  targetRole: "" as string | null,
  isDefault: false,
  logoUrl: undefined as string | undefined,
});

// Image Upload Handling
const photoFile = ref<File | null>(null);
const imagePhotos = computed<Photo[]>(() => {
  if (photoFile.value) return [{ key: "photo", file: photoFile.value, url: null }];
  return form.logoUrl ? [{ key: "photo", file: null, url: form.logoUrl }] : [];
});

const onPhotosUpdate = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  photoFile.value = photo?.file ?? null;
  if (!photo) {
    form.logoUrl = undefined;
    imagePreviewUrl.value = "";
  } else if (photo.file) {
    imagePreviewUrl.value = URL.createObjectURL(photo.file);
  }
};

const imagePreviewUrl = ref("");
const hoveredHotspot = ref<any>(null);

// Parsed and Calculated JSON Data
const parsedConfig = computed(() => {
  try {
    return JSON.parse(form.jsonContent);
  } catch {
    return null;
  }
});

const jsonValidationError = computed(() => {
  if (!form.jsonContent.trim()) return "กรุณากรอก JSON Configuration";
  try {
    const config = JSON.parse(form.jsonContent);
    if (!config.size || typeof config.size.width !== "number" || typeof config.size.height !== "number") {
      return "ข้อมูลขนาด (size) ต้องระบุ width และ height เป็นตัวเลข";
    }
    if (config.size.width < 800 || config.size.width > 2500 || config.size.height < 250 || config.size.height > 1686) {
      return "ขนาด Rich Menu ต้องอยู่ระหว่าง กว้าง 800-2500px, สูง 250-1686px";
    }
    if (!config.chatBarText) {
      return "กรุณาระบุข้อความสำหรับ chatBarText";
    }
    if (!Array.isArray(config.areas) || config.areas.length === 0) {
      return "ต้องกำหนดพื้นที่ปุ่ม (areas) อย่างน้อย 1 ปุ่ม";
    }
    for (let i = 0; i < config.areas.length; i++) {
      const area = config.areas[i];
      if (!area.bounds || typeof area.bounds.x !== "number" || typeof area.bounds.y !== "number" || typeof area.bounds.width !== "number" || typeof area.bounds.height !== "number") {
        return `ปุ่มที่ ${i + 1}: พิกัด bounds ไม่ถูกต้อง`;
      }
      if (!area.action || !area.action.type) {
        return `ปุ่มที่ ${i + 1}: ประเภทของแอ็กชันไม่ถูกต้อง`;
      }
    }
    return null;
  } catch (e: any) {
    return `รูปแบบ JSON ไม่ถูกต้อง: ${e.message}`;
  }
});

const hotspots = computed(() => {
  const config = parsedConfig.value;
  if (!config || !config.size || !Array.isArray(config.areas)) return [];
  const w = config.size.width;
  const h = config.size.height;
  if (!w || !h) return [];

  return config.areas.map((area: any, index: number) => {
    const bounds = area.bounds;
    if (!bounds) return null;
    return {
      index,
      x: (bounds.x / w) * 100,
      y: (bounds.y / h) * 100,
      width: (bounds.width / w) * 100,
      height: (bounds.height / h) * 100,
      action: area.action,
      rawBounds: bounds,
    };
  }).filter(Boolean);
});

// View mode hotspots overlay
const viewModeHotspots = computed(() => {
  if (!selectedMenu.value) return [];
  try {
    const config = JSON.parse(selectedMenu.value.jsonContent);
    const w = config.size.width;
    const h = config.size.height;
    if (!w || !h || !Array.isArray(config.areas)) return [];

    return config.areas.map((area: any, index: number) => {
      const bounds = area.bounds;
      if (!bounds) return null;
      return {
        index,
        x: (bounds.x / w) * 100,
        y: (bounds.y / h) * 100,
        width: (bounds.width / w) * 100,
        height: (bounds.height / h) * 100,
        action: area.action,
        rawBounds: bounds,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
});

// Actions
const onSubmit = async () => {
  if (jsonValidationError.value) {
    notify.error(jsonValidationError.value);
    return;
  }
  if (!photoFile.value) {
    notify.error("กรุณาอัปโหลดรูปภาพ PNG สำหรับ Rich Menu");
    return;
  }

  isSaving.value = true;

  const fd = new FormData();
  fd.append("name", form.name);
  fd.append("jsonContent", form.jsonContent);
  if (form.targetRole) fd.append("targetRole", form.targetRole);
  fd.append("isDefault", form.isDefault.toString());
  fd.append("file", photoFile.value);

  try {
    await $fetch("/api/admin/settings/richmenu", {
      method: "POST",
      body: fd,
    });
    notify.success("บันทึกและติดตั้ง LINE Rich Menu เรียบร้อยแล้ว 🚀");
    resetForm();
    await refreshMenus();
    isCreateModalOpen.value = false;
  } catch (err: any) {
    console.error(err);
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาดในการติดตั้ง Rich Menu");
  } finally {
    isSaving.value = false;
  }
};

const deleteMenu = async (id: string) => {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Rich Menu นี้ออกจากระบบและจาก LINE?")) return;

  try {
    await $fetch(`/api/admin/settings/richmenu/${id}`, {
      method: "DELETE",
    });
    notify.success("ลบ Rich Menu เรียบร้อยแล้ว");
    if (selectedMenu.value?.id === id) selectedMenu.value = null;
    await refreshMenus();
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาดในการลบ Rich Menu");
  }
};

const onAssign = async () => {
  if (!selectedMenu.value) return;
  isSaving.value = true;

  try {
    await $fetch("/api/admin/settings/richmenu/assign", {
      method: "POST",
      body: {
        id: selectedMenu.value.id,
        targetRole: assignForm.targetRole || null,
        isDefault: assignForm.isDefault,
      },
    });
    notify.success("อัปเดตการกำหนดสิทธิ์สำเร็จ และกำลังซิงค์ผู้ใช้งานในเบื้องหลัง 🔄");
    isManageModalOpen.value = false;
    await refreshMenus();
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  } finally {
    isSaving.value = false;
  }
};

const onAliasSave = async () => {
  if (!selectedMenu.value || !aliasForm.aliasId.trim()) return;
  isSaving.value = true;

  try {
    await $fetch("/api/admin/settings/richmenu/alias", {
      method: "POST",
      body: {
        id: selectedMenu.value.id,
        aliasId: aliasForm.aliasId.trim(),
      },
    });
    notify.success("สร้าง/อัปเดต LINE Alias เรียบร้อยแล้ว");
    isManageModalOpen.value = false;
    await refreshMenus();
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  } finally {
    isSaving.value = false;
  }
};

const deleteAlias = async (menu: any) => {
  if (!confirm("คุณต้องการลบ Alias ของ Rich Menu นี้ใช่หรือไม่?")) return;

  try {
    await $fetch(`/api/admin/settings/richmenu/alias?id=${menu.id}`, {
      method: "DELETE",
    });
    notify.success("ลบ LINE Alias เรียบร้อยแล้ว");
    isManageModalOpen.value = false;
    await refreshMenus();
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  }
};

const copyToClipboard = (text: string) => {
  if (typeof window !== "undefined" && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
    notify.success("คัดลอก Rich Menu ID เรียบร้อยแล้ว 📋");
  } else {
    notify.error("ไม่สามารถคัดลอกได้ในขณะนี้");
  }
};

const simulatorRef = ref<HTMLElement | null>(null);

// Auto-select first rich menu if none selected
watch(richMenus, (newVal) => {
  if (newVal && newVal.length > 0 && !selectedMenu.value) {
    selectedMenu.value = newVal[0];
  }
}, { immediate: true });

const resetForm = () => {
  form.name = "";
  form.targetRole = "";
  form.isDefault = false;
  form.logoUrl = undefined;
  photoFile.value = null;
  imagePreviewUrl.value = "";
};

const getHotspotsCount = (jsonStr: string) => {
  try {
    const obj = JSON.parse(jsonStr);
    return Array.isArray(obj?.areas) ? obj.areas.length : 0;
  } catch {
    return 0;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
</script>

<template>
  <div class="relative mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-8 overflow-hidden min-h-screen">
    <!-- Premium background glows -->
    <div class="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-1/3 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

    <!-- Header Block -->
    <div class="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl border border-default/30 bg-default/60 backdrop-blur-md px-6 py-6 shadow-sm dark:border-default/20 dark:bg-elevated/40">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black flex items-center gap-3 tracking-tight text-slate-800 dark:text-white">
          <span class="p-2.5 rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
            <UIcon name="i-lucide-menu" class="w-6 h-6" />
          </span>
          ระบบจัดการ LINE Rich Menu
        </h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          อัปโหลด ติดตั้ง และกำหนดสิทธิ์การแสดงผลของ Rich Menu บนแชท LINE OA ของร้านได้แบบพรีเมียมตามบทบาทผู้ใช้
        </p>
      </div>
      <div class="flex-shrink-0">
        <UButton
          icon="i-lucide-plus"
          size="lg"
          color="primary"
          class="font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-primary/20 transition-all duration-300"
          @click="isCreateModalOpen = true; resetForm();"
        >
          สร้าง Rich Menu ใหม่
        </UButton>
      </div>
    </div>

    <!-- SaaS Quick Stats Banner -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard
        v-for="stat in [
          { label: 'Rich Menus ทั้งหมด', value: quickStats.total, icon: 'i-lucide-layers', color: 'text-blue-500 bg-blue-500/10' },
          { label: 'เปิดใช้งานอยู่', value: quickStats.active, icon: 'i-lucide-sparkles', color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'แบบร่าง (Draft)', value: quickStats.draft, icon: 'i-lucide-file-text', color: 'text-amber-500 bg-amber-500/10' },
          { label: 'สิทธิ์ผู้ใช้ซิงค์แล้ว', value: quickStats.users, icon: 'i-lucide-users-round', color: 'text-purple-500 bg-purple-500/10' }
        ]"
        :key="stat.label"
        class="border border-default/30 hover:border-default/60 transition-all duration-200"
        :ui="{ body: { padding: 'p-4 sm:p-5' } }"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-3 rounded-lg" :class="stat.color">
            <UIcon :name="stat.icon" class="w-5 h-5 sm:w-6 h-6" />
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-400 dark:text-slate-500">{{ stat.label }}</p>
            <h3 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-0.5">{{ stat.value }}</h3>
          </div>
        </div>
      </UCard>
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
            { label: 'บทบาททั้งหมด', value: '' },
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
        @click="isCreateModalOpen = true; resetForm();"
      >
        สร้าง Rich Menu แรก
      </UButton>
    </div>

    <!-- Modern Horizontal Card of Rich Menu Layout -->
    <div v-else class="grid grid-cols-1 gap-6">
      <UCard
        v-for="menu in filteredRichMenus"
        :key="menu.id"
        class="overflow-hidden group hover:shadow-xl transition-all duration-300 border border-default/30 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        :ui="{ body: { padding: 'p-0' } }"
      >
        <div class="flex flex-col md:flex-row w-full">
          <!-- Card Image Preview Left Side -->
          <div class="relative w-full md:w-52 lg:w-60 flex-shrink-0 aspect-[2500/1686] md:aspect-auto bg-slate-900 overflow-hidden group-hover:opacity-95 transition-opacity min-h-[150px]">
            <img
              :src="menu.imageUrl"
              class="w-full h-full object-cover md:absolute md:inset-0"
              draggable="false"
              alt="Rich Menu Image Preview"
            />
            <!-- Glowing overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-950/20 opacity-60 group-hover:opacity-80 transition-opacity"></div>
            
            <!-- Quick badges on image overlay -->
            <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <UBadge
                v-if="menu.isDefault || menu.targetRole"
                color="success"
                variant="solid"
                size="md"
                class="font-black px-2.5 py-0.5 rounded-lg shadow-sm flex items-center gap-1"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                Active
              </UBadge>
              <UBadge
                v-else
                color="neutral"
                variant="solid"
                size="md"
                class="font-black px-2.5 py-0.5 rounded-lg"
              >
                Draft
              </UBadge>
            </div>

            <!-- Hotspots count tag -->
            <div class="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-2 py-0.5 flex items-center gap-1.5 text-xs text-white font-bold">
              <UIcon name="i-lucide-layout" class="w-3.5 h-3.5 text-primary" />
              {{ getHotspotsCount(menu.jsonContent) }} ปุ่มสัมผัส
            </div>
          </div>

          <!-- Card Body Info Right Side -->
          <div class="p-6 flex-1 flex flex-col justify-between space-y-6 min-w-0">
            <div class="space-y-3 w-full">
              <!-- Menu Name (Wrapping properly & full width) -->
              <h3 class="font-extrabold text-xl text-slate-800 dark:text-white leading-snug group-hover:text-primary transition-colors whitespace-normal break-words w-full">
                {{ menu.name }}
              </h3>

              <!-- Metadata row under name (flex-wrap) -->
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <!-- Copyable ID -->
                <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-800/40 px-2 py-0.5 rounded flex-shrink-0">
                  <span class="text-[10px] font-mono text-slate-400 break-all" :title="menu.richMenuId">
                    ID: {{ menu.richMenuId }}
                  </span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    class="p-0.5 min-h-0 text-slate-400 hover:text-primary"
                    @click.stop="copyToClipboard(menu.richMenuId)"
                    title="คัดลอก Rich Menu ID"
                  />
                </div>

                <!-- สิทธิ์ -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <span class="text-slate-400 dark:text-slate-500 font-medium">สิทธิ์:</span>
                  <UBadge v-if="menu.isDefault" color="success" variant="subtle" size="sm" class="font-bold px-2 py-0.5 rounded">
                    Default Menu
                  </UBadge>
                  <UBadge v-if="menu.targetRole" color="primary" variant="subtle" size="sm" class="font-bold px-2 py-0.5 rounded">
                    บทบาท: {{ menu.targetRole }}
                  </UBadge>
                  <span v-if="!menu.isDefault && !menu.targetRole" class="text-slate-400 dark:text-slate-500 italic text-[11px]">
                    ทุกคน (หากไม่กำหนด)
                  </span>
                </div>

                <!-- LINE Alias -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <span class="text-slate-400 dark:text-slate-500 font-medium">LINE Alias:</span>
                  <span v-if="menu.aliasId" class="font-mono bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/30 text-indigo-500 rounded px-2 py-0.5 text-[11px] font-semibold">
                    {{ menu.aliasId }}
                  </span>
                  <span v-else class="text-slate-400 dark:text-slate-500 italic text-[11px]">ไม่ได้กำหนด Alias</span>
                </div>
              </div>
            </div>

            <!-- Middle divider and date/stats row -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs border-t border-slate-100 dark:border-slate-800/80 pt-4 w-full">
              <div class="flex items-center gap-4 text-slate-400/80 whitespace-nowrap flex-shrink-0">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
                  อัปเดตล่าสุด: {{ formatDate(menu.updatedAt) }}
                </span>
              </div>

              <!-- Operations Buttons (Only Manage & Simulate CTA on Card Layout) -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <!-- Manage CTA -->
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-lucide-settings-2"
                  class="font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                  @click.stop="openManageDetails(menu)"
                >
                  จัดการและจำลอง
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Create / Upload Modal Dialog (Spacious & Clean Layout) -->
    <UModal v-model:open="isCreateModalOpen" :ui="{ content: 'sm:max-w-5xl' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-slate-100 dark:divide-slate-800' }" class="p-2">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
                <UIcon name="i-lucide-plus-circle" class="w-5 h-5" />
              </span>
              <h3 class="text-base font-bold text-slate-800 dark:text-white">ติดตั้ง LINE Rich Menu ใหม่</h3>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1" @click="isCreateModalOpen = false" />
          </div>
        </template>

        <UForm :state="form" class="space-y-6 pr-1 max-h-[70vh] overflow-y-auto" @submit="onSubmit">
          <div class="grid gap-6 sm:grid-cols-2">
            
            <!-- Left inputs column -->
            <div class="space-y-4">
              <UFormField label="ชื่อเรียกภายในระบบ (Name)" name="name" required description="ใช้เพื่อระบุและค้นหาตัวเมนูในฝั่งแอดมิน">
                <UInput v-model="form.name" placeholder="เช่น เมนูลูกค้าทั่วไป, เมนูพนักงาน" class="w-full rounded-xl" />
              </UFormField>

              <UFormField label="อัปโหลดรูปภาพเมนู (PNG เท่านั้น)" name="file" required>
                <UIPhotoUpload
                  label="รูปภาพ Rich Menu"
                  description="ขนาดแนะนำ 2500x1686 หรือ 2500x843 px (ไม่เกิน 1MB)"
                  :photos="imagePhotos"
                  :max="1"
                  @update:photos="onPhotosUpdate"
                />
              </UFormField>

              <!-- Space-out Target Role Block -->
              <div class="space-y-4 rounded-xl border border-default p-4 bg-default/40 dark:bg-slate-900/40">
                <UFormField label="จำกัดสิทธิ์เฉพาะบทบาท" name="targetRole" description="สลับสิทธิ์ Rich Menu บน LINE อัตโนมัติตามระดับบทบาทนี้">
                  <USelect
                    v-model="form.targetRole"
                    placeholder="สำหรับทุกคน (เมนูหลัก)"
                    :items="[
                      { label: 'ไม่จำกัดบทบาท (สำหรับทุกคน)', value: '' },
                      { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
                      { label: 'สมาชิกรายเดือน (MEMBER)', value: 'MEMBER' },
                      { label: 'พนักงาน (EMPLOYEE)', value: 'EMPLOYEE' },
                      { label: 'ผู้ดูแลระบบ (ADMIN)', value: 'ADMIN' },
                    ]"
                    class="w-full"
                  />
                </UFormField>

                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center">
                  <UCheckbox
                    v-model="form.isDefault"
                    label="ตั้งค่าเป็นเมนูเริ่มต้น (Default)"
                    description="เมนูจะถูกเปิดให้ลูกค้าที่ระบบไม่พบเงื่อนไขสิทธิ์อื่น"
                  />
                </div>
              </div>
            </div>

            <!-- Right live schema inspector and visualizer block -->
            <div class="space-y-4">
              <UFormField label="JSON Configuration (LINE Messaging API Schema)" name="jsonContent" required description="พิกัดปุ่มสัมผัส (areas) และความกว้าง/ความสูง">
                <UTextarea
                  v-model="form.jsonContent"
                  placeholder="กรอก JSON Configuration..."
                  :rows="13"
                  class="w-full font-mono text-xs p-3 bg-slate-900 text-slate-100 rounded-xl border-slate-800"
                />
              </UFormField>

              <!-- Validation Feedback -->
              <div
                v-if="jsonValidationError"
                class="p-3 border border-red-500/20 bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold"
              >
                ⚠️ {{ jsonValidationError }}
              </div>
              <div
                v-else
                class="p-3 border border-green-500/20 bg-green-500/10 text-green-600 rounded-xl text-xs flex items-center gap-2 font-semibold"
              >
                <UIcon name="i-lucide-check-circle" class="w-4 h-4 text-green-500" />
                โครงสร้าง JSON และพิกัด Hotspots ได้รับการตรวจสอบว่าถูกต้อง!
              </div>
            </div>
          </div>

          <!-- Bottom Hotspot Layout Visual preview inside Create Modal -->
          <div v-if="imagePreviewUrl && hotspots.length" class="border border-default/50 rounded-2xl p-4 bg-slate-950/90 shadow-inner">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <UIcon name="i-lucide-layout" class="w-4 h-4 text-emerald-500 animate-pulse" />
                ภาพจำลองพิกัดปุ่มสัมผัสตามโครงสร้าง JSON (Hotspots)
              </h4>
              <span class="text-[10px] text-muted bg-slate-800 px-2.5 py-0.5 rounded-full font-bold text-emerald-400">
                พบพิกัดทั้งหมด {{ hotspots.length }} ปุ่ม
              </span>
            </div>
            
            <div class="relative w-full max-w-md mx-auto aspect-[2500/1686] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-md">
              <img
                :src="imagePreviewUrl"
                class="w-full h-full object-cover"
                draggable="false"
              />
              <svg class="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <g v-for="hs in hotspots" :key="`ch-${hs.index}`">
                  <rect
                    :x="`${hs.x}%`"
                    :y="`${hs.y}%`"
                    :width="`${hs.width}%`"
                    :height="`${hs.height}%`"
                    fill="rgba(16, 185, 129, 0.15)"
                    stroke="rgba(16, 185, 129, 0.85)"
                    stroke-width="1.5"
                  />
                  <!-- Tiny numeric indicator -->
                  <rect
                    :x="`${hs.x + 0.5}%`"
                    :y="`${hs.y + 0.5}%`"
                    width="18"
                    height="18"
                    rx="3"
                    fill="rgba(15, 23, 42, 0.8)"
                  />
                  <text
                    :x="`${hs.x + 0.5}%`"
                    :y="`${hs.y + 0.5}%`"
                    dx="9"
                    dy="13"
                    font-size="9"
                    fill="#ffffff"
                    font-weight="bold"
                    text-anchor="middle"
                  >
                    {{ hs.index + 1 }}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          <!-- Deploy Submit Action -->
          <div class="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <UButton
              color="neutral"
              variant="outline"
              class="font-bold rounded-xl px-5"
              @click="isCreateModalOpen = false"
            >
              ยกเลิก
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isSaving"
              :disabled="!!jsonValidationError"
              class="font-bold rounded-xl px-5"
              icon="i-lucide-upload-cloud"
            >
              ปรับใช้ออนไลน์ไปยัง LINE
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <!-- Immersive Integrated Configuration Detail Drawer Modal (Spacious UModal) -->
    <UModal v-model:open="isManageModalOpen" :ui="{ content: 'sm:max-w-6xl' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-slate-100 dark:divide-slate-800' }" class="p-2">
        <template #header>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
                <UIcon name="i-lucide-settings-2" class="w-5 h-5" />
              </span>
              <h3 class="text-base font-bold text-slate-800 dark:text-white">จัดการและพรีวิว: {{ selectedMenu?.name }}</h3>
            </div>
            
            <div class="flex items-center gap-3 flex-shrink-0 self-end sm:self-auto">
              <!-- Duplicate / Clone Action -->
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-lucide-copy-plus"
                class="font-bold py-1.5 px-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1.5 whitespace-nowrap"
                @click.stop="onDuplicateMenu(selectedMenu); isManageModalOpen = false;"
                title="คัดลอกเพื่อสร้างใหม่ (Duplicate)"
              >
                คัดลอกเมนู
              </UButton>

              <!-- Delete Menu -->
              <UButton
                size="sm"
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                class="font-bold py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap"
                @click.stop="deleteMenu(selectedMenu.id)"
                title="ลบ Rich Menu นี้"
              >
                ลบเมนู
              </UButton>

              <div class="hidden sm:block w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1"></div>

              <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1" @click="isManageModalOpen = false" />
            </div>
          </div>
        </template>

        <div v-if="selectedMenu" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-h-[70vh] overflow-y-auto pr-1 py-1">
          
          <!-- Left Column inside Modal: Luxury Smartphone Simulator Preview -->
          <div class="lg:col-span-4 flex flex-col items-center">
            <div class="w-full max-w-[270px] bg-slate-950 ring-4 ring-slate-800/80 rounded-[34px] shadow-2xl p-2.5 pb-3.5 relative overflow-hidden mx-auto border-4 border-slate-900/90 select-none">
              
              <!-- Speaker & Camera Notch / Dynamic Island -->
              <div class="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-3.5 bg-slate-950 rounded-full z-20 flex items-center justify-center gap-1.5 px-3">
                <div class="w-8 h-0.5 bg-slate-800 rounded-full"></div>
                <div class="w-2 h-2 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                  <div class="w-0.5 h-0.5 bg-blue-900 rounded-full"></div>
                </div>
              </div>

              <!-- Simulated Mobile Status Bar -->
              <div class="flex justify-between items-center px-4 pt-1.5 pb-2 text-[9px] text-slate-400 font-semibold select-none z-10">
                <span>12:30</span>
                <div class="flex items-center gap-1">
                  <UIcon name="i-lucide-signal" class="w-2.5 h-2.5" />
                  <UIcon name="i-lucide-wifi" class="w-2.5 h-2.5" />
                  <div class="w-4 h-2 border border-slate-500 rounded-xs p-0.5 flex items-center">
                    <div class="w-full h-full bg-slate-400 rounded-3xs"></div>
                  </div>
                </div>
              </div>

              <!-- LINE Chat Header -->
              <div class="flex items-center justify-between bg-slate-900/95 border-b border-slate-800/80 py-1.5 px-3 text-slate-200">
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5 text-slate-400" />
                  <div class="relative">
                    <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-[9px]">
                      SJ
                    </div>
                    <div class="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-slate-900"></div>
                  </div>
                  <div>
                    <div class="text-[9px] font-bold flex items-center gap-0.5 leading-none">
                      SaiJai Official
                      <UIcon name="i-lucide-badge-check" class="w-2.5 h-2.5 text-primary" />
                    </div>
                    <span class="text-[7.5px] text-emerald-400 flex items-center gap-0.5 mt-0.5">
                      <span class="w-0.5 h-0.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      แชทบอทออนไลน์
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1 text-slate-400">
                  <UIcon name="i-lucide-phone" class="w-2.5 h-2.5" />
                  <UIcon name="i-lucide-search" class="w-2.5 h-2.5" />
                  <UIcon name="i-lucide-menu" class="w-2.5 h-2.5" />
                </div>
              </div>

              <!-- Simulated Chat Bubble Space -->
              <div class="p-2 space-y-1.5 bg-slate-950 flex-1 min-h-[60px] flex flex-col justify-end text-left">
                <div class="flex gap-1.5 items-start max-w-[90%]">
                  <div class="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[7.5px] font-bold">SJ</div>
                  <div class="bg-slate-900 text-slate-200 rounded-lg rounded-tl-none p-1.5 text-[8.5px] leading-normal shadow-sm border border-slate-800/80">
                    สวัสดีค่ะ ลองทดสอบคลิกปุ่มสัมผัสบนภาพเมนูด้านล่างนี้ได้เลยค่ะ! 🌸
                  </div>
                </div>
              </div>

              <!-- Simulator Body (Image & Hotspots) -->
              <div class="relative w-full aspect-[2500/1686] bg-slate-900 overflow-hidden select-none border-y border-slate-900">
                <img
                  :src="selectedMenu.imageUrl"
                  class="w-full h-full object-cover"
                  draggable="false"
                />

                <!-- SVG hotspot layer overlay -->
                <svg class="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <g
                    v-for="hs in viewModeHotspots"
                    :key="`vh-${hs.index}`"
                    class="cursor-pointer group/hotspot"
                    @mouseenter="hoveredHotspot = hs"
                    @mouseleave="hoveredHotspot = null"
                  >
                    <!-- Clickable Area Highlight Rect -->
                    <rect
                      :x="`${hs.x}%`"
                      :y="`${hs.y}%`"
                      :width="`${hs.width}%`"
                      :height="`${hs.height}%`"
                      :fill="hoveredHotspot?.index === hs.index ? 'rgba(99, 102, 241, 0.28)' : 'rgba(59, 130, 246, 0.12)'"
                      :stroke="hoveredHotspot?.index === hs.index ? '#6366f1' : 'rgba(59, 130, 246, 0.7)'"
                      :stroke-width="hoveredHotspot?.index === hs.index ? 2.5 : 1.5"
                      class="transition-all duration-150"
                      :stroke-dasharray="hs.action.type === 'richmenuswitch' ? '4 2' : 'none'"
                    />
                    
                    <!-- Tiny numeric key indicator -->
                    <rect
                      :x="`${hs.x + 0.5}%`"
                      :y="`${hs.y + 0.5}%`"
                      width="15"
                      height="15"
                      rx="3"
                      :fill="hoveredHotspot?.index === hs.index ? '#6366f1' : 'rgba(15, 23, 42, 0.8)'"
                      class="pointer-events-none transition-colors duration-150"
                    />
                    <text
                      :x="`${hs.x + 0.5}%`"
                      :y="`${hs.y + 0.5}%`"
                      dx="7.5"
                      dy="11"
                      font-size="9"
                      fill="#ffffff"
                      font-weight="bold"
                      text-anchor="middle"
                      class="pointer-events-none font-sans"
                    >
                      {{ hs.index + 1 }}
                    </text>
                  </g>
                </svg>
              </div>

              <!-- Bottom Chat bar sim -->
              <div class="flex items-center justify-between py-1.5 px-3 bg-slate-900 text-slate-200 text-[9px] font-semibold select-none cursor-pointer hover:bg-slate-800 transition-colors">
                <div class="flex items-center gap-1">
                  <UIcon name="i-lucide-keyboard" class="w-3 h-3 text-slate-400" />
                  <div class="w-[1px] h-2 bg-slate-800"></div>
                </div>
                <span class="font-bold tracking-wide flex items-center gap-0.5 text-[9px]">
                  {{ JSON.parse(selectedMenu.jsonContent)?.chatBarText || 'เมนูหลัก' }}
                  <UIcon name="i-lucide-chevron-up" class="w-2.5 h-2.5 text-slate-400" />
                </span>
                <UIcon name="i-lucide-smile" class="w-3 h-3 text-slate-400" />
              </div>

              <!-- Phone home indicator bar -->
              <div class="w-20 h-1 bg-slate-800 rounded-full mx-auto mt-2"></div>
            </div>

            <!-- Quick copy menu ID inside modal -->
            <div class="mt-4 flex items-center gap-1.5 justify-center">
              <span class="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Menu ID: {{ selectedMenu.richMenuId }}
              </span>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-copy"
                class="p-0.5 min-h-0 text-slate-400 hover:text-primary"
                @click="copyToClipboard(selectedMenu.richMenuId)"
              />
            </div>
          </div>

          <!-- Right Column inside Modal: Configuration Tab panels -->
          <div class="lg:col-span-8 space-y-6">
            <!-- Modal Internal Tab Buttons (Notion-like minimalist pills) -->
            <div class="flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-default/30 gap-1">
              <button
                v-for="tab in [
                  { id: 'preview', label: '1. พิกัด Hotspots', icon: 'i-lucide-layout' },
                  { id: 'settings', label: '2. สิทธิ์เข้าถึง', icon: 'i-lucide-user-cog' },
                  { id: 'alias', label: '3. LINE Alias', icon: 'i-lucide-link' },
                  { id: 'schema', label: '4. โครงสร้าง JSON', icon: 'i-lucide-file-code' }
                ]"
                :key="tab.id"
                class="flex-1 min-w-[120px] py-2 px-3 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
                :class="activeManageTab === tab.id ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                @click="activeManageTab = tab.id"
              >
                <UIcon :name="tab.icon" class="w-4 h-4" />
                {{ tab.label }}
              </button>
            </div>

            <!-- Tab Content 1: Hotspots detail grid -->
            <div v-if="activeManageTab === 'preview'" class="space-y-4">
              <div class="flex items-center justify-between border-b border-default/50 pb-2">
                <h3 class="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <UIcon name="i-lucide-info" class="w-4 h-4 text-primary" />
                  รายชื่อปุ่มสัมผัส และ LINE Actions ({{ viewModeHotspots.length }} ปุ่ม)
                </h3>
              </div>

              <!-- Interactive hover banner -->
              <div v-if="hoveredHotspot" class="p-3 bg-primary-50/20 dark:bg-primary-950/20 border border-primary-500/20 rounded-xl space-y-2 animate-pulse">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-bold text-primary">กำลังตรวจสอบปุ่มสัมผัสที่ {{ hoveredHotspot.index + 1 }}</span>
                  <span class="text-[10px] font-mono text-slate-400 font-medium">LINE Bounds coordinates</span>
                </div>
                <div class="grid grid-cols-4 text-[10px] gap-2 font-mono text-slate-600 dark:text-slate-300">
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">X: {{ hoveredHotspot.rawBounds.x }}px</div>
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">Y: {{ hoveredHotspot.rawBounds.y }}px</div>
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">W: {{ hoveredHotspot.rawBounds.width }}px</div>
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">H: {{ hoveredHotspot.rawBounds.height }}px</div>
                </div>
                <div class="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-xs">
                  <span class="font-bold text-slate-700 dark:text-slate-200">แอ็กชัน:</span>
                  <span class="font-mono bg-primary/10 px-2 py-0.5 rounded ml-1 text-primary text-[10px] font-bold">{{ hoveredHotspot.action.type }}</span>
                  <p class="text-slate-500 dark:text-slate-400 text-xs mt-1.5 break-all leading-relaxed font-mono">
                    พารามิเตอร์: {{ hoveredHotspot.action.uri || hoveredHotspot.action.text || hoveredHotspot.action.richMenuAliasId || hoveredHotspot.action.data || 'ไม่มีข้อมูล' }}
                  </p>
                </div>
              </div>
              <div v-else class="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl text-xs text-slate-400 italic flex items-center justify-center py-4">
                💡 นำเมาส์วางบนแถบปุ่มสัมผัสด้านล่าง หรือนำเมาส์วางบนตำแหน่งในรูปภาพ เพื่อดูการตอบสนองแบบเรียลไทม์
              </div>

              <!-- Hotspot Table List -->
              <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                <div
                  v-for="hs in viewModeHotspots"
                  :key="`vlist-${hs.index}`"
                  class="p-3 rounded-xl border text-xs flex flex-col gap-2 transition-all duration-150 cursor-pointer"
                  :class="hoveredHotspot?.index === hs.index ? 'border-primary bg-primary-50/15 shadow-sm' : 'border-default bg-default/40 hover:border-slate-300 dark:hover:border-slate-700'"
                  @mouseenter="hoveredHotspot = hs"
                  @mouseleave="hoveredHotspot = null"
                >
                  <div class="flex items-center justify-between font-bold">
                    <span class="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            :class="hoveredHotspot?.index === hs.index ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'">
                        {{ hs.index + 1 }}
                      </span>
                      ปุ่มสัมผัสที่ {{ hs.index + 1 }}
                    </span>
                    <UBadge
                      :color="hs.action.type === 'uri' ? 'primary' : hs.action.type === 'message' ? 'indigo' : hs.action.type === 'richmenuswitch' ? 'amber' : 'neutral'"
                      variant="subtle"
                      size="sm"
                      class="font-mono text-[10px]"
                    >
                      {{ hs.action.type }}
                    </UBadge>
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                    <span class="font-semibold text-slate-700 dark:text-slate-300">พารามิเตอร์:</span>
                    <span class="font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded text-xs truncate" :title="hs.action.uri || hs.action.text || hs.action.richMenuAliasId || hs.action.data">
                      {{ hs.action.uri || hs.action.text || hs.action.richMenuAliasId || hs.action.data || '-' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab Content 2: Permissions Manager -->
            <div v-else-if="activeManageTab === 'settings'" class="space-y-6">
              <div class="border-b border-default/50 pb-2">
                <h3 class="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <UIcon name="i-lucide-user-cog" class="w-4 h-4 text-primary" />
                  จัดการกำหนดสิทธิ์บทบาทและสิทธิ์การแสดงผล
                </h3>
              </div>

              <div class="space-y-4 bg-default/30 dark:bg-slate-900/40 border border-default p-5 rounded-2xl">
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  ระบบแชทบอท SaiJai จะทำหน้าที่สลับเปลี่ยน Rich Menu บนหน้าจอสมาร์ทโฟนของลูกค้าโดยอัตโนมัติ ตามระดับสิทธิ์ที่ได้รับมอบหมาย
                </p>

                <UFormField label="บทบาทสิทธิ์ (Target Role)" description="ลูกค้าที่มีสิทธิ์สอดคล้องกับบทบาทนี้จะมองเห็น Rich Menu นี้เป็นหลัก">
                  <USelect
                    v-model="assignForm.targetRole"
                    placeholder="สำหรับทุกคน (ไม่มีการจำกัด)"
                    :items="[
                      { label: 'ไม่กำหนดบทบาทเฉพาะเจาะจง (สำหรับทุกคน)', value: '' },
                      { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
                      { label: 'สมาชิกรายเดือน (MEMBER)', value: 'MEMBER' },
                      { label: 'พนักงานดูแลร้าน (EMPLOYEE)', value: 'EMPLOYEE' },
                      { label: 'ผู้ดูแลระบบสูงสุด (ADMIN)', value: 'ADMIN' },
                    ]"
                    class="w-full"
                  />
                </UFormField>

                <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <UCheckbox
                    v-model="assignForm.isDefault"
                    label="ตั้งค่าให้เมนูนี้เป็นค่าเริ่มต้นหลัก (Default Rich Menu)"
                    description="หากเปิดใช้งาน เมนูนี้จะแสดงผลกับทุกคนที่ไม่ได้ถูกกำหนดบทบาทพิเศษอื่นๆ"
                  />
                </div>

                <div class="pt-2 flex justify-end">
                  <UButton
                    color="primary"
                    class="font-black px-6 py-2.5 rounded-xl"
                    :loading="isSaving"
                    icon="i-lucide-save"
                    @click="onAssign"
                  >
                    บันทึกและติดตั้งสิทธิ์บทบาท
                  </UButton>
                </div>
              </div>
            </div>

            <!-- Tab Content 3: LINE Alias Configurations -->
            <div v-else-if="activeManageTab === 'alias'" class="space-y-6">
              <div class="border-b border-default/50 pb-2">
                <h3 class="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <UIcon name="i-lucide-link" class="w-4 h-4 text-primary" />
                  จัดการ LINE Rich Menu Alias ID
                </h3>
              </div>

              <div class="space-y-4 bg-default/30 dark:bg-slate-900/40 border border-default p-5 rounded-2xl">
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  LINE Alias ID คือรหัสอ้างอิงของ Rich Menu ใช้สำหรับเรียกคำสั่ง <strong>richmenuswitch</strong> เพื่อสลับการแสดงผลอย่างรวดเร็วฝั่งผู้ใช้ (เช่น เมนูแบบหลายแท็บหลัก-ย่อย)
                </p>

                <UFormField label="LINE Alias ID (เฉพาะตัวอักษรภาษาอังกฤษ, ตัวเลข และเครื่องหมาย - เท่านั้น)" required>
                  <UInput
                    v-model="aliasForm.aliasId"
                    placeholder="เช่น richmenu-tab-a"
                    class="w-full font-mono text-sm rounded-xl"
                    maxlength="30"
                  />
                </UFormField>

                <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
                  <div>
                    <UButton
                      v-if="selectedMenu.aliasId"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      class="font-bold py-2 rounded-xl text-xs"
                      @click="deleteAlias(selectedMenu)"
                    >
                      ลบ Alias ปัจจุบัน
                    </UButton>
                  </div>
                  <UButton
                    color="primary"
                    class="font-black px-6 py-2.5 rounded-xl"
                    :loading="isSaving"
                    :disabled="!aliasForm.aliasId.trim()"
                    icon="i-lucide-save"
                    @click="onAliasSave"
                  >
                    บันทึกและติดตั้ง Alias
                  </UButton>
                </div>
              </div>
            </div>

            <!-- Tab Content 4: Original JSON Config schema -->
            <div v-else-if="activeManageTab === 'schema'" class="space-y-4">
              <div class="flex items-center justify-between border-b border-default/50 pb-2">
                <h3 class="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <UIcon name="i-lucide-file-code" class="w-4 h-4 text-primary" />
                  พิกัดโครงสร้าง JSON Configuration (LINE Messaging API)
                </h3>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-copy"
                  class="font-bold"
                  @click="copyToClipboard(selectedMenu.jsonContent)"
                >
                  คัดลอก JSON Schema
                </UButton>
              </div>

              <div class="relative rounded-2xl overflow-hidden border border-slate-800">
                <!-- Textarea formatted as disabled code block for safety and high-fidelity scrolling -->
                <textarea
                  readonly
                  :value="JSON.stringify(JSON.parse(selectedMenu.jsonContent), null, 2)"
                  class="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 select-all border-none outline-none focus:ring-0 leading-relaxed cursor-text"
                  rows="14"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
