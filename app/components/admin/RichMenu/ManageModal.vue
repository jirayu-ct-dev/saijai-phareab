<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  selectedMenu: any;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'refresh'): void;
  (e: 'duplicate', menu: any): void;
}>();

const notify = useNotify();

const activeManageTab = ref("preview");
const isSaving = ref(false);
const hoveredHotspot = ref<any>(null);

const assignForm = reactive({
  targetRole: "ALL" as string | null,
  isDefault: false,
});

const aliasForm = reactive({
  aliasId: "",
});

watch(() => props.selectedMenu, (newVal) => {
  if (newVal) {
    assignForm.targetRole = newVal.targetRole || "ALL";
    assignForm.isDefault = newVal.isDefault;
    aliasForm.aliasId = newVal.aliasId || "";
    activeManageTab.value = "preview";
  }
}, { immediate: true });

const clearHoveredHotspot = (hs: any) => {
  if (hoveredHotspot.value?.index === hs?.index) {
    hoveredHotspot.value = null;
  }
};

const viewModeHotspots = computed(() => {
  if (!props.selectedMenu) return [];
  try {
    const config = JSON.parse(props.selectedMenu.jsonContent);
    const w = config.size?.width;
    const h = config.size?.height;
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

const selectedMenuChatBarText = computed(() => {
  if (!props.selectedMenu) return 'เมนูหลัก';
  try {
    return JSON.parse(props.selectedMenu.jsonContent)?.chatBarText || 'เมนูหลัก';
  } catch {
    return 'เมนูหลัก';
  }
});

const selectedMenuPrettyJson = computed(() => {
  if (!props.selectedMenu) return '';
  try {
    return JSON.stringify(JSON.parse(props.selectedMenu.jsonContent), null, 2);
  } catch {
    return props.selectedMenu.jsonContent || '';
  }
});

const formatActionParams = (action: any) => {
  if (!action) return "";
  const parts: string[] = [];
  if (action.type === "uri") {
    parts.push(`URI: ${action.uri}`);
  } else if (action.type === "message") {
    parts.push(`Text: "${action.text}"`);
  } else if (action.type === "postback") {
    parts.push(`Data: "${action.data}"`);
    if (action.text) parts.push(`Text: "${action.text}"`);
    if (action.displayText) parts.push(`Display: "${action.displayText}"`);
  } else if (action.type === "richmenuswitch") {
    parts.push(`Alias: "${action.richMenuAliasId}"`);
    if (action.data) parts.push(`Data: "${action.data}"`);
  } else if (action.type === "datetimepicker") {
    parts.push(`Data: "${action.data}"`);
    parts.push(`Mode: ${action.mode}`);
    if (action.initial) parts.push(`Init: ${action.initial}`);
    if (action.min) parts.push(`Min: ${action.min}`);
    if (action.max) parts.push(`Max: ${action.max}`);
  } else {
    const p = action.uri || action.text || action.richMenuAliasId || action.data || "";
    if (p) parts.push(p);
  }
  return parts.join(" | ");
};

const copyToClipboard = (text: string) => {
  if (typeof window !== "undefined" && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
    notify.success("คัดลอกเรียบร้อยแล้ว 📋");
  } else {
    notify.error("ไม่สามารถคัดลอกได้ในขณะนี้");
  }
};

const deleteMenu = async (id: string) => {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Rich Menu นี้ออกจากระบบและจาก LINE?")) return;
  try {
    await $fetch(`/api/admin/settings/richmenu/${id}`, { method: "DELETE" });
    notify.success("ลบ Rich Menu เรียบร้อยแล้ว");
    emit('refresh');
    emit('update:modelValue', false);
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาดในการลบ Rich Menu");
  }
};

const onAssign = async () => {
  if (!props.selectedMenu) return;
  isSaving.value = true;
  try {
    await $fetch("/api/admin/settings/richmenu/assign", {
      method: "POST",
      body: {
        id: props.selectedMenu.id,
        targetRole: assignForm.targetRole === "ALL" ? null : assignForm.targetRole,
        isDefault: assignForm.isDefault,
      },
    });
    notify.success("อัปเดตการกำหนดสิทธิ์สำเร็จ และกำลังซิงค์ผู้ใช้งานในเบื้องหลัง 🔄");
    emit('refresh');
    emit('update:modelValue', false);
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  } finally {
    isSaving.value = false;
  }
};

const onAliasSave = async () => {
  if (!props.selectedMenu || !aliasForm.aliasId.trim()) return;
  isSaving.value = true;
  try {
    await $fetch("/api/admin/settings/richmenu/alias", {
      method: "POST",
      body: {
        id: props.selectedMenu.id,
        aliasId: aliasForm.aliasId.trim(),
      },
    });
    notify.success("สร้าง/อัปเดต LINE Alias เรียบร้อยแล้ว");
    emit('refresh');
    emit('update:modelValue', false);
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  } finally {
    isSaving.value = false;
  }
};

const deleteAlias = async (menu: any) => {
  if (!confirm("คุณต้องการลบ Alias ของ Rich Menu นี้ใช่หรือไม่?")) return;
  try {
    await $fetch(`/api/admin/settings/richmenu/alias?id=${menu.id}`, { method: "DELETE" });
    notify.success("ลบ LINE Alias เรียบร้อยแล้ว");
    emit('refresh');
    emit('update:modelValue', false);
  } catch (err: any) {
    notify.error(err.data?.statusMessage || "เกิดข้อผิดพลาด");
  }
};
</script>

<template>
  <UModal :open="modelValue" @update:open="emit('update:modelValue', $event)" :ui="{ content: 'sm:max-w-6xl' }">
    <template #title>
      <div class="flex items-center gap-2">
        <span class="p-1.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
          <UIcon name="i-lucide-settings-2" class="w-5 h-5" />
        </span>
        <span class="text-base font-bold text-slate-800 dark:text-white">จัดการและพรีวิว: {{ selectedMenu?.name }}</span>
      </div>
    </template>

    <template #body>
      <!-- Premium Action Control Bar inside Body -->
      <div v-if="selectedMenu" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
        <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
          จัดการพารามิเตอร์ของ Rich Menu, กำหนดบทบาท, LINE Alias หรือลบการเชื่อมต่อออนไลน์
        </div>
        <div class="flex items-center gap-3">
          <!-- Duplicate / Clone Action -->
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-lucide-copy-plus"
            class="font-bold py-1.5 px-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1.5 whitespace-nowrap"
            @click.stop="emit('duplicate', selectedMenu); emit('update:modelValue', false);"
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
        </div>
      </div>

      <div v-if="selectedMenu" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-h-[70vh] overflow-y-auto pr-1 py-1">
        
        <!-- Left Column inside Modal: Luxury Smartphone Simulator Preview -->
        <div class="lg:col-span-4 flex flex-col items-center">
          <AdminRichMenuSmartphoneSimulator
            :selected-menu="selectedMenu"
            :view-mode-hotspots="viewModeHotspots"
            :hovered-hotspot="hoveredHotspot"
            :selected-menu-chat-bar-text="selectedMenuChatBarText"
            @update:hoveredHotspot="hoveredHotspot = $event"
            @clear:hoveredHotspot="clearHoveredHotspot($event)"
          />

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

            <!-- Interactive hover banner with a stable height to prevent layout shift and infinite flickering loops -->
            <div class="h-[135px] flex-shrink-0">
              <div v-if="hoveredHotspot" class="h-full p-3 bg-primary-50/20 dark:bg-primary-950/20 border border-primary-500/20 rounded-xl space-y-1.5 animate-pulse flex flex-col justify-between">
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
                <div class="border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5 text-xs flex-1 flex flex-col justify-center">
                  <div>
                    <span class="font-bold text-slate-700 dark:text-slate-200">แอ็กชัน:</span>
                    <span class="font-mono bg-primary/10 px-2 py-0.5 rounded ml-1 text-primary text-[10px] font-bold">{{ hoveredHotspot.action.type }}</span>
                  </div>
                  <p class="text-slate-500 dark:text-slate-400 text-[11px] mt-1 break-all leading-normal font-mono line-clamp-2" :title="formatActionParams(hoveredHotspot.action)">
                    พารามิเตอร์: {{ formatActionParams(hoveredHotspot.action) || 'ไม่มีข้อมูล' }}
                  </p>
                </div>
              </div>
              <div v-else class="h-full p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl text-xs text-slate-400 italic flex items-center justify-center text-center leading-relaxed">
                💡 นำเมาส์วางบนแถบปุ่มสัมผัสด้านล่าง หรือนำเมาส์วางบนตำแหน่งในรูปภาพ เพื่อดูการตอบสนองแบบเรียลไทม์
              </div>
            </div>

            <!-- Hotspot Table List -->
            <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <div
                v-for="hs in viewModeHotspots"
                :key="`vlist-${hs.index}`"
                class="p-3 rounded-xl border text-xs flex flex-col gap-2 transition-colors duration-150 cursor-pointer"
                :class="hoveredHotspot?.index === hs.index ? 'border-primary bg-primary-50/15 shadow-sm' : 'border-default bg-default/40 hover:border-slate-300 dark:hover:border-slate-700'"
                @mouseenter="hoveredHotspot = hs"
                @mouseleave="clearHoveredHotspot(hs)"
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
                    :color="hs.action.type === 'uri' ? 'primary' : hs.action.type === 'message' ? 'indigo' : hs.action.type === 'richmenuswitch' ? 'amber' : hs.action.type === 'postback' ? 'rose' : hs.action.type === 'datetimepicker' ? 'purple' : 'neutral'"
                    variant="subtle"
                    size="sm"
                    class="font-mono text-[10px]"
                  >
                    {{ hs.action.type }}
                  </UBadge>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <span class="font-semibold text-slate-700 dark:text-slate-300">พารามิเตอร์:</span>
                  <span class="font-mono bg-slate-50 dark:bg-slate-900/60 px-1.5 py-0.5 rounded text-xs truncate" :title="formatActionParams(hs.action)">
                    {{ formatActionParams(hs.action) || '-' }}
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
                    { label: 'ไม่กำหนดบทบาทเฉพาะเจาะจง (สำหรับทุกคน)', value: 'ALL' },
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
              <textarea
                readonly
                :value="selectedMenuPrettyJson"
                class="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 select-all border-none outline-none focus:ring-0 leading-relaxed cursor-text"
                rows="14"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
