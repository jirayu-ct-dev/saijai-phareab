<script setup lang="ts">
import { authClient } from "~/utils/auth-client";

definePageMeta({ layout: false });

const notify = useNotify();
const loading = ref(false);
const sent = ref(false);

const form = reactive({
    email: "",
});

async function handleForgotPassword() {
    if (!form.email) {
        notify.error("กรุณากรอกอีเมล");
        return;
    }

    loading.value = true;
    try {
        // @ts-expect-error - better-auth type definition might not include forgetPassword in client
        const { error } = await authClient.forgetPassword({
            email: form.email,
            redirectTo: "/auth/reset-password",
        });

        if (error) {
            notify.error(error.message || "เกิดข้อผิดพลาดในการส่งอีเมล");
        } else {
            sent.value = true;
            notify.success("ส่งอีเมลรีเซ็ตรหัสผ่านเรียบร้อยแล้ว");
        }
    } catch (error: any) {
        notify.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
        loading.value = false;
    }
}
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
          กู้คืนการเข้าถึง<br />บัญชีของคุณ
        </h2>
        <p class="text-blue-100 text-sm xl:text-base max-w-sm mb-10 leading-relaxed">
          ลืมรหัสผ่านไม่ใช่ปัญหา เราจะช่วยตั้งรหัสใหม่ให้คุณ ใช้เวลาไม่ถึง 2 นาที
        </p>

        <!-- Step List -->
         <div class="space-y-6">
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-white text-[#1b4e85] flex items-center justify-center font-bold text-sm shadow-sm">1</div>
                <p class="text-sm font-medium">กรอกอีเมลที่ลงทะเบียน</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm border border-white/30 backdrop-blur-sm">2</div>
                <p class="text-sm font-medium text-blue-100">ตรวจอีเมล คลิกลิงก์รีเซ็ต</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm border border-white/30 backdrop-blur-sm">3</div>
                <p class="text-sm font-medium text-blue-100">ตั้งรหัสผ่านใหม่</p>
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
      
      <!-- Top right nav -->
      <div class="hidden sm:block absolute top-8 right-8 text-sm text-gray-500 dark:text-gray-400">
        นึกได้แล้ว?
        <NuxtLink to="/auth/login" class="text-primary font-bold hover:underline ml-1">
          กลับไปเข้าสู่ระบบ
        </NuxtLink>
      </div>

      <!-- Form Container -->
      <div class="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div class="w-full max-w-[400px]">
          
          <div v-if="sent" class="text-center">
            <div class="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
                <UIcon name="i-lucide-check-circle" class="w-12 h-12" />
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">ส่งอีเมลเรียบร้อยแล้ว</h1>
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-8">
                เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปที่ <span class="font-bold text-gray-700 dark:text-gray-200">{{ form.email }}</span> แล้ว โปรดตรวจสอบกล่องขาเข้าหรือถังขยะ
            </p>
            <UButton block color="primary" size="xl" to="/auth/login" class="font-bold">
                กลับไปยังหน้าเข้าสู่ระบบ
            </UButton>
          </div>

          <div v-else>
            <div class="mb-8">
              <div class="w-14 h-14 bg-blue-50 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mb-6 text-primary">
                  <UIcon name="i-lucide-key-round" class="w-7 h-7" />
              </div>
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">ลืมรหัสผ่าน?</h1>
              <p class="text-gray-500 dark:text-gray-400 text-sm">กรอกอีเมลที่คุณใช้สมัครสมาชิก เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้ภายในไม่กี่นาที</p>
            </div>

            <UForm :state="form" class="space-y-6" @submit="handleForgotPassword">
              
              <UFormField name="email" required>
                <template #label>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">อีเมลที่ลงทะเบียน</span>
                </template>
                <UInput 
                  v-model="form.email" 
                  type="email" 
                  placeholder="somchai@gmail.com" 
                  autocomplete="email" 
                  icon="i-lucide-mail" 
                  size="lg" 
                  class="w-full mt-1.5" 
                  required
                />
              </UFormField>

              <UButton 
                type="submit" 
                block 
                color="primary" 
                size="xl" 
                :loading="loading" 
                class="font-bold text-[15px] shadow-sm shadow-primary-500/20"
              >
                <UIcon name="i-lucide-send" class="w-4 h-4 mr-2" />
                ส่งลิงก์รีเซ็ตรหัสผ่าน
              </UButton>
            </UForm>

            <!-- Help box -->
            <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <p class="text-xs text-center text-gray-500 dark:text-gray-400 leading-relaxed">
                    <span class="font-bold text-gray-700 dark:text-gray-200">ไม่ได้รับอีเมล?</span> ตรวจสอบกล่องสแปม หรือ <NuxtLink to="#" class="text-primary font-bold hover:underline">ติดต่อทีมงาน</NuxtLink> เพื่อขอความช่วยเหลือ
                </p>
            </div>

            <div class="mt-8 text-center">
                <NuxtLink to="/auth/login" class="text-sm font-bold text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-2">
                    <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
                    กลับไปหน้าเข้าสู่ระบบ
                </NuxtLink>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
