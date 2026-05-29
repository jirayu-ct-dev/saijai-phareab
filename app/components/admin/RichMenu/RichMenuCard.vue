<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  menu: any;
}>();

const emit = defineEmits<{
  (e: 'manage', menu: any): void;
  (e: 'copy', text: string): void;
}>();

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
  <UCard
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
                @click.stop="emit('copy', menu.richMenuId)"
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
              @click.stop="emit('manage', menu)"
            >
              จัดการและจำลอง
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
