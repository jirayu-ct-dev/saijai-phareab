<script setup lang="ts">
import { authClient } from "~/utils/auth-client";

const sessionRef = authClient.useSession();
const session = computed(() => sessionRef.value.data);
const isPending = computed(() => sessionRef.value.isPending);

// Form state
const isSignUp = ref(false);
const loading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

const form = reactive({
    name: "",
    email: "",
    password: "",
});

async function handleSignUp() {
    loading.value = true;
    errorMsg.value = "";
    successMsg.value = "";

    const { error } = await authClient.signUp.email({
        name: form.name,
        email: form.email,
        password: form.password,
    });

    loading.value = false;

    if (error) {
        errorMsg.value = error.message || "สมัครสมาชิกไม่สำเร็จ";
    } else {
        successMsg.value = "สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...";
    }
}

async function handleSignIn() {
    loading.value = true;
    errorMsg.value = "";
    successMsg.value = "";

    const { error } = await authClient.signIn.email({
        email: form.email,
        password: form.password,
    });

    loading.value = false;

    if (error) {
        errorMsg.value = error.message || "เข้าสู่ระบบไม่สำเร็จ";
    } else {
        successMsg.value = "เข้าสู่ระบบสำเร็จ!";
    }
}

async function handleSignOut() {
    await authClient.signOut();
    successMsg.value = "";
}
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <!-- แสดงข้อมูล Session (ถ้า login แล้ว) -->
        <div v-if="isPending" class="text-gray-500">กำลังโหลด...</div>

        <div v-else-if="session" class="w-full max-w-md">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
                <div class="text-center">
                    <div
                        class="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-3xl">✅</span>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">เข้าสู่ระบบแล้ว!</h2>
                </div>

                <div class="space-y-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="font-semibold">ชื่อ:</span> {{ session.user.name }}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="font-semibold">อีเมล:</span> {{ session.user.email }}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="font-semibold">ID:</span>
                        <code class="text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded">{{ session.user.id }}</code>
                    </p>
                </div>

                <button
                    class="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                    @click="handleSignOut">
                    ออกจากระบบ
                </button>
            </div>
        </div>

        <!-- ฟอร์ม Login / Sign Up -->
        <div v-else class="w-full max-w-md">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
                <div class="text-center">
                    <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        {{ isSignUp ? "สมัครสมาชิก" : "เข้าสู่ระบบ" }}
                    </h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Saijai Phareab</p>
                </div>

                <!-- Error / Success Messages -->
                <div v-if="errorMsg"
                    class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {{ errorMsg }}
                </div>
                <div v-if="successMsg"
                    class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
                    {{ successMsg }}
                </div>

                <form class="space-y-4" @submit.prevent="isSignUp ? handleSignUp() : handleSignIn()">
                    <!-- Name (เฉพาะ Sign Up) -->
                    <div v-if="isSignUp">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ</label>
                        <input v-model="form.name" type="text" placeholder="ชื่อ-นามสกุล" required
                            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                    </div>

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
                        <span v-else>{{ isSignUp ? "สมัครสมาชิก" : "เข้าสู่ระบบ" }}</span>
                    </button>
                </form>

                <!-- Toggle Sign Up / Sign In -->
                <p class="text-center text-sm text-gray-500 dark:text-gray-400">
                    {{ isSignUp ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?" }}
                    <button class="text-blue-600 dark:text-blue-400 font-semibold hover:underline ml-1"
                        @click="isSignUp = !isSignUp; errorMsg = ''; successMsg = ''">
                        {{ isSignUp ? "เข้าสู่ระบบ" : "สมัครสมาชิก" }}
                    </button>
                </p>
            </div>
        </div>
    </div>
</template>