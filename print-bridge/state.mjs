import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const EMPTY_STATE = { version: 2, printers: [] };
const validateState = (raw) => {
  if (!raw || ![1, 2].includes(raw.version) || !Array.isArray(raw.printers)) throw new Error("Gateway state has an unsupported shape or version");
  return { version: 2, printers: raw.printers };
};
export function createMemoryStateStore(initial = EMPTY_STATE) {
  let state = structuredClone(validateState(initial));
  return { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(validateState(next)); } };
}
export function createFileStateStore(statePath) {
  const absolutePath = path.resolve(statePath);
  const writeState = async (next) => {
    const normalized = validateState(next);
    await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${absolutePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, absolutePath);
  };
  return {
    async read() {
      try {
        const stats = await stat(absolutePath);
        if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0 && (stats.mode & 0o077) !== 0) {
          throw new Error("Gateway state file must be owner-only: chmod 600");
        }
        const raw = JSON.parse(await readFile(absolutePath, "utf8"));
        const normalized = validateState(raw);
        if (raw.version === 1) await writeState(normalized);
        return normalized;
      }
      catch (error) { if (error?.code === "ENOENT") return structuredClone(EMPTY_STATE); throw error; }
    },
    async write(next) {
      await writeState(next);
    },
  };
}
export { EMPTY_STATE };
