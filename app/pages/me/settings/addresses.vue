<script setup lang="ts">
import { z } from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const { addresses, pending, refresh, addAddress, updateAddress, deleteAddress } = useUserAddresses();
const notify = useNotify();

const isModalOpen = ref(false);
const isDeleting = ref(false);
const showDeleteModal = ref(false);
const deleteConfirmId = ref<string | null>(null);
const editingAddress = ref<any>(null);

const schema = z.object({
  address: z.string().min(5, "กรุณากรอกที่อยู่ให้ครบถ้วน"),
  subdistrict: z.string().min(1, "กรุณากรอกแขวง/ตำบล"),
  district: z.string().min(1, "กรุณากรอกเขต/อำเภอ"),
  province: z.string().min(1, "กรุณากรอกจังหวัด"),
  postalCode: z.string().length(5, "รหัสไปรษณีย์ต้องมี 5 หลัก"),
  isDefault: z.boolean(),
});

type Schema = z.output<typeof schema>;

const state = reactive({
  address: "",
  subdistrict: "",
  district: "",
  province: "",
  postalCode: "",
  isDefault: false,
});

const openAdd = () => {
  editingAddress.value = null;
  state.address = "";
  state.subdistrict = "";
  state.district = "";
  state.province = "";
  state.postalCode = "";
  state.isDefault = addresses.value.length === 0; // Default if first address
  isModalOpen.value = true;
};

const openEdit = (addr: any) => {
  editingAddress.value = addr;
  state.address = addr.address || "";
  state.subdistrict = addr.subdistrict || "";
  state.district = addr.district || "";
  state.province = addr.province || "";
  state.postalCode = addr.postalCode || "";
  state.isDefault = addr.isDefault || false;
  isModalOpen.value = true;
};

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  try {
    if (editingAddress.value) {
      await updateAddress(editingAddress.value.id, event.data);
      notify.success("แก้ไขที่อยู่สำเร็จ");
    } else {
      await addAddress(event.data);
      notify.success("เพิ่มที่อยู่สำเร็จ");
    }
    isModalOpen.value = false;
    refresh();
  } catch (err: any) {
    notify.error(err.message || "เกิดข้อผิดพลาด");
  }
};

const confirmDelete = (id: string) => {
  deleteConfirmId.value = id;
  showDeleteModal.value = true;
};

const closeAddressModal = (): void => {
  isModalOpen.value = false;
};

const closeDeleteModal = (): void => {
  showDeleteModal.value = false;
};

const handleDelete = async () => {
  if (!deleteConfirmId.value) return;
  isDeleting.value = true;
  try {
    await deleteAddress(deleteConfirmId.value);
    notify.success("ลบที่อยู่สำเร็จ");
    deleteConfirmId.value = null;
    showDeleteModal.value = false;
    refresh();
  } catch (err: any) {
    notify.error(err.message || "เกิดข้อผิดพลาด");
  } finally {
    isDeleting.value = false;
  }
};
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-3 p-2 sm:p-6">
    <!-- Header Card with Add button -->
    <div class="rounded-md border border-default/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55 flex justify-between items-center">
      <div>
        <h1 class="text-xl font-semibold">ที่อยู่จัดส่ง</h1>
        <p class="mt-1 text-sm font-normal text-toned">จัดการที่อยู่ของคุณสำหรับรับ-ส่งผ้า</p>
      </div>
      <UButton 
        color="primary" 
        icon="i-lucide-plus" 
        @click="openAdd"
      >
        เพิ่มที่อยู่
      </UButton>
    </div>

    <!-- Main Content -->
    <div class="space-y-4">
      <div v-if="pending" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-32 w-full rounded-md" />
      </div>

      <div v-else-if="addresses.length === 0" class="flex flex-col items-center justify-center py-20 text-center bg-elevated rounded-md border border-dashed border-default">
        <UIcon name="i-lucide-map-pin" class="h-16 w-16 text-dimmed mb-4" />
        <h3 class="text-lg font-semibold text-highlighted">ยังไม่มีข้อมูลที่อยู่จัดส่ง</h3>
        <p class="text-muted max-w-xs mx-auto mb-6">เพิ่มที่อยู่ของคุณเพื่อความสะดวกในการเรียกใช้บริการรับ-ส่งผ้า</p>
        <UButton color="primary" icon="i-lucide-plus" size="lg" @click="openAdd">เพิ่มที่อยู่ใหม่</UButton>
      </div>

      <div v-else class="grid grid-cols-1 gap-4">
        <UCard 
          v-for="addr in addresses" 
          :key="addr.id"
          class="group hover:border-primary transition-colors"
        >
          <div class="flex justify-between items-start">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <UBadge v-if="addr.isDefault" color="primary" variant="subtle">ที่อยู่หลัก</UBadge>
              </div>
              <p class="text-highlighted font-medium leading-relaxed">
                {{ addr.address }}
              </p>
              <p class="text-sm text-muted">
                {{ addr.subdistrict }}, {{ addr.district }}, {{ addr.province }} {{ addr.postalCode }}
              </p>
            </div>
            
            <div class="flex gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-edit-2"
                @click="openEdit(addr)"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="confirmDelete(addr.id)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <UModal v-model:open="isModalOpen" :title="editingAddress ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'">
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="ที่อยู่ (บ้านเลขที่, หมู่บ้าน, ซอย, ถนน)" name="address">
            <UTextarea v-model="state.address" placeholder="เช่น 123/45 หมู่บ้านไทยเจริญ ซอย 5 ถนนสุขุมวิท" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="แขวง/ตำบล" name="subdistrict">
              <UInput v-model="state.subdistrict" placeholder="แขวง/ตำบล" />
            </UFormField>
            <UFormField label="เขต/อำเภอ" name="district">
              <UInput v-model="state.district" placeholder="เขต/อำเภอ" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="จังหวัด" name="province">
              <UInput v-model="state.province" placeholder="จังหวัด" />
            </UFormField>
            <UFormField label="รหัสไปรษณีย์" name="postalCode">
              <UInput v-model="state.postalCode" placeholder="รหัสไปรษณีย์" />
            </UFormField>
          </div>

          <UFormField name="isDefault">
            <UCheckbox v-model="state.isDefault" label="ตั้งเป็นที่อยู่หลัก" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton color="neutral" variant="ghost" @click="closeAddressModal">ยกเลิก</UButton>
            <UButton type="submit" color="primary">บันทึก</UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete Confirmation -->
    <UModal v-model:open="showDeleteModal" title="ยืนยันการลบ">
      <template #body>
        <p class="py-4">คุณต้องการลบที่อยู่นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="closeDeleteModal">ยกเลิก</UButton>
          <UButton color="error" :loading="isDeleting" @click="handleDelete">ลบทิ้ง</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
