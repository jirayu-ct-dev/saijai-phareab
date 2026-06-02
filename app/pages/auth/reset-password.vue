<script setup lang="ts">
import { authClient } from "~/utils/auth-client";

definePageMeta({ layout: false });

const route = useRoute();
const notify = useNotify();
const loading = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

const token = computed(() => route.query.token as string);
const email = computed(() => route.query.email as string); // รับ email มาแสดงถ้ามีใน URL

const form = reactive({
    password: "",
    confirmPassword: "",
});

async function handleResetPassword() {
    if (!token.value) {
        notify.error("Token ไม่ถูกต้องหรือหมดอายุ");
        return;
    }

    if (form.password.length < 8) {
        notify.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        return;
    }

    if (form.password !== form.confirmPassword) {
        notify.error("รหัสผ่านไม่ตรงกัน");
        return;
    }

    loading.value = true;
    try {
        const { error } = await authClient.resetPassword({
            newPassword: form.password,
            token: token.value,
        });

        if (error) {
            notify.error(error.message || "การรีเซ็ตรหัสผ่านล้มเหลว");
        } else {
            notify.success("รีเซ็ตรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
            await navigateTo("/auth/login");
        }
    } catch (error: any) {
        notify.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    if (!token.value) {
        notify.error("ไม่พบรหัส Token สำหรับรีเซ็ตรหัสผ่าน");
    }
});
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-gray-900 w-full font-sans">
    
    <!-- LEFT PANEL: Brand & Illustration -->
    <div class="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-[#1b4e85] text-white flex-col justify-between p-10 xl:p-16 relative overflow-hidden">
      <!-- Background details -->
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

      <!-- Middle: Copy -->
      <div class="relative z-10 mt-8 xl:mt-12">
        <div class="inline-flex px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-bold tracking-wider mb-6 uppercase">
          ACCOUNT RECOVERY
        </div>
        <h2 class="text-4xl xl:text-5xl font-bold leading-[1.15] mb-5">
          กู้คืนการเข้าถึง<br>บัญชีของคุณ
        </h2>
        <p class="text-blue-100 text-sm xl:text-base max-w-sm mb-10 leading-relaxed">
          ลืมรหัสผ่านไม่ใช่ปัญหา เราจะช่วยตั้งรหัสใหม่ให้คุณ ใช้เวลาไม่ถึง 2 นาที
        </p>

        <!-- Step List -->
         <div class="space-y-6">
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <UIcon name="i-lucide-check" class="w-5 h-5" />
                </div>
                <p class="text-sm font-medium text-white">กรอกอีเมลที่ลงทะเบียน</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <UIcon name="i-lucide-check" class="w-5 h-5" />
                </div>
                <p class="text-sm font-medium text-white">ตรวจอีเมล คลิกลิงก์รีเซ็ต</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-white text-[#1b4e85] flex items-center justify-center font-bold text-sm shadow-sm border border-white/30 backdrop-blur-sm">3</div>
                <p class="text-sm font-medium text-white">ตั้งรหัสผ่านใหม่</p>
            </div>
         </div>
      </div>

      <!-- Bottom: Footer -->
      <div class="relative z-10 flex gap-4 text-xs text-blue-200/70 mt-12">
        <span>&copy; 2026 ใส่ใจ ผ้าเรียบ</span>
        <NuxtLink to="#" class="hover:text-white transition-colors">เงื่อนไข</NuxtLink>
        <NuxtLink to="#" class="hover:text-white transition-colors">ติดต่อสนับสนุน</NuxtLink>
      </div>
    </div>

    <!-- RIGHT PANEL: Form -->
    <div class="flex-1 flex flex-col relative bg-white dark:bg-gray-900">
      
      <!-- Top left nav -->
      <div class="absolute top-8 left-8 sm:left-12 z-10">
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

      <!-- Display email if provided in URL -->
      <div v-if="email" class="hidden sm:block absolute top-8 right-8 text-sm font-mono text-gray-400 dark:text-gray-500 z-10">
        {{ email }}
      </div>

      <!-- Form Container -->
      <div class="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div class="w-full max-w-[400px]">
          
          <div class="mb-8 text-center lg:text-left">
            <div class="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 mx-auto lg:mx-0">
                <UIcon name="i-lucide-shield-check" class="w-7 h-7" />
            </div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">ตั้งรหัสผ่านใหม่</h1>
            <p class="text-gray-500 dark:text-gray-400 text-sm">เลือกรหัสผ่านใหม่ที่แข็งแรงเพื่อความปลอดภัยของบัญชีคุณ</p>
          </div>

          <UForm v-if="token" :state="form" class="space-y-6" @submit="handleResetPassword">
            
            <UFormField name="password" required>
              <template #label>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">รหัสผ่านใหม่</span>
              </template>
              <UInput 
                v-model="form.password" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="อย่างน้อย 8 ตัวอักษร" 
                autocomplete="new-password" 
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

            <UFormField name="confirmPassword" required :error="form.confirmPassword && form.password !== form.confirmPassword ? 'รหัสผ่านไม่ตรงกัน' : ''">
              <template #label>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">ยืนยันรหัสผ่านใหม่</span>
              </template>
              <UInput 
                v-model="form.confirmPassword" 
                :type="showConfirmPassword ? 'text' : 'password'" 
                placeholder="กรอกรหัสผ่านอีกครั้ง" 
                autocomplete="new-password" 
                icon="i-lucide-lock" 
                size="lg" 
                class="w-full mt-1.5" 
                required
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    :icon="showConfirmPassword ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                    :padded="false"
                    @click="showConfirmPassword = !showConfirmPassword"
                    class="text-gray-400"
                  />
                </template>
              </UInput>
            </UFormField>

            <div class="pt-4">
                <UButton 
                type="submit" 
                block 
                color="primary" 
                size="xl" 
                :loading="loading" 
                :disabled="!token || loading || (form.password !== form.confirmPassword && form.confirmPassword !== '')"
                class="font-bold text-[15px] shadow-sm shadow-primary-500/20"
                >
                ตั้งรหัสผ่านใหม่
                <template #trailing>
                    <UIcon name="i-lucide-arrow-right" class="w-4 h-4 ml-1" />
                </template>
                </UButton>
            </div>
          </UForm>

          <!-- No Token Warning -->
          <div v-else class="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
            <UIcon name="i-lucide-alert-circle" class="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h3 class="text-lg font-bold text-red-700 dark:text-red-400 mb-2">ไม่พบลิงก์รีเซ็ตรหัสผ่าน</h3>
            <p class="text-sm text-red-600 dark:text-red-300 mb-6">ลิงก์ที่คุณใช้เข้าถึงหน้านี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณากลับไปที่หน้าลืมรหัสผ่านเพื่อขอลิงก์ใหม่</p>
            <UButton to="/auth/forgot-password" color="primary" block>
              ขอลิงก์ตั้งรหัสผ่านใหม่
            </UButton>
          </div>

          <!-- Warning box -->
          <div v-if="token" class="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p class="text-xs text-center text-gray-500 dark:text-gray-400 leading-relaxed">
                  หลังเปลี่ยนรหัสผ่าน คุณจะถูกออกจากระบบทุกอุปกรณ์เพื่อความปลอดภัย
              </p>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
