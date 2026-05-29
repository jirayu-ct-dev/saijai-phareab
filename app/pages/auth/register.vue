<script setup lang="ts">
import { authClient } from "~/utils/auth-client";
const notify = useNotify();

definePageMeta({ layout: false });

const { register, redirectByRole, loginWithLine } = useUser();

async function handleLineLogin() {
    loading.value = true;
    try {
        await loginWithLine();
    } catch (error: any) {
        notify.error(error.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
        loading.value = false;
    }
}

const sessionRef = authClient.useSession();
const session = computed(() => sessionRef.value.data);
const isPending = computed(() => sessionRef.value.isPending);

// Form state
const loading = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

const form = reactive({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
});

const acceptTerms = ref(false);

async function handleSignUp() {
    // Validation
    if (form.password.length < 8) {
        notify.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        return;
    }

    if (form.password !== form.confirmPassword) {
        notify.error("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
        return;
    }

    if (!acceptTerms.value) {
        notify.error("กรุณายอมรับเงื่อนไขการใช้บริการก่อนสมัครสมาชิก");
        return;
    }

    loading.value = true;

    try {
        await register(form.name, form.email, form.password);
    } catch (error: any) {
        notify.error(error.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
        loading.value = false;
    }
}

// Redirect to home if already logged in, using redirectByRole to prevent flickering
watch(session, async (newSession) => {
    if (newSession?.user) {
        await redirectByRole((newSession.user as any).role);
    }
}, { immediate: true });

</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-gray-900 w-full font-sans">
    
    <!-- LEFT PANEL: Brand & Illustration -->
    <div class="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-[#1b4e85] text-white flex-col justify-between p-10 xl:p-16 relative overflow-hidden">
      <!-- Background details -->
      <div class="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <!-- Top: Logo -->
      <div class="relative z-10 flex items-center gap-3">
        <div class="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm">
          <UIcon name="i-lucide-washing-machine" class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight">ใส่ใจ ผ้าเรียบ</h1>
          <p class="text-[10px] text-blue-200 tracking-widest uppercase">Saijai Laundry</p>
        </div>
      </div>

      <!-- Middle: Copy -->
      <div class="relative z-10 mt-8 xl:mt-12">
        <div class="inline-flex px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-bold tracking-wider mb-6">
          NEW MEMBER
        </div>
        <h2 class="text-4xl xl:text-5xl font-bold leading-[1.15] mb-5">
          เริ่มต้นดูแลผ้าของคุณ<br>ด้วยความใส่ใจ
        </h2>
        <p class="text-blue-100 text-sm xl:text-base max-w-sm mb-10 leading-relaxed">
          สมัครสมาชิกเพื่อสะสมแต้ม จัดการแพ็กเกจ และรับการแจ้งเตือนสถานะผ้าแบบเรียลไทม์ผ่าน LINE
        </p>

        <!-- Feature List -->
         <div class="space-y-4">
            <div class="flex items-center gap-3 p-4 bg-white/5 rounded-md border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10">
                <div class="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center shadow-inner">
                    <UIcon name="i-lucide-badge-check" class="w-6 h-6 text-primary-300" />
                </div>
                <div>
                    <h4 class="font-bold text-sm text-white">รับสิทธิประโยชน์สมาชิก</h4>
                    <p class="text-xs text-blue-200">สะสมแต้มและส่วนลดพิเศษสำหรับแพ็กเกจ</p>
                </div>
            </div>
            <div class="flex items-center gap-3 p-4 bg-white/5 rounded-md border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10">
                <div class="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-inner">
                    <UIcon name="i-lucide-bell" class="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                    <h4 class="font-bold text-sm text-white">แจ้งเตือนผ่าน LINE</h4>
                    <p class="text-xs text-blue-200">ไม่พลาดทุกความเคลื่อนไหวของผ้าคุณ</p>
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

    <!-- RIGHT PANEL: Register Form -->
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

      <!-- Top right nav -->
      <div class="hidden sm:block absolute top-8 right-8 text-sm text-gray-500 dark:text-gray-400 z-10">
        มีบัญชีอยู่แล้ว?
        <NuxtLink to="/auth/login" class="text-primary font-bold hover:underline ml-1">
          เข้าสู่ระบบ
        </NuxtLink>
      </div>

      <!-- Form Container -->
      <div class="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <ClientOnly>
          <div v-if="isPending" class="text-center text-gray-500">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>กำลังโหลด...</p>
          </div>
          
          <div v-else class="w-full max-w-[400px] py-12 lg:py-0">
            
            <div class="mb-8 text-center lg:text-left">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">สมัครสมาชิก</h1>
              <p class="text-gray-500 dark:text-gray-400 text-sm">สร้างบัญชีผู้ใช้ใหม่เพื่อเริ่มใช้บริการและจัดการออเดอร์</p>
            </div>

            <!-- Mobile benefit summary -->
            <div class="lg:hidden mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
              <div class="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                <UIcon name="i-lucide-badge-check" class="w-4 h-4 text-primary flex-shrink-0" />
                สะสมแต้มและส่วนลดพิเศษสำหรับแพ็กเกจ
              </div>
              <div class="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200 mt-2">
                <UIcon name="i-lucide-bell" class="w-4 h-4 text-emerald-500 flex-shrink-0" />
                แจ้งเตือนสถานะผ้าแบบเรียลไทม์ผ่าน LINE
              </div>
            </div>

            <!-- LINE Register Button -->
            <UButton 
              block 
              size="xl" 
              class="mb-6 font-bold text-[15px] bg-[#00B900] hover:bg-[#009900] dark:bg-[#00B900] dark:hover:bg-[#009900] text-white transition-all shadow-sm" 
              @click="handleLineLogin"
            >
              <UIcon name="i-simple-icons-line" class="w-5 h-5 mr-1" />
              ลงทะเบียนด้วย LINE
            </UButton>
            <USeparator label="หรือ" class="mb-6" :ui="{ label: 'text-gray-400 dark:text-gray-500 text-xs' }" />

            <UForm :state="form" class="space-y-4" @submit="handleSignUp">
              
              <UFormField name="name" required>
                <template #label>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">ชื่อ - นามสกุล</span>
                </template>
                <UInput 
                  v-model="form.name" 
                  placeholder="ระบุชื่อและนามสกุลของคุณ" 
                  icon="i-lucide-user" 
                  size="lg" 
                  class="w-full mt-1.5" 
                  required
                />
              </UFormField>

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
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">ยืนยันรหัสผ่าน</span>
                </template>
                <UInput 
                  v-model="form.confirmPassword" 
                  :type="showConfirmPassword ? 'text' : 'password'" 
                  placeholder="••••••••" 
                  autocomplete="new-password" 
                  icon="i-lucide-shield-check" 
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

              <!-- Terms & Privacy Checkbox -->
              <div class="flex items-start gap-3 py-1">
                <UCheckbox
                  v-model="acceptTerms"
                  id="accept-terms"
                  class="mt-0.5 shrink-0"
                />
                <label for="accept-terms" class="text-sm text-gray-600 dark:text-gray-400 cursor-pointer leading-snug">
                  ฉันยอมรับ
                  <NuxtLink to="/terms" class="text-primary font-semibold hover:underline">เงื่อนไขการใช้บริการ</NuxtLink>
                  และ
                  <NuxtLink to="/privacy" class="text-primary font-semibold hover:underline">นโยบายความเป็นส่วนตัว</NuxtLink>
                </label>
              </div>

              <div class="pt-2">
                  <UButton 
                  type="submit" 
                  block 
                  color="primary" 
                  size="xl" 
                  :loading="loading" 
                  :disabled="loading || !acceptTerms || (form.password !== form.confirmPassword && form.confirmPassword !== '')"
                  class="font-bold text-[15px] shadow-sm shadow-primary-500/20"
                  >
                  สร้างบัญชี
                  <template #trailing>
                      <UIcon name="i-lucide-arrow-right" class="w-4 h-4 ml-1" />
                  </template>
                  </UButton>
              </div>
            </UForm>

            <p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-8">
              มีบัญชีอยู่แล้ว? 
              <NuxtLink to="/auth/login" class="text-primary font-bold hover:underline ml-1">
                เข้าสู่ระบบที่นี่
              </NuxtLink>
            </p>

          </div>
          <template #fallback>
            <div class="w-full max-w-[400px] flex flex-col items-center justify-center py-12">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary mb-2" />
              <p class="text-gray-500 text-sm">กำลังโหลดระบบสมัครสมาชิก...</p>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
