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
  font-family: "Prompt", "Tahoma", "Arial", sans-serif;
  font-size: 22px;
  line-height: 1.7;
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
</style>

<style>
@font-face {
  font-family: "Prompt";
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url("/fonts/Prompt-normal-400-thai.woff2") format("woff2");
  unicode-range: U+0E00-0E7F;
}

@font-face {
  font-family: "Prompt";
  font-style: normal;
  font-weight: 500;
  font-display: block;
  src: url("/fonts/Prompt-normal-500-thai.woff2") format("woff2");
  unicode-range: U+0E00-0E7F;
}

@font-face {
  font-family: "Prompt";
  font-style: normal;
  font-weight: 600;
  font-display: block;
  src: url("/fonts/Prompt-normal-600-thai.woff2") format("woff2");
  unicode-range: U+0E00-0E7F;
}

@font-face {
  font-family: "Prompt";
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url("/fonts/Prompt-normal-700-thai.woff2") format("woff2");
  unicode-range: U+0E00-0E7F;
}

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
