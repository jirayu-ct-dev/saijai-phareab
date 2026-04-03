<script setup lang="ts">
import PackagePosWorkspace from "~~/app/components/admin/pos/PackagePosWorkspace.vue";
import StorefrontPosWorkspace from "~~/app/components/admin/pos/StorefrontPosWorkspace.vue";

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const activeMode = ref<"packages" | "storefront">("packages");

const modeOptions = [
  { value: "packages" as const, label: "ขายแพ็กเกจ", description: "เลือกแพ็กเกจและขายแบบ POS" },
  { value: "storefront" as const, label: "ขายบริการหน้าร้าน", description: "นับผ้า คิดราคา และรวมค่าไม้แขวน" },
];
</script>

<template>
  <UDashboardPanel id="sales-pos">
    <template #header>
      <UDashboardNavbar title="POS หน้าร้าน" icon="i-lucide-store">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <UButton label="ดูประวัติชำระเงิน" icon="i-lucide-receipt" color="neutral" variant="outline" @click="navigateTo('/admin/payment')" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <section class="rounded-2xl border border-default bg-default p-4 shadow-sm">
          <div class="grid gap-3 md:grid-cols-2">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              type="button"
              class="rounded-2xl border p-4 text-left transition"
              :class="activeMode === option.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-default bg-elevated/20 hover:border-primary/40'"
              @click="activeMode = option.value"
            >
              <p class="font-semibold text-highlighted">{{ option.label }}</p>
              <p class="mt-1 text-sm text-muted">{{ option.description }}</p>
            </button>
          </div>
        </section>

        <PackagePosWorkspace v-if="activeMode === 'packages'" />
        <StorefrontPosWorkspace v-else />
      </div>
    </template>
  </UDashboardPanel>
</template>
