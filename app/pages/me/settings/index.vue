<script setup lang="ts">
definePageMeta({
  middleware: [
    () => navigateTo("/me/settings/profile"),
  ],
});
</script>
