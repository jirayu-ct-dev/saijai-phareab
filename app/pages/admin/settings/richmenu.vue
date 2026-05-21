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

const selectMenuForPreview = (menu: any) => {
  selectedMenu.value = menu;
  activeTab.value = "preview";
};

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
  <div class="mx-auto w-full max-w-6xl space-y-4 p-2 sm:p-6">
    <!-- Header Block -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-default/30 bg-default px-4 py-3 shadow-sm dark:border-default/20 dark:bg-elevated/55">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <UIcon name="i-lucide-menu" class="text-primary w-6 h-6" />
          ระบบจัดการ LINE Rich Menu
        </h1>
        <p class="mt-1 text-sm text-muted">สร้าง คอนฟิก และควบคุมการแสดงผลเมนูบน LINE แชทบอทของร้าน</p>
      </div>
      <div>
        <UButton
          icon="i-lucide-plus"
          color="primary"
          @click="isCreateModalOpen = true; resetForm();"
        >
          ติดตั้ง Rich Menu ใหม่
        </UButton>
      </div>
    </div>

    <!-- Tabs Container -->
    <div class="flex border-b border-default">
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200"
        :class="activeTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-default'"
        @click="activeTab = 'list'"
      >
        รายการเมนูทั้งหมด
      </button>
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200"
        :class="activeTab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-default'"
        @click="activeTab = 'preview'"
        :disabled="!selectedMenu"
      >
        พรีวิว Hotspots ({{ selectedMenu ? selectedMenu.name : 'ยังไม่เลือก' }})
      </button>
    </div>

    <!-- Dynamic Main Content -->
    <div v-if="activeTab === 'list'">
      <!-- Loading State -->
      <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="i in 3" :key="`rm-skeleton-${i}`" class="p-4 space-y-4">
          <USkeleton class="h-6 w-3/4 rounded" />
          <USkeleton class="h-40 w-full rounded" />
          <USkeleton class="h-8 w-full rounded" />
        </UCard>
      </div>

      <!-- Empty State -->
      <div v-else-if="!richMenus.length" class="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-default rounded-md bg-default px-4">
        <UIcon name="i-lucide-menu" class="w-12 h-12 text-muted mb-4" />
        <h3 class="text-lg font-semibold text-default">ยังไม่มี Rich Menu ในระบบ</h3>
        <p class="text-sm text-muted mt-1 max-w-sm">อัปโหลดโครงสร้างและรูปภาพเพื่อเริ่มปรับแต่ง Rich Menu สำหรับกลุ่มลูกค้าหรือพนักงานพิกัดร้านค้าของคุณ</p>
        <UButton
          class="mt-4"
          icon="i-lucide-plus"
          size="sm"
          @click="isCreateModalOpen = true"
        >
          ติดตั้งเมนูแรก
        </UButton>
      </div>

      <!-- Rich Menu Cards Grid -->
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="menu in richMenus"
          :key="menu.id"
          class="overflow-hidden group hover:shadow-md transition-shadow duration-300 dark:border-default/30 flex flex-col justify-between"
          :class="selectedMenu?.id === menu.id ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' : ''"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-lg text-default truncate max-w-[200px]" :title="menu.name">
                  {{ menu.name }}
                </h3>
                <span class="text-xs text-muted font-mono truncate max-w-[180px] block">{{ menu.richMenuId }}</span>
              </div>
              <div class="flex gap-1.5">
                <UBadge v-if="menu.isDefault" color="success" size="sm">เมนูเริ่มต้น</UBadge>
                <UBadge v-if="menu.targetRole" color="primary" size="sm">{{ menu.targetRole }}</UBadge>
              </div>
            </div>
          </template>

          <div class="relative rounded-md overflow-hidden bg-slate-900 aspect-[2500/1686]">
            <img
              :src="menu.imageUrl"
              alt="Rich Menu Preview"
              class="w-full h-full object-contain"
            />
            <!-- Visual Linkage Overlay -->
            <div class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 gap-2">
              <UButton
                size="sm"
                color="neutral"
                icon="i-lucide-eye"
                @click="selectMenuForPreview(menu)"
              >
                ดู Hotspots
              </UButton>
            </div>
          </div>

          <template #footer>
            <div class="flex flex-col gap-2">
              <!-- Alias block -->
              <div class="flex items-center justify-between text-xs border-b border-default pb-2">
                <span class="text-muted flex items-center gap-1">
                  <UIcon name="i-lucide-link" class="w-3.5 h-3.5" />
                  LINE Alias:
                </span>
                <div class="flex items-center gap-1">
                  <span v-if="menu.aliasId" class="font-mono bg-default border border-default rounded px-1.5 py-0.5 max-w-[120px] truncate text-primary">{{ menu.aliasId }}</span>
                  <span v-else class="text-muted italic">ไม่มีการเชื่อมโยง</span>
                  
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :icon="menu.aliasId ? 'i-lucide-pencil' : 'i-lucide-plus-circle'"
                    @click="openAliasModal(menu)"
                  />
                  <UButton
                    v-if="menu.aliasId"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="deleteAlias(menu)"
                  />
                </div>
              </div>

              <!-- Action button bar -->
              <div class="flex items-center justify-between pt-1">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-user-cog"
                  @click="openAssignModal(menu)"
                >
                  ตั้งสิทธิ์บทบาท
                </UButton>

                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash"
                  @click="deleteMenu(menu.id)"
                >
                  ลบเมนู
                </UButton>
              </div>
            </div>
          </template>
        </UCard>
      </div>
    </div>

    <!-- Tab Hotspots Preview -->
    <div v-else-if="activeTab === 'preview' && selectedMenu" class="grid gap-6 lg:grid-cols-12">
      <!-- Live Mobile Screen Simulator -->
      <div class="lg:col-span-8 flex flex-col items-center">
        <div class="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl p-3 shadow-2xl relative">
          <!-- Mobile simulated chat head -->
          <div class="flex items-center gap-2 border-b border-slate-900 pb-2 mb-2 px-2 text-slate-400 text-xs">
            <div class="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            <span class="mx-auto font-medium text-slate-300">{{ selectedMenu.name }} (จำลองหน้าจอแชท LINE)</span>
          </div>

          <!-- Simulator Body -->
          <div class="relative w-full aspect-[2500/1686] bg-slate-900 rounded-lg overflow-hidden select-none">
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
                  fill="rgba(59, 130, 246, 0.18)"
                  stroke="rgba(59, 130, 246, 0.85)"
                  stroke-width="1.5"
                  class="hover:fill-primary-500/35 hover:stroke-primary-400 transition-all duration-150"
                  :stroke-dasharray="hs.action.type === 'richmenuswitch' ? '4 2' : 'none'"
                />
                
                <!-- Tiny numeric key indicator -->
                <rect
                  :x="`${hs.x + 0.5}%`"
                  :y="`${hs.y + 0.5}%`"
                  width="20"
                  height="20"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.8)"
                  class="pointer-events-none"
                />
                <text
                  :x="`${hs.x + 0.5}%`"
                  :y="`${hs.y + 0.5}%`"
                  dx="10"
                  dy="14"
                  font-size="11"
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
          <div class="mt-2 flex items-center justify-center py-2 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-semibold select-none">
            {{ JSON.parse(selectedMenu.jsonContent)?.chatBarText || 'เมนูหลัก' }}
            <UIcon name="i-lucide-chevron-up" class="w-4 h-4 ml-1.5 text-slate-500" />
          </div>
        </div>

        <p class="text-xs text-muted mt-3 text-center">ชี้เมาส์ที่แต่ละแถบเพื่อตรวจสอบรายละเอียดพิกัดและ Action ของ LINE API ในตารางขวาด้านล่าง</p>
      </div>

      <!-- Hotspot details listing -->
      <div class="lg:col-span-4 space-y-4">
        <UCard class="p-2">
          <template #header>
            <h3 class="font-bold flex items-center gap-1.5">
              <UIcon name="i-lucide-info" class="w-5 h-5 text-primary" />
              รายละเอียดปุ่ม & Actions
            </h3>
          </template>

          <!-- Hover Details Block -->
          <div v-if="hoveredHotspot" class="p-3 bg-primary-50/20 border border-primary-500/20 rounded-md mb-3 space-y-2 animate-pulse">
            <span class="text-xs font-bold text-primary block">คุณกำลังตรวจสอบปุ่มที่ {{ hoveredHotspot.index + 1 }}</span>
            <div class="grid grid-cols-2 text-xs gap-1 font-mono">
              <div>พิกัด X: {{ hoveredHotspot.rawBounds.x }}</div>
              <div>พิกัด Y: {{ hoveredHotspot.rawBounds.y }}</div>
              <div>กว้าง: {{ hoveredHotspot.rawBounds.width }}</div>
              <div>สูง: {{ hoveredHotspot.rawBounds.height }}</div>
            </div>
            <div class="border-t border-default/50 pt-2 text-xs">
              <span class="font-semibold text-default">แอ็กชัน:</span>
              <span class="font-mono bg-default px-1 rounded ml-1 text-primary">{{ hoveredHotspot.action.type }}</span>
              <p class="text-muted truncate mt-1" :title="hoveredHotspot.action.uri || hoveredHotspot.action.text || hoveredHotspot.action.richMenuAliasId">
                ค่า: {{ hoveredHotspot.action.uri || hoveredHotspot.action.text || hoveredHotspot.action.richMenuAliasId || hoveredHotspot.action.data || 'ไม่มีข้อมูล' }}
              </p>
            </div>
          </div>

          <div v-else class="p-3 bg-default border border-default/50 rounded-md mb-3 text-xs text-muted italic flex items-center justify-center py-6">
            ชี้เมาส์ในพื้นที่ Hotspot ฝั่งซ้ายเพื่อดูแอ็กชันทันที
          </div>

          <!-- Hotspot Table list -->
          <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <div
              v-for="hs in viewModeHotspots"
              :key="`vlist-${hs.index}`"
              class="p-2.5 rounded-md border text-xs flex flex-col gap-1 transition-colors duration-150"
              :class="hoveredHotspot?.index === hs.index ? 'border-primary bg-primary-50/10' : 'border-default bg-elevated/40'"
            >
              <div class="flex items-center justify-between font-bold">
                <span class="text-default font-semibold">ปุ่มที่ {{ hs.index + 1 }}</span>
                <UBadge color="neutral" size="sm" class="font-mono">{{ hs.action.type }}</UBadge>
              </div>
              <div class="text-muted truncate mt-1">
                <span class="text-default font-medium">รายละเอียด: </span>
                <span class="font-mono text-muted">{{ hs.action.uri || hs.action.text || hs.action.richMenuAliasId || hs.action.data || '-' }}</span>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Create / Upload Modal Dialog -->
    <UModal v-model:open="isCreateModalOpen" title="ติดตั้ง LINE Rich Menu ใหม่" :ui="{ body: 'sm:max-w-4xl' }">
      <template #body>
        <UForm :state="form" class="space-y-4 pr-1 max-h-[85vh] overflow-y-auto" @submit="onSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <!-- Left inputs column -->
            <div class="space-y-4">
              <UFormField label="ชื่อระบุภายใน (Name)" name="name" required>
                <UInput v-model="form.name" placeholder="เช่น เมนูลูกค้าทั่วไป, เมนูพนักงาน" class="w-full" />
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

              <div class="grid grid-cols-2 gap-4">
                <UFormField label="จำกัดสิทธิ์เฉพาะบทบาท" name="targetRole">
                  <USelect
                    v-model="form.targetRole"
                    placeholder="สำหรับทุกคน (เมนูหลัก)"
                    :items="[
                      { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
                      { label: 'สมาชิกรายเดือน (MEMBER)', value: 'MEMBER' },
                      { label: 'พนักงาน (EMPLOYEE)', value: 'EMPLOYEE' },
                      { label: 'ผู้ดูแลระบบ (ADMIN)', value: 'ADMIN' },
                    ]"
                    class="w-full"
                  />
                </UFormField>

                <div class="flex items-center h-full pt-6 pl-2">
                  <UCheckbox
                    v-model="form.isDefault"
                    label="ตั้งค่าเป็นเมนูเริ่มต้น"
                  />
                </div>
              </div>
            </div>

            <!-- Right live schema inspector and visualizer block -->
            <div class="space-y-3">
              <UFormField label="JSON Configuration (LINE Messaging API Schema)" name="jsonContent" required>
                <UTextarea
                  v-model="form.jsonContent"
                  placeholder="กรอก JSON Configuration..."
                  :rows="11"
                  class="w-full font-mono text-xs"
                />
              </UFormField>

              <!-- Validation Feedback -->
              <div
                v-if="jsonValidationError"
                class="p-2 border border-red-500/20 bg-red-500/10 text-red-600 rounded text-xs"
              >
                {{ jsonValidationError }}
              </div>
              <div
                v-else
                class="p-2 border border-green-500/20 bg-green-500/10 text-green-600 rounded text-xs flex items-center gap-1"
              >
                <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
                โครงสร้าง JSON และพิกัด Hotspots ได้รับการตรวจสอบว่าถูกต้อง!
              </div>
            </div>
          </div>

          <!-- Bottom Hotspot Layout Visual preview inside Create Modal -->
          <div v-if="imagePreviewUrl && hotspots.length" class="border border-default/50 rounded-lg p-2 bg-slate-950/80">
            <h4 class="text-xs font-semibold mb-2 text-default flex items-center gap-1">
              <UIcon name="i-lucide-layout" class="w-3.5 h-3.5 text-primary" />
              ภาพจำลองพิกัดปุ่มสัมผัสตามโครงสร้าง JSON (Hotspot Preview):
            </h4>
            <div class="relative w-full max-w-md mx-auto aspect-[2500/1686] bg-slate-900 rounded overflow-hidden select-none">
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
                  <!-- Tiny numeric key indicator -->
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
          <div class="flex justify-end gap-2 border-t border-default pt-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="isCreateModalOpen = false"
            >
              ยกเลิก
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isSaving"
              :disabled="!!jsonValidationError"
              icon="i-lucide-upload-cloud"
            >
              ปรับใช้ออนไลน์ไปยัง LINE
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Assign Role / Default Modal -->
    <UModal v-model:open="isAssignModalOpen" title="กำหนดบทบาทของ Rich Menu" :ui="{ body: 'sm:max-w-md' }">
      <template #body>
        <div class="space-y-4 py-1">
          <p class="text-sm text-muted">
            การกำหนดบทบาทที่เฉพาะเจาะจง จะช่วยให้ระบบสามารถสลับเปลี่ยน Rich Menu ให้ลูกค้าและพนักงานโดยอัตโนมัติเมื่อพวกเขาเข้าใช้งาน LIFF
          </p>

          <UFormField label="กำหนดสำหรับบทบาท">
            <USelect
              v-model="assignForm.targetRole"
              placeholder="สำหรับทุกคน (เมนูหลัก)"
              :items="[
                { label: 'ไม่กำหนดบทบาทเฉพาะเจาะจง', value: '' },
                { label: 'ผู้ใช้ทั่วไป (USER)', value: 'USER' },
                { label: 'สมาชิกรายเดือน (MEMBER)', value: 'MEMBER' },
                { label: 'พนักงาน (EMPLOYEE)', value: 'EMPLOYEE' },
                { label: 'ผู้ดูแลระบบ (ADMIN)', value: 'ADMIN' },
              ]"
              class="w-full"
            />
          </UFormField>

          <div class="py-2 border-t border-default">
            <UCheckbox
              v-model="assignForm.isDefault"
              label="ตั้งค่าเมนูนี้เป็นค่าเริ่มต้น (Default Rich Menu)"
              description="เมนูนี้จะถูกตั้งให้ลูกค้าทุกคนเห็นหากไม่มีเงื่อนไขสิทธิ์หรือบทบาทอื่นที่ตรงกัน"
            />
          </div>

          <div class="flex justify-end gap-2 border-t border-default pt-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="isAssignModalOpen = false"
            >
              ยกเลิก
            </UButton>
            <UButton
              color="primary"
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
    <UModal v-model:open="isAliasModalOpen" title="ตั้งค่า LINE Alias ID" :ui="{ body: 'sm:max-w-md' }">
      <template #body>
        <div class="space-y-4 py-1">
          <p class="text-sm text-muted">
            Alias ID ใช้สำหรับความสามารถ <strong>richmenuswitch</strong> ใน LINE เพื่อเปลี่ยน Rich Menu แบบทันทีโดยไม่ต้องรอดึงจาก Server (เช่น สลับหน้าแท็บหลัก-ย่อย)
          </p>

          <UFormField label="LINE Alias ID (ตัวอักษรภาษาอังกฤษ ตัวเลข และ -)" name="aliasId" required>
            <UInput
              v-model="aliasForm.aliasId"
              placeholder="ตัวอย่างเช่น richmenu-tab-a"
              class="w-full font-mono text-sm"
              maxlength="30"
            />
          </UFormField>

          <div class="flex justify-end gap-2 border-t border-default pt-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="isAliasModalOpen = false"
            >
              ยกเลิก
            </UButton>
            <UButton
              color="primary"
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
