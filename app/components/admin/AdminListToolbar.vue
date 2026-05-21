<script setup lang="ts">
import { isRef } from "vue";
import { adminFilterBarClass } from "~~/shared/config/adminUi";

type AdminListToolbarFilterOption = {
  label: string;
  value: string | number | boolean | null;
  [key: string]: unknown;
};

type FilterModel =
  | string
  | number
  | boolean
  | null
  | undefined
  | { value: string | number | boolean | null | undefined };

export type AdminListToolbarFilter = {
  key: string;
  label: string;
  options: AdminListToolbarFilterOption[];
  model: FilterModel;
};

export type AdminListToolbarAction = {
  label: string;
  icon?: string;
  click: () => void | Promise<void>;
};

const props = withDefaults(defineProps<{
  searchPlaceholder?: string;
  filters?: AdminListToolbarFilter[];
  actions?: AdminListToolbarAction[];
}>(), {
  searchPlaceholder: "ค้นหา...",
  filters: () => [],
  actions: () => [],
});

const emit = defineEmits<{
  "update:filter": [payload: { key: string; value: string | number | boolean | null | undefined }];
}>();

const search = defineModel<string>("search", { default: "" });

const getFilterValue = (filter: AdminListToolbarFilter) => {
  if (isRef(filter.model)) return filter.model.value;
  return filter.model;
};

const setFilterValue = (filter: AdminListToolbarFilter, value: string | number | boolean | null | undefined) => {
  if (isRef(filter.model)) {
    filter.model.value = value;
  } else {
    filter.model = value;
  }

  emit("update:filter", { key: filter.key, value });
};
</script>

<template>
  <div :class="[adminFilterBarClass, '!px-3 !py-3 flex flex-col gap-1.5']">
    <div class="flex flex-wrap items-center gap-1.5">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="props.searchPlaceholder"
        class="min-w-0 flex-1 md:max-w-sm"
      />

      <UButton
        v-for="action in props.actions"
        :key="action.label"
        :label="action.label"
        :icon="action.icon"
        color="neutral"
        variant="outline"
        class="shrink-0"
        @click="action.click"
      />
    </div>

    <div
      v-if="props.filters.length"
      class="grid gap-1.5"
      :class="{
        'grid-cols-1': props.filters.length === 1,
        'grid-cols-2': props.filters.length === 2,
        'grid-cols-3': props.filters.length >= 3,
      }"
    >
      <UFormField
        v-for="filter in props.filters"
        :key="filter.key"
        :label="filter.label"
      >
        <USelect
          :model-value="getFilterValue(filter)"
          :items="filter.options"
          value-key="value"
          class="min-w-0 w-full"
          @update:model-value="setFilterValue(filter, $event as string | number | boolean | null | undefined)"
        />
      </UFormField>
    </div>
  </div>
</template>
