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
const isAssignModalOpen = ref(false);
const isAliasModalOpen = ref(false);
const isSaving = ref(false);
const activeTab = ref("list");

const selectedMenu = ref<any>(null);
const assignForm = reactive({
  targetRole: "" as string | null,
  isDefault: false,
});
const aliasForm = reactive({
  aliasId: "",
});

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
    activeTab.value = "list";
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

const openAssignModal = (menu: any) => {
  selectedMenu.value = menu;
  assignForm.targetRole = menu.targetRole || "";
  assignForm.isDefault = menu.isDefault;
  isAssignModalOpen.value = true;
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
    isAssignModalOpen.value = false;
    await refreshMenus();
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  } finally {
    isSaving.value = false;
  }
};

const openAliasModal = (menu: any) => {
  selectedMenu.value = menu;
  aliasForm.aliasId = menu.aliasId || "";
  isAliasModalOpen.value = true;
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
    isAliasModalOpen.value = false;
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

const selectMenuForPreview = (menu: any) => {
  selectedMenu.value = menu;
  activeTab.value = "preview";
  
  if (typeof window !== "undefined" && window.innerWidth < 1024) {
    nextTick(() => {
      simulatorRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
};

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
</script>

<template>
  <div class="relative mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-8 overflow-hidden min-h-screen">
    <!-- Premium background glows -->
    <div class="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-1/3 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

    <!-- Header Block -->
    <div class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-default/30 bg-default/60 backdrop-blur-md px-6 py-5 shadow-sm dark:border-default/20 dark:bg-elevated/40">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black flex items-center gap-3 tracking-tight text-slate-800 dark:text-white">
          <span class="p-2 rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
            <UIcon name="i-lucide-menu" class="w-6 h-6" />
          </span>
          ระบบจัดการ LINE Rich Menu
        </h1>
        <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400 font-medium">
          สร้าง กำหนดสิทธิ์บทบาท และทดสอบพิกัดการกดของ Rich Menu บนแชท LINE OA ของร้านได้แบบเรียลไทม์
        </p>
      </div>
      <div class="flex-shrink-0">
        <UButton
          icon="i-lucide-plus"
          size="lg"
          color="primary"
          class="font-bold py-2.5 px-5 rounded-xl shadow-md hover:shadow-primary/20 transition-all duration-300"
          @click="isCreateModalOpen = true; resetForm();"
        >
          ติดตั้ง Rich Menu ใหม่
        </UButton>
      </div>
    </div>

    <!-- Mobile Tab Selector (Visible only on mobile/tablet screens < 1024px) -->
    <div class="flex lg:hidden p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-default/30 max-w-md mx-auto relative z-10">
      <button
        class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
        :class="activeTab === 'list' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
        @click="activeTab = 'list'"
      >
        <UIcon name="i-lucide-list" class="w-4 h-4" />
        รายการเมนูทั้งหมด ({{ richMenus.length }})
      </button>
      <button
        class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
        :class="activeTab === 'preview' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
        @click="activeTab = 'preview'"
        :disabled="!selectedMenu"
      >
        <UIcon name="i-lucide-smartphone" class="w-4 h-4" />
        พรีวิว Simulator
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="i in 3" :key="`rm-skeleton-${i}`" class="p-4 space-y-4 border border-default/30">
        <USkeleton class="h-6 w-3/4 rounded" />
        <USkeleton class="h-40 w-full rounded" />
        <USkeleton class="h-8 w-full rounded" />
      </UCard>
    </div>

    <!-- Empty State -->
    <div v-else-if="!richMenus.length" class="relative flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-default/40 backdrop-blur-md px-6 shadow-sm">
      <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
        <UIcon name="i-lucide-menu" class="w-8 h-8" />
      </div>
      <h3 class="text-xl font-bold text-slate-800 dark:text-white">ยังไม่มี Rich Menu ในระบบ</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm font-medium">
        เริ่มต้นอัปโหลดภาพเมนูและไฟล์พิกัด JSON สำหรับ Rich Menu ของร้านคุณ เพื่ออำนวยความสะดวกสูงสุดในการใช้งานของลูกค้า
      </p>
      <UButton
        class="mt-6 font-extrabold px-6 py-3 rounded-xl shadow-md hover:shadow-primary/20 transition-all duration-300"
        icon="i-lucide-plus"
        @click="isCreateModalOpen = true"
      >
        ติดตั้ง Rich Menu แรก
      </UButton>
    </div>

    <!-- Unified Master-Detail Layout -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
      
      <!-- Left side: List of Rich Menus (Visible always on desktop, and on mobile when activeTab is list) -->
      <div class="lg:col-span-7 space-y-6" :class="activeTab === 'list' ? 'block' : 'hidden lg:block'">
        <div class="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="text-xs font-bold bg-primary/10 text-primary dark:bg-primary/20 px-3 py-1 rounded-full font-mono">
              {{ richMenus.length }} รายการ
            </span>
            <span class="text-sm font-bold text-slate-800 dark:text-slate-200">LINE Rich Menus ทั้งหมด</span>
          </div>
          <span class="text-[11px] text-slate-400 font-medium hidden sm:inline">💡 คลิกบนการ์ดเพื่อดูและทดสอบ Hotspots ทันที</span>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <UCard
            v-for="menu in richMenus"
            :key="menu.id"
            class="overflow-hidden group hover:shadow-lg transition-all duration-300 dark:border-default/30 flex flex-col justify-between cursor-pointer"
            :class="selectedMenu?.id === menu.id ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-950 bg-primary-50/5 dark:bg-primary-950/5' : 'hover:border-primary-500/50'"
            @click="selectMenuForPreview(menu)"
          >
            <template #header>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-bold text-base text-slate-800 dark:text-white leading-tight group-hover:text-primary transition-colors truncate max-w-[160px]" :title="menu.name">
                    {{ menu.name }}
                  </h3>
                  <div class="flex flex-wrap gap-1 flex-shrink-0">
                    <UBadge v-if="menu.isDefault" color="success" variant="subtle" size="sm" class="font-bold">
                      Default
                    </UBadge>
                    <UBadge v-if="menu.targetRole" color="primary" variant="subtle" size="sm" class="font-bold">
                      {{ menu.targetRole }}
                    </UBadge>
                  </div>
                </div>
                
                <!-- Rich Menu ID copyable -->
                <div class="flex items-center gap-1 mt-1">
                  <span class="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[170px]" :title="menu.richMenuId">
                    ID: {{ menu.richMenuId }}
                  </span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    class="p-1 min-h-0 text-slate-400 hover:text-primary"
                    @click.stop="copyToClipboard(menu.richMenuId)"
                    title="คัดลอก Rich Menu ID"
                  />
                </div>
              </div>
            </template>

            <!-- Image display -->
            <div class="relative rounded-lg overflow-hidden bg-slate-950 aspect-[2500/1686] border border-slate-100 dark:border-slate-800">
              <img
                :src="menu.imageUrl"
                alt="Rich Menu Preview"
                class="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
              />
              <div class="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                <span class="bg-primary hover:bg-primary-600 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md">
                  <UIcon name="i-lucide-smartphone" class="w-4 h-4" />
                  จำลองปุ่มบนมือถือ
                </span>
              </div>
            </div>

            <!-- Sleek non-crowded footer -->
            <template #footer>
              <div class="space-y-3.5">
                <!-- LINE Alias Row -->
                <div class="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/80 pb-2">
                  <span class="text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                    <UIcon name="i-lucide-link" class="w-3.5 h-3.5 text-slate-400" />
                    LINE Alias:
                  </span>
                  <div class="flex items-center gap-1">
                    <span v-if="menu.aliasId" class="font-mono bg-primary-50 dark:bg-primary-950/30 border border-primary-200/50 dark:border-primary-800/30 text-primary rounded px-2 py-0.5 text-xs font-semibold max-w-[100px] truncate">
                      {{ menu.aliasId }}
                    </span>
                    <span v-else class="text-slate-400 dark:text-slate-500 italic text-[11px]">ยังไม่ได้เชื่อม</span>
                    
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :icon="menu.aliasId ? 'i-lucide-pencil' : 'i-lucide-plus-circle'"
                      class="hover:text-primary p-1"
                      @click.stop="openAliasModal(menu)"
                    />
                    <UButton
                      v-if="menu.aliasId"
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      class="p-1"
                      @click.stop="deleteAlias(menu)"
                    />
                  </div>
                </div>

                <!-- Footer Operations Row -->
                <div class="flex items-center justify-between pt-1">
                  <!-- Dynamic selection indicator -->
                  <div class="flex items-center gap-1.5 text-[11px] font-bold" :class="selectedMenu?.id === menu.id ? 'text-primary' : 'text-slate-400'">
                    <span class="flex h-2.5 w-2.5 relative" v-if="selectedMenu?.id === menu.id">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                    <span>{{ selectedMenu?.id === menu.id ? 'กำลังเปิดพรีวิว' : 'คลิกเปิดพรีวิว' }}</span>
                  </div>

                  <div class="flex items-center gap-1">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-user-cog"
                      class="font-bold py-1 px-2.5 rounded-lg"
                      @click.stop="openAssignModal(menu)"
                    >
                      ตั้งบทบาท
                    </UButton>

                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      class="hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5"
                      @click.stop="deleteMenu(menu.id)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </UCard>
        </div>
      </div>

      <!-- Right side: Phone Simulator & Hotspot Info (Sticky on desktop, visible on mobile when activeTab is preview) -->
      <div ref="simulatorRef" class="lg:col-span-5 scroll-mt-6" :class="activeTab === 'preview' ? 'block' : 'hidden lg:block'">
        <div class="sticky top-6 space-y-6">
          <div class="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
            <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <UIcon name="i-lucide-smartphone" class="w-5 h-5 text-primary" />
              จำลองปุ่มบนสมาร์ทโฟน
            </h2>
            <UBadge v-if="selectedMenu" color="primary" variant="subtle" class="font-bold px-2.5 py-0.5 rounded-full">
              {{ selectedMenu.name }}
            </UBadge>
          </div>

          <!-- iPhone style luxury phone simulator -->
          <div v-if="selectedMenu" class="w-full max-w-[340px] bg-slate-950 ring-4 ring-slate-800/80 rounded-[38px] shadow-2xl p-3 pb-4 relative overflow-hidden mx-auto border-4 border-slate-900/90 select-none">
            
            <!-- Speaker & Camera Notch / Dynamic Island -->
            <div class="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full z-20 flex items-center justify-center gap-1.5 px-3">
              <div class="w-10 h-1 bg-slate-800 rounded-full"></div>
              <div class="w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                <div class="w-1 h-1 bg-blue-900 rounded-full"></div>
              </div>
            </div>

            <!-- Simulated Mobile Status Bar -->
            <div class="flex justify-between items-center px-4 pt-1.5 pb-2 text-[10px] text-slate-400 font-semibold select-none z-10">
              <span>12:30</span>
              <div class="flex items-center gap-1.5">
                <UIcon name="i-lucide-signal" class="w-3 h-3" />
                <UIcon name="i-lucide-wifi" class="w-3 h-3" />
                <div class="w-5 h-2.5 border border-slate-500 rounded-sm p-0.5 flex items-center">
                  <div class="w-full h-full bg-slate-400 rounded-2xs"></div>
                </div>
              </div>
            </div>

            <!-- LINE Chat Header -->
            <div class="flex items-center justify-between bg-slate-900/95 border-b border-slate-800/80 py-2.5 px-3 text-slate-200">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-chevron-left" class="w-5 h-5 text-slate-400" />
                <div class="relative">
                  <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">
                    SJ
                  </div>
                  <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"></div>
                </div>
                <div>
                  <div class="text-[11px] font-bold flex items-center gap-0.5">
                    SaiJai Official
                    <UIcon name="i-lucide-badge-check" class="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span class="text-[9px] text-emerald-400 flex items-center gap-0.5">
                    <span class="w-1 h-1 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    แชทบอทออนไลน์
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-slate-400">
                <UIcon name="i-lucide-phone" class="w-3.5 h-3.5" />
                <UIcon name="i-lucide-search" class="w-3.5 h-3.5" />
                <UIcon name="i-lucide-menu" class="w-3.5 h-3.5" />
              </div>
            </div>

            <!-- Simulated Chat Bubble Space -->
            <div class="p-3 space-y-2 bg-slate-950 flex-1 min-h-[90px] flex flex-col justify-end text-left">
              <div class="flex gap-2 items-start max-w-[90%]">
                <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[9px] font-bold">SJ</div>
                <div class="bg-slate-900 text-slate-200 rounded-xl rounded-tl-none p-2 text-[10px] leading-relaxed shadow-sm border border-slate-800/80">
                  สวัสดีค่ะ คุณลูกค้า 🌸 ยินดีต้อนรับสู่ SaiJai ค่ะ สามารถเลือกสั่งซื้อหรือสอบถามบริการได้ที่เมนูด้านล่างนี้ได้เลยค่ะ!
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
                    width="18"
                    height="18"
                    rx="4"
                    :fill="hoveredHotspot?.index === hs.index ? '#6366f1' : 'rgba(15, 23, 42, 0.8)'"
                    class="pointer-events-none transition-colors duration-150"
                  />
                  <text
                    :x="`${hs.x + 0.5}%`"
                    :y="`${hs.y + 0.5}%`"
                    dx="9"
                    dy="13"
                    font-size="10"
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
            <div class="flex items-center justify-between py-2.5 px-4 bg-slate-900 text-slate-200 text-xs font-semibold select-none cursor-pointer hover:bg-slate-800 transition-colors">
              <div class="flex items-center gap-1.5">
                <UIcon name="i-lucide-keyboard" class="w-4 h-4 text-slate-400" />
                <div class="w-[1px] h-3 bg-slate-800"></div>
              </div>
              <span class="font-bold tracking-wide flex items-center gap-1 text-[11px]">
                {{ JSON.parse(selectedMenu.jsonContent)?.chatBarText || 'เมนูหลัก' }}
                <UIcon name="i-lucide-chevron-up" class="w-3.5 h-3.5 text-slate-400" />
              </span>
              <UIcon name="i-lucide-smile" class="w-4 h-4 text-slate-400" />
            </div>

            <!-- Phone home indicator bar -->
            <div class="w-24 h-1 bg-slate-800 rounded-full mx-auto mt-2.5"></div>
          </div>

          <!-- Hotspots info details section -->
          <div v-if="selectedMenu" class="space-y-4">
            <UCard class="p-1 border border-slate-200/50 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <template #header>
                <h3 class="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-white">
                  <UIcon name="i-lucide-info" class="w-4 h-4 text-primary" />
                  รายชื่อปุ่ม และ LINE Actions
                </h3>
              </template>

              <!-- Dynamic Hover Details Block -->
              <div v-if="hoveredHotspot" class="p-3 bg-primary-50/20 dark:bg-primary-950/20 border border-primary-500/20 rounded-xl mb-3 space-y-2 animate-pulse">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-bold text-primary">กำลังตรวจสอบปุ่มที่ {{ hoveredHotspot.index + 1 }}</span>
                  <span class="text-[10px] font-mono text-slate-400 font-medium">Bounds (พิกัดพิกเซลบน LINE)</span>
                </div>
                <div class="grid grid-cols-4 text-[10px] gap-2 font-mono text-slate-600 dark:text-slate-300">
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">X: {{ hoveredHotspot.rawBounds.x }}</div>
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">Y: {{ hoveredHotspot.rawBounds.y }}</div>
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">กว้าง: {{ hoveredHotspot.rawBounds.width }}</div>
                  <div class="bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center">สูง: {{ hoveredHotspot.rawBounds.height }}</div>
                </div>
                <div class="border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-xs">
                  <span class="font-bold text-slate-700 dark:text-slate-200">แอ็กชัน:</span>
                  <span class="font-mono bg-primary/10 px-2 py-0.5 rounded ml-1 text-primary text-[10px] font-bold">{{ hoveredHotspot.action.type }}</span>
                  <p class="text-slate-500 dark:text-slate-400 text-xs mt-1.5 break-all leading-relaxed font-mono">
                    ค่าข้อมูล: {{ hoveredHotspot.action.uri || hoveredHotspot.action.text || hoveredHotspot.action.richMenuAliasId || hoveredHotspot.action.data || 'ไม่มีข้อมูล' }}
                  </p>
                </div>
              </div>

              <div v-else class="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl mb-3 text-xs text-slate-400 italic flex items-center justify-center py-6">
                💡 เอาเมาส์วางบนแถบ Hotspots ซ้าย/ขวา เพื่อดูการเชื่อมข้อมูล
              </div>

              <!-- Hotspot Interactive Table List -->
              <div class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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
                    <span class="font-semibold text-slate-700 dark:text-slate-300">ค่าแอ็กชัน:</span>
                    <span class="font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded text-xs truncate" :title="hs.action.uri || hs.action.text || hs.action.richMenuAliasId || hs.action.data">
                      {{ hs.action.uri || hs.action.text || hs.action.richMenuAliasId || hs.action.data || '-' }}
                    </span>
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Upload Modal Dialog (Spacious & Clean Layout) -->
    <UModal v-model:open="isCreateModalOpen" title="ติดตั้ง LINE Rich Menu ใหม่" :ui="{ content: 'sm:max-w-5xl' }">
      <template #body>
        <UForm :state="form" class="space-y-6 pr-1 max-h-[85vh] overflow-y-auto" @submit="onSubmit">
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
      </template>
    </UModal>

    <!-- Assign Role / Default Modal -->
    <UModal v-model:open="isAssignModalOpen" title="กำหนดบทบาทของ Rich Menu" :ui="{ content: 'sm:max-w-md' }">
      <template #body>
        <div class="space-y-4 py-1">
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            การกำหนดบทบาทที่เฉพาะเจาะจง จะช่วยให้ระบบสามารถสลับเปลี่ยน Rich Menu ให้ลูกค้าและพนักงานโดยอัตโนมัติเมื่อพวกเขาเข้าใช้งานแชทบอท
          </p>

          <UFormField label="กำหนดสำหรับบทบาท">
            <USelect
              v-model="assignForm.targetRole"
              placeholder="สำหรับทุกคน (เมนูหลัก)"
              :items="[
                { label: 'ไม่กำหนดบทบาทเฉพาะเจาะจง (สำหรับทุกคน)', value: '' },
                { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
                { label: 'สมาชิกรายเดือน (MEMBER)', value: 'MEMBER' },
                { label: 'พนักงาน (EMPLOYEE)', value: 'EMPLOYEE' },
                { label: 'ผู้ดูแลระบบ (ADMIN)', value: 'ADMIN' },
              ]"
              class="w-full rounded-xl"
            />
          </UFormField>

          <div class="py-3 border-t border-slate-100 dark:border-slate-800">
            <UCheckbox
              v-model="assignForm.isDefault"
              label="ตั้งค่าเมนูนี้เป็นค่าเริ่มต้น (Default Rich Menu)"
              description="เมนูนี้จะถูกตั้งให้ลูกค้าทุกคนเห็นหากไม่มีเงื่อนไขสิทธิ์หรือบทบาทอื่นที่ตรงกัน"
            />
          </div>

          <div class="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <UButton
              color="neutral"
              variant="outline"
              class="font-bold rounded-xl"
              @click="isAssignModalOpen = false"
            >
              ยกเลิก
            </UButton>
            <UButton
              color="primary"
              class="font-bold rounded-xl"
              :loading="isSaving"
              @click="onAssign"
            >
              บันทึกและติดตั้ง
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Configure Alias Modal -->
    <UModal v-model:open="isAliasModalOpen" title="ตั้งค่า LINE Alias ID" :ui="{ content: 'sm:max-w-md' }">
      <template #body>
        <div class="space-y-4 py-1">
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Alias ID ใช้สำหรับความสามารถ <strong>richmenuswitch</strong> ใน LINE เพื่อเปลี่ยน Rich Menu แบบทันทีโดยไม่ต้องรอดึงจาก Server (เช่น สลับหน้าแท็บหลัก-ย่อย)
          </p>

          <UFormField label="LINE Alias ID (ตัวอักษรภาษาอังกฤษ ตัวเลข และ -)" name="aliasId" required>
            <UInput
              v-model="aliasForm.aliasId"
              placeholder="ตัวอย่างเช่น richmenu-tab-a"
              class="w-full font-mono text-sm rounded-xl"
              maxlength="30"
            />
          </UFormField>

          <div class="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <UButton
              color="neutral"
              variant="outline"
              class="font-bold rounded-xl"
              @click="isAliasModalOpen = false"
            >
              ยกเลิก
            </UButton>
            <UButton
              color="primary"
              class="font-bold rounded-xl"
              :loading="isSaving"
              :disabled="!aliasForm.aliasId.trim()"
              @click="onAliasSave"
            >
              บันทึก Alias
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
