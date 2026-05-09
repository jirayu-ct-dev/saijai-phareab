import type { Ref } from "vue";
import { nextTick, ref } from "vue";

const EXPORT_WIDTH_PX = 390;
const EXPORT_PIXEL_RATIO = 3;

const waitForFonts = async () => {
  if (!import.meta.client || !("fonts" in document)) return;
  await document.fonts.ready;
};

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return;
    try {
      await image.decode();
    } catch {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }
  }));
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function useThermalExport(
  elementRef: Readonly<Ref<HTMLElement | null>>,
  fileName: Ref<string> | (() => string),
  fallbackPath = "/admin",
) {
  const resolveFileName = () => (typeof fileName === "function" ? fileName() : fileName.value);
  const notify = useNotify();
  const isExporting = ref(false);

  const goBack = () => {
    if (import.meta.client && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigateTo(fallbackPath);
  };

  const downloadPng = async () => {
    if (!import.meta.client || !elementRef.value) return;

    isExporting.value = true;
    try {
      await nextTick();
      await waitForFonts();
      await waitForImages(elementRef.value);

      const { toBlob } = await import("html-to-image");
      const fileNameWithExt = `${resolveFileName()}.png`;
      const blob = await toBlob(elementRef.value, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        width: EXPORT_WIDTH_PX,
        height: elementRef.value.scrollHeight,
        pixelRatio: EXPORT_PIXEL_RATIO,
      });

      if (!blob) throw new Error("ไม่สามารถสร้างไฟล์ PNG ได้");

      downloadBlob(blob, fileNameWithExt);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "ไม่สามารถบันทึก PNG ได้");
    } finally {
      isExporting.value = false;
    }
  };

  return { goBack, downloadPng, isExporting };
}
