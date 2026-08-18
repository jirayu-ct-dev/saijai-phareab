<script setup lang="ts">
definePageMeta({ layout: false });

const notify = useNotify();

const { login, loginWithLine } = useUser();

// Form state
const loading = ref(false);
const showPassword = ref(false);
const rememberMe = ref(true);

function togglePasswordVisibility(): void {
    showPassword.value = !showPassword.value;
}

const form = reactive({
    email: "",
    password: "",
});

async function handleSignIn() {
    loading.value = true;

    try {
        await login(form.email, form.password, rememberMe.value);
    } catch {
        // useUser().login แสดง error notification เองแล้ว
    } finally {
        loading.value = false;
    }
}

async function handleLineLogin() {
    loading.value = true;
    try {
        await loginWithLine();
    } catch (error: any) {
        notify.error(error.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
        loading.value = false;
    }
}

onMounted(async () => {
    const reason = useCookie<string | null>("auth_signout_reason");
    if (reason.value === "deleted") {
        notify.error("บัญชีของคุณถูกลบโดยผู้ดูแลระบบ ไม่สามารถเข้าสู่ระบบได้");
        reason.value = null;
        return;
    }
})
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-gray-900 w-full font-sans">
    
    <!-- LEFT PANEL: Brand & Illustration -->
    <div class="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-[#1b4e85] text-white flex-col justify-between p-10 xl:p-16 relative overflow-hidden">
      <!-- Background details (optional) -->
      <div class="absolute top-[-10%] right-[-10%] size-125 bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <!-- Top: Logo -->
      <AppLogo
        to="/"
        label="SAIJAI LAUNDRY"
        class="relative z-10 w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      />

      <!-- Middle: Copy & Mockup -->
      <div class="relative z-10 mt-8 xl:mt-12">
        <div class="inline-flex px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-bold tracking-wider mb-6">
          MEMBER PORTAL
        </div>
        <h2 class="text-4xl xl:text-5xl font-bold leading-[1.15] mb-5">
          ยินดีต้อนรับ<br>กลับมาอีกครั้ง
        </h2>
        <p class="text-blue-100 text-sm xl:text-base max-w-sm mb-10 leading-relaxed">
          เข้าสู่ระบบเพื่อจัดการแพ็กเกจ ดูประวัติการซัก และติดตามสถานะผ้าของคุณแบบเรียลไทม์
        </p>

        <!-- Member benefits -->
        <div class="w-full max-w-md rounded-xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
          <div class="mb-4 flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-5 text-sky-200" />
            <p class="text-sm font-semibold">ทุกเรื่องผ้า ดูได้ในที่เดียว</p>
          </div>

          <div class="space-y-3">
            <div class="flex items-center gap-3 rounded-lg bg-white/10 p-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-300/20 text-sky-100">
                <UIcon name="i-lucide-route" class="size-4.5" />
              </div>
              <div>
                <p class="text-sm font-semibold">ติดตามสถานะงาน</p>
                <p class="mt-0.5 text-xs text-blue-100/80">เช็กความคืบหน้าของผ้าได้ทุกขั้นตอน</p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-lg bg-white/10 p-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-300/20 text-sky-100">
                <UIcon name="i-lucide-ticket-check" class="size-4.5" />
              </div>
              <div>
                <p class="text-sm font-semibold">จัดการแพ็กเกจ</p>
                <p class="mt-0.5 text-xs text-blue-100/80">ดูเครดิตคงเหลือและประวัติการใช้งาน</p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-lg bg-white/10 p-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#06C755]/20 text-[#7df0a6]">
                <UIcon name="i-simple-icons-line" class="size-4.5" />
              </div>
              <div>
                <p class="text-sm font-semibold">ไม่พลาดการแจ้งเตือน</p>
                <p class="mt-0.5 text-xs text-blue-100/80">รับข่าวสารสำคัญผ่าน LINE อย่างสะดวก</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom: Footer -->
      <div class="relative z-10 flex gap-4 text-xs text-blue-200/70 mt-12">
        <span>&copy; 2026 ใส่ใจ ผ้าเรียบ</span>
        <NuxtLink to="/terms" class="hover:text-white transition-colors">เงื่อนไข</NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-white transition-colors">ความเป็นส่วนตัว</NuxtLink>
      </div>
    </div>

    <!-- RIGHT PANEL: Login Form -->
    <div class="flex-1 flex flex-col relative bg-white dark:bg-gray-900">
      
      <!--      <!-- Form Container -->
      <div class="flex-1 flex items-center justify-center p-6 sm:p-12">
        <ClientOnly>
          <div class="w-full max-w-100">
            
            <div class="mb-10">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">เข้าสู่ระบบ</h1>
              <p class="text-gray-500 dark:text-gray-400 text-sm">ใช้บัญชีของคุณเพื่อจัดการบริการ และดูสถานะผ้าทุกผืน</p>
            </div>

            <NuxtLink
              to="/auth/claim-customer"
              class="mb-6 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
            >
              <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UIcon name="i-lucide-key-round" class="size-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-highlighted">มีรหัสเปิดใช้งานจากหน้าร้าน?</span>
                <span class="mt-0.5 block text-xs text-muted">เปิดใช้งานบัญชีเดิมก่อนเข้าสู่ระบบด้วย LINE</span>
              </span>
              <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
            </NuxtLink>

            <!-- LINE Button -->
            <UButton 
              block 
              size="xl" 
              class="mb-6 font-bold text-[15px] bg-[#00B900] hover:bg-[#009900] dark:bg-[#00B900] dark:hover:bg-[#009900] text-white transition-all shadow-sm" 
              @click="handleLineLogin"
            >
              <UIcon name="i-simple-icons-line" class="w-5 h-5 mr-1" />
              เข้าสู่ระบบด้วย LINE
            </UButton>

            <USeparator label="หรือ" class="mb-6" :ui="{ label: 'text-gray-400 dark:text-gray-500 text-xs' }" />

            <UForm :state="form" class="space-y-5" @submit="handleSignIn">
              
              <UFormField name="email" required>
                <template #label>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">อีเมล</span>
                </template>
                <UInput 
                  v-model="form.email" 
                  type="email" 
                  placeholder="you@example.com" 
                  autocomplete="email" 
                  icon="i-lucide-mail" 
                  size="lg" 
                  class="w-full mt-1.5" 
                  required
                />
              </UFormField>

              <UFormField name="password" required>
                <template #label>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">รหัสผ่าน</span>
                </template>
                <UInput 
                  v-model="form.password" 
                  :type="showPassword ? 'text' : 'password'" 
                  placeholder="••••••••" 
                  autocomplete="current-password" 
                  icon="i-lucide-lock" 
                  size="lg" 
                  class="w-full mt-1.5" 
                  required
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="link"
                      :icon="showPassword ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                      :padded="false"
                      @click="togglePasswordVisibility"
                      class="text-gray-400"
                    />
                  </template>
                </UInput>
              </UFormField>

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 mb-8">
                <UCheckbox v-model="rememberMe" label="จดจำฉันบนอุปกรณ์นี้" :ui="{ label: 'text-sm text-gray-600 dark:text-gray-300' }" />
                <NuxtLink to="/auth/forgot-password" class="text-sm text-primary font-semibold hover:underline self-start sm:self-auto">ลืมรหัสผ่าน?</NuxtLink>
              </div>

              <UButton 
                type="submit" 
                block 
                color="primary" 
                size="xl" 
                :loading="loading" 
                class="font-bold text-[15px] shadow-sm"
              >
                เข้าสู่ระบบ
                <template #trailing>
                  <UIcon name="i-lucide-arrow-right" class="w-4 h-4 ml-1" />
                </template>
              </UButton>
            </UForm>

            <p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-8 sm:hidden">
              ยังไม่มีบัญชี?
              <NuxtLink to="/auth/register" class="text-primary font-bold hover:underline ml-1">
                สมัครสมาชิก
              </NuxtLink>
            </p>
            <p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-8 hidden sm:block">
              ยังไม่มีบัญชี? <NuxtLink to="/auth/register" class="text-primary font-bold hover:underline ml-1">สมัครสมาชิกฟรี</NuxtLink>
            </p>

          </div>
          <template #fallback>
            <div class="w-full max-w-100 flex flex-col items-center justify-center py-12">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary mb-2" />
              <p class="text-gray-500 text-sm">กำลังโหลดระบบเข้าสู่ระบบ...</p>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
