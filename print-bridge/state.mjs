import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const EMPTY_STATE = { version: 1, tokens: [], printers: [] };
const validateState = (raw) => {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.tokens) || !Array.isArray(raw.printers)) throw new Error("Gateway state has an unsupported shape or version");
  return raw;
};
export function createMemoryStateStore(initial = EMPTY_STATE) {
  let state = structuredClone(validateState(initial));
  return { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(validateState(next)); } };
}
export function createFileStateStore(statePath) {
  const absolutePath = path.resolve(statePath);
  return {
    async read() {
      try {
        const stats = await stat(absolutePath);
        if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0 && (stats.mode & 0o077) !== 0) {
          throw new Error("Gateway state file must be owner-only: chmod 600");
        }
        return validateState(JSON.parse(await readFile(absolutePath, "utf8")));
      }
      catch (error) { if (error?.code === "ENOENT") return structuredClone(EMPTY_STATE); throw error; }
    },
    async write(next) {
      validateState(next);
      await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${absolutePath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
      await chmod(temporaryPath, 0o600);
      await rename(temporaryPath, absolutePath);
    },
  };
}
export { EMPTY_STATE };
