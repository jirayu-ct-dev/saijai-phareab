<script setup lang="ts">
const props = defineProps<{
    loading?: boolean;
}>();

const emit = defineEmits<{
    refresh: [];
}>();

const handleRefresh = () => {
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
        aria-label="รีเฟรชข้อมูล"
        label="รีเฟรช"
        @click="handleRefresh"
    />
</template>
