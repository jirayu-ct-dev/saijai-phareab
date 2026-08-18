<script setup lang="ts">
const notify = useNotify()
const router = useRouter()

const isOpen = ref(false)
const password = ref('')
const isDeleting = ref(false)


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
  } catch (error: unknown) {
    const message = error && typeof error === 'object' && 'data' in error
      ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
      : null
    notify.error(message || 'ไม่สามารถลบบัญชีได้')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <section class="-mx-2 border border-error/30 bg-default px-4 py-3 dark:border-error/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
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
        @click="open"
      />
    </div>
  </section>

  <UModal v-model:open="isOpen" title="ยืนยันการลบบัญชี" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-4">
        <div class="rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
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
