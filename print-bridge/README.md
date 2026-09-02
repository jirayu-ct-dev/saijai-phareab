# Saijai Print Bridge (PRN-04 Bridge MVP)

Zero-runtime-dependency Node 24 (ESM) local bridge for the Saijai Phareab print
system. It claims print jobs from the server, encodes them to ESC/POS bytes and
sends them to a network thermal printer (XP-C260M) over TCP.

No install step, no TypeScript build: plain `.mjs`/`.js` files with JSDoc.

## Run

```bash
cp print-bridge/config.example.json print-bridge/config.json
# edit print-bridge/config.json (see shape below)
chmod 600 print-bridge/config.json          # required: file holds the credential

node print-bridge/bin/bridge.mjs --config print-bridge/config.json
node print-bridge/bin/bridge.mjs --help      # usage, no connection is made
node print-bridge/bin/bridge.mjs --version   # version string sent in heartbeats
```

## Config shape (`--config <path>`, default `./config.json`)

```json
{
  "baseUrl": "https://your-saijai-host",     // server base URL
  "printerId": "printer_xxx",                // printer registered server-side
  "bridgeCredential": "<from admin settings>", // bearer token, stays local
  "pollIntervalMs": 15000,                   // claim poll interval (default 15000)
  "heartbeatIntervalMs": 60000,              // optional, default 60000
  "tcpTimeoutMs": 10000,                     // optional connect/write timeout
  "outboxPath": "./print-bridge-outbox.jsonl", // durable outbox file
  "tcpTarget": { "host": "192.168.1.50", "port": 9100 }
}
```

All fields except `heartbeatIntervalMs`, `tcpTimeoutMs` and `pollIntervalMs`
(default 15000) are required.

## Server contract (frozen PRN-04)

Every call uses `Authorization: Bearer <bridgeCredential>` and JSON bodies.

- `POST /api/admin/print-bridge/heartbeat` — `{printerId, bridgeVersion}` →
  `{ok: true, serverTime}`
- `POST /api/admin/print-bridge/claim` — `{printerId, maxJobs?}` →
  `{jobs: [{jobId, leaseToken, fencingToken, leaseExpiresAt, kind, documentNo,
  document, operations, snapshotHash, renderVersion}]}` (empty array when idle)
- `POST /api/admin/print-bridge/events` — `{printerId, events: [{jobId,
  leaseToken, fencingToken, type, failureCode?, failureMessageSafe?}]}` →
  `{results: [{jobId, accepted, reason?}]}` with event types
  `RENDERING | READY | SENDING | SENT | ACKNOWLEDGED | FAILED | NEEDS_REVIEW`

## Job pipeline and crash safety (C8 lease/fencing)

Per claimed job: report `RENDERING` → encode operations to ESC/POS bytes
(injected `encodeOperations`, default binds the repo's
`shared/utils/escpos.ts`) → report `READY` → TCP connect → report `SENDING`
(best-effort) → write bytes → report `SENT`.

- Every event carries the claim's `leaseToken` + `fencingToken`. The server
  rejects stale fencing with `accepted: false`; the bridge then drops the job
  locally and never retries it.
- Failure **before any byte was written** (connect refused, render error,
  known-zero-byte write error) → `FAILED` with a safe code
  (`FAILED_OFFLINE` / `FAILED_TIMEOUT` / `FAILED_DEVICE` / `FAILED_RENDER`),
  then a bounded local retry with exponential-ish backoff (`attempts`,
  max 3 attempts, then `NEEDS_REVIEW`).
- Failure **after bytes were written — or with unknown progress** (hang/timeout
  mid-write, crash before `SENT` was confirmed) → `NEEDS_REVIEW` and stop.
  A possibly-printed job is never silently retried.
- Durable outbox (`outboxPath`): append-only JSON lines, `fsync` after every
  append, one record per state change
  (`{jobId, attempts, state, leaseToken, fencingToken, lastEventAt, bytesWritten,
  sentReported, nextAttemptAt}`). On restart the bridge replays the file:
  bytes-written-without-`SENT` is re-reported as `NEEDS_REVIEW`; mid-pipeline
  jobs without bytes are re-claimed later with attempts preserved.

## Concurrency

One send loop per printer, guarded by a per-printer mutex
(`Map` keyed by `printerId`; overlapping sends are rejected). Shutdown on
`SIGINT`/`SIGTERM` finishes the in-flight job (including its write and `SENT`
report), flushes the outbox and exits.

## Security notes

- The bridge credential lives only in the local config file and the
  `Authorization` header. It is **never logged**: all log lines pass through a
  redaction filter before hitting stderr.
- The loader refuses a config file readable by group/others on posix systems
  (mode check); keep it `0600`.
- The printer's host/port stay on this machine: they are read from local config
  for the TCP transport and are **never sent to the server** in any event,
  heartbeat, or claim body.
- Log lines and failure reports carry only safe codes/messages — no raw device
  responses, stack traces, endpoints, or credentials.

## Layout

- `bin/bridge.mjs` — CLI entry (`--help`, `--version`, `--config`)
- `config.mjs` — config loader/validator (mode check, never logs values)
- `apiClient.mjs` — frozen bridge API client
- `runner.mjs` — claim/render/send/report pipeline + restart recovery
- `loop.mjs` — heartbeat + claim polling + graceful shutdown
- `outbox.mjs` — fsync'd JSON-lines durable outbox
- `mutex.mjs` — per-printer send mutex
- `encoding.mjs` — default `encodeOperations` binding `shared/utils/escpos.ts`
- `transport/tcp.js` — verified TCP transport (`node:net`)
- `transport/fake.js` — in-memory transport used by the repo's Vitest tests

Tests live in `tests/server/printBridge*.test.ts` and run with the repo's
`pnpm exec vitest run tests/server/printBridge`.
