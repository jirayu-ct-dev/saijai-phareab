import type {
  PaperWidthMm,
  PrintRenderMode,
  PrintTransport,
  PrintableDots,
  PrinterCapabilities,
  PrinterModel,
} from "~~/shared/types/printing";

// PRN-06: admin printer profile access (GET /api/admin/printers is a safe
// projection — never connectionProfile, never credential hash).

export type AdminPrinter = {
  id: string;
  name: string;
  model: PrinterModel;
  defaultTransport: PrintTransport;
  paperWidthMm: PaperWidthMm;
  printableDots: PrintableDots;
  renderMode: PrintRenderMode;
  capabilities: PrinterCapabilities;
  isActive: boolean;
  /** ISO 8601 string, or null when the bridge has never reported. */
  lastHeartbeatAt: string | null;
  bridgeVersion: string | null;
  bridgeCredentialVersion: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePrinterBody = {
  name: string;
  defaultTransport: PrintTransport;
  paperWidthMm: PaperWidthMm;
  printableDots: PrintableDots;
  renderMode: PrintRenderMode;
  capabilities?: Partial<PrinterCapabilities>;
  isActive?: boolean;
};

/** Heartbeat is considered fresh ("online") within this window. */
export const PRINTER_HEARTBEAT_WINDOW_MS = 3 * 60 * 1000;

export function isPrinterHeartbeatFresh(
  lastHeartbeatAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastHeartbeatAt) return false;
  const atMs = Date.parse(lastHeartbeatAt);
  if (Number.isNaN(atMs)) return false;
  return nowMs - atMs <= PRINTER_HEARTBEAT_WINDOW_MS;
}

export const useAdminPrinters = () => {
  const notify = useNotify();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }
    return fallback;
  };

  const { data, status, error, refresh } = useFetch<{ printers: AdminPrinter[] }>(
    "/api/admin/printers",
    {
      key: "admin-printers",
      default: () => ({ printers: [] }),
      server: false,
      lazy: true,
    },
  );

  const printers = computed<AdminPrinter[]>(() => data.value?.printers ?? []);
  const isLoading = computed(() => status.value === "pending");

  const createPrinter = async (body: CreatePrinterBody): Promise<boolean> => {
    try {
      await $fetch("/api/admin/printers", { method: "POST", body });
      await refresh();
      notify.created("เครื่องพิมพ์");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถลงทะเบียนเครื่องพิมพ์ได้"));
      return false;
    }
  };

  /**
   * Rotates the bridge credential. The plaintext token is returned ONCE by
   * the API — the UI must show it once and never ask the server for it again.
   */
  const rotateCredential = async (
    id: string,
  ): Promise<{ token: string; credentialVersion: number } | null> => {
    try {
      const response = await $fetch<{
        ok: boolean;
        credential: string;
        bridgeCredentialVersion: number;
      }>(`/api/admin/printers/${id}/credential`, { method: "POST" });
      await refresh();
      return { token: response.credential, credentialVersion: response.bridgeCredentialVersion };
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถหมุนเวียนรหัส Bridge ได้"));
      return null;
    }
  };

  const updatePrinter = async (id: string, body: Partial<CreatePrinterBody>): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/printers/${id}`, { method: "PUT", body });
      await refresh();
      notify.updated();
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถบันทึกเครื่องพิมพ์ได้"));
      return false;
    }
  };

  const deletePrinter = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/printers/${id}`, { method: "DELETE" });
      await refresh();
      notify.deleted("เครื่องพิมพ์");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถลบเครื่องพิมพ์ได้"));
      return false;
    }
  };

  return {
    printers,
    isLoading,
    error,
    refresh,
    createPrinter,
    updatePrinter,
    rotateCredential,
    deletePrinter,
  };
};
