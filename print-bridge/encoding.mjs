/**
 * Default operation encoder (PRN-04 bridge side of PRN-05).
 *
 * The bridge never hardcodes ESC/POS knowledge: the caller injects
 * `encodeOperations(operations)`. This default implementation lazy-loads the
 * repo's shared encoder (shared/utils/escpos.ts, owned by PRN-05) and binds it
 * to the default XP-C260M 80mm profile. Tests inject fakes and must NOT depend
 * on the real module.
 */

const DEFAULT_XP_C260M_PROFILE = {
  id: "bridge-default",
  name: "Saijai Print Bridge Default",
  model: "XP-C260M",
  defaultTransport: "WIFI",
  paperWidthMm: 80,
  printableDots: 576,
  renderMode: "HYBRID",
  capabilities: {
    partialCut: true,
    nativeQr: true,
    nativeBarcode: true,
    pdf417: false,
    nvLogo: false,
    buzzer: false,
    statusQuery: false,
    cashDrawer: false,
    blackMark: false,
  },
};

/**
 * Returns an async `encodeOperations(operations) -> Uint8Array` backed by the
 * shared PRN-05 encoder. Throws a clear, actionable error when the shared
 * module is unavailable (e.g. the bridge was copied out of the repository).
 */
export async function createDefaultEncodeOperations() {
  let mod;
  try {
    // Node 24 strips types from .ts imports natively; the path is relative to
    // this file so the bridge works from any cwd inside the repo checkout.
    mod = await import("../shared/utils/escpos.ts");
  } catch (err) {
    throw new Error(
      "Could not load the ESC/POS encoder at shared/utils/escpos.ts. " +
        "Run the bridge from the Saijai Phareab repository checkout so the shared " +
        "encoder (PRN-05) is available.",
      { cause: err },
    );
  }
  const encodeEscpos = mod?.encodeEscpos;
  if (typeof encodeEscpos !== "function") {
    throw new Error(
      "shared/utils/escpos.ts does not export encodeEscpos(); the installed " +
        "bridge is incompatible with this repository's renderer.",
    );
  }
  return async function encodeOperations(operations) {
    return encodeEscpos(operations, DEFAULT_XP_C260M_PROFILE);
  };
}
