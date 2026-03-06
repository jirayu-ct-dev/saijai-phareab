<script setup lang="ts">
import { authClient } from "~/utils/auth-client";
const notify = useNotify();

const { register } = useUser();

const sessionRef = authClient.useSession();
const session = computed(() => sessionRef.value.data);
const isPending = computed(() => sessionRef.value.isPending);

// Form state
const loading = ref(false);

const form = reactive({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
});

async function handleSignUp() {
    // Validation
    if (form.password !== form.confirmPassword) {
        notify.error("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
        return;
    }

    if (!form.acceptTerms) {
        notify.error("กรุณายอมรับเงื่อนไขการให้บริการ");
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

// Redirect to home if already logged in
watchEffect(() => {
    if (session.value) {
        navigateTo('/');
    }
});

</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 py-12">
        <div v-if="isPending" class="text-gray-500">กำลังโหลด...</div>

        <!-- ฟอร์ม Sign Up -->
        <div v-else-if="!session" class="w-full max-w-md">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6 border border-gray-100 dark:border-gray-700">
                <div class="text-center">
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">สร้างบัญชีผู้ใช้ใหม่</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">กรอกข้อมูลด้านล่างเพื่อเริ่มใช้บริการ Saijai Phareab</p>
                </div>

                <form class="space-y-5" @submit.prevent="handleSignUp">

                    <!-- Name -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ - นามสกุล <span class="text-red-500">*</span></label>
                        <input v-model="form.name" type="text" placeholder="ระบุชื่อและนามสกุลของคุณ" required
                            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                    </div>

                    <!-- Email -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมล <span class="text-red-500">*</span></label>
                        <input v-model="form.email" type="email" placeholder="example@email.com" required
                            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสผ่าน <span class="text-red-500">*</span></label>
                        <input v-model="form.password" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" required
                            minlength="8"
                            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                    </div>

                    <!-- Confirm Password -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ยืนยันรหัสผ่าน <span class="text-red-500">*</span></label>
                        <input v-model="form.confirmPassword" type="password" placeholder="กรอกรหัสผ่านอีกครั้ง" required
                            minlength="8"
                            :class="[
                                'w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:outline-none transition',
                                form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-transparent'
                            ]" />
                        <p v-if="form.confirmPassword && form.password !== form.confirmPassword" class="text-xs text-red-500 mt-1">
                            รหัสผ่านไม่ตรงกัน
                        </p>
                    </div>
                    

                    <!-- Submit -->
                    <button type="submit" :disabled="loading || (form.password !== form.confirmPassword && form.confirmPassword !== '')"
                        class="w-full py-3.5 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70 text-white font-semibold rounded-lg transition-all shadow-sm">
                        <span v-if="loading" class="flex items-center justify-center gap-2">
                            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            กำลังดำเนินการ...
                        </span>
                        <span v-else>สมัครสมาชิก</span>
                    </button>
                </form>

                <div class="pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        มีบัญชีอยู่แล้ว? 
                        <NuxtLink to="/auth/login" class="text-blue-600 dark:text-blue-400 font-semibold hover:underline ml-1 transition-colors">
                            เข้าสู่ระบบ
                        </NuxtLink>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
