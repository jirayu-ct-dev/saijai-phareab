<script setup lang="ts">
// Stripped-down layout used by /print/* routes that get rendered to PDF/PNG by
// Puppeteer. No navbar, sidebar, or any admin chrome — just the document body
// on a white page so the rendered output is identical regardless of viewport.
</script>

<template>
  <main class="print-host">
    <slot />
  </main>
</template>

<style scoped>
.print-host {
  width: 100%;
  min-height: 100vh;
  background: #ffffff;
  color: #000000;
  font-family: "Noto Sans Thai", "Sarabun", "Tahoma", "Arial", sans-serif;
  font-size: 22px;
  line-height: 1.7;
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
</style>

<style>
/* Tell Chromium to honour the document's intrinsic size when generating the
   PDF (preferCSSPageSize: true). The viewport width is set per-route via
   ?w=576|384 on the print frame, and the PDF page picks up the same size. */
@page {
  size: auto;
  margin: 0;
}
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
</style>
