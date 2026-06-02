<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  selectedMenu: any;
  viewModeHotspots: any[];
  hoveredHotspot: any;
  selectedMenuChatBarText: string;
}>();

const emit = defineEmits<{
  (e: 'update:hoveredHotspot', value: any): void;
  (e: 'clear:hoveredHotspot', value: any): void;
}>();
</script>

<template>
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
        :src="selectedMenu?.imageUrl"
        class="w-full h-full object-cover"
        draggable="false"
      />

      <!-- SVG hotspot layer overlay -->
      <svg class="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <g
          v-for="hs in viewModeHotspots"
          :key="`vh-${hs.index}`"
          class="cursor-pointer group/hotspot"
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
            class="transition-[fill,stroke,stroke-width] duration-150"
            :stroke-dasharray="hs.action?.type === 'richmenuswitch' ? '4 2' : 'none'"
            @mouseenter="emit('update:hoveredHotspot', hs)"
            @mouseleave="emit('clear:hoveredHotspot', hs)"
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
        {{ selectedMenuChatBarText }}
        <UIcon name="i-lucide-chevron-up" class="w-2.5 h-2.5 text-slate-400" />
      </span>
      <UIcon name="i-lucide-smile" class="w-3 h-3 text-slate-400" />
    </div>

    <!-- Phone home indicator bar -->
    <div class="w-20 h-1 bg-slate-800 rounded-full mx-auto mt-2"></div>
  </div>
</template>
