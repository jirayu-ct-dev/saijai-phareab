<script setup lang="ts">

defineProps<{
    collapsed?: boolean
    label?: string
    to?: string
}>()


</script>

<template>
    <NuxtLink :to="to || '/'" class="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
        <img src="/logo-saijai-phareab.png"
            :class="[collapsed ? 'h-8' : 'h-15', 'shrink-0 w-auto object-contain transition-all duration-300']"
            alt="SaiJai-Phareab" />
        <div v-if="!collapsed" class="min-w-0">
            <p class="font-semibold truncate"><span class="text-primary">ใส่ใจ </span>ผ้าเรียบ</p>
            <p class="text-[0.7rem] font-medium text-gray-500 tracking-widest dark:text-gray-300 truncate">{{ label ||
                'LAUNDRY SERVICE' }}</p>
        </div>
    </NuxtLink>
</template>