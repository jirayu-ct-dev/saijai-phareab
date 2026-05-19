<script setup lang="ts">
const { user } = useUser()
const notify = useNotify()
const router = useRouter()

const isOpen = ref(false)
const password = ref('')
const isDeleting = ref(false)

const isWalkIn = computed(() => user.value?.email === 'walkin@saijai.local')

const open = () => {
  password.value = ''
  isOpen.value = true
}

const handleDelete = async () => {
  if (!password.value.trim()) {
    notify.validationError('กรุณากรอกรหัสผ่าน')
    return
  }

  isDeleting.value = true
  try {
    await $fetch('/api/me/account', {
      method: 'DELETE',
      body: { password: password.value },
    })
    isOpen.value = false
    notify.success('ลบบัญชีเรียบร้อยแล้ว')
    await router.push('/login')
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || 'ไม่สามารถลบบัญชีได้')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="rounded-md border border-error/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-error/20 dark:bg-elevated/55">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-base font-semibold text-error">ลบบัญชี</h2>
        <p class="mt-1 text-sm text-muted">
          ลบบัญชีของคุณออกจากระบบถาวร ข้อมูลทั้งหมดจะไม่สามารถกู้คืนได้
        </p>
      </div>
      <UButton
        color="error"
        variant="subtle"
        label="ลบบัญชี"
        icon="i-lucide-trash-2"
        class="shrink-0"
        :disabled="isWalkIn"
        @click="open"
      />
    </div>
  </div>

  <UModal v-model:open="isOpen" title="ยืนยันการลบบัญชี" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-4">
        <div class="rounded-md border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          การดำเนินการนี้ไม่สามารถย้อนกลับได้ บัญชีและข้อมูลส่วนตัวของคุณจะถูกลบออกจากระบบ
        </div>
        <UFormField label="ยืนยันรหัสผ่าน" required>
          <UInput
            v-model="password"
            type="password"
            placeholder="กรอกรหัสผ่านเพื่อยืนยัน"
            class="w-full"
            autofocus
            @keyup.enter="handleDelete"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <UButton color="neutral" variant="outline" label="ยกเลิก" @click="isOpen = false" />
      <UButton
        color="error"
        label="ลบบัญชีถาวร"
        icon="i-lucide-trash-2"
        :loading="isDeleting"
        @click="handleDelete"
      />
    </template>
  </UModal>
</template>
