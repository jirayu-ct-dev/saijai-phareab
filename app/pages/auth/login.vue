<script setup lang="ts">
import { authClient } from "~/utils/auth-client";
const notify = useNotify();

const { login, loginWithLine } = useUser();

const sessionRef = authClient.useSession();
const session = computed(() => sessionRef.value.data);
const isPending = computed(() => sessionRef.value.isPending);

// ดึง Logic ของ LIFF มาจาก Composable
const { handleLiffAutoLogin } = useLiffAuth();

// Form state
const loading = ref(false);

const form = reactive({
    email: "",
    password: "",
});

async function handleSignIn() {
    loading.value = true;

    try {
        await login(form.email, form.password);
    } catch (error: any) {
        notify.error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
        loading.value = false;
    }
}

onMounted(async () => {
    if (session.value) return;
    await handleLiffAutoLogin();
})

async function handleSignOut() {
    await authClient.signOut();
}
</script>

<template>
    <div class="min-h-screen flex items-center justify-center p-4">


        <!-- ฟอร์ม Login -->
        <div v-if="!session" class="w-full max-w-md">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
                <div class="text-center">
                    <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">เข้าสู่ระบบ</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Saijai Phareab</p>
                </div>

                <form class="space-y-4" @submit.prevent="handleSignIn">
 
                    <button type="button" @click="loginWithLine"
                        class="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors">
                        เข้าสู่ระบบด้วย LINE
                    </button>

                    <!-- Email -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมล</label>
                        <input v-model="form.email" type="email" placeholder="example@email.com" required
                            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รหัสผ่าน</label>
                        <input v-model="form.password" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" required
                            minlength="8"
                            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                    </div>

                    <!-- Submit -->
                    <button type="submit" :disabled="loading"
                        class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors">
                        <span v-if="loading">กำลังดำเนินการ...</span>
                        <span v-else>เข้าสู่ระบบ</span>
                    </button>
                </form>

                <p class="text-center text-sm text-gray-500 dark:text-gray-400">
                    ยังไม่มีบัญชี?
                    <NuxtLink to="/auth/register" class="text-blue-600 dark:text-blue-400 font-semibold hover:underline ml-1">
                        สมัครสมาชิก
                    </NuxtLink>
                </p>
            </div>
        </div>
    </div>
</template>