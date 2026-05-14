<script setup lang="ts">
definePageMeta({ layout: false });

const lang = ref<'th' | 'en'>('th');

const content = {
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    subtitle: 'เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ',
    updated: 'อัปเดตล่าสุด: 1 มกราคม 2568',
    sections: [
      {
        title: '1. ข้อมูลที่เราเก็บรวบรวม',
        body: 'เราเก็บรวบรวมข้อมูลที่จำเป็นในการให้บริการ ได้แก่ ชื่อ-นามสกุล, อีเมล, เบอร์โทรศัพท์, ที่อยู่จัดส่ง และข้อมูลการชำระเงิน รวมถึงข้อมูลที่ได้จากการใช้งานบริการ เช่น ประวัติออเดอร์และการแจ้งเตือน',
      },
      {
        title: '2. วัตถุประสงค์ในการใช้ข้อมูล',
        body: 'เราใช้ข้อมูลของท่านเพื่อ: (1) ให้บริการซักรีดและจัดส่ง (2) ยืนยันตัวตนและป้องกันการทุจริต (3) แจ้งสถานะออเดอร์ผ่าน LINE และอีเมล (4) ปรับปรุงคุณภาพการให้บริการ',
      },
      {
        title: '3. การเปิดเผยข้อมูลแก่บุคคลที่สาม',
        body: 'เราจะไม่เปิดเผย ขาย หรือให้เช่าข้อมูลส่วนตัวของท่านแก่บุคคลที่สาม เว้นแต่ได้รับความยินยอมจากท่าน หรือเป็นข้อกำหนดทางกฎหมาย เช่น คำสั่งศาลหรือหน่วยงานราชการ',
      },
      {
        title: '4. การเชื่อมต่อ LINE',
        body: 'หากท่านเชื่อมต่อบัญชี LINE เราจะเข้าถึงเฉพาะ LINE User ID และชื่อโปรไฟล์ที่ท่านอนุญาต เพื่อส่งการแจ้งเตือนสถานะผ้าเท่านั้น เราจะไม่อ่านหรือส่งข้อความในนามของท่าน',
      },
      {
        title: '5. ความปลอดภัยของข้อมูล',
        body: 'เราใช้มาตรการรักษาความปลอดภัยระดับมาตรฐาน รวมถึงการเข้ารหัส HTTPS, การจัดเก็บรหัสผ่านแบบ hashed และการจำกัดการเข้าถึงข้อมูลเฉพาะผู้ที่มีสิทธิ์ อย่างไรก็ตาม ไม่มีระบบใดที่ปลอดภัย 100%',
      },
      {
        title: '6. สิทธิ์ของเจ้าของข้อมูล',
        body: 'ท่านมีสิทธิ์ขอดู แก้ไข หรือลบข้อมูลส่วนตัวของท่านได้ตลอดเวลา โดยติดต่อผ่านช่องทางที่เราระบุไว้ เราจะดำเนินการตามคำขอภายใน 30 วัน',
      },
      {
        title: '7. คุกกี้และการติดตาม',
        body: 'เราใช้คุกกี้เพื่อรักษาสถานะการล็อกอินและปรับปรุงประสบการณ์การใช้งาน ท่านสามารถปิดการใช้งานคุกกี้ผ่านการตั้งค่าเบราว์เซอร์ อย่างไรก็ตาม อาจส่งผลต่อการใช้งานบางส่วน',
      },
      {
        title: '8. การเปลี่ยนแปลงนโยบาย',
        body: 'เราสงวนสิทธิ์ในการแก้ไขนโยบายนี้ได้ตลอดเวลา การใช้บริการต่อเนื่องหลังจากการแก้ไข ถือว่าท่านยอมรับนโยบายใหม่',
      },
    ],
    contact: 'หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อเราผ่าน LINE OA หรือที่อยู่อีเมลในหน้าติดต่อ เราพร้อมตอบคำถามทุกข้อของท่าน',
    back: 'กลับไปสมัครสมาชิก',
    switchLang: 'Read in English',
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'We respect your privacy and are committed to protecting your personal data.',
    updated: 'Last updated: January 1, 2025',
    sections: [
      {
        title: '1. Information We Collect',
        body: 'We collect information necessary to provide our services, including: full name, email address, phone number, delivery address, and payment details, as well as usage data such as order history and notification preferences.',
      },
      {
        title: '2. How We Use Your Information',
        body: 'We use your data to: (1) Provide laundry and delivery services (2) Verify your identity and prevent fraud (3) Send order status updates via LINE and email (4) Improve our service quality.',
      },
      {
        title: '3. Third-Party Disclosure',
        body: 'We do not sell, trade, or rent your personal information to third parties. Disclosure may occur only with your consent or as required by law, such as court orders or government directives.',
      },
      {
        title: '4. LINE Integration',
        body: 'If you connect your LINE account, we only access your LINE User ID and profile name (as permitted by you) solely for sending order status notifications. We will never read or send messages on your behalf.',
      },
      {
        title: '5. Data Security',
        body: 'We implement industry-standard security measures, including HTTPS encryption, hashed password storage, and role-based access control. However, no system is 100% secure.',
      },
      {
        title: '6. Your Rights',
        body: 'You have the right to access, correct, or delete your personal data at any time by contacting us through our designated channels. We will respond to all requests within 30 days.',
      },
      {
        title: '7. Cookies & Tracking',
        body: 'We use cookies to maintain login state and improve your experience. You may disable cookies in your browser settings, though this may affect some functionality.',
      },
      {
        title: '8. Policy Changes',
        body: 'We reserve the right to update this Privacy Policy at any time. Continued use of our services after any changes constitutes acceptance of the updated policy.',
      },
    ],
    contact: 'If you have questions about this Privacy Policy, please contact us via LINE OA or the email address on our contact page. We are happy to address all your concerns.',
    back: 'Back to Register',
    switchLang: 'อ่านภาษาไทย',
  },
};

const t = computed(() => content[lang.value]);
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
    <!-- Top bar -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/auth/register"
            size="sm"
          />
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <UIcon name="i-lucide-washing-machine" class="w-4 h-4 text-white" />
            </div>
            <span class="font-bold text-gray-900 dark:text-white text-sm">ใส่ใจ ผ้าเรียบ</span>
          </div>
        </div>

        <UButton
          :label="t.switchLang"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-languages"
          @click="lang = lang === 'th' ? 'en' : 'th'"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <!-- Header -->
      <div class="mb-10 text-center">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <UIcon name="i-lucide-shield-check" class="w-7 h-7 text-primary" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t.title }}</h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm">{{ t.subtitle }}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">{{ t.updated }}</p>
      </div>

      <!-- Sections -->
      <div class="space-y-6">
        <div
          v-for="section in t.sections"
          :key="section.title"
          class="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <h2 class="text-base font-bold text-gray-900 dark:text-white mb-2">{{ section.title }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ section.body }}</p>
        </div>
      </div>

      <!-- Contact note -->
      <div class="mt-8 p-5 bg-primary/5 border border-primary/20 rounded-2xl flex gap-3">
        <UIcon name="i-lucide-info" class="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{{ t.contact }}</p>
      </div>

      <!-- Back button -->
      <div class="mt-10 text-center">
        <UButton
          :label="t.back"
          color="primary"
          variant="soft"
          to="/auth/register"
          icon="i-lucide-arrow-left"
          size="lg"
        />
      </div>
    </div>
  </div>
</template>
