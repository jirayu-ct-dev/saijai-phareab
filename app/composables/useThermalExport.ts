import type { Ref } from "vue";

const EXPORT_WIDTH_PX = 302;

export function useThermalExport(
  elementRef: Ref<HTMLElement | null>,
  fileName: Ref<string> | (() => string),
  fallbackPath = "/admin",
) {
  const resolveFileName = () => (typeof fileName === "function" ? fileName() : fileName.value);

  const goBack = () => {
    if (import.meta.client && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigateTo(fallbackPath);
  };

  const handlePrint = () => {
    if (import.meta.client) window.print();
  };

  const downloadPng = async () => {
    if (!import.meta.client || !elementRef.value) return;

    const { toPng } = await import("html-to-image");

    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-10000px";
    exportHost.style.top = "0";
    exportHost.style.width = `${EXPORT_WIDTH_PX}px`;
    exportHost.style.padding = "0";
    exportHost.style.margin = "0";
    exportHost.style.background = "#ffffff";

    const clone = elementRef.value.cloneNode(true) as HTMLElement;
    clone.style.width = `${EXPORT_WIDTH_PX}px`;
    clone.style.maxWidth = `${EXPORT_WIDTH_PX}px`;
    clone.style.margin = "0 auto";
    clone.style.boxSizing = "border-box";

    exportHost.appendChild(clone);
    document.body.appendChild(exportHost);

    const dataUrl = await toPng(clone, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      canvasWidth: EXPORT_WIDTH_PX,
      skipFonts: true,
    });

    document.body.removeChild(exportHost);

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${resolveFileName()}.png`;
    link.click();
  };

  return { goBack, handlePrint, downloadPng };
}
