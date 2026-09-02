// fake-printer.mjs — disposable local test stand-in for the XP-C260M.
// Listens on TCP 9100 like a network receipt printer, records whatever the
// bridge writes, and logs a summary for `docker compose logs fake-printer`.
// Usage: node print-bridge/test/fake-printer.mjs  (env: PORT, OUT_DIR)
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT ?? 9100);
const outDir = process.env.OUT_DIR ?? "/tmp/fake-printer";
fs.mkdirSync(outDir, { recursive: true });

let jobCount = 0;

const server = net.createServer((socket) => {
  const chunks = [];
  let bytes = 0;
  socket.on("data", (chunk) => {
    chunks.push(chunk);
    bytes += chunk.length;
  });
  socket.on("end", () => {
    jobCount += 1;
    const file = path.join(outDir, `print-${String(jobCount).padStart(4, "0")}-${Date.now()}.bin`);
    fs.writeFileSync(file, Buffer.concat(chunks));
    const head = Buffer.concat(chunks).subarray(0, 8).toString("hex");
    // ESC @ initialize (1b40) is the expected first byte pair of every job.
    const looksEscpos = head.startsWith("1b40");
    console.log(`[fake-printer] job ${jobCount}: ${bytes} bytes -> ${file} (head ${head}) ${looksEscpos ? "looks like ESC/POS ✔" : "WARNING: no ESC/POS initialize"}`);
  });
  socket.on("error", (err) => console.error(`[fake-printer] socket error: ${err.code ?? err.message}`));
});

server.listen(port, "0.0.0.0", () => console.log(`[fake-printer] listening on 0.0.0.0:${port}, dumping to ${outDir}`));
