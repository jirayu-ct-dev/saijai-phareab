<script setup lang="ts">
defineProps<{ 
    addLineFriend: boolean 
}>()
</script>

<template>
    <UButton
    v-if="!addLineFriend"
        color="neutral" 
        variant="ghost" 
        to="https://line.me/R/ti/p/@883vmdct" target="_blank"
        icon="i-simple-icons-line" aria-label="Line"
        class="bg-[#06C755] shrink-0 hover:bg-[#06C755]/80 text-white rounded-md p-2 border border-[#000000]/8 font-medium text-sm transition-all duration-150 hover:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.1)] active:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.3)] disabled:bg-white disabled:text-[#1E1E1E]/20 disabled:border-[#E5E5E5]/60"
    >
        <span>เพิ่มเพื่อน</span>
    </UButton>
</template>