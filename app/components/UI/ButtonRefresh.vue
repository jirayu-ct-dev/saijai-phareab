<script setup lang="ts">
const props = defineProps<{
    loading?: boolean;
}>();

const emit = defineEmits<{
    refresh: [];
}>();

function handleRefresh(e: Event) {
    if (props.loading) return;
    emit('refresh');
}
</script>

<template>
    <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="loading"
        @click="handleRefresh"
        aria-label="รีเฟรชข้อมูล"
        label="รีเฟรช"
    />
</template>
