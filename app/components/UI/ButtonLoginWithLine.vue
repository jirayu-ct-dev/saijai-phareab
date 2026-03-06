<script setup lang="ts">
const { loginWithLine } = useUser();
const notify = useNotify();
const loading = ref(false);

async function onloginWithLine() {
    loading.value = true;
    try {
        await loginWithLine();
    } catch (error: any) {
        notify.error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
        loading.value = false;
    }
}

</script>

<template>
    <div>
        <button
          class="group relative w-full cursor-pointer flex items-center gap-0 bg-[#06C755] text-white rounded px-2 py-2.5 border border-[#000000]/8 font-medium text-sm transition-all duration-150 hover:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.1)] active:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.3)] disabled:bg-white disabled:text-[#1E1E1E]/20 disabled:border-[#E5E5E5]/60" 
          :disabled="loading"
          @click="onloginWithLine"
        >
          <span class="flex items-center self-stretch pr-2 -my-2.5 border-r border-[#000000]/8 group-disabled:border-[#E5E5E5]/60">
            <UPageLogos
              :items="['i-simple-icons-line']" 
              class="group-disabled:opacity-60"
            />
          </span>
          <span class="flex flex-1 items-center justify-center whitespace-nowrap px-6 text-center">ลงชื่อเข้าใช้ด้วยไลน์</span>
          <span
            class="flex items-center self-stretch pr-2 -my-2.5 border-r border-transparent opacity-0 pointer-events-none"
            aria-hidden="true"
          >
            <UPageLogos
              :items="['i-simple-icons-line']"
              class="opacity-0"
            />
          </span>
        </button>
    </div>

    <!-- <NuxtLink
          v-if="lineLink"
          :to="lineLink.to"
          target="_blank"
          rel="noopener noreferrer"
          class="group relative flex items-stretch justify-center gap-0 bg-[#06C755] text-white rounded px-2 py-2.5 border border-[#000000]/8 font-medium text-sm transition-all duration-150 hover:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.1)] active:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.3)] disabled:bg-white disabled:text-[#1E1E1E]/20 disabled:border-[#E5E5E5]/60" 
        >
          <span class="flex items-center self-stretch pr-3 -my-2.5 border-r border-[#000000]/8 group-disabled:border-[#E5E5E5]/60">
            <UPageLogos
              :items="['i-simple-icons-line']" 
              class="group-disabled:opacity-60"
            />
          </span>
          <span class="flex items-center whitespace-nowrap px-6">{{ lineLink.label }}</span>
        </NuxtLink> -->
</template>