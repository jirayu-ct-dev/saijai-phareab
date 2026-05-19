<script setup lang="ts">
import ProfileForm from "~~/app/components/account/ProfileForm.vue";
import EmailVerificationSection from "~~/app/components/account/EmailVerificationSection.vue";
import LineLinkSection from "~~/app/components/account/LineLinkSection.vue";
import NotificationPreferenceForm from "~~/app/components/account/NotificationPreferenceForm.vue";
import PasswordChangeForm from "~~/app/components/account/PasswordChangeForm.vue";
import ActiveSessionsList from "~~/app/components/account/ActiveSessionsList.vue";
import DeleteAccountSection from "~~/app/components/account/DeleteAccountSection.vue";

const props = withDefaults(defineProps<{
  /** URL ที่ใช้ redirect กลับหลังยืนยันอีเมล */
  callbackUrl: string
  /** แสดง section ลบบัญชี (default: true) */
  showDangerZone?: boolean
}>(), {
  showDangerZone: true,
})
</script>

<template>
  <div class="space-y-8">
    <!-- ข้อมูลส่วนตัว -->
    <section class="space-y-3">
      <h2 class="px-1 text-xs font-semibold uppercase tracking-widest text-muted">
        ข้อมูลส่วนตัว
      </h2>
      <ProfileForm />
      <EmailVerificationSection :callback-url="props.callbackUrl" />
      <LineLinkSection />
      <NotificationPreferenceForm />
    </section>

    <!-- ความปลอดภัย -->
    <section class="space-y-3">
      <h2 class="px-1 text-xs font-semibold uppercase tracking-widest text-muted">
        ความปลอดภัย
      </h2>
      <PasswordChangeForm />
      <ActiveSessionsList />
    </section>

    <!-- โซนอันตราย -->
    <section v-if="props.showDangerZone" class="space-y-3">
      <h2 class="px-1 text-xs font-semibold uppercase tracking-widest text-error/70">
        โซนอันตราย
      </h2>
      <DeleteAccountSection />
    </section>
  </div>
</template>
