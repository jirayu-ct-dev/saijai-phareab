import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import { PrinterMutex } from "./mutex.mjs";
import { authenticateToken, issueToken, tokenHash, validatePairingCode } from "./auth.mjs";
import { createTcpTransport } from "./transport/tcp.js";
import { BRIDGE_VERSION } from "./version.mjs";
import { fingerprintBuffer } from "./byteFingerprint.mjs";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const sendJson = (response, statusCode, body, corsHeaders = {}) => {
  response.writeHead(statusCode, { ...JSON_HEADERS, ...corsHeaders });
  response.end(JSON.stringify(body));
};
const corsHeadersFor = (origin) => ({ "access-control-allow-origin": origin, vary: "Origin" });

async function readBody(request, maxPayloadBytes, { allowEmpty = false } = {}) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > maxPayloadBytes) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { code: "PAYLOAD_TOO_LARGE" });
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxPayloadBytes) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { code: "PAYLOAD_TOO_LARGE" });
    chunks.push(chunk);
  }
  if (total === 0 && !allowEmpty) throw Object.assign(new Error("EMPTY_PAYLOAD"), { code: "EMPTY_PAYLOAD" });
  return Buffer.concat(chunks, total);
}

const readJson = async (request) => {
  if ((request.headers["content-type"] ?? "").split(";", 1)[0]?.trim() !== "application/json") {
    throw Object.assign(new Error("UNSUPPORTED_MEDIA_TYPE"), { code: "UNSUPPORTED_MEDIA_TYPE" });
  }
  try { return JSON.parse((await readBody(request, 16_384)).toString("utf8")); }
  catch (error) { if (error?.code) throw error; throw Object.assign(new Error("INVALID_JSON"), { code: "INVALID_JSON" }); }
};

const classifyTransportFailure = (error, sendStarted) => {
  if (sendStarted) return { statusCode: 502, code: "UNKNOWN_PROGRESS", bytesMayHaveBeenWritten: true };
  if (error?.code === "FAILED_TIMEOUT") return { statusCode: 504, code: "TIMEOUT", bytesMayHaveBeenWritten: false };
  return { statusCode: 503, code: "OFFLINE", bytesMayHaveBeenWritten: false };
};

export function createPrintGatewayServer({
  config,
  stateStore,
  discovery,
  mutex = new PrinterMutex(),
  log = console,
  createTransport = (printer) => createTcpTransport({
    host: printer.host,
    port: printer.port,
    timeoutMs: config.tcpTimeoutMs,
    debugBytes: config.debugBytes,
    log,
  }),
  now = Date.now,
  tls = null,
} = {}) {
  if (!config || !stateStore || !discovery) throw new Error("Print Gateway requires config, stateStore and discovery");
  const pairingAttempts = [];
  const requestWindows = new Map();
  const withinRate = (key, limit, windowMs) => {
    const cutoff = now() - windowMs;
    const entries = (requestWindows.get(key) ?? []).filter((time) => time > cutoff);
    if (entries.length >= limit) { requestWindows.set(key, entries); return false; }
    entries.push(now());
    requestWindows.set(key, entries);
    return true;
  };
  let stateMutation = Promise.resolve();
  const mutateState = (operation) => {
    const run = stateMutation.then(async () => {
      const state = await stateStore.read();
      const result = await operation(state);
      await stateStore.write(state);
      return result;
    });
    stateMutation = run.catch(() => undefined);
    return run;
  };

  const handler = async (request, response) => {
    const origin = request.headers.origin;
    const originAllowed = typeof origin === "string" && config.allowedOrigins.includes(origin);
    const corsHeaders = originAllowed ? corsHeadersFor(origin) : {};
    const url = new URL(request.url ?? "/", config.publicUrl);
    if (!originAllowed) return sendJson(response, 403, { ok: false, code: "ORIGIN_DENIED" });

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...corsHeaders,
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "600",
        ...(request.headers["access-control-request-private-network"] === "true" ? { "access-control-allow-private-network": "true" } : {}),
      });
      return response.end();
    }

    const state = await stateStore.read();
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { available: true, pairingRequired: state.tokens.every((entry) => Date.parse(entry.expiresAt) <= now()), version: BRIDGE_VERSION }, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/pair") {
      const cutoff = now() - 60_000;
      while (pairingAttempts[0] < cutoff) pairingAttempts.shift();
      if (pairingAttempts.length >= 5) return sendJson(response, 429, { ok: false, code: "RATE_LIMITED" }, corsHeaders);
      pairingAttempts.push(now());
      let body;
      try { body = await readJson(request); } catch (error) { return sendJson(response, error.code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400, { ok: false, code: error.code }, corsHeaders); }
      if (!validatePairingCode(body?.code, config.pairingSecret, now(), config.pairingCodeTtlSeconds)) {
        return sendJson(response, 401, { ok: false, code: "PAIRING_CODE_INVALID" }, corsHeaders);
      }
      const issued = issueToken(now(), config.tokenTtlDays);
      await mutateState((next) => {
        next.tokens = next.tokens.filter((entry) => Date.parse(entry.expiresAt) > now());
        next.tokens.push({ hash: tokenHash(issued.token), expiresAt: issued.expiresAt });
      });
      return sendJson(response, 201, { ok: true, token: issued.token, expiresAt: issued.expiresAt }, corsHeaders);
    }

    if (!authenticateToken(request.headers.authorization, state.tokens, now())) {
      return sendJson(response, 401, { ok: false, code: "PAIRING_REQUIRED" }, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/printers") {
      const printers = await Promise.all(state.printers.map(async (printer) => ({
        id: printer.id,
        name: printer.name,
        model: printer.model,
        online: await discovery.probeTarget(printer),
      })));
      return sendJson(response, 200, { printers }, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/discover") {
      const rateKey = `discover:${tokenHash(request.headers.authorization ?? "")}`;
      if (!withinRate(rateKey, 6, 60_000)) return sendJson(response, 429, { ok: false, code: "RATE_LIMITED" }, corsHeaders);
      const candidates = await discovery.scan({ force: url.searchParams.get("force") === "true" });
      const newCandidates = candidates.filter((candidate) => {
        const target = discovery.resolveCandidate(candidate.id);
        return target && !state.printers.some((printer) => printer.host === target.host && printer.port === target.port);
      });
      return sendJson(response, 200, { candidates: newCandidates.map((candidate, index) => ({ ...candidate, name: `เครื่องพิมพ์ที่พบ ${index + 1}` })) }, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/printers/trust") {
      let body;
      try { body = await readJson(request); } catch (error) { return sendJson(response, error.code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400, { ok: false, code: error.code }, corsHeaders); }
      const candidate = discovery.resolveCandidate(body?.candidateId);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!candidate || name.length < 1 || name.length > 80) return sendJson(response, 400, { ok: false, code: "INVALID_PRINTER" }, corsHeaders);
      const printer = await mutateState((next) => {
        const replacement = typeof body.replacesPrinterId === "string" ? next.printers.find((entry) => entry.id === body.replacesPrinterId) : null;
        const saved = { id: replacement?.id ?? `printer_${randomUUID()}`, name, model: "XP-C260M", host: candidate.host, port: candidate.port };
        next.printers = replacement ? next.printers.map((entry) => entry.id === replacement.id ? saved : entry) : [...next.printers, saved];
        return saved;
      });
      return sendJson(response, 201, { printer: { id: printer.id, name: printer.name, model: printer.model, online: true } }, corsHeaders);
    }

    const printMatch = /^\/print\/([^/]+)$/.exec(url.pathname);
    if (request.method === "POST" && printMatch) {
      const rateKey = `print:${tokenHash(request.headers.authorization ?? "")}`;
      if (!withinRate(rateKey, 120, 60_000)) return sendJson(response, 429, { ok: false, code: "RATE_LIMITED" }, corsHeaders);
      if ((request.headers["content-type"] ?? "").split(";", 1)[0]?.trim() !== "application/octet-stream") return sendJson(response, 415, { ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }, corsHeaders);
      const printer = state.printers.find((entry) => entry.id === decodeURIComponent(printMatch[1]));
      if (!printer) return sendJson(response, 404, { ok: false, code: "PRINTER_NOT_FOUND" }, corsHeaders);
      let release;
      try { release = mutex.acquire(printer.id); } catch { return sendJson(response, 409, { ok: false, code: "BUSY", bytesMayHaveBeenWritten: false }, corsHeaders); }
      let transport;
      let sendStarted = false;
      try {
        const bytes = await readBody(request, config.maxPayloadBytes);
        if (!Buffer.isBuffer(bytes)) throw new TypeError("Print request body must be a Buffer");
        if (config.debugBytes) {
          log.debug(`Print payload E ${JSON.stringify(fingerprintBuffer(bytes))}`, "PRINT_BYTES_E");
        }
        transport = createTransport(printer);
        await transport.connect();
        sendStarted = true;
        await transport.write(bytes);
        await transport.end();
        return sendJson(response, 200, { ok: true, code: "SENT" }, corsHeaders);
      } catch (error) {
        if (error?.code === "PAYLOAD_TOO_LARGE") return sendJson(response, 413, { ok: false, code: error.code }, corsHeaders);
        if (error?.code === "EMPTY_PAYLOAD") return sendJson(response, 400, { ok: false, code: error.code }, corsHeaders);
        const result = classifyTransportFailure(error, sendStarted);
        log.warn("Immediate print failed", result.code);
        return sendJson(response, result.statusCode, { ok: false, code: result.code, bytesMayHaveBeenWritten: result.bytesMayHaveBeenWritten }, corsHeaders);
      } finally {
        await transport?.close?.().catch(() => undefined);
        release();
      }
    }
    return sendJson(response, 404, { ok: false, code: "NOT_FOUND" }, corsHeaders);
  };

  const server = (tls ? https : http).createServer(tls ?? {}, (request, response) => {
    handler(request, response).catch(() => sendJson(response, 500, { ok: false, code: "INTERNAL_ERROR" }));
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}

export async function listenPrintGateway(server, config) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.bindHost, () => { server.removeListener("error", reject); resolve(); });
  });
}

export const createDirectBridgeServer = createPrintGatewayServer;
export const listenDirectBridge = (server, port) => listenPrintGateway(server, { port, bindHost: "127.0.0.1" });
