<script setup lang="ts">
import ThermalSlip from "~~/app/components/thermal/ThermalSlip.vue";
import ReceiptDocument from "~~/app/components/print/ReceiptDocument.vue";
import type { ReceiptPayload } from "~~/shared/types/receipt";

definePageMeta({ layout: "admin", middleware: ["role-employee"] });

const route = useRoute();
const router = useRouter();
const paymentId = computed(() => String(route.params.id ?? ""));
const notify = useNotify();
const { settings: shopSettings } = useAdminShopSettings();
const { state: printerState, send } = useThermalPrinter();
const { createJob } = useAdminPrintJobs();

const { data, status, refresh, error } = useFetch<ReceiptPayload>(
  () => `/api/admin/payments/${paymentId.value}/receipt`,
  { key: () => `payment-receipt-${paymentId.value}`, lazy: true, server: false },
);

watch(error, (err) => {
  const code = (err as { statusCode?: number } | null)?.statusCode;
  if (code === 409) router.replace(`/admin/payment/${paymentId.value}/quotation`);
}, { immediate: true });

const isLoading = computed(() => status.value === "pending" || status.value === "idle");
const hasError = computed(() => Boolean(error.value) || !data.value);
const receiptCode = computed(() => {
  const extras = (data.value ?? {}) as { receiptNo?: string | null };
  return extras.receiptNo || data.value?.paymentNo || `RC-${paymentId.value.slice(-8).toUpperCase()}`;
});

// ── Actions: server-rendered PDF / PNG / ESC-POS ────────────────────────────

const isDownloadingPdf = ref(false);
const isDownloadingPng = ref(false);
const isPrinting = ref(false);
const isQueueing = ref(false);

async function fetchDocument(format: "pdf" | "png" | "escpos") {
  const width = printerState.value.paperWidth === 58 ? 384 : 576;
  const blob = await $fetch<Blob>(`/api/admin/payments/${paymentId.value}/document`, {
    query: { type: "receipt", format, width },
    responseType: "blob",
  });
  return blob;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleDownloadPdf() {
  if (!data.value) return;
  isDownloadingPdf.value = true;
  try {
    const blob = await fetchDocument("pdf");
    triggerDownload(blob, `${receiptCode.value}.pdf`);
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "ดาวน์โหลด PDF ไม่สำเร็จ");
  } finally {
    isDownloadingPdf.value = false;
  }
}

async function handleDownloadPng() {
  if (!data.value) return;
  isDownloadingPng.value = true;
  try {
    const blob = await fetchDocument("png");
    triggerDownload(blob, `${receiptCode.value}.png`);
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "ดาวน์โหลด PNG ไม่สำเร็จ");
  } finally {
    isDownloadingPng.value = false;
  }
}

// PRN-06: queue-based printing — server snapshot + bridge, supports every
// transport registered on the printer profile (RECEIPT -> paymentId).
async function handlePrintQueue() {
  isQueueing.value = true;
  try {
    await createJob({ kind: "RECEIPT", documentId: paymentId.value });
  } finally {
    isQueueing.value = false;
  }
}

async function handlePrint() {
  if (!data.value) return;
  if (!printerState.value.isConnected) {
    notify.error("ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ — กดไอคอนเครื่องพิมพ์เพื่อเชื่อมต่อก่อน");
    return;
  }
  isPrinting.value = true;
  try {
    const blob = await fetchDocument("escpos");
    const buf = new Uint8Array(await blob.arrayBuffer());
    await send(buf);
    notify.success("ส่งงานพิมพ์เรียบร้อย");
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการพิมพ์");
  } finally {
    isPrinting.value = false;
  }
}
</script>

<template>
  <ThermalSlip
    panel-id="payment-receipt"
    navbar-title="ใบเสร็จ"
    navbar-icon="i-lucide-receipt"
    :file-name="receiptCode"
    :is-loading="isLoading"
    :has-error="hasError"
    fallback-path="/admin/payment"
    empty-title="ไม่พบข้อมูลใบเสร็จ"
    print-label="พิมพ์ใบเสร็จ"
    print-mode="both"
    :is-printing="isPrinting"
    :is-queueing="isQueueing"
    :is-downloading-pdf="isDownloadingPdf"
    :is-downloading-png="isDownloadingPng"
    @retry="refresh()"
    @print-queue="handlePrintQueue"
    @print="handlePrint"
    @download-pdf="handleDownloadPdf"
    @download-png="handleDownloadPng"
  >
    <ReceiptDocument v-if="data" :data="data" :shop="shopSettings ?? null" />
  </ThermalSlip>
</template>
