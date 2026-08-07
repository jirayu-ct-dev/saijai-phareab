<script setup lang="ts">
definePageMeta({ layout: false });

const lang = ref<'th' | 'en'>('th');

function toggleLanguage(): void {
  lang.value = lang.value === 'th' ? 'en' : 'th';
}

const content = {
  th: {
    title: 'เงื่อนไขการใช้บริการ',
    subtitle: 'กรุณาอ่านเงื่อนไขการใช้บริการอย่างละเอียดก่อนสมัครสมาชิก',
    updated: 'อัปเดตล่าสุด: 1 มกราคม 2568',
    sections: [
      {
        title: '1. การยอมรับเงื่อนไข',
        body: 'การใช้บริการ ใส่ใจ ผ้าเรียบ ถือว่าท่านได้อ่าน เข้าใจ และยอมรับเงื่อนไขการใช้บริการฉบับนี้ทุกประการ หากท่านไม่ยอมรับเงื่อนไขดังกล่าว กรุณาหยุดใช้บริการของเราทันที',
      },
      {
        title: '2. ขอบเขตการให้บริการ',
        body: 'เราให้บริการซักรีดและรับ-ส่งผ้า ทั้งบริการแบบรายครั้งและแบบแพ็กเกจสมาชิก ขอบเขตพื้นที่บริการเป็นไปตามที่บริษัทกำหนด โดยอาจมีการเปลี่ยนแปลงโดยไม่ต้องแจ้งล่วงหน้า',
      },
      {
        title: '3. ความรับผิดชอบของผู้ใช้บริการ',
        body: 'ผู้ใช้บริการมีหน้าที่ตรวจสอบทรัพย์สินในเสื้อผ้าและแจ้งรายการผ้าที่มีความเสี่ยงหรือต้องการการดูแลเป็นพิเศษ ก่อนส่งมอบให้กับพนักงาน บริษัทจะไม่รับผิดชอบต่อความเสียหายที่เกิดจากการไม่แจ้งข้อมูลดังกล่าว',
      },
      {
        title: '4. การรับประกันและข้อจำกัดความรับผิด',
        body: 'บริษัทรับประกันความเสียหายที่เกิดจากกระบวนการซักรีดของเรา ในวงเงินไม่เกิน 10 เท่าของค่าบริการในรายการนั้น บริษัทสงวนสิทธิ์ในการพิจารณาค่าชดเชยเป็นรายกรณี',
      },
      {
        title: '5. การชำระเงินและการคืนเงิน',
        body: 'ราคาค่าบริการเป็นไปตามที่แสดงในระบบ ณ ขณะสั่งซื้อ สำหรับแพ็กเกจสมาชิก ไม่สามารถขอคืนเงินได้หลังจากเปิดใช้งานแล้ว ยกเว้นกรณีที่บริษัทไม่สามารถให้บริการได้ตามที่ตกลงไว้',
      },
      {
        title: '6. การระงับและยกเลิกบัญชี',
        body: 'บริษัทสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้ที่มีพฤติกรรมละเมิดเงื่อนไขการใช้บริการ โดยไม่จำเป็นต้องแจ้งล่วงหน้า',
      },
      {
        title: '7. การเปลี่ยนแปลงเงื่อนไข',
        body: 'บริษัทสงวนสิทธิ์ในการแก้ไขเงื่อนไขการใช้บริการนี้ได้ตลอดเวลา การใช้บริการต่อเนื่องหลังจากการแก้ไข ถือว่าท่านยอมรับเงื่อนไขใหม่',
      },
      {
        title: '8. กฎหมายที่ใช้บังคับ',
        body: 'เงื่อนไขการใช้บริการนี้อยู่ภายใต้กฎหมายไทย ข้อพิพาทใด ๆ จะอยู่ภายใต้เขตอำนาจของศาลไทย',
      },
    ],
    contact: 'หากมีข้อสงสัยเกี่ยวกับเงื่อนไขการใช้บริการ กรุณาติดต่อเราผ่าน LINE OA หรืออีเมลที่แสดงในหน้าติดต่อ',
    back: 'กลับไปสมัครสมาชิก',
    switchLang: 'Read in English',
  },
  en: {
    title: 'Terms of Service',
    subtitle: 'Please read these terms carefully before creating an account.',
    updated: 'Last updated: January 1, 2025',
    sections: [
      {
        title: '1. Acceptance of Terms',
        body: 'By using Saijai Phareab services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, please stop using our services immediately.',
      },
      {
        title: '2. Scope of Services',
        body: 'We provide laundry and ironing services, including pickup and delivery, available as one-time or membership package options. Service coverage area is subject to change without prior notice.',
      },
      {
        title: '3. User Responsibilities',
        body: 'You are responsible for checking personal belongings in garments and notifying our staff of any special care requirements before handover. We are not liable for damage resulting from undisclosed information.',
      },
      {
        title: '4. Warranty & Limitation of Liability',
        body: 'We warrant against damage caused by our laundering process, limited to no more than 10 times the service fee for the affected item. Compensation is determined on a case-by-case basis.',
      },
      {
        title: '5. Payment & Refund Policy',
        body: 'Prices are as displayed in the system at the time of purchase. Membership packages are non-refundable once activated, except when we are unable to provide the agreed service.',
      },
      {
        title: '6. Account Suspension & Termination',
        body: 'We reserve the right to suspend or terminate accounts that violate these terms, without prior notice.',
      },
      {
        title: '7. Changes to Terms',
        body: 'We reserve the right to modify these Terms at any time. Continued use of our services after any modification constitutes acceptance of the new terms.',
      },
      {
        title: '8. Governing Law',
        body: 'These Terms are governed by the laws of Thailand. Any disputes shall be subject to the jurisdiction of Thai courts.',
      },
    ],
    contact: 'If you have questions about these Terms of Service, please contact us via LINE OA or the email listed on our contact page.',
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
          @click="toggleLanguage"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <!-- Header -->
      <div class="mb-10 text-center">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <UIcon name="i-lucide-file-text" class="w-7 h-7 text-primary" />
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
