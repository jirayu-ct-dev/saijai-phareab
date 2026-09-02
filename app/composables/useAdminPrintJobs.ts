import type {
  PrintDocumentKind,
  PrintJobStatus,
  PrintJobTimelineEntry,
  PrintTransport,
} from "~~/shared/types/printing";

// PRN-06: admin print-job queue access. Shapes follow the JSON-safe projection
// from server/utils/printJobQueue.ts (projectPrintJob).

export type AdminPrintJob = {
  id: string;
  printerId: string;
  kind: PrintDocumentKind;
  documentId: string;
  documentNo: string;
  documentRevision: number;
  status: PrintJobStatus;
  source: {
    paymentId: string;
    status: string;
    revision: number;
    amountMinor: number;
    qrConfigVersion: number | null;
    snapshotHasPaymentQr: boolean;
  };
  snapshotHash: string;
  renderVersion: string;
  snapshotExpiresAt: string | null;
  requestedById: string;
  selectedTransport: PrintTransport | null;
  idempotencyKey: string;
  reprintOfId: string | null;
  availableAt: string;
  attemptCount: number;
  sendStartedAt: string | null;
  lease: {
    leaseToken: string | null;
    leaseExpiresAt: string | null;
    fencingToken: number | null;
  };
  failure: {
    code: string | null;
    messageSafe: string | null;
  };
  timeline: PrintJobTimelineEntry[];
  createdAt: string;
  updatedAt: string;
};

export type PrintJobResolution = "RESOLVED_PRINTED" | "RESOLVED_NOT_PRINTED";

export type CreatePrintJobInput = {
  kind: PrintDocumentKind;
  documentId: string;
  transport?: PrintTransport;
  /**
   * Client-generated random string; the caller must reuse the SAME key when
   * retrying the same logical print request. A new key creates a new job.
   */
  idempotencyKey?: string;
};

/** Thai labels + badge colors. SENT never claims a physical print succeeded. */
export const PRINT_JOB_STATUS_BADGES: Readonly<
  Record<PrintJobStatus, { label: string; color: "neutral" | "info" | "success" | "warning" | "error" }>
> = Object.freeze({
  QUEUED: { label: "รอส่ง", color: "info" },
  CLAIMED: { label: "กำลังเตรียม", color: "info" },
  RENDERING: { label: "กำลังเตรียม", color: "info" },
  READY: { label: "กำลังเตรียม", color: "info" },
  SENDING: { label: "กำลังส่ง", color: "info" },
  SENT: { label: "ส่งไปที่เครื่องพิมพ์แล้ว", color: "success" },
  ACKNOWLEDGED: { label: "เครื่องพิมพ์ยืนยันรับงาน", color: "success" },
  RETRY_WAIT: { label: "รอลองใหม่", color: "warning" },
  STALE_DOCUMENT: { label: "เอกสารไม่ตรงล่าสุด", color: "warning" },
  NEEDS_REVIEW: { label: "ต้องตรวจสอบ", color: "warning" },
  RESOLVED_PRINTED: { label: "ปิดแล้ว (พิมพ์ออกจริง)", color: "neutral" },
  RESOLVED_NOT_PRINTED: { label: "ปิดแล้ว (ไม่ได้พิมพ์)", color: "neutral" },
  REPRINTED: { label: "พิมพ์ซ้ำแล้ว", color: "neutral" },
  FAILED: { label: "ล้มเหลว", color: "error" },
});

/** Statuses the UI offers an explicit "พิมพ์ซ้ำ" action for. */
export const PRINT_JOB_REPRINTABLE_STATUSES: readonly PrintJobStatus[] = Object.freeze([
  "SENT",
  "FAILED",
  "NEEDS_REVIEW",
  "STALE_DOCUMENT",
] satisfies PrintJobStatus[]);

export const PRINT_JOB_KIND_LABELS: Readonly<Record<PrintDocumentKind, string>> = Object.freeze({
  RECEIPT: "ใบเสร็จ",
  QUOTATION: "ใบแจ้งราคา",
});

export const PRINT_JOB_STATUS_FILTER_OPTIONS: Array<{ label: string; value: PrintJobStatus | "ALL" }> = [
  { label: "ทุกสถานะ", value: "ALL" as const },
  ...Object.keys(PRINT_JOB_STATUS_BADGES).map((status) => ({
    label: PRINT_JOB_STATUS_BADGES[status as PrintJobStatus].label,
    value: status as PrintJobStatus,
  })),
];

export const useAdminPrintJobs = (options: {
  printerId?: () => string | undefined;
  take?: number;
} = {}) => {
  const notify = useNotify();
  const take = options.take ?? 20;

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }
    return fallback;
  };

  const statusFilter = ref<PrintJobStatus | "ALL">("ALL");

  const query = computed(() => ({
    ...(statusFilter.value !== "ALL" ? { status: statusFilter.value } : {}),
    ...(options.printerId?.() ? { printerId: options.printerId()! } : {}),
    take: String(take),
  }));

  const { data, status, error, refresh } = useFetch<{ jobs: AdminPrintJob[] }>(
    "/api/admin/print-jobs",
    {
      key: "admin-print-jobs",
      query,
      default: () => ({ jobs: [] }),
      server: false,
      lazy: true,
    },
  );

  const jobs = computed<AdminPrintJob[]>(() => data.value?.jobs ?? []);
  const isLoading = computed(() => status.value === "pending");

  /**
   * Creates a print job. The idempotency key is generated client-side when not
   * supplied; callers that retry the SAME print request must pass the SAME key.
   */
  const createJob = async (
    input: CreatePrintJobInput,
  ): Promise<{ ok: boolean; job: AdminPrintJob | null }> => {
    try {
      const response = await $fetch<{ existing: boolean; job: AdminPrintJob }>(
        "/api/admin/print-jobs",
        {
          method: "POST",
          body: {
            kind: input.kind,
            documentId: input.documentId,
            ...(input.transport ? { transport: input.transport } : {}),
            idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
          },
        },
      );
      await refresh();
      notify.success(response.existing ? "งานพิมพ์นี้ถูกสร้างไว้แล้ว (ไม่สร้างซ้ำ)" : "สร้างงานพิมพ์แล้ว");
      return { ok: true, job: response.job };
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถสร้างงานพิมพ์ได้"));
      return { ok: false, job: null };
    }
  };

  /** Manual needs-review resolution — two explicit, human-confirmed outcomes. */
  const resolveJob = async (
    id: string,
    resolution: PrintJobResolution,
    note?: string,
  ): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/print-jobs/${id}/resolve`, {
        method: "PUT",
        body: {
          resolution,
          ...(note?.trim() ? { note: note.trim() } : {}),
        },
      });
      await refresh();
      notify.success("บันทึกผลการตรวจสอบแล้ว");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถบันทึกผลการตรวจสอบได้"));
      return false;
    }
  };

  /** Explicit reprint — creates a NEW job from the original snapshot. */
  const reprintJob = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/print-jobs/${id}/reprint`, { method: "POST" });
      await refresh();
      notify.success("สร้างงานพิมพ์ซ้ำแล้ว");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถสั่งพิมพ์ซ้ำได้"));
      return false;
    }
  };

  return {
    jobs,
    statusFilter,
    isLoading,
    error,
    refresh,
    createJob,
    resolveJob,
    reprintJob,
  };
};
