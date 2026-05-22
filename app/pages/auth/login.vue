<script setup lang="ts">
import { authClient } from "~/utils/auth-client";

definePageMeta({ layout: false });

const notify = useNotify();

const { login, loginWithLine, redirectByRole } = useUser();

const sessionRef = authClient.useSession();
const session = computed(() => sessionRef.value.data);
const isPending = computed(() => sessionRef.value.isPending);

// ดึง Logic ของ LIFF มาจาก Composable
const { handleLiffAutoLogin } = useLiffAuth();

// Form state
const loading = ref(false);
const showPassword = ref(false);
const rememberMe = ref(true);

const form = reactive({
    email: "",
    password: "",
});

async function handleSignIn() {
    loading.value = true;

    try {
        await login(form.email, form.password, rememberMe.value);
    } catch (error: any) {
        notify.error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
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

watch(session, async (newSession) => {
    if (newSession?.user) {
        await redirectByRole((newSession.user as any).role);
    }
}, { immediate: false });

onMounted(async () => {
    const reason = useCookie<string | null>("auth_signout_reason");
    if (reason.value === "deleted") {
        notify.error("บัญชีของคุณถูกลบโดยผู้ดูแลระบบ ไม่สามารถเข้าสู่ระบบได้");
        reason.value = null;
        return;
    }
    if (session.value) {
        await redirectByRole((session.value.user as any)?.role);
        return;
    }
    await handleLiffAutoLogin();
})
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-gray-900 w-full font-sans">
    
    <!-- LEFT PANEL: Brand & Illustration -->
    <div class="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-[#1b4e85] text-white flex-col justify-between p-10 xl:p-16 relative overflow-hidden">
      <!-- Background details (optional) -->
      <div class="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <!-- Top: Logo -->
      <div class="relative z-10 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm">
          <UIcon name="i-lucide-washing-machine" class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight">ใส่ใจ ผ้าเรียบ</h1>
          <p class="text-[10px] text-blue-200 tracking-widest uppercase">Saijai Laundry</p>
        </div>
      </div>

      <!-- Middle: Copy & Mockup -->
      <div class="relative z-10 mt-8 xl:mt-12">
        <div class="inline-flex px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-bold tracking-wider mb-6">
          MEMBER PORTAL
        </div>
        <h2 class="text-4xl xl:text-5xl font-bold leading-[1.15] mb-5">
          ยินดีต้อนรับ<br />กลับมาอีกครั้ง
        </h2>
        <p class="text-blue-100 text-sm xl:text-base max-w-sm mb-10 leading-relaxed">
          เข้าสู่ระบบเพื่อจัดการแพ็กเกจ ดูประวัติการซัก และติดตามสถานะผ้าของคุณแบบเรียลไทม์
        </p>

        <!-- LINE Mockup -->
        <div class="relative w-full max-w-sm opacity-95">
          <div class="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
            <div class="p-4">
              <div class="flex items-center gap-3 pb-3 mb-3 border-b border-white/10">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#06C755] to-[#04a045] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow ring-2 ring-white/20">
                  ใจ
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm flex items-center gap-1.5 text-white">
                    ใส่ใจ ผ้าเรียบ
                    <UIcon name="i-ph-check-circle-fill" class="text-[#06C755] w-4 h-4 shrink-0" />
                  </div>
                  <div class="text-[10px] text-white/70">แจ้งเตือนล่าสุด · 14:23</div>
                </div>
              </div>
              
              <div class="bg-white/95 dark:bg-gray-800 rounded-xl rounded-tl-sm p-3 mb-3">
                <div class="font-semibold flex items-center gap-1.5 mb-2 text-gray-900 dark:text-white text-[12px]">
                  <span class="w-2 h-2 rounded-full bg-amber-500" />
                  กำลังซัก...
                </div>
                <div class="space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                  <div class="flex justify-between gap-3">
                    <span>ใบเสร็จ</span>
                    <span class="font-mono font-medium text-gray-900 dark:text-gray-200">#SJ-2604-018</span>
                  </div>
                  <div class="flex justify-between gap-3">
                    <span>เหลืออีก</span>
                    <span class="font-semibold text-gray-900 dark:text-gray-200">~ 28 นาที</span>
                  </div>
                </div>
              </div>

              <div class="bg-white/95 dark:bg-gray-800 rounded-xl rounded-tl-sm p-3">
                <div class="font-semibold flex items-center gap-1.5 mb-1.5 text-gray-900 dark:text-white text-[12px]">
                  <span class="w-2 h-2 rounded-full bg-emerald-500" />
                  พร้อมส่ง 🛵
                </div>
                <div class="flex justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                  <span>ถึงประมาณ</span>
                  <span class="font-semibold text-gray-900 dark:text-gray-200">17:45 น.</span>
                </div>
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
      
      <!-- Top left nav -->
      <div class="absolute top-8 left-8 sm:left-12">
        <UButton 
          to="/" 
          variant="ghost" 
          color="neutral" 
          icon="i-lucide-arrow-left" 
          class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          กลับหน้าหลัก
        </UButton>
      </div>

      <!-- Top right nav -->
      <div class="hidden sm:block absolute top-8 right-8 text-sm text-gray-500 dark:text-gray-400">
        ยังไม่มีบัญชี?
        <NuxtLink to="/auth/register" class="text-primary font-bold hover:underline ml-1">
          สมัครสมาชิก
        </NuxtLink>
      </div>

      <!-- Form Container -->
      <div class="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div class="w-full max-w-[400px]">
          
          <div class="mb-10">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">เข้าสู่ระบบ</h1>
            <p class="text-gray-500 dark:text-gray-400 text-sm">ใช้บัญชีของคุณเพื่อจัดการบริการ และดูสถานะผ้าทุกผืน</p>
          </div>

          <!-- LINE Button -->
          <UButton 
            block 
            size="xl" 
            class="mb-6 font-bold text-[15px] bg-[#00B900] hover:bg-[#009900] dark:bg-[#00B900] dark:hover:bg-[#009900] text-white transition-all shadow-sm" 
            @click="handleLineLogin"
          >
            <UIcon name="i-ph-chat-circle-fill" class="w-5 h-5 mr-1" />
            เข้าสู่ระบบด้วย LINE
          </UButton>

          <UDivider label="หรือ" class="mb-6" :ui="{ label: 'text-gray-400 dark:text-gray-500 text-xs' }" />

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
                <div class="flex justify-between items-center w-full">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">รหัสผ่าน</span>
                  <NuxtLink to="/auth/forgot-password" class="text-xs text-primary font-semibold hover:underline">
                    ลืมรหัสผ่าน?
                  </NuxtLink>
                </div>
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
                    @click="showPassword = !showPassword"
                    class="text-gray-400"
                  />
                </template>
              </UInput>
            </UFormField>

            <div class="flex items-center mt-4 mb-8">
              <UCheckbox v-model="rememberMe" label="จดจำการเข้าสู่ระบบของฉันบนอุปกรณ์นี้" :ui="{ label: 'text-sm text-gray-600 dark:text-gray-300' }" />
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
              สมัครสมาชิกฟรี
            </NuxtLink>
          </p>
          <p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-8 hidden sm:block">
            ยังไม่มีบัญชี? <NuxtLink to="/auth/register" class="text-primary font-bold hover:underline ml-1">สมัครสมาชิกฟรี</NuxtLink>
          </p>

        </div>
      </div>
    </div>
  </div>
</template>