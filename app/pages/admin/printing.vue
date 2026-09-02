<script setup lang="ts">
import type {
  PaperWidthMm,
  PrintableDots,
  PrintRenderMode,
  PrinterCapabilities,
  PrintJobStatus,
  PrintTransport,
} from "~~/shared/types/printing";
import type { AdminPrinter } from "~~/app/composables/useAdminPrinters";
import { isPrinterHeartbeatFresh } from "~~/app/composables/useAdminPrinters";
import type { PrinterFormValue } from "~~/app/utils/printFormOptions";
import type { AdminPrintJob, PrintJobResolution } from "~~/app/composables/useAdminPrintJobs";
import {
  PRINT_JOB_STATUS_BADGES,
  PRINT_JOB_REPRINTABLE_STATUSES,
  PRINT_JOB_KIND_LABELS,
  PRINT_JOB_STATUS_FILTER_OPTIONS,
} from "~~/app/composables/useAdminPrintJobs";
import { formatDateTime, formatCurrency } from "~~/shared/utils/format";

definePageMeta({
  layout: "admin",
  middleware: ["role-admin"],
});

const notify = useNotify();

const {
  printers,
  isLoading: printerLoading,
  error: printerError,
  refresh: refreshPrinters,
  createPrinter,
  updatePrinter,
  rotateCredential,
  deletePrinter,
} = useAdminPrinters();

const printer = computed<AdminPrinter | null>(() => printers.value[0] ?? null);

const {
  jobs,
  statusFilter,
  isLoading: jobsLoading,
  error: jobsError,
  refresh: refreshJobs,
  resolveJob,
  reprintJob,
} = useAdminPrintJobs({ printerId: () => printer.value?.id });

// ---- Heartbeat freshness (re-evaluated on a short interval) ----
const nowMs = ref(Date.now());
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  heartbeatTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 30_000);
});
onBeforeUnmount(() => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});

const isPrinterOnline = computed(() =>
  isPrinterHeartbeatFresh(printer.value?.lastHeartbeatAt, nowMs.value),
);

const hydrated = ref(false);
onMounted(() => {
  hydrated.value = true;
});
const showPrinterSkeleton = computed(() => !hydrated.value || printerLoading.value);

const getBadge = (status: PrintJobStatus) => PRINT_JOB_STATUS_BADGES[status];

const formatHeartbeat = (value: string | null) => (value ? formatDateTime(value) : null);

// ============================
// Section 1: printer setup form (shown only when no printer exists)
// Option lists and capability items are shared with the edit form via
// app/utils/printFormOptions.ts (Nuxt auto-imports).

const setupForm = reactive({
  name: "",
  defaultTransport: "WIFI" as PrintTransport,
  paperWidthMm: 80 as PaperWidthMm,
  printableDots: 576 as PrintableDots,
  renderMode: "HYBRID" as PrintRenderMode,
  capabilities: {
    partialCut: false,
    nativeQr: false,
    nativeBarcode: false,
    pdf417: false,
    nvLogo: false,
    buzzer: false,
    statusQuery: false,
    cashDrawer: false,
    blackMark: false,
  } as PrinterCapabilities,
});

const isCreatingPrinter = ref(false);

const onSubmitCreatePrinter = async () => {
  if (!setupForm.name.trim()) {
    notify.validationError("กรุณาตั้งชื่อเครื่องพิมพ์");
    return;
  }

  isCreatingPrinter.value = true;
  const ok = await createPrinter({
    name: setupForm.name.trim(),
    defaultTransport: setupForm.defaultTransport,
    paperWidthMm: setupForm.paperWidthMm,
    printableDots: setupForm.printableDots,
    renderMode: setupForm.renderMode,
    capabilities: { ...setupForm.capabilities },
    isActive: true,
  });
  isCreatingPrinter.value = false;
};

// ============================
// Section 1: printer profile edit (printer exists)
// ============================

const showEditPrinterForm = ref(false);
const isUpdatingPrinter = ref(false);

const editForm = reactive<PrinterFormValue>({
  name: "",
  defaultTransport: "WIFI",
  paperWidthMm: 80,
  printableDots: 576,
  renderMode: "HYBRID",
  capabilities: {
    partialCut: false,
    nativeQr: false,
    nativeBarcode: false,
    pdf417: false,
    nvLogo: false,
    buzzer: false,
    statusQuery: false,
    cashDrawer: false,
    blackMark: false,
  },
});

const openEditPrinterForm = () => {
  if (!printer.value) return;
  editForm.name = printer.value.name;
  editForm.defaultTransport = printer.value.defaultTransport;
  editForm.paperWidthMm = printer.value.paperWidthMm;
  editForm.printableDots = printer.value.printableDots;
  editForm.renderMode = printer.value.renderMode;
  editForm.capabilities = { ...printer.value.capabilities };
  showEditPrinterForm.value = true;
};

const onSubmitUpdatePrinter = async () => {
  if (!printer.value) return;
  if (!editForm.name.trim()) {
    notify.validationError("กรุณาตั้งชื่อเครื่องพิมพ์");
    return;
  }
  isUpdatingPrinter.value = true;
  const ok = await updatePrinter(printer.value.id, {
    name: editForm.name.trim(),
    defaultTransport: editForm.defaultTransport,
    paperWidthMm: editForm.paperWidthMm,
    printableDots: editForm.printableDots,
    renderMode: editForm.renderMode,
    capabilities: { ...editForm.capabilities },
  });
  isUpdatingPrinter.value = false;
  if (ok) showEditPrinterForm.value = false;
};

// ============================
// Section 1: credential rotation (token shown ONCE)
// ============================

const showRotateConfirm = ref(false);
const isRotating = ref(false);
const rotatedToken = ref<string | null>(null);
const rotatedCredentialVersion = ref<number | null>(null);
const showTokenModal = ref(false);

const confirmRotateCredential = async () => {
  if (!printer.value) return;
  isRotating.value = true;
  const result = await rotateCredential(printer.value.id);
  isRotating.value = false;
  showRotateConfirm.value = false;
  if (result) {
    rotatedToken.value = result.token;
    rotatedCredentialVersion.value = result.credentialVersion;
    showTokenModal.value = true;
  }
};

const copyToken = async () => {
  if (!rotatedToken.value) return;
  await navigator.clipboard.writeText(rotatedToken.value);
  notify.success("คัดลอกรหัส Bridge แล้ว");
};

const closeTokenModal = () => {
  showTokenModal.value = false;
  rotatedToken.value = null;
  rotatedCredentialVersion.value = null;
};

// ============================
// Section 1: delete printer
// ============================

const showDeletePrinterConfirm = ref(false);
const isDeletingPrinter = ref(false);

const confirmDeletePrinter = async () => {
  if (!printer.value) return;
  isDeletingPrinter.value = true;
  const ok = await deletePrinter(printer.value.id);
  isDeletingPrinter.value = false;
  if (ok) showDeletePrinterConfirm.value = false;
};

// ============================
// Section 2: queue actions
// ============================

const showJobsSkeleton = computed(() => !hydrated.value || jobsLoading.value);

const canReprint = (job: AdminPrintJob) =>
  PRINT_JOB_REPRINTABLE_STATUSES.includes(job.status);

// Explicit reprint — requires a human confirmation first.
const reprintTarget = ref<AdminPrintJob | null>(null);
const showReprintConfirm = ref(false);
const isReprinting = ref(false);

const openReprintConfirm = (job: AdminPrintJob) => {
  reprintTarget.value = job;
  showReprintConfirm.value = true;
};

const confirmReprint = async () => {
  if (!reprintTarget.value) return;
  isReprinting.value = true;
  const ok = await reprintJob(reprintTarget.value.id);
  isReprinting.value = false;
  if (ok) {
    showReprintConfirm.value = false;
    reprintTarget.value = null;
  }
};

// Needs-review resolution — two explicit choices + optional note.
const resolveTarget = ref<AdminPrintJob | null>(null);
const showResolveModal = ref(false);
const resolveChoice = ref<PrintJobResolution | null>(null);
const resolveNote = ref("");
const isResolving = ref(false);

const openResolveModal = (job: AdminPrintJob) => {
  resolveTarget.value = job;
  resolveChoice.value = null;
  resolveNote.value = "";
  showResolveModal.value = true;
};

watch(showResolveModal, (open) => {
  if (!open) {
    resolveTarget.value = null;
    resolveChoice.value = null;
    resolveNote.value = "";
  }
});

const confirmResolve = async () => {
  if (!resolveTarget.value || !resolveChoice.value) return;
  isResolving.value = true;
  const ok = await resolveJob(resolveTarget.value.id, resolveChoice.value, resolveNote.value);
  isResolving.value = false;
  if (ok) {
    showResolveModal.value = false;
  }
};

const getLatestTimelineNote = (job: AdminPrintJob) =>
  job.timeline.length > 0 ? (job.timeline[job.timeline.length - 1]?.note ?? null) : null;

const handleRefreshAll = async () => {
  await Promise.all([refreshPrinters(), refreshJobs()]);
};
</script>

<template>
  <UDashboardPanel id="printing">
    <template #header>
      <UDashboardNavbar title="ระบบพิมพ์" icon="i-lucide-printer">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <UIButtonRefresh :loading="showPrinterSkeleton || showJobsSkeleton" @refresh="handleRefreshAll" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
        <!-- ==================== Section 1: เครื่องพิมพ์ ==================== -->
        <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">เครื่องพิมพ์</h2>
              <p class="mt-0.5 text-sm text-muted">โปรไฟล์เครื่องพิมพ์ใบเสร็จ/ใบแจ้งราคาของร้าน</p>
            </div>
            <UBadge
              v-if="printer"
              :color="isPrinterOnline ? 'success' : 'neutral'"
              variant="subtle"
              :icon="isPrinterOnline ? 'i-lucide-wifi' : 'i-lucide-help-circle'"
            >
              {{ isPrinterOnline ? "ออนไลน์" : "ไม่ทราบสถานะ" }}
            </UBadge>
          </div>
        </section>

        <!-- Printer error state -->
        <section
          v-if="hydrated && printerError && !printerLoading && !printer"
          class="-mx-2 flex flex-col items-center justify-center border border-dashed border-error/40 bg-error/5 px-3 py-6 text-center sm:mx-0 sm:rounded-lg"
        >
          <UIcon name="i-lucide-server-off" class="mb-2 size-8 text-error" />
          <p class="text-sm text-muted">ไม่สามารถโหลดข้อมูลเครื่องพิมพ์ได้</p>
          <UButton label="ลองใหม่" variant="soft" color="primary" size="sm" class="mt-3" @click="refreshPrinters()" />
        </section>

        <!-- Printer loading skeleton -->
        <section v-else-if="showPrinterSkeleton" class="-mx-2 space-y-3 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <USkeleton class="h-4 w-40 rounded-lg" />
          <USkeleton class="h-9 w-full rounded-lg" />
          <USkeleton class="h-9 w-full rounded-lg" />
          <USkeleton class="h-9 w-40 rounded-lg" />
        </section>

        <!-- Printer profile exists -->
        <section
          v-else-if="printer"
          class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
        >
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <p class="min-w-0 truncate text-base font-semibold text-highlighted">{{ printer.name }}</p>
              <UBadge :color="printer.isActive ? 'success' : 'warning'" variant="subtle" size="xs">
                {{ printer.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน" }}
              </UBadge>
              <UBadge color="info" variant="subtle" size="xs">{{ printer.model }}</UBadge>
            </div>

            <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div class="flex justify-between gap-3 sm:block">
                <dt class="text-muted">การเชื่อมต่อหลัก</dt>
                <dd class="font-medium text-highlighted">
                  {{ TRANSPORT_OPTIONS.find((o) => o.value === printer!.defaultTransport)?.label ?? printer.defaultTransport }}
                </dd>
              </div>
              <div class="flex justify-between gap-3 sm:block">
                <dt class="text-muted">ความกว้างกระดาษ</dt>
                <dd class="font-medium text-highlighted">{{ printer.paperWidthMm }} มม.</dd>
              </div>
              <div class="flex justify-between gap-3 sm:block">
                <dt class="text-muted">ความละเอียดพิมพ์</dt>
                <dd class="font-medium text-highlighted">{{ printer.printableDots }} จุด</dd>
              </div>
              <div class="flex justify-between gap-3 sm:block">
                <dt class="text-muted">โหมดเรนเดอร์</dt>
                <dd class="font-medium text-highlighted">{{ printer.renderMode }}</dd>
              </div>
              <div class="flex justify-between gap-3 sm:block">
                <dt class="text-muted">Heartbeat ล่าสุด</dt>
                <dd class="font-medium text-highlighted">{{ formatHeartbeat(printer.lastHeartbeatAt) ?? "ไม่เคยรายงาน" }}</dd>
              </div>
              <div class="flex justify-between gap-3 sm:block">
                <dt class="text-muted">เวอร์ชัน Bridge</dt>
                <dd class="font-medium text-highlighted">{{ printer.bridgeVersion ?? "ไม่ทราบ" }}</dd>
              </div>
            </dl>

            <div>
              <p class="mb-1.5 text-sm text-muted">ความสามารถที่เปิดใช้งาน</p>
              <div class="flex flex-wrap gap-1.5">
                <template v-if="CAPABILITY_ITEMS.filter((item) => printer!.capabilities[item.key]).length">
                  <UBadge
                    v-for="item in CAPABILITY_ITEMS.filter((item) => printer!.capabilities[item.key])"
                    :key="item.key"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >
                    {{ item.label }}
                  </UBadge>
                </template>
                <p v-else class="text-sm text-muted">ไม่ได้เปิดความสามารถเสริมใด ๆ</p>
              </div>
            </div>

            <div class="flex flex-wrap justify-end gap-2 border-t border-default pt-3">
              <UButton
                :label="showEditPrinterForm ? 'ยกเลิกการแก้ไข' : 'แก้ไขโปรไฟล์'"
                :icon="showEditPrinterForm ? 'i-lucide-x' : 'i-lucide-pencil'"
                color="neutral"
                variant="soft"
                @click="showEditPrinterForm ? (showEditPrinterForm = false) : openEditPrinterForm()"
              />
              <UButton
                label="หมุนเวียนรหัส Bridge"
                icon="i-lucide-key-round"
                color="primary"
                variant="soft"
                @click="showRotateConfirm = true"
              />
              <UButton
                label="ลบเครื่องพิมพ์"
                icon="i-lucide-trash-2"
                color="error"
                variant="soft"
                @click="showDeletePrinterConfirm = true"
              />
            </div>

            <UForm
              v-if="showEditPrinterForm"
              :state="editForm"
              class="space-y-4 rounded-lg border border-default/40 bg-default/50 p-3"
              @submit="onSubmitUpdatePrinter"
            >
              <AdminPrinterForm v-model="editForm" />

              <div class="flex justify-end gap-2 border-t border-default pt-3">
                <UButton
                  label="ยกเลิก"
                  color="neutral"
                  variant="ghost"
                  @click="showEditPrinterForm = false"
                />
                <UButton type="submit" :loading="isUpdatingPrinter" icon="i-lucide-save">
                  บันทึกการแก้ไข
                </UButton>
              </div>
            </UForm>
          </div>
        </section>

        <!-- Printer empty state: setup form -->
        <section
          v-else
          class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
        >
          <div class="mb-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-4 text-center text-muted">
            <UIcon name="i-lucide-printer" class="mb-2 size-8 opacity-60" />
            <p class="text-sm">ยังไม่มีเครื่องพิมพ์ที่ลงทะเบียนในระบบ (รองรับเครื่องเดียวในเวอร์ชันนี้)</p>
          </div>

          <UForm :state="setupForm" class="space-y-4" @submit="onSubmitCreatePrinter">
            <AdminPrinterForm v-model="setupForm" />

            <div class="flex justify-end border-t border-default pt-3">
              <UButton type="submit" :loading="isCreatingPrinter" icon="i-lucide-printer">
                ลงทะเบียนเครื่องพิมพ์
              </UButton>
            </div>
          </UForm>
        </section>

        <!-- ==================== Section 2: คิวงานพิมพ์ ==================== -->
        <section class="-mx-2 mt-3 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <h2 class="text-lg font-semibold text-highlighted">คิวงานพิมพ์</h2>
          <p class="mt-0.5 text-sm text-muted">
            "ส่งไปที่เครื่องพิมพ์แล้ว" หมายถึงระบบส่งข้อมูลถึงเครื่องสำเร็จเท่านั้น ไม่ได้ยืนยันว่ากระดาษพิมพ์ออกจริง
          </p>
        </section>

        <div class="-mx-2 border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <div class="flex items-center gap-2">
            <USelect
              v-model="statusFilter"
              :items="PRINT_JOB_STATUS_FILTER_OPTIONS"
              value-key="value"
              class="min-w-0 flex-1"
            />
            <UIButtonRefresh class="shrink-0" :loading="jobsLoading" @refresh="refreshJobs()" />
          </div>
        </div>

        <!-- Queue error state -->
        <section
          v-if="hydrated && jobsError && !jobsLoading && !jobs.length"
          class="-mx-2 flex flex-col items-center justify-center border border-dashed border-error/40 bg-error/5 px-3 py-6 text-center sm:mx-0 sm:rounded-lg"
        >
          <UIcon name="i-lucide-server-off" class="mb-2 size-8 text-error" />
          <p class="text-sm text-muted">ไม่สามารถโหลดคิวงานพิมพ์ได้</p>
          <UButton label="ลองใหม่" variant="soft" color="primary" size="sm" class="mt-3" @click="refreshJobs()" />
        </section>

        <!-- Queue loading skeleton -->
        <template v-else-if="showJobsSkeleton">
          <div class="-mx-2 space-y-2 sm:mx-0">
            <div v-for="i in 3" :key="`job-sk-${i}`" class="border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg">
              <USkeleton class="h-4 w-40 rounded-lg" />
              <USkeleton class="mt-2 h-3 w-56 rounded-lg" />
            </div>
          </div>
        </template>

        <!-- Queue empty state -->
        <div
          v-else-if="!jobs.length"
          class="flex flex-col items-center justify-center border border-dashed border-default/30 bg-default/55 px-3 py-6 text-center text-muted"
        >
          <UIcon name="i-lucide-inbox" class="mb-3 size-10 opacity-60" />
          <p class="text-sm">ไม่มีงานพิมพ์ตามเงื่อนไขที่เลือก</p>
        </div>

        <!-- Queue list (mobile-first cards) -->
        <div v-else class="-mx-2 space-y-2 sm:mx-0">
          <article
            v-for="job in jobs"
            :key="job.id"
            class="border border-default/30 bg-default p-3 transition-[background-color,border-color] duration-200 hover:border-default/45 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">
                  {{ PRINT_JOB_KIND_LABELS[job.kind] }} {{ job.documentNo }}
                </p>
                <p class="mt-0.5 text-xs text-muted">
                  สร้าง {{ formatDateTime(job.createdAt) }} · พยายามแล้ว {{ job.attemptCount }} ครั้ง
                </p>
              </div>
              <UBadge :color="getBadge(job.status).color" variant="subtle" size="xs">
                {{ getBadge(job.status).label }}
              </UBadge>
            </div>

            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-muted">ยอดเงินในเอกสาร</dt>
                <dd class="font-medium text-highlighted">{{ formatCurrency(job.source.amountMinor / 100) }}</dd>
              </div>
              <div class="flex justify-between gap-2 sm:block">
                <dt class="text-muted">ช่องทางที่เลือก</dt>
                <dd class="font-medium text-highlighted">{{ job.selectedTransport ?? "ค่าเริ่มต้นเครื่องพิมพ์" }}</dd>
              </div>
            </dl>

            <p v-if="job.failure.messageSafe" class="mt-2 rounded-md bg-error/10 px-2 py-1.5 text-xs text-error">
              {{ job.failure.messageSafe }}
            </p>

            <p v-else-if="getLatestTimelineNote(job)" class="mt-2 truncate text-xs text-muted">
              {{ getLatestTimelineNote(job) }}
            </p>

            <div v-if="canReprint(job) || job.status === 'NEEDS_REVIEW'" class="mt-2 flex justify-end gap-2 border-t border-default pt-2">
              <UButton
                v-if="job.status === 'NEEDS_REVIEW'"
                label="ตรวจสอบผล"
                icon="i-lucide-search-check"
                size="xs"
                color="warning"
                variant="soft"
                @click="openResolveModal(job)"
              />
              <UButton
                v-if="canReprint(job)"
                label="พิมพ์ซ้ำ"
                icon="i-lucide-printer"
                size="xs"
                color="primary"
                variant="soft"
                @click="openReprintConfirm(job)"
              />
            </div>
          </article>
        </div>

        <!-- ==================== Section 3: สถานะการเชื่อมต่อ Bridge ==================== -->
        <section class="-mx-2 mt-3 border border-default/30 bg-default px-4 py-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-highlighted">สถานะการเชื่อมต่อ Bridge</h2>
            <UBadge
              v-if="printer"
              :color="isPrinterOnline ? 'success' : 'neutral'"
              variant="subtle"
              :icon="isPrinterOnline ? 'i-lucide-wifi' : 'i-lucide-help-circle'"
            >
              {{ isPrinterOnline ? "ออนไลน์" : "ไม่ทราบสถานะ" }}
            </UBadge>
          </div>

          <ul class="mt-3 space-y-2 text-sm text-muted">
            <li class="flex gap-2">
              <UIcon name="i-lucide-monitor-dot" class="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                การพิมพ์ผ่านระบบคิวต้องเปิดโปรแกรม Local Print Bridge ไว้ที่คอมพิวเตอร์ในร้าน
                โดย Bridge จะดึงงานจากคิวและส่งต่อให้เครื่องพิมพ์โดยอัตโนมัติ
              </span>
            </li>
            <li class="flex gap-2">
              <UIcon name="i-lucide-heart-pulse" class="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                สถานะล่าสุด:
                <template v-if="printer">
                  {{ isPrinterOnline ? "Bridge รายงานตัวอยู่ (ออนไลน์)" : "ยังไม่มีรายงานล่าสุดจาก Bridge" }}
                  <template v-if="printer.lastHeartbeatAt">
                    (Heartbeat: {{ formatDateTime(printer.lastHeartbeatAt) }})
                  </template>
                </template>
                <template v-else>ยังไม่มีเครื่องพิมพ์ที่ลงทะเบียน</template>
              </span>
            </li>
            <li class="flex gap-2">
              <UIcon name="i-lucide-shield-check" class="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                IP, พอร์ต และรหัสของเครื่องพิมพ์ถูกเก็บไว้ในไฟล์ตั้งค่าของ Bridge บนคอมพิวเตอร์ร้านเท่านั้น
                ระบบหลักไม่จัดเก็บหรือแสดงข้อมูลการเชื่อมต่อโดยตรงเหล่านี้
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Rotate credential: confirm first (invalidates the previous token) -->
  <UIConfirmModal
    v-model:open="showRotateConfirm"
    title="หมุนเวียนรหัส Bridge"
    icon="i-lucide-key-round"
    icon-color="warning"
    confirm-label="หมุนเวียนรหัส"
    confirm-color="warning"
    :loading="isRotating"
    @confirm="confirmRotateCredential"
  >
    <template #message>
      รหัสเดิมที่ Bridge ใช้งานอยู่จะหมดอาณัติทันที และรหัสใหม่จะถูกแสดง
      <strong class="text-highlighted">เพียงครั้งเดียว</strong>
      หลังจากนี้ ต้องนำรหัสใหม่ไปตั้งค่าที่ Bridge บนคอมพิวเตอร์ร้าน ดำเนินการต่อหรือไม่?
    </template>
  </UIConfirmModal>

  <!-- Rotate credential: token shown ONCE -->
  <UModal
    v-model:open="showTokenModal"
    title="รหัส Bridge ใหม่"
    description="คัดลอกรหัสนี้ทันที — ระบบจะไม่แสดงรหัสนี้อีก"
    :dismissible="false"
    @update:open="(open: boolean) => { if (!open) closeTokenModal() }"
  >
    <template #body>
      <div class="space-y-3">
        <UAlert
          icon="i-lucide-alert-triangle"
          color="warning"
          variant="subtle"
          title="แสดงเพียงครั้งเดียว"
          description="หากปิดหน้าต่างนี้โดยยังไม่ได้บันทึกรหัส จะต้องหมุนเวียนรหัสใหม่อีกครั้ง"
        />
        <div class="flex items-center gap-2">
          <code class="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm text-highlighted">
            {{ rotatedToken }}
          </code>
          <UButton icon="i-lucide-copy" label="คัดลอก" color="primary" variant="soft" @click="copyToken" />
        </div>
        <p v-if="rotatedCredentialVersion !== null" class="text-xs text-muted">
          เวอร์ชันรหัสปัจจุบัน: {{ rotatedCredentialVersion }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton label="ฉันบันทึกรหัสแล้ว" color="primary" @click="closeTokenModal" />
      </div>
    </template>
  </UModal>

  <!-- Delete printer -->
  <UIConfirmModal
    v-model:open="showDeletePrinterConfirm"
    title="ลบเครื่องพิมพ์"
    description="ยืนยันการลบเครื่องพิมพ์ออกจากระบบ"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบเครื่องพิมพ์"
    confirm-color="error"
    :loading="isDeletingPrinter"
    @confirm="confirmDeletePrinter"
  >
    <template #message>
      คุณต้องการลบ
      <strong class="text-highlighted">{{ printer?.name }}</strong>
      ใช่หรือไม่? ระบบจะไม่สามารถรับงานพิมพ์ใหม่ได้จนกว่าจะลงทะเบียนเครื่องใหม่
      (หากยังมีงานในคิว ระบบจะไม่อนุญาตให้ลบ)
    </template>
  </UIConfirmModal>

  <!-- Explicit reprint -->
  <UIConfirmModal
    v-model:open="showReprintConfirm"
    title="สั่งพิมพ์ซ้ำ"
    icon="i-lucide-printer"
    icon-color="warning"
    confirm-label="สั่งพิมพ์ซ้ำ"
    :loading="isReprinting"
    @confirm="confirmReprint"
  >
    <template #message>
      ยืนยันสั่งพิมพ์ซ้ำ
      <strong class="text-highlighted">
        {{ reprintTarget ? `${PRINT_JOB_KIND_LABELS[reprintTarget.kind]} ${reprintTarget.documentNo}` : "" }}
      </strong>
      ใช่หรือไม่? ระบบจะสร้างงานพิมพ์ใหม่จากข้อมูลเดิม — โปรดตรวจสอบก่อนว่าไม่ได้พิมพ์ใบนี้ออกไปแล้ว
    </template>
  </UIConfirmModal>

  <!-- Needs-review resolution -->
  <UModal
    v-model:open="showResolveModal"
    title="ตรวจสอบผลการพิมพ์"
    :description="resolveTarget ? `${PRINT_JOB_KIND_LABELS[resolveTarget.kind]} ${resolveTarget.documentNo}` : ''"
  >
    <template #body>
      <div class="space-y-3">
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          title="ระบบไม่ทราบผลการพิมพ์จริง"
          description="การส่งถึงเครื่องพิมพ์สำเร็จไม่ได้แปลว่ากระดาษพิมพ์ออกจริง กรุณาตรวจใบที่เครื่องพิมพ์ก่อนยืนยัน"
        />

        <p class="text-sm text-muted">เลือกผลการตรวจสอบ (จำเป็น)</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-md border p-3 text-left transition-colors"
            :class="resolveChoice === 'RESOLVED_PRINTED'
              ? 'border-success/50 bg-success/10'
              : 'border-default/30 bg-default hover:border-default/45 dark:bg-elevated/55'"
            @click="resolveChoice = 'RESOLVED_PRINTED'"
          >
            <span class="flex items-center gap-2 text-sm font-medium text-highlighted">
              <UIcon name="i-lucide-check-circle-2" class="size-4 text-success" />
              พิมพ์ออกจริง
            </span>
            <span class="mt-1 block text-xs text-muted">พบใบถูกพิมพ์ออกมาที่เครื่องจริง</span>
          </button>
          <button
            type="button"
            class="rounded-md border p-3 text-left transition-colors"
            :class="resolveChoice === 'RESOLVED_NOT_PRINTED'
              ? 'border-warning/50 bg-warning/10'
              : 'border-default/30 bg-default hover:border-default/45 dark:bg-elevated/55'"
            @click="resolveChoice = 'RESOLVED_NOT_PRINTED'"
          >
            <span class="flex items-center gap-2 text-sm font-medium text-highlighted">
              <UIcon name="i-lucide-x-circle" class="size-4 text-warning" />
              ไม่ได้พิมพ์ออก
            </span>
            <span class="mt-1 block text-xs text-muted">ไม่พบใบหรือกระดาษไม่พิมพ์ออกมา</span>
          </button>
        </div>

        <UFormField label="บันทึกเพิ่มเติม (ถ้ามี)" name="note">
          <UTextarea v-model="resolveNote" placeholder="เช่น กระดาษติด ต้องรีเซ็ตเครื่อง" :rows="2" class="w-full" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton label="ยกเลิก" color="neutral" variant="outline" @click="showResolveModal = false" />
        <UButton
          label="ยืนยันผลการตรวจสอบ"
          icon="i-lucide-check"
          color="primary"
          :disabled="!resolveChoice"
          :loading="isResolving"
          @click="confirmResolve"
        />
      </div>
    </template>
  </UModal>
</template>
