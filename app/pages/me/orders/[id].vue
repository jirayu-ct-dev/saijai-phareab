<script setup lang="ts">
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const route = useRoute();
const { order, pending } = useMyOrderDetail(route.params.id as string);

const orderSteps = [
  { value: "RECEIVED", label: "รับผ้าแล้ว", icon: "i-lucide-package" },
  { value: "PROCESSING", label: "กำลังดำเนินการ", icon: "i-lucide-loader" },
  { value: "DELIVERING", label: "พร้อมส่ง", icon: "i-lucide-truck" },
  { value: "COMPLETED", label: "เสร็จสิ้น", icon: "i-lucide-check-circle" },
];

const currentStepIndex = computed(() => {
  if (!order.value) return -1;
  if (order.value.status === "CANCELLED") return -1;
  return orderSteps.findIndex((s) => s.value === order.value?.status);
});

const getStepClass = (index: number) => {
  if (!order.value) return "bg-elevated text-dimmed";
  if (order.value.status === "CANCELLED") return "bg-error text-white";
  if (index < currentStepIndex.value) return "bg-success text-white";
  if (index === currentStepIndex.value) return "bg-primary text-white ring-4 ring-primary/20 scale-110";
  return "bg-elevated text-dimmed";
};
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar :title="order?.orderNo ? `ออเดอร์ ${order.orderNo}` : 'รายละเอียดออเดอร์'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton color="neutral" variant="ghost" to="/me/orders" icon="i-lucide-arrow-left">กลับ</UButton>
        </template>
      </UDashboardNavbar>

      <div v-if="pending" class="p-6 space-y-4">
        <USkeleton class="h-8 w-1/3" />
        <USkeleton class="h-32 w-full" />
      </div>

      <div v-else-if="!order" class="p-12 text-center">
        <UIcon name="i-lucide-file-question" class="h-12 w-12 text-dimmed mx-auto mb-4" />
        <p class="text-muted">ไม่พบออเดอร์ที่ต้องการ</p>
        <UButton to="/me/orders" color="neutral" class="mt-4">กลับไปรายการออเดอร์</UButton>
      </div>

      <div v-else class="p-6 max-w-4xl mx-auto space-y-8 w-full">
        <!-- Timeline -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">สถานะออเดอร์</h3>
          </template>
          
          <div v-if="order.status === 'CANCELLED'" class="text-center py-6">
            <UIcon name="i-lucide-x-circle" class="h-16 w-16 text-error mx-auto mb-4" />
            <h4 class="text-xl font-bold text-error">ยกเลิกแล้ว</h4>
            <p class="text-muted mt-2">ออเดอร์นี้ถูกยกเลิกแล้ว กรุณาติดต่อร้านหากมีข้อสงสัย</p>
          </div>
          
          <div v-else class="relative flex items-center justify-between py-4">
            <!-- Background Line -->
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-elevated z-0 rounded-full overflow-hidden">
               <div class="h-full bg-primary transition-all duration-500" :style="{ width: `${currentStepIndex > 0 ? (currentStepIndex / (orderSteps.length - 1)) * 100 : 0}%` }" />
            </div>
            
            <div v-for="(step, index) in orderSteps" :key="step.value" class="relative z-10 flex flex-col items-center gap-2">
              <div 
                class="flex h-10 w-10 items-center justify-center rounded-full border-4 border-default transition-all duration-300"
                :class="[
                  getStepClass(index),
                  index === currentStepIndex ? 'animate-pulse' : ''
                ]"
              >
                <UIcon :name="step.icon" class="h-5 w-5" />
              </div>
              <span class="text-sm font-medium" :class="index <= currentStepIndex ? 'text-highlighted' : 'text-muted'">{{ step.label }}</span>
            </div>
          </div>
        </UCard>

        <!-- Order Details -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">ข้อมูลออเดอร์</h3>
            </template>
            <dl class="space-y-4">
              <div class="flex justify-between">
                <dt class="text-muted">เลขรับผ้า</dt>
                <dd class="font-medium">{{ order.orderNo || '-' }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">วันที่รับ</dt>
                <dd class="font-medium">{{ formatDateTime(order.receivedAt) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">นัดรับ/ส่ง</dt>
                <dd class="font-medium">{{ order.dueAt ? formatDateTime(order.dueAt) : '-' }}</dd>
              </div>
              <div v-if="order.employee" class="flex justify-between">
                <dt class="text-muted">พนักงานที่รับผ้า</dt>
                <dd class="font-medium">{{ order.employee.name }}</dd>
              </div>
              <div v-if="order.note" class="pt-4 border-t border-default">
                <dt class="text-muted mb-1">หมายเหตุ</dt>
                <dd class="text-sm">{{ order.note }}</dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">รูปภาพ</h3>
            </template>
            <div class="space-y-6">
              <div v-if="order.image">
                <p class="text-sm text-muted mb-2">รูปถ่ายตอนรับผ้า</p>
                <img :src="order.image.secureUrl || order.image.url || ''" alt="รูปรับผ้า" class="rounded-md max-h-48 object-cover w-full" />
              </div>
              <div v-if="order.deliveryImage">
                <p class="text-sm text-muted mb-2">รูปถ่ายหลักฐานการส่ง</p>
                <img :src="order.deliveryImage.secureUrl || order.deliveryImage.url || ''" alt="รูปส่งผ้า" class="rounded-md max-h-48 object-cover w-full" />
              </div>
              <div v-if="!order.image && !order.deliveryImage" class="text-center py-8 text-muted">
                ไม่มีรูปภาพ
              </div>
            </div>
          </UCard>
        </div>

        <!-- Items -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">รายการบริการ</h3>
          </template>
          
          <div class="space-y-4">
            <div v-for="item in order.items" :key="item.id" class="flex justify-between py-3 border-b border-default last:border-0">
              <div>
                <p class="font-medium">{{ item.label }}</p>
                <p v-if="item.notes" class="text-xs text-muted">{{ item.notes }}</p>
                <div v-if="item.photos && item.photos.length > 0" class="flex gap-2 mt-2">
                  <img v-for="photo in item.photos" :key="photo.id" :src="photo.secureUrl || photo.url || ''" class="w-12 h-12 rounded-md object-cover border" :class="photo.isDamaged ? 'border-error' : 'border-default'" />
                </div>
              </div>
              <div class="text-right">
                <p>{{ formatCurrency(item.unitPrice) }} x {{ item.quantity }}</p>
                <p v-if="item.isPackageIncluded" class="text-sm text-primary font-medium">ใช้เครดิตแพ็กเกจ</p>
                <p v-else class="font-semibold">{{ formatCurrency(item.totalPrice) }}</p>
              </div>
            </div>
            
            <div class="pt-4 space-y-2">
              <div class="flex justify-between text-muted">
                <span>รวมค่าบริการ</span>
                <span>{{ formatCurrency(order.subtotalAmount) }}</span>
              </div>
              <div v-if="order.hangerCharge?.total && order.hangerCharge.total > 0" class="flex justify-between text-muted">
                <span>ค่าไม้แขวน ({{ order.hangerCharge?.count || 0 }} ชิ้น)</span>
                <span>{{ formatCurrency(order.hangerCharge?.total || 0) }}</span>
              </div>
              <div v-if="order.discountAmount > 0" class="flex justify-between text-success">
                <span>ส่วนลด</span>
                <span>-{{ formatCurrency(order.discountAmount) }}</span>
              </div>
              <div class="flex justify-between font-bold text-lg pt-2 border-t border-default">
                <span>ยอดสุทธิ</span>
                <span>{{ formatCurrency(order.totalAmount) }}</span>
              </div>
            </div>
          </div>
          
          <template #footer v-if="order.payment">
            <div class="flex justify-between items-center">
              <p class="text-sm text-muted">ชำระเงินแล้ว (บิล: {{ order.payment.paymentNo }})</p>
              <UButton :to="`/me/receipts/${order.payment.id}`" variant="soft">ดูใบเสร็จ</UButton>
            </div>
          </template>
        </UCard>
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
