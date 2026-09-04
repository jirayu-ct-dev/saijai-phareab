// Nuxt renders inline scripts into SSR HTML whose content changes between
// builds/environments (color-mode init script, window.__NUXT__ runtime config
// with buildId), so their CSP hashes cannot be pinned in nuxt.config.ts.
// This plugin hashes whatever inline scripts each response actually contains
// and appends them to the script-src directive set by the routeRules policy.
import { createHash } from "node:crypto";

const INLINE_SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
// Data blocks such as the Nuxt payload are not executed, so script-src does
// not apply to them and hashing them would be meaningless.
const NON_EXECUTABLE_TYPE = /\btype\s*=\s*["'](?:application\/(?:json|ld\+json)|importmap)["']/;

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:response", (response, { event }) => {
    if (typeof response.body !== "string") return;
    const policy = event.node.res.getHeader("Content-Security-Policy");
    if (typeof policy !== "string" || !policy.includes("script-src")) return;

    let nextPolicy = policy;
    const gatewayConfig = useRuntimeConfig(event).public;
    const gatewayUrl = gatewayConfig.printGatewayUrl;
    if (gatewayConfig.printGatewayEnabled === true && typeof gatewayUrl === "string" && gatewayUrl.length > 0) {
      try {
        const gatewayOrigin = new URL(gatewayUrl).origin;
        if (gatewayOrigin === gatewayUrl && /^https?:$/.test(new URL(gatewayOrigin).protocol)) {
          nextPolicy = nextPolicy.replace(/connect-src[^;]*/, (directive) => `${directive} ${gatewayOrigin}`);
        }
      } catch {
        // Invalid runtime configuration stays fail-closed: no CSP exception.
      }
    }

    const hashes = new Set<string>();
    for (const match of response.body.matchAll(INLINE_SCRIPT_PATTERN)) {
      const attrs = match[1] ?? "";
      const content = match[2] ?? "";
      if (/\bsrc\s*=/.test(attrs) || NON_EXECUTABLE_TYPE.test(attrs)) continue;
      if (!content.trim()) continue;
      // CSP hashes the exact text content of the element, so hash the raw
      // string without trimming.
      hashes.add(`'sha256-${createHash("sha256").update(content).digest("base64")}'`);
    }
    if (hashes.size === 0) {
      if (nextPolicy !== policy) event.node.res.setHeader("Content-Security-Policy", nextPolicy);
      return;
    }

    event.node.res.setHeader(
      "Content-Security-Policy",
      nextPolicy.replace(/script-src[^;]*/, (directive) => `${directive} ${[...hashes].join(" ")}`)
    );
  });
});
